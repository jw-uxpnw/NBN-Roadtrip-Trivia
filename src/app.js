/* Road Trip Questions — app logic
   All state lives in localStorage. No network calls beyond fetching the
   bundled questions.json (which the service worker caches for offline use). */

(() => {
  'use strict';

  const CATEGORIES = {
    pnw:        'Pacific Northwest',
    animals:    'Animals & Nature',
    movies:     'Movies & TV',
    music:      'Music',
    food:       'Food',
    sports:     'Sports',
    science:    'Science & Space',
    history:    'History',
    geography:  'Geography',
    kids:       'Kid Classics',
    general:    'General Knowledge',
    film:       'Film & TV',
    arts:       'Arts & Literature',
    culture:    'Society & Culture',
    mythology:  'Mythology',
    books:      'Books',
    videogames: 'Video Games',
    computers:  'Computers',
    cartoons:   'Cartoons',
    math:       'Math',
  };

  // Categories that need live fetching the first time they're selected.
  // tta: TTA slug (or null), otdb: OTDB category ID string (or null).
  const FETCHABLE_CATS = {
    general:    { tta: 'general_knowledge',   otdb: '9'  },
    film:       { tta: 'film_and_tv',         otdb: '11' },
    arts:       { tta: 'arts_and_literature', otdb: null },
    culture:    { tta: 'society_and_culture', otdb: '22' },
    mythology:  { tta: null,                  otdb: '20' },
    books:      { tta: null,                  otdb: '10' },
    videogames: { tta: null,                  otdb: '15' },
    computers:  { tta: null,                  otdb: '18' },
    cartoons:   { tta: null,                  otdb: '32' },
    math:       { tta: null,                  otdb: '19' },
  };

  const OPEN_CATEGORIES = {
    silly:  'Silly & Imagination',
    wyr:    'Would You Rather',
    family: 'Family & Us',
    know:   'Get to Know You',
    deep:   'Big Questions',
  };

  const OPEN_CATEGORY_META = {
    silly:  { img: 'assets/Silly%20-%20Imagination.png', desc: 'Weird hypotheticals. Impossible scenarios. No wrong answers, just chaos.' },
    wyr:    { img: 'assets/Would%20You%20Rather.png',    desc: 'Two choices. Both questionable. Go.' },
    family: { img: 'assets/Family%20-%20Us.png',         desc: 'Questions about your crew — funny, sweet, possibly embarrassing.' },
    know:   { img: 'assets/Get%20to%20Know%20You.png',   desc: "You've been in this car for hours. Time to actually learn something." },
    deep:   { img: 'assets/Big%20Questions.png',         desc: 'Heavy stuff. Save these for the long stretches of highway.' },
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
    categories: Object.fromEntries(Object.keys(CATEGORIES).map(c => [c, false])),
    openCategories: Object.fromEntries(Object.keys(OPEN_CATEGORIES).map(c => [c, false])),
    roundLength: null,
    difficulty: '',
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

  // Active category overrides for Surprise Me — set before startRound, cleared after.
  // When non-null, these override settings.categories / settings.openCategories for
  // the duration of the round without persisting to localStorage.
  let activeCategories = null;
  let activeOpenCategories = null;

  // ---------- age bands ----------

  // With no players configured, everyone is treated as 16+ and no
  // "For: [name]" targeting happens.
  const bandFor = age => age >= 16 ? 16 : age >= 13 ? 13 : age >= 10 ? 10 : 7;
  const youngestBand = () => settings.players.length
    ? bandFor(Math.min(...settings.players.map(p => p.age))) : 16;
  const oldestBand   = () => settings.players.length
    ? bandFor(Math.max(...settings.players.map(p => p.age))) : 16;

  // ---------- selection engine ----------

  // Map difficulty setting → minimum age band for bundled trivia questions.
  const diffAge = { easy: 0, medium: 13, hard: 16 };
  const diffMatchesBand = (age, diff) => {
    if (!diff) return true;
    if (diff === 'easy') return age <= 10;
    return age >= (diffAge[diff] || 0);
  };

  const eligible = q =>
    !skipped[q.id] &&
    (q.type === 'open'
      ? (activeOpenCategories || settings.openCategories)[q.category]
      : (activeCategories || settings.categories)[q.category] &&
        diffMatchesBand(q.age, settings.difficulty));

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

  const getSelectedSource = () => 'tta';

  const initSourceCards = () => {};

  // Populate the category dropdown by merging TTA (instant) + OTDB (async).
  // Option values are encoded as "tta:key" or "otdb:id" so importFromSource
  // knows which fetcher to try first without a source selector UI.
  const populateCategories = async () => {
    const select = $('otdb-category');
    select.innerHTML = '<option value="">Any category</option>';

    // TTA categories — hardcoded, always available
    const ttaLabels = new Set();
    for (const [key, label] of Object.entries(TRIVIA_API_CATS)) {
      const opt = document.createElement('option');
      opt.value = 'tta:' + key;
      opt.textContent = label;
      select.appendChild(opt);
      ttaLabels.add(label.toLowerCase());
    }

    // OTDB categories — async, de-duplicated against TTA by label
    try {
      const cats = await loadOtdbCategories();
      for (const c of cats) {
        if (ttaLabels.has(c.name.toLowerCase())) continue;
        const opt = document.createElement('option');
        opt.value = 'otdb:' + c.id;
        opt.textContent = c.name;
        select.appendChild(opt);
      }
    } catch { /* offline — TTA list is enough */ }
  };

  const otdbStatus = (msg, isError) => {
    const el = $('otdb-status');
    if (!el) return;
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
    if (!list) return;
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
      otdbStatus(`${imported.length} added question${imported.length === 1 ? '' : 's'} in your offline bank.`);
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

  // Try one fetcher; catch network errors so the caller can fall back.
  const tryFetch = async (source, cat, diff, amount) => {
    try {
      return source === 'tta'
        ? await fetchTriviaApi(cat, diff, amount)
        : await fetchOtdb(cat, diff, amount);
    } catch { return { error: true }; }
  };

  // Silently fetch questions for a FETCHABLE_CATS category on Start.
  // Stores them with category = key so eligible() treats them like bundled ones.
  const autoFetchCategory = async key => {
    const cfg  = FETCHABLE_CATS[key];
    const diff = settings.difficulty || '';
    const amount = settings.roundLength > 0 ? settings.roundLength : 25;

    let result = { items: [] };
    if (cfg.tta)  result = await tryFetch('tta',  cfg.tta,  diff, amount);
    if (!result.items?.length && cfg.otdb) result = await tryFetch('otdb', cfg.otdb, diff, amount);
    if (!result.items?.length) return 0;

    const packId = 'pk-' + key + '-' + Date.now().toString(36);
    const known  = new Set(questions.map(q => normText(q.q)));
    let added = 0;

    for (const it of result.items) {
      if (!it.q || known.has(normText(it.q))) continue;
      known.add(normText(it.q));
      imported.push({
        id:       'dl-' + textHash(it.q),
        packId,
        source:   'auto',
        type:     'trivia',
        category: key,
        catLabel: it.catLabel,
        age:      it.age,
        q:        it.q,
        a:        it.a,
        choices:  it.choices,
      });
      added++;
    }

    if (added > 0) { save(KEYS.imported, imported); rebuildBank(); }
    return added;
  };

  const importFromSource = async () => {
    const btn = $('btn-otdb');
    btn.disabled = true;
    otdbStatus('Adding questions…');
    try {
      const optVal = $('otdb-category').value; // "tta:music", "otdb:12", or ""
      let primarySource = 'tta', primaryCat = '';
      if (optVal) {
        const colon = optVal.indexOf(':');
        primarySource = optVal.slice(0, colon);
        primaryCat   = optVal.slice(colon + 1);
      }
      const fallbackSource = primarySource === 'tta' ? 'otdb' : 'tta';

      const diff   = settings.difficulty || '';
      const amount = settings.roundLength > 0 ? settings.roundLength : 25;

      let result = await tryFetch(primarySource, primaryCat, diff, amount);
      let usedSource = primarySource;

      // If primary is unavailable, try the other source (no category filter)
      if (!result.items?.length && !result.rateLimited) {
        otdbStatus('Trying another source…');
        result = await tryFetch(fallbackSource, '', diff, amount);
        usedSource = fallbackSource;
      }

      if (result.rateLimited) {
        otdbStatus('Both trivia services are busy — wait a few seconds and try again.', true);
        return;
      }
      if (!result.items?.length) {
        otdbStatus('No questions found for that combination — try a different category.', true);
        return;
      }

      const catLabel = optVal ? $('otdb-category').selectedOptions[0].textContent : 'Any category';
      const diffLabel = diff ? diff[0].toUpperCase() + diff.slice(1) : 'Any difficulty';
      const packId = 'pk-' + Date.now().toString(36);

      const known = new Set(questions.map(q => normText(q.q)));
      let added = 0;
      for (const it of result.items) {
        if (!it.q || known.has(normText(it.q))) continue;
        known.add(normText(it.q));
        imported.push({
          id: 'dl-' + textHash(it.q),
          packId,
          source: usedSource,
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
        packs.push({ id: packId, source: usedSource, label: catLabel, difficulty: diffLabel,
                     downloadedAt: Date.now(), count: added });
        save(KEYS.packs, packs);
      }
      save(KEYS.imported, imported);
      rebuildBank();
      updateOtdbControls();
      otdbStatus(`Added ${added} questions to your offline bank.`);
    } catch {
      otdbStatus("Couldn't reach either trivia service — check your connection.", true);
    } finally {
      btn.disabled = false;
    }
  };

  // ---------- elements ----------

  const $ = id => document.getElementById(id);
  const screens = {
    splash:  $('screen-splash'),
    mode:    $('screen-mode'),
    cartalk: $('screen-cartalk'),
    help:    $('screen-help'),
    trivia:  $('screen-trivia'),
    play:    $('screen-play'),
    done:    $('screen-done'),
  };

  const show = name => {
    for (const [key, el] of Object.entries(screens)) el.hidden = key !== name;
    window.scrollTo(0, 0);
  };

  // ---------- Surprise Me ----------

  // Picks a random subset of keys (at least 1) using Math.random().
  const pickRandomSubset = keys => {
    let selected;
    do {
      selected = Object.fromEntries(keys.map(k => [k, Math.random() < 0.5]));
    } while (!Object.values(selected).some(Boolean));
    return selected;
  };

  // ---------- trivia setup screen ----------

  const renderChipGrid = (gridId, hintId, labels, store, onChange) => {
    const grid = $(gridId);
    grid.innerHTML = '';
    for (const [key, label] of Object.entries(labels)) {
      const btn = document.createElement('button');
      btn.className = 'chip';
      btn.setAttribute('aria-pressed', String(!!store[key]));

      // Checkmark is always in the DOM — visibility toggled via CSS on aria-pressed
      // so chips never change width when selected, preventing layout shift.
      const check = document.createElement('span');
      check.className = 'chip-check';
      check.setAttribute('aria-hidden', 'true');
      check.textContent = '✓';

      const text = document.createElement('span');
      text.textContent = label;

      btn.append(check, text);
      btn.addEventListener('click', () => {
        store[key] = !store[key];
        btn.setAttribute('aria-pressed', String(store[key]));
        save(KEYS.settings, settings);
        $(hintId).hidden = Object.values(store).some(Boolean);
        if (onChange) onChange();
      });
      grid.appendChild(btn);
    }
  };

  // ---------- wizard navigation ----------

  const showTriviaStep = n => {
    for (let i = 1; i <= 3; i++) $('trivia-step-' + i).hidden = i !== n;
    window.scrollTo(0, 0);
  };

  const showCartalkStep = n => {
    for (let i = 1; i <= 2; i++) $('cartalk-step-' + i).hidden = i !== n;
    window.scrollTo(0, 0);
  };

  const renderLengthCards = (gridId, currentLength) => {
    for (const btn of $(gridId).querySelectorAll('.length-card')) {
      btn.classList.toggle('length-card--selected', Number(btn.dataset.length) === currentLength);
    }
  };

  const renderTriviaSetup = () => {
    showTriviaStep(1);
    renderLengthCards('trivia-length-cards', null);
    renderChipGrid('category-grid', 'category-hint', CATEGORIES, settings.categories);
    $('category-hint').hidden = true;
    renderSegmentedStr('difficulty-control', 'difficulty', settings.difficulty || '', v => {
      settings.difficulty = v; save(KEYS.settings, settings);
    });
  };

  const renderOpenCatCards = () => {
    const grid = $('open-cat-cards');
    grid.innerHTML = '';
    for (const [key, label] of Object.entries(OPEN_CATEGORIES)) {
      const meta = OPEN_CATEGORY_META[key];
      const btn = document.createElement('button');
      btn.className = 'open-cat-card mode-card mode-card--large';
      btn.setAttribute('aria-pressed', String(!!settings.openCategories[key]));

      const img = document.createElement('img');
      img.className = 'mode-card-img';
      img.src = meta.img;
      img.alt = '';

      const text = document.createElement('span');
      text.className = 'mode-card-text';

      const title = document.createElement('span');
      title.className = 'mode-title';
      title.textContent = label;

      const sub = document.createElement('span');
      sub.className = 'mode-sub';
      sub.textContent = meta.desc;

      const check = document.createElement('span');
      check.className = 'open-cat-check';
      check.setAttribute('aria-hidden', 'true');
      check.textContent = '✓';

      text.append(title, sub);
      btn.append(img, text, check);

      btn.addEventListener('click', () => {
        settings.openCategories[key] = !settings.openCategories[key];
        btn.setAttribute('aria-pressed', String(settings.openCategories[key]));
        save(KEYS.settings, settings);
        $('btn-cartalk-start').disabled = !Object.values(settings.openCategories).some(Boolean);
      });

      grid.appendChild(btn);
    }
  };

  const renderCartalkSetup = () => {
    showCartalkStep(2);
    renderOpenCatCards();
    $('btn-cartalk-start').disabled = !Object.values(settings.openCategories).some(Boolean);
  };

  // Trivia: Select All / Clear All
  $('cat-select-all').addEventListener('click', () => {
    for (const k of Object.keys(CATEGORIES)) settings.categories[k] = true;
    save(KEYS.settings, settings);
    renderChipGrid('category-grid', 'category-hint', CATEGORIES, settings.categories);
    $('category-hint').hidden = true;
  });

  $('cat-clear-all').addEventListener('click', () => {
    for (const k of Object.keys(CATEGORIES)) settings.categories[k] = false;
    save(KEYS.settings, settings);
    renderChipGrid('category-grid', 'category-hint', CATEGORIES, settings.categories);
    $('category-hint').hidden = true;
  });

  initSourceCards();

  // Trivia wizard — length cards (step 1 → step 2)
  for (const btn of document.querySelectorAll('#trivia-length-cards .length-card')) {
    btn.addEventListener('click', () => {
      settings.roundLength = Number(btn.dataset.length);
      save(KEYS.settings, settings);
      renderLengthCards('trivia-length-cards', settings.roundLength);
      showTriviaStep(2);
    });
  }

  // Car Talk wizard — length cards (step 1 → step 2)
  for (const btn of document.querySelectorAll('#cartalk-length-cards .length-card')) {
    btn.addEventListener('click', () => {
      settings.roundLength = Number(btn.dataset.length);
      save(KEYS.settings, settings);
      renderLengthCards('cartalk-length-cards', settings.roundLength);
      showCartalkStep(2);
    });
  }

  // Trivia back navigation
  $('btn-trivia-back-1').addEventListener('click', () => showTriviaStep(1));
  $('btn-trivia-back-2').addEventListener('click', () => showTriviaStep(2));


  // Trivia: step 2 → step 3
  $('btn-trivia-next-2').addEventListener('click', () => {
    if (!Object.values(settings.categories).some(Boolean)) {
      $('category-hint').hidden = false;
      return;
    }
    showTriviaStep(3);
  });

  // Trivia Start (step 3) — auto-fetches any selected fetchable categories not yet cached
  $('btn-start').addEventListener('click', async () => {
    const needsFetch = Object.keys(FETCHABLE_CATS).filter(key =>
      settings.categories[key] && !imported.some(q => q.category === key)
    );

    if (needsFetch.length > 0) {
      if (!navigator.onLine) {
        // Drop uncached fetchable categories so the round can still start
        for (const key of needsFetch) settings.categories[key] = false;
        save(KEYS.settings, settings);
        if (!Object.values(settings.categories).some(Boolean)) {
          renderChipGrid('category-grid', 'category-hint', CATEGORIES, settings.categories);
          $('category-hint').hidden = false;
          showTriviaStep(2);
          return;
        }
      } else {
        const btn = $('btn-start');
        btn.textContent = 'Getting your questions ready…';
        btn.disabled = true;
        for (const key of needsFetch) await autoFetchCategory(key);
        btn.textContent = 'Start';
        btn.disabled = false;
      }
    }

    activeCategories = null;
    activeOpenCategories = null;
    startRound();
  });

  // Car Talk Start (step 2)
  $('btn-cartalk-start').addEventListener('click', () => {
    activeCategories = null;
    activeOpenCategories = null;
    startRound();
  });

  // Mode selection cards
  $('mode-card-trivia').addEventListener('click', () => {
    settings.mode = 'trivia';
    save(KEYS.settings, settings);
    renderTriviaSetup();
    show('trivia');
  });

  $('mode-card-open').addEventListener('click', () => {
    settings.mode = 'open';
    save(KEYS.settings, settings);
    renderCartalkSetup();
    show('cartalk');
  });

  // Home buttons on setup screens
  $('btn-cartalk-home').addEventListener('click', () => show('mode'));
  $('btn-trivia-home').addEventListener('click', () => show('mode'));

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
    const catImg = $('cat-img');
    if (q.type === 'open' && OPEN_CATEGORY_META[q.category]) {
      catImg.src = OPEN_CATEGORY_META[q.category].img;
      catImg.hidden = false;
    } else {
      catImg.hidden = true;
    }
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
    const revealBtn = $('btn-show-answer');
    revealBtn.textContent = q.type !== 'trivia' ? 'Next' : 'Show Me the Answer';
    revealBtn.hidden = !!(q.choices && q.type === 'trivia');
    revealBtn.disabled = false;
    $('btn-prev').disabled = round.history.length < 2;
    const endless = settings.roundLength === 0;
    $('progress-fill').style.width = endless
      ? '0%'
      : Math.round((round.count / settings.roundLength) * 100) + '%';
  };

  const advance = () => {
    if (settings.roundLength !== 0 && settings.roundLength !== null && round.count >= settings.roundLength) {
      $('done-count').textContent = `You made it through ${round.count} questions.`;
      show('done');
      return;
    }
    const q = nextQuestion();
    if (!q) {
      $('done-count').textContent = "You've been through every question in the bank!";
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
    $('btn-show-answer').textContent = 'Next Question';
    $('btn-show-answer').hidden = false;
    $('btn-show-answer').disabled = false;
  };

  $('btn-show-answer').addEventListener('click', () => {
    const q = round.current;
    if (!q) return;
    if (q.type !== 'trivia') { advance(); return; }
    if (round.revealed) { advance(); return; }
    if (q.choices) return;
    round.revealed = true;
    $('answer-text').hidden = false;
    $('btn-show-answer').textContent = 'Next Question';
  });

  $('btn-prev').addEventListener('click', goBack);

  $('btn-skip').addEventListener('click', () => {
    const q = round.current;
    if (!q) return;
    skipped[q.id] = true;
    save(KEYS.skipped, skipped);
    adjustWeights(q, false);
    round.count -= 1; // skips don't count against the round
    advance();
  });

  $('btn-home').addEventListener('click', () => show('mode'));

  // ---------- done screen ----------

  $('btn-again').addEventListener('click', startRound);
  $('btn-done-setup').addEventListener('click', () => show('mode'));

  // ---------- segmented control ----------

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

  const renderSegmentedStr = (containerId, attr, current, onPick) => {
    const container = $(containerId);
    for (const btn of container.querySelectorAll('button')) {
      const val = btn.dataset[attr];
      btn.setAttribute('aria-checked', String(val === current));
      btn.onclick = () => {
        onPick(val);
        renderSegmentedStr(containerId, attr, val, onPick);
      };
    }
  };

  // ---------- help screen ----------

  let helpReturnTo = 'trivia';
  const openHelp = from => { helpReturnTo = from; show('help'); window.scrollTo(0, 0); };
  const closeHelp = () => show(helpReturnTo);
  $('btn-setup-help').addEventListener('click', () => openHelp('trivia'));
  $('btn-cartalk-help').addEventListener('click', () => openHelp('cartalk'));
  $('btn-help-back').addEventListener('click', closeHelp);
  $('btn-help-done').addEventListener('click', closeHelp);

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

  // ---------- boot ----------

  const boot = async () => {
    const res = await fetch('questions.json');
    const data = await res.json();
    bundled = data.questions;
    rebuildBank();

    // migrate older saved settings (pre-mode, pre-openCategories)
    settings = settings || defaultSettings();
    if (!settings.mode) settings.mode = 'trivia';
    if (!settings.players) settings.players = [];
    if (!settings.openCategories) {
      settings.openCategories = defaultSettings().openCategories;
    }
    if (!('difficulty' in settings)) settings.difficulty = '';
    for (const key of Object.keys(CATEGORIES)) {
      if (!(key in settings.categories)) settings.categories[key] = false;
    }

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

    show('splash');
  };

  // Welcome → mode selection
  $('btn-play-now').addEventListener('click', () => show('mode'));

  boot();
})();
