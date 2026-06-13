# Car Game — Naughty by Nature Road Trip Trivia

Offline-first family trivia PWA for a 2026 road trip. Plays fully offline after first load; shareable by link; installs to the phone home screen like a native app.

## Where things live

- **App code:** `src/` — `index.html`, `app.js`, `styles.css`, `sw.js`, `manifest.json`, `questions.json`, `_bank/`, `icons/`, `assets/`
- **Question source:** `src/_bank/*.json` (one file per category) → merged into `src/questions.json`. Never hand-edit `questions.json`; edit `_bank/` and re-run the merge.
- **Design system:** `DESIGN_SYSTEM.md` (dark "Naughty by Nature" Midnight theme — source of truth for color, type, components)
- **Requirements:** `road-trip-trivia-requirements-backlog.md` (prioritized backlog; note ~70% of P0 was already built before consolidation)
- **Splash asset:** `src/assets/Naughtybynature_front.png`

## Architecture

- Vanilla HTML/CSS/JS, no build step, no framework. Serve `src/` as static files.
- **Storage: localStorage** (settings, weights, seen, skipped, saved, imported). Deliberately not IndexedDB — fine at family scale (~600+ questions).
- **Offline:** `sw.js` precaches the whole app (cache-first, same-origin only; cross-origin like OpenTDB is never cached). Bump `CACHE` (e.g. `rtq-v8`) **once per change** so installed phones pick up updates.
- Two modes: **Trivia** (categories, round length, OpenTDB downloads) and **Table Talk** (conversation prompts, endless).

## Working practices (token-smart)

- Build on the existing app; don't rebuild working code.
- One feature/phase at a time; verify in the preview tool before moving on.
- All content changes go through `_bank/*.json` + merge.
- Future sessions: open Claude Code rooted at `Car Game/` (this folder).

## Run

Static server from `src/`, e.g. `python3 -m http.server 8741` then open the port. Service workers need localhost or HTTPS.
