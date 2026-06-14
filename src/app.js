/* Road Trip Questions — app logic
   All state lives in localStorage. No network calls beyond fetching the
   bundled questions.json (which the service worker caches for offline use). */

(() => {
  'use strict';

  const CATEGORIES = {
    pnw:       'Pacific Northwest',
    animals:   'Animals & Nature',
    movies:    'Movies & TV',
    music:     'Music',
    food:      'Food',
    sports:    'Sports',
    science:   'Science & Space',
    history:   'History',
    geography: 'Geography',
    kids:      'Kid Classics',
    otdb:      'Downloaded',
  };

  const OPEN_CATEGORIES = {
    silly:  'Silly & Imagination',
    wyr:    'Would You Rather',
    family: 'Family & Us',
    know:   'Get to Know You',
    deep:   'Big Questions',
  };

  const KEYS = {
    settings: 'rtq_settings',
    weights:  'rtq_weights',
    seen:     'rtq_seen',
    skipped:  'rtq_skipped',
    imported: 'rtq_imported',
    packs:    'rtq_packs',
  };

  // Hearts nudge weights up, skips nudge them down — bounded so one grumpy
  // streak can't zero out a category.
  const W = { catUp: 0.20, catDown: 0.15, catMin: 0.2, catMax: 3.0 };

  const FOR_PLAYER_CHANCE = 0.25; // chance a trivia draw targets an older player

  // ---------- storage ----------

  const load = (key, fallback) => {
    try {
      const raw = localStorage.getItem(key);
      return raw === null ? fallback : JSON.parse(raw);
    } catch { return fallback; }
  };
  const save = (key, value) => localStorage.setItem(key, JSON.stringify(value));

  const defaultSettings = () => ({
    mode: 'trivia',
    players: [],
    categories: Object.fromEntries(Object.keys(CATEGORIES).map(c => [c, true])),
    openCategories: Object.fromEntries(Object.keys(OPEN_CATEGORIES).map(c => [c, true])),
    roundLength: 25,
  });

  const defaultWeights = () => ({
    categories: Object.fromEntries(
      [...Object.keys(CATEGORIES), ...Object.keys(OPEN_CATEGORIES)].map(c => [c, 1])),
  });

  let settings = load(KEYS.settings, null);
  let weights  = load(KEYS.weights, defaultWeights());
  let seen     = load(KEYS.seen, {});      // id -> true
  let skipped  = load(KEYS.skipped, {});   // id -> true, never shown again
  let imported = load(KEYS.imported, []);  // questions downloaded from OpenTDB
  let packs    = load(KEYS.packs, []);     // metadata per download batch

  let bundled = [];
  let questions = [];
  let byId = {};

  const rebuildBank = () => {
    questions = bundled.concat(imported);
    byId = Object.fromEntries(questions.map(q => [q.id, q]));
  };

  // round state (memory only)
  let round = { count: 0, current: null, revealed: false, forName: null, history: [] };

  // ---------- age bands ----------

  // With no players configured, everyone is treated as 16+ and no
  // "For: [name]" targeting happens.
  const bandFor = age => age >= 16 ? 16 : age >= 13 ? 13 : age >= 10 ? 10 : 7;
  const youngestBand = () => settings.players.length
    ? bandFor(Math.min(...settings.players.map(p => p.age))) : 16;
  const oldestBand   = () => settings.players.length
    ? bandFor(Math.max(...settings.players.map(p => p.age))) : 16;

  // ---------- selection engine ----------

  const eligible = q =>
    !skipped[q.id] &&
    (q.type === 'open'
      ? settings.openCategories[q.category]
      : settings.categories[q.category]);

  // Pool for the whole group (filtered to youngest player's band)
  const groupPool = (type, includeSeen) => {
    const band = youngestBand();
    return questions.filter(q =>
      q.type === type && q.age <= band && eligible(q) && (includeSeen || !seen[q.id]));
  };

  // Harder questions a subset of players qualifies for ("For: name")
  const targetedPool = includeSeen => {
    const lo = youngestBand(), hi = oldestBand();
    if (hi <= lo) return [];
    return questions.filter(q =>
      q.type === 'trivia' && q.age > lo && q.age <= hi && eligible(q) &&
      (includeSeen || !seen[q.id]));
  };

  const weightedPickCategory = pool => {
    const counts = {};
    for (const q of pool) counts[q.category] = (counts[q.category] || 0) + 1;
    const cats = Object.keys(counts);
    const total = cats.reduce((s, c) => s + (weights.categories[c] || 1), 0);
    let roll = Math.random() * total;
    for (const c of cats) {
      roll -= (weights.categories[c] || 1);
      if (roll <= 0) return c;
    }
    return cats[cats.length - 1];
  };

  // every question has a category now, so hearts and skips shape
  // Car Talk rounds the same way they shape trivia
  const pickFrom = pool => {
    if (pool.length === 0) return null;
    const cat = weightedPickCategory(pool);
    const inCat = pool.filter(q => q.category === cat);
    return inCat[Math.floor(Math.random() * inCat.length)];
  };

  // When everything eligible has been seen, forget seen-status for that slice
  // so long trips keep going. Skipped questions stay gone.
  const resetSeenFor = ids => {
    for (const id of ids) delete seen[id];
    save(KEYS.seen, seen);
  };

  const nextQuestion = () => {
    let type = settings.mode;
    let forName = null;
    let q = null;

    if (type === 'trivia' && Math.random() < FOR_PLAYER_CHANCE) {
      let pool = targetedPool(false);
      if (pool.length === 0 && targetedPool(true).length > 0) {
        resetSeenFor(targetedPool(true).map(x => x.id));
        pool = targetedPool(false);
      }
      q = pickFrom(pool);
      if (q) {
        const qualifying = settings.players.filter(p => bandFor(p.age) >= q.age);
        forName = qualifying[Math.floor(Math.random() * qualifying.length)].name;
      }
    }

    if (!q) {
      let pool = groupPool(type, false);
      if (pool.length === 0) {
        const fullPool = groupPool(type, true);
        if (fullPool.length === 0) return null; // every eligible question skipped
        resetSeenFor(fullPool.map(x => x.id));
        pool = groupPool(type, false);
      }
      q = pickFrom(pool);
    }

    if (q) {
      seen[q.id] = true;
      save(KEYS.seen, seen);
      // store history for back button (max 20)
      round.history.push({ q, forName });
      if (round.history.length > 20) round.history.shift();
    }
    round.current = q;
    round.forName = forName;
    round.revealed = false;
    return q;
  };

  const goBack = () => {
    if (round.history.length < 2) return; // need at least 2 to go back (current + previous)
    round.history.pop(); // remove current
    const prev = round.history.pop();
    round.current = prev.q;
    round.forName = prev.forName;
    round.revealed = false;
    round.count = Math.max(0, round.count - 1);
    renderQuestion();
  };

  // ---------- preference weighting ----------

  const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

  const adjustWeights = (q, liked) => {
    const w = weights.categories[q.category] || 1;
    weights.categories[q.category] = clamp(
      w + (liked ? W.catUp : -W.catDown), W.catMin, W.catMax);
    save(KEYS.weights, weights);
  };

  // ---------- question downloads ----------
  // Downloads trivia from free sources (Open Trivia DB or The Trivia API) and
  // stores it on-device, so anything grabbed while online plays offline forever.

  const OTDB_AGE = { easy: 10, medium: 13, hard: 16 };

  const SOURCE_LABEL = { otdb: 'Open Trivia DB', tta: 'The Trivia API' };

  const TRIVIA_API_CATS = {
    general_knowledge: 'General Knowledge',
    music: 'Music',
    sport_and_leisure: 'Sport & Leisure',
    film_and_tv: 'Film & TV',
    arts_and_literature: 'Arts & Literature',
    history: 'History',
    society_and_culture: 'Society & Culture',
    science: 'Science',
    geography: 'Geography',
    food_and_drink: 'Food & Drink',
  };

  const normText = s => s.toLowerCase().replace(/[^a-z0-9]/g, '');

  const textHash = s => {
    let h = 5381;
    for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) >>> 0;
    return h.toString(36);
  };

  const shuffle = arr => {
    const a = [...arr];
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  };

  let otdbCats = null; // cached OpenTDB category list

  const loadOtdbCategories = async () => {
    if (otdbCats) return otdbCats;
    try {
      const res = await fetch('https://opentdb.com/api_category.php');
      const data = await res.json();
      otdbCats = data.trivia_categories;
    } catch {
      otdbCats = []; // offline — only "Any category" available
    }
    return otdbCats;
  };

  // Repopulate the category dropdown for the selected source.
  const populateCategories = async () => {
    const source = $('otdb-source').value;
    const select = $('otdb-category');
    select.innerHTML = '<option value="">Any category</option>';
    const entries = source === 'tta'
      ? Object.entries(TRIVIA_API_CATS)
      : (await loadOtdbCategories()).map(c => [String(c.id), c.name]);
    for (const [value, label] of entries) {
      const opt = document.createElement('option');
      opt.value = value;
      opt.textContent = label;
      select.appendChild(opt);
    }
  };

  const otdbStatus = (msg, isError) => {
    const el = $('otdb-status');
    el.hidden = false;
    el.textContent = msg;
    el.classList.toggle('error', !!isError);
  };

  const fmtDate = ts => new Date(ts).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });

  const deletePack = packId => {
    imported = imported.filter(q => q.packId !== packId);
    packs = packs.filter(p => p.id !== packId);
    save(KEYS.imported, imported);
    save(KEYS.packs, packs);
    rebuildBank();
    updateOtdbControls();
  };

  const updateOtdbControls = () => {
    const list = $('otdb-packs');
    list.innerHTML = '';
    for (const p of [...packs].reverse()) {
      const row = document.createElement('div');
      row.className = 'pack-row';
      const info = document.createElement('div');
      info.className = 'pack-info';
      const label = document.createElement('div');
      label.className = 'pack-label';
      label.textContent = p.difficulty && p.difficulty !== 'Any difficulty'
        ? `${p.label} · ${p.difficulty}` : p.label;
      const meta = document.createElement('div');
      meta.className = 'pack-meta';
      const src = SOURCE_LABEL[p.source] ? ` · ${SOURCE_LABEL[p.source]}` : '';
      meta.textContent = `${p.count} question${p.count === 1 ? '' : 's'}${src} · ${fmtDate(p.downloadedAt)}`;
      info.append(label, meta);
      const del = document.createElement('button');
      del.className = 'pack-del';
      del.setAttribute('aria-label', `Delete ${p.label} pack`);
      del.textContent = '✕';
      del.addEventListener('click', () => deletePack(p.id));
      row.append(info, del);
      list.appendChild(row);
    }
    $('btn-otdb-clear').hidden = imported.length === 0;
    if (imported.length > 0) {
      otdbStatus(`${imported.length} downloaded question${imported.length === 1 ? '' : 's'} in your offline bank.`);
    } else {
      $('otdb-status').hidden = true;
    }
  };

  // Each fetcher returns { items: [{q,a,choices,catLabel,age}] } or
  // { rateLimited } / { empty }, so the shared importer treats both alike.
  const fetchOtdb = async (cat, diff, amount) => {
    const params = new URLSearchParams({ amount, encode: 'url3986' });
    if (cat) params.set('category', cat);
    if (diff) params.set('difficulty', diff);
    const data = await (await fetch('https://opentdb.com/api.php?' + params)).json();
    if (data.response_code === 5) return { rateLimited: true };
    if (data.response_code !== 0 || !data.results.length) return { empty: true };
    return { items: data.results.map(r => {
      const correct = decodeURIComponent(r.correct_answer);
      return {
        q: decodeURIComponent(r.question),
        a: correct,
        choices: shuffle([correct, ...r.incorrect_answers.map(decodeURIComponent)]),
        catLabel: decodeURIComponent(r.category),
        age: OTDB_AGE[r.difficulty] || 13,
      };
    }) };
  };

  const fetchTriviaApi = async (cat, diff, amount) => {
    const params = new URLSearchParams({ limit: amount });
    if (cat) params.set('categories', cat);
    if (diff) params.set('difficulties', diff);
    const res = await fetch('https://the-trivia-api.com/v2/questions?' + params);
    if (!res.ok) return { empty: true };
    const data = await res.json();
    if (!Array.isArray(data) || !data.length) return { empty: true };
    return { items: data.map(r => {
      const qText = typeof r.question === 'string' ? r.question : r.question.text;
      return {
        q: qText,
        a: r.correctAnswer,
        choices: shuffle([r.correctAnswer, ...r.incorrectAnswers]),
        catLabel: TRIVIA_API_CATS[r.category] || 'Trivia',
        age: OTDB_AGE[r.difficulty] || 13,
      };
    }) };
  };

  const importFromSource = async () => {
    const btn = $('btn-otdb');
    btn.disabled = true;
    otdbStatus('Downloading…');
    try {
      const source = $('otdb-source').value;
      const cat = $('otdb-category').value;
      const diff = $('otdb-difficulty').value;
      const amount = $('otdb-amount').value;

      const result = source === 'tta'
        ? await fetchTriviaApi(cat, diff, amount)
        : await fetchOtdb(cat, diff, amount);

      if (result.rateLimited) {
        otdbStatus('The trivia service is rate-limited — wait a few seconds and try again.', true);
        return;
      }
      if (result.empty || !result.items || !result.items.length) {
        otdbStatus('Not enough questions for that combination — try a different category or difficulty.', true);
        return;
      }

      const catLabel = cat ? $('otdb-category').selectedOptions[0].textContent : 'Any category';
      const diffLabel = diff ? diff[0].toUpperCase() + diff.slice(1) : 'Any difficulty';
      const packId = 'pk-' + Date.now().toString(36);

      const known = new Set(questions.map(q => normText(q.q)));
      let added = 0, dupes = 0;
      for (const it of result.items) {
        if (!it.q || known.has(normText(it.q))) { dupes++; continue; }
        known.add(normText(it.q));
        imported.push({
          id: 'dl-' + textHash(it.q),
          packId,
          source,
          type: 'trivia',
          category: 'otdb',
          catLabel: it.catLabel,
          age: it.age,
          q: it.q,
          a: it.a,
          choices: it.choices,
        });
        added++;
      }
      if (added > 0) {
        packs.push({ id: packId, source, label: catLabel, difficulty: diffLabel,
                     downloadedAt: Date.now(), count: added });
        save(KEYS.packs, packs);
      }
      save(KEYS.imported, imported);
      rebuildBank();
      updateOtdbControls();
      otdbStatus(`Added ${added} new questions${dupes ? ` (${dupes} you already had)` : ''}. Total downloaded: ${imported.length}.`);
    } catch {
      otdbStatus('Couldn’t reach the trivia service — check your connection.', true);
    } finally {
      btn.disabled = false;
    }
  };

  // ---------- elements ----------

  const $ = id => document.getElementById(id);
  const screens = {
    splash:    $('screen-splash'),
    readiness: $('screen-readiness'),
    help:      $('screen-help'),
    setup:     $('screen-setup'),
    play:      $('screen-play'),
    done:      $('screen-done'),
  };

  const show = name => {
    for (const [key, el] of Object.entries(screens)) el.hidden = key !== name;
    window.scrollTo(0, 0);
  };

  // ---------- setup screen ----------

  const renderChipGrid = (gridId, hintId, labels, store, onChange) => {
    const grid = $(gridId);
    grid.innerHTML = '';
    for (const [key, label] of Object.entries(labels)) {
      const btn = document.createElement('button');
      btn.className = 'chip';
      const isSelected = store[key];
      btn.setAttribute('aria-pressed', String(isSelected));

      const content = document.createElement('span');
      content.className = 'chip-content';
      const text = document.createElement('span');
      text.textContent = label;
      content.appendChild(text);

      if (isSelected) {
        const checkmark = document.createElement('span');
        checkmark.className = 'chip-check';
        checkmark.textContent = '✓';
        content.insertBefore(checkmark, text);
      }

      btn.appendChild(content);
      btn.addEventListener('click', () => {
        store[key] = !store[key];
        btn.setAttribute('aria-pressed', String(store[key]));
        save(KEYS.settings, settings);
        renderChipGrid(gridId, hintId, labels, store, onChange);
        $(hintId).hidden = Object.values(store).some(Boolean);
        if (onChange) onChange();
      });
      grid.appendChild(btn);
    }
  };

  // Select-all / deselect-all toggle for the trivia categories.
  const updateSelectAllLabel = () => {
    const allOn = Object.keys(CATEGORIES).every(k => settings.categories[k]);
    $('cat-select-all').textContent = allOn ? 'Deselect all' : 'Select all';
  };
  $('cat-select-all').addEventListener('click', () => {
    const allOn = Object.keys(CATEGORIES).every(k => settings.categories[k]);
    for (const k of Object.keys(CATEGORIES)) settings.categories[k] = !allOn;
    save(KEYS.settings, settings);
    renderChipGrid('category-grid', 'category-hint', CATEGORIES, settings.categories, updateSelectAllLabel);
    updateSelectAllLabel();
    $('category-hint').hidden = Object.values(settings.categories).some(Boolean);
  });

  // Branch the setup: trivia gets categories + round length + downloads,
  // Car Talk gets its own categories and runs endless.
  const renderModeBlocks = () => {
    for (const card of document.querySelectorAll('.mode-card')) {
      card.setAttribute('aria-checked', String(card.dataset.mode === settings.mode));
    }
    const trivia = settings.mode === 'trivia';
    $('block-trivia-cats').hidden = !trivia;
    $('block-length').hidden = !trivia;
    $('block-otdb').hidden = !trivia;
    $('block-open-cats').hidden = trivia;
  };

  const renderSegmented = (containerId, attr, current, onPick) => {
    const container = $(containerId);
    for (const btn of container.querySelectorAll('button')) {
      const val = Number(btn.dataset[attr]);
      btn.setAttribute('aria-checked', String(val === current));
      btn.onclick = () => {
        onPick(val);
        renderSegmented(containerId, attr, val, onPick);
      };
    }
  };

  const renderSetup = () => {
    renderModeBlocks();
    renderChipGrid('category-grid', 'category-hint', CATEGORIES, settings.categories, updateSelectAllLabel);
    renderChipGrid('open-category-grid', 'open-category-hint', OPEN_CATEGORIES, settings.openCategories);
    updateSelectAllLabel();
    renderSegmented('length-control', 'length', settings.roundLength, v => {
      settings.roundLength = v; save(KEYS.settings, settings);
    });
    $('category-hint').hidden = true;
    $('open-category-hint').hidden = true;
    updateOtdbControls();
    populateCategories();
  };

  $('otdb-source').addEventListener('change', populateCategories);

  for (const card of document.querySelectorAll('.mode-card')) {
    card.addEventListener('click', () => {
      settings.mode = card.dataset.mode;
      save(KEYS.settings, settings);
      renderModeBlocks();
    });
  }

  $('btn-otdb').addEventListener('click', importFromSource);

  $('btn-otdb-clear').addEventListener('click', () => {
    imported = [];
    packs = [];
    save(KEYS.imported, imported);
    save(KEYS.packs, packs);
    rebuildBank();
    updateOtdbControls();
    otdbStatus('Downloaded questions removed.');
  });

  $('btn-start').addEventListener('click', () => {
    if (settings.mode === 'trivia' && !Object.values(settings.categories).some(Boolean)) {
      $('category-hint').hidden = false;
      return;
    }
    if (settings.mode === 'open' && !Object.values(settings.openCategories).some(Boolean)) {
      $('open-category-hint').hidden = false;
      return;
    }
    startRound();
  });

  // ---------- play screen ----------

  // Bigger text for short questions, smaller for long ones, never tiny.
  // Multiple-choice questions cap lower so the choices fit on screen too.
  const fitQuestion = (text, hasChoices) => {
    const len = text.length;
    let px;
    if (len <= 50) px = 40;
    else if (len <= 90) px = 34;
    else if (len <= 140) px = 30;
    else px = 26;
    if (hasChoices) px = Math.min(px, 30);
    $('question-text').style.fontSize = px + 'px';
  };


  const renderQuestion = () => {
    const q = round.current;
    if (!q) return;
    $('category-pill').textContent = q.type === 'trivia'
      ? (q.catLabel || CATEGORIES[q.category])
      : OPEN_CATEGORIES[q.category];
    $('for-pill').hidden = !round.forName;
    if (round.forName) $('for-pill').textContent = `For: ${round.forName}`;
    $('question-text').textContent = q.q;
    fitQuestion(q.q, !!q.choices);
    const choicesEl = $('choices');
    choicesEl.innerHTML = '';
    choicesEl.hidden = !q.choices;
    if (q.choices) {
      for (const c of q.choices) {
        const btn = document.createElement('button');
        btn.className = 'choice';
        const txt = document.createElement('span');
        txt.className = 'choice-text';
        txt.textContent = c;
        const mark = document.createElement('span');
        mark.className = 'choice-mark';
        btn.append(txt, mark);
        btn.addEventListener('click', e => { e.stopPropagation(); pickChoice(c); });
        choicesEl.appendChild(btn);
      }
    }
    $('answer-text').hidden = true;
    $('answer-text').textContent = q.a || '';
    $('tap-hint').hidden = false;
    $('tap-hint').textContent =
      q.type !== 'trivia' ? 'Tap for next question'
      : q.choices ? 'Pick your answer'
      : 'Tap to reveal answer';
    // update back button visibility and progress
    const endless = settings.mode === 'open' || settings.roundLength === 0;
    $('btn-back').hidden = round.history.length < 2;
    $('progress-fill').style.width = endless
      ? '0%'
      : Math.round((round.count / settings.roundLength) * 100) + '%';
  };

  const advance = () => {
    if (settings.mode === 'trivia' && settings.roundLength !== 0 && round.count >= settings.roundLength) {
      $('done-count').textContent = `You made it through ${round.count} questions.`;
      show('done');
      return;
    }
    const q = nextQuestion();
    if (!q) {
      $('done-count').textContent = 'You’ve been through every question in the bank!';
      show('done');
      return;
    }
    round.count += 1;
    renderQuestion();
  };

  const startRound = () => {
    round = { count: 0, current: null, revealed: false, forName: null, history: [] };
    show('play');
    advance();
  };

  // Multiple choice: tap a choice to answer. Right = ✓; wrong = ✗ on your pick
  // plus ✓ on the correct one. Then tap anywhere to continue.
  const pickChoice = chosen => {
    const q = round.current;
    if (!q || round.revealed) return;
    round.revealed = true;
    for (const btn of $('choices').children) {
      const val = btn.querySelector('.choice-text').textContent;
      const mark = btn.querySelector('.choice-mark');
      if (val === q.a) { btn.classList.add('correct'); mark.textContent = '✓'; }
      else if (val === chosen) { btn.classList.add('wrong'); mark.textContent = '✗'; }
      btn.disabled = true;
    }
    $('tap-hint').textContent = 'Tap for next question';
  };

  // Tapping the screen: single-answer reveals the answer then advances;
  // Car Talk advances; multiple-choice does nothing until a choice is picked.
  $('question-area').addEventListener('click', () => {
    const q = round.current;
    if (!q) return;
    if (q.type !== 'trivia') { advance(); return; }
    if (round.revealed) { advance(); return; }
    if (q.choices) return;   // must tap a choice
    round.revealed = true;
    $('answer-text').hidden = false;
    $('tap-hint').textContent = 'Tap for next question';
  });
  $('question-area').addEventListener('keydown', e => {
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); $('question-area').click(); }
  });

  $('btn-skip').addEventListener('click', () => {
    const q = round.current;
    if (!q) return;
    skipped[q.id] = true;
    save(KEYS.skipped, skipped);
    adjustWeights(q, false);
    round.count -= 1; // skips don't count against the round
    advance();
  });

  $('btn-home').addEventListener('click', () => {
    renderSetup();
    show('setup');
  });

  $('btn-back').addEventListener('click', goBack);

  // ---------- done screen ----------

  $('btn-again').addEventListener('click', startRound);
  $('btn-done-setup').addEventListener('click', () => {
    renderSetup();
    show('setup');
  });

  // ---------- boot ----------

  const boot = async () => {
    const res = await fetch('questions.json');
    const data = await res.json();
    bundled = data.questions;
    rebuildBank();

    // migrate older saved settings (pre-mode, pre-openCategories)
    const firstLaunch = !settings;
    settings = settings || defaultSettings();
    if (!settings.mode) settings.mode = 'trivia';
    if (!settings.players) settings.players = [];
    if (!settings.openCategories) {
      settings.openCategories = defaultSettings().openCategories;
    }
    for (const key of Object.keys(CATEGORIES)) {
      if (!(key in settings.categories)) settings.categories[key] = true;
    }
    void firstLaunch;

    // migrate pre-pack downloads into one legacy pack so they're manageable
    const orphans = imported.filter(q => !q.packId);
    if (orphans.length) {
      const legacyId = 'pk-legacy';
      for (const q of orphans) q.packId = legacyId;
      if (!packs.some(p => p.id === legacyId)) {
        packs.push({ id: legacyId, label: 'Earlier downloads', difficulty: 'Mixed',
                     downloadedAt: Date.now(), count: orphans.length });
      }
      save(KEYS.imported, imported);
      save(KEYS.packs, packs);
    }

    renderSetup();
    routeEntry();
  };

  // ---------- entry routing ----------

  const isStandalone = () =>
    matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;

  const goToSetup = () => { renderSetup(); show('setup'); };

  // Installed/standalone users land on readiness; everyone else sees the welcome.
  const routeEntry = () => {
    if (isStandalone()) { renderReadiness(); show('readiness'); }
    else show('splash');
  };

  // Welcome
  $('btn-play-now').addEventListener('click', goToSetup);

  // Help screen — reached from setup; returns there
  let helpReturnTo = 'setup';
  const openHelp = from => { helpReturnTo = from; show('help'); window.scrollTo(0, 0); };
  const closeHelp = () => show(helpReturnTo);
  $('btn-setup-help').addEventListener('click', () => openHelp('setup'));
  $('btn-help-back').addEventListener('click', closeHelp);
  $('btn-help-done').addEventListener('click', closeHelp);

  // Readiness
  const renderReadiness = () => {
    const hasExtra = imported.length > 0;
    const extra = $('check-extra');
    extra.classList.toggle('done', hasExtra);
    extra.querySelector('.check-mark').textContent = hasExtra ? '✓' : '○';
    const status = $('readiness-status');
    status.textContent = navigator.onLine
      ? 'Ready for offline play. Download more questions for extra variety.'
      : 'You’re offline — playing from your downloaded and built-in questions.';
    status.classList.toggle('offline', !navigator.onLine);
  };
  $('btn-readiness-play').addEventListener('click', goToSetup);
  $('btn-readiness-download').addEventListener('click', () => {
    settings.mode = 'trivia'; save(KEYS.settings, settings);
    goToSetup();
    $('block-otdb').scrollIntoView({ behavior: 'smooth', block: 'center' });
  });
  window.addEventListener('online', () => { if (!$('screen-readiness').hidden) renderReadiness(); });
  window.addEventListener('offline', () => { if (!$('screen-readiness').hidden) renderReadiness(); });

  // ---------- service worker + update banner ----------
  if ('serviceWorker' in navigator) {
    const hadController = !!navigator.serviceWorker.controller;
    navigator.serviceWorker.register('sw.js');
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      // only when a previous version was already running → it's an update, not first install
      if (hadController) $('update-banner').hidden = false;
    });
  }
  $('btn-update-refresh').addEventListener('click', () => location.reload());

  boot();
})();
