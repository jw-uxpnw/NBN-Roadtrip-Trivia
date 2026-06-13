# Road Trip Questions

An offline-first PWA for family car trips. One question at a time, big readable text, mixing trivia and open-ended conversation questions, filtered to the ages of who's in the car.

## What's in the box

- 427 trivia questions across 10 categories (80 of them Pacific Northwest), each tagged with a minimum age band (7+, 10+, 13+, 16+)
- 150 open-ended conversation prompts, also age-tagged
- A "Download more trivia" option (setup screen) that pulls batches from the [Open Trivia Database](https://opentdb.com/) and stores them on-device — grab questions on Wi-Fi, play them offline forever after
- Light setup: players + ages, category toggles, trivia/talk mix, round length
- Heart questions to save them; hearts and skips quietly tune which categories come up more
- Fully offline after the first visit — the service worker precaches everything

## Files

| File | Purpose |
|---|---|
| `index.html` | All four screens (setup, play, saved, round-done) |
| `app.js` | Selection engine, age filtering, preference weighting, storage |
| `styles.css` | Theme — one accent color, system fonts, big type |
| `questions.json` | The merged question bank (don't edit by hand) |
| `_bank/` | Editable source files for the question bank, one per category |
| `sw.js` / `manifest.json` / `icons/` | PWA shell |

## Run locally

Any static server works:

```sh
python3 -m http.server 8000
# open http://localhost:8000
```

(Service workers need localhost or HTTPS — opening index.html as a file:// URL won't install one.)

## Deploy + share with family

1. Drag this folder onto [Netlify Drop](https://app.netlify.com/drop) (or push to GitHub Pages). One time, free.
2. Text the link to the family.
3. On iPhone: open the link in Safari → Share → **Add to Home Screen**.
4. That's it — it launches like a native app and works with zero signal from then on.

## Adding or editing questions

Edit the JSON files in `_bank/` (trivia: `category`, `age`, `q`, `a`; open prompts in `open.json`: `age`, `q`), then re-merge — the merge script lives in the project history, or simply concatenate: each entry gets an `id`, trivia entries get `"type": "trivia"`, open entries get `"type": "open"`. Bump `CACHE` in `sw.js` (e.g. `rtq-v2`) so installed phones pick up the new bank.

Age bands: `7`, `10`, `13`, `16` — a question shows only when the youngest player meets the band, except occasional harder questions labeled "For: [name]" aimed at an older player.

## Downloaded trivia (Open Trivia Database)

The setup screen can pull 10/25/50 questions at a time from opentdb.com (free, no API key). How it maps:

- Difficulty → age band: easy = 10+, medium = 13+, hard = 16+ (OpenTDB isn't written for 7-year-olds; the bundled bank covers them)
- Downloaded questions are multiple choice — the play screen shows the options and highlights the correct one on reveal
- They live under one **Downloaded** category toggle; the pill on each card shows the real OpenTDB category
- Stored in localStorage (`rtq_imported`), deduplicated against everything you already have, fully offline once downloaded
- "Remove all downloaded questions" on the setup screen clears them

Note: OpenTDB rate-limits to one download every ~5 seconds per device.
