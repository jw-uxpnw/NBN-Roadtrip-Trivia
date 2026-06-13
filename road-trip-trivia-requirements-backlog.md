# Road Trip Trivia App: Offline-First PWA Requirements & Credit-Smart Implementation Plan

## 1. Product Summary

Road Trip Trivia is a personal family trivia app for an upcoming road trip. It should be easy to share by link, easy for non-technical family members to install on iPhone or Android, and reliable in areas with spotty or no cell coverage.

The app should feel like a lightweight phone app without requiring the App Store or Play Store. It will be built as an installable web app with offline support.

The core experience is:

```text
Open shared link
→ Add app to Home Screen
→ Download questions while online
→ Play trivia offline in the car
```

The highest priority is a reliable, family-friendly, offline-first experience. Features that require accounts, cloud sync, admin dashboards, or complex moderation should be deferred until the core app is stable.

---

## 2. Guiding Principles

- Prioritize reliability over cleverness.
- Optimize for low credit spend.
- Assume users are non-technical family members.
- Keep setup short, obvious, and friendly.
- Do not use the term “PWA” in user-facing UI.
- Gameplay must never depend on a live API call.
- Internet should only be required for first load, app updates, and downloading more questions.
- Store downloaded trivia locally on the device.
- Keep future features modular so they can be added later without disrupting the offline MVP.
- Use the Figma design system enough to make the app feel polished, but do not spend credits rebuilding a full component library.

---

## 3. Credit-Spend Strategy

Because this project is being built with a limited Claude Code budget, implementation should be broken into small, testable slices.

### Credit-Smart Rules

1. Ask Claude Code to work on one feature or screen at a time.
2. Avoid broad prompts like “make the whole app better.”
3. Use explicit acceptance criteria.
4. Test manually after each major change.
5. Avoid backend, accounts, sync, and admin tooling until the offline app is stable.
6. Prefer local-first implementations.
7. Use simple data structures and clear separation between:
   - App shell
   - Question download
   - Local storage
   - Gameplay
   - Feedback/reporting
8. Ask Claude Code to summarize changes and identify files modified after each task.

### Implementation Modes

Use the full document as product context, but run Claude Code with smaller prompts from the backlog sections.

---

## 4. Priority Framework

Each feature is scored by:

- **User value**: How important it is for the family road trip.
- **Implementation complexity**: How expensive/risky it is to build.
- **Credit priority**: How soon it should be tackled given limited usage.

### Priority Definitions

| Priority | Meaning |
|---|---|
| P0 | Required for usable road-trip MVP |
| P1 | High-value improvement after MVP is stable |
| P2 | Useful, but defer if credits are limited |
| P3 | Future feature; avoid before trip unless everything else is done |

### Complexity Definitions

| Complexity | Meaning |
|---|---|
| XS | Very small change, likely one focused prompt |
| S | Small feature or screen-level change |
| M | Multi-file change, needs careful testing |
| L | Larger system change or new data flow |
| XL | Backend/sync/accounts/admin complexity; defer |

---

## 5. Prioritized Backlog

## P0 — Road-Trip MVP

These features should be completed first.

### P0.1 Install and Setup UX for iPhone and Android

**User value:** Very high  
**Complexity:** M  
**Credit priority:** Highest

#### Requirements

- Show a friendly welcome/setup screen.
- Support one shared link for all users.
- Detect platform/browser as best as possible:
  - iPhone/iPad
  - Android/Samsung/Chrome
  - Already installed/standalone mode
  - Unknown browser
- Show device-specific install instructions.
- Avoid the term “PWA” in user-facing copy.
- Use plain language:
  - “Install app”
  - “Add to Home Screen”
  - “Download questions”
  - “Ready for offline play”
- If already running in standalone mode, skip install instructions and go to offline setup.

#### iPhone/iPad Instructions

Show:

```text
Add Road Trip Trivia to your Home Screen

1. Open this page in Safari.
2. Tap the Share button.
3. Tap “Add to Home Screen.”
4. Tap “Add.”

After that, open Road Trip Trivia from your Home Screen like a regular app.
```

#### Android/Samsung Instructions

Show:

```text
Install Road Trip Trivia

1. Open this page in Chrome.
2. Tap the three-dot menu.
3. Tap “Add to Home screen” or “Install app.”
4. Tap “Install” or “Add.”

After that, open Road Trip Trivia from your Home Screen like a regular app.
```

If the browser supports the native install prompt, show a primary “Install app” button.

#### Acceptance Criteria

- iPhone users see iPhone-specific instructions.
- Android users see Android-specific instructions.
- Unknown browsers get a fallback message.
- Installed/standalone users do not get stuck in setup.
- The user can continue in browser if they do not install.

#### Claude Code Prompt

```text
Implement a family-friendly install/setup experience for Road Trip Trivia.

Requirements:
- Add a welcome/setup screen.
- Detect iPhone/iPad, Android/Chrome/Samsung, standalone installed mode, and unknown browser as best as possible.
- Show platform-specific install instructions.
- Do not use the term “PWA” in user-facing copy.
- Use plain language for non-technical users.
- If running in standalone mode, skip install instructions and continue to offline setup.
- Include a “Continue in browser” fallback.
- Keep the implementation simple and avoid adding backend dependencies.
- After changes, summarize files modified and anything I should manually test.
```

---

### P0.2 Web App Manifest and Custom App Icon

**User value:** Very high  
**Complexity:** S-M  
**Credit priority:** Highest

#### Requirements

- Add a web app manifest.
- App name: Road Trip Trivia
- Short name: Trivia
- Display mode: standalone
- Include custom icons:
  - 192x192 PNG
  - 512x512 PNG
  - 512x512 maskable icon
  - 180x180 Apple touch icon
- Add iOS-specific metadata.
- Make icons easy to replace later.

#### Suggested Manifest

```json
{
  "name": "Road Trip Trivia",
  "short_name": "Trivia",
  "description": "A family trivia game for the road.",
  "start_url": "/",
  "scope": "/",
  "display": "standalone",
  "background_color": "#ffffff",
  "theme_color": "#0f172a",
  "icons": [
    {
      "src": "/icons/icon-192.png",
      "sizes": "192x192",
      "type": "image/png"
    },
    {
      "src": "/icons/icon-512.png",
      "sizes": "512x512",
      "type": "image/png"
    },
    {
      "src": "/icons/icon-maskable-512.png",
      "sizes": "512x512",
      "type": "image/png",
      "purpose": "maskable"
    }
  ]
}
```

#### Acceptance Criteria

- App has a manifest.
- iPhone Add to Home Screen uses the chosen icon.
- Android install uses the chosen icon.
- App launches in standalone mode when opened from the home screen.
- Icon assets are organized and easy to replace.

#### Claude Code Prompt

```text
Add installable app metadata and icon support.

Requirements:
- Add a web app manifest for Road Trip Trivia.
- Use app name “Road Trip Trivia” and short name “Trivia.”
- Set display mode to standalone.
- Add icon support for 192x192, 512x512, maskable 512x512, and apple-touch-icon.
- Add iOS metadata for home screen app behavior.
- Organize icon assets so I can replace them later.
- Do not over-engineer this.
- After changes, summarize files modified and how to test on iPhone and Android.
```

---

### P0.3 Offline App Shell

**User value:** Very high  
**Complexity:** M  
**Credit priority:** Highest

#### Requirements

- Add service worker support.
- Cache the app shell after first successful load.
- Cache core assets:
  - HTML
  - JavaScript
  - CSS
  - Manifest
  - Icons
  - Starter content
- App should open from Home Screen even without service after first successful load.
- Add simple offline status messaging.
- Preserve offline play if update checks fail.

#### Acceptance Criteria

- App opens after turning on airplane mode.
- Core UI loads offline.
- Offline users see clear status messaging.
- App does not crash when offline.
- Download actions are disabled or clearly unavailable when offline.

#### Claude Code Prompt

```text
Add offline app shell support.

Requirements:
- Add a service worker that caches the core app shell and static assets.
- Cache the manifest, icons, CSS, JS, and bundled starter content.
- The app should open after first successful load even when the phone is offline.
- Add simple offline/online detection and user-facing status messages.
- Disable or explain download actions when offline.
- Do not make gameplay depend on any live API request.
- Keep the caching strategy simple and maintainable.
- After changes, summarize files modified and provide an airplane-mode test checklist.
```

---

### P0.4 Local Question Storage with IndexedDB

**User value:** Very high  
**Complexity:** M  
**Credit priority:** Highest

#### Requirements

- Store downloaded question packs locally.
- Use IndexedDB, not localStorage, for questions and pack metadata.
- Store:
  - Question packs
  - Questions
  - Download timestamps
  - Source metadata
  - Local session progress if needed
- Provide helper functions for:
  - Save pack
  - Get downloaded packs
  - Get questions by pack
  - Delete pack
  - Count questions

#### Suggested Data Types

```ts
type QuestionPack = {
  id: string;
  name: string;
  source: "bundled" | "opentdb" | "triviaapi" | "custom";
  downloadedAt: string;
  questionCount: number;
  categories: string[];
  ageLevel?: "kids" | "teens" | "adults" | "mixed";
};

type TriviaQuestion = {
  id: string;
  source: "opentdb" | "triviaapi" | "custom";
  externalId?: string;
  packId: string;
  category: string;
  ageLevel?: "kids" | "teens" | "adults" | "mixed";
  difficulty?: "easy" | "medium" | "hard";
  question: string;
  correctAnswer: string;
  incorrectAnswers: string[];
  explanation?: string;
};
```

#### Acceptance Criteria

- Downloaded packs persist after refresh.
- Downloaded packs persist after closing/reopening app.
- App can retrieve questions offline.
- User can delete a downloaded pack.
- Storage code is isolated in a clear module/service.

#### Claude Code Prompt

```text
Implement local question pack storage using IndexedDB.

Requirements:
- Use IndexedDB for downloaded packs and questions.
- Do not use localStorage for question storage.
- Create a small storage layer with functions to save a pack, list packs, get questions by pack, delete a pack, and count questions.
- Store source metadata, downloaded timestamp, category, difficulty, and optional age level.
- Keep storage code isolated and easy to test.
- Do not add cloud sync or accounts.
- After changes, summarize the storage API and files modified.
```

---

### P0.5 Question Download Flow

**User value:** Very high  
**Complexity:** M-L  
**Credit priority:** Highest

#### Requirements

- Downloads happen only when user explicitly chooses to download questions.
- Gameplay never calls APIs directly.
- Support a bundled starter pack.
- Support downloading additional packs from Open Trivia Database.
- Show:
  - Available packs
  - Downloaded packs
  - Question counts
  - Last updated times
  - Failed download states
- Save downloaded questions to IndexedDB.
- Handle bad network gracefully.

#### Acceptance Criteria

- User can download starter/additional packs while online.
- Downloaded questions are available offline.
- Failed downloads show clear error and retry.
- The play flow uses only local stored questions.
- No live API call occurs during gameplay.

#### Claude Code Prompt

```text
Build the question download flow.

Requirements:
- Add a Download Questions screen.
- Show suggested packs and downloaded packs.
- Support a bundled starter pack.
- Support downloading questions from Open Trivia Database.
- Save downloaded packs and questions to IndexedDB using the existing storage layer.
- Show question counts and last downloaded timestamps.
- Handle failed downloads with a clear error message and retry button.
- Disable or explain download actions when offline.
- Gameplay must only use locally stored questions, never live API calls.
- Keep this focused on Open Trivia Database first; do not add the second trivia API yet.
- After changes, summarize files modified and how to test online/offline.
```

---

### P0.6 Basic Gameplay Loop

**User value:** Very high  
**Complexity:** M  
**Credit priority:** Highest

#### Requirements

- Select a downloaded pack or recommended mix.
- Show one question at a time.
- Show multiple choice answers.
- Randomize answer order.
- Track correct/incorrect answers.
- Show immediate result after each answer.
- Move to next question.
- End session after selected number of questions.

#### Acceptance Criteria

- User can play from downloaded questions.
- Game works in airplane mode.
- Correct answer is clearly shown after selection.
- No duplicate answers appear in a question.
- Game gracefully handles running out of questions.

#### Claude Code Prompt

```text
Implement the basic offline trivia gameplay loop.

Requirements:
- Let the user start a game using locally downloaded questions.
- Show one multiple-choice question at a time.
- Randomize answer order.
- Track correct and incorrect answers.
- Show result feedback after each answer.
- Allow moving to the next question.
- End the session after a simple fixed number of questions, such as 10 or 25.
- Gameplay must work fully offline and must not call any trivia API.
- Handle empty or missing question packs gracefully.
- After changes, summarize files modified and provide a manual test checklist.
```

---

### P0.7 Session-Level Scoring

**User value:** High  
**Complexity:** S  
**Credit priority:** High

#### Requirements

- Track session score.
- Show:
  - Correct count
  - Total questions
  - Percentage
  - Optional streak
- Show end-of-session summary.
- Do not build accounts or persistent global stats yet.

#### Acceptance Criteria

- Session score updates correctly.
- End screen shows result like “15 / 25 correct.”
- Score resets when starting a new session.
- Works offline.

#### Claude Code Prompt

```text
Add simple session-level scoring.

Requirements:
- Track correct answers, incorrect answers, total answered, percentage correct, and optional current streak.
- Show the current score during gameplay.
- Show an end-of-session summary like “15 / 25 correct.”
- Do not add accounts, profiles, leaderboards, or cloud sync.
- Keep score session-based only.
- After changes, summarize files modified and how to test scoring.
```

---

### P0.8 Figma-Lite Design System Pass

**User value:** High  
**Complexity:** S-L depending on scope  
**Credit priority:** High, but scope tightly

#### Requirements

- Apply the Figma design direction to core screens only.
- Focus on:
  - Colors
  - Typography
  - Spacing
  - Buttons
  - Cards
  - Icon treatment
  - App icon
- Do not rebuild every Figma component.
- Do not introduce unnecessary dependencies.

#### Core Screens

- Welcome/setup
- Install instructions
- Offline readiness
- Download packs
- Play screen
- Results screen
- Settings/help

#### Acceptance Criteria

- Main screens feel visually consistent.
- Buttons and cards use consistent styling.
- Typography and spacing feel intentional.
- App remains easy to use and touch-friendly.
- Design pass does not break offline behavior.

#### Claude Code Prompt

```text
Apply a lightweight Figma design system pass to the core app screens.

Requirements:
- Focus only on colors, typography, spacing, buttons, cards, and icon treatment.
- Apply the design direction to the welcome/setup, install instructions, offline readiness, download packs, play, results, and settings/help screens.
- Do not rebuild an entire component library.
- Do not introduce unnecessary dependencies.
- Preserve all existing offline and gameplay behavior.
- Keep the UI touch-friendly and readable in the car.
- After changes, summarize files modified and anything I should visually review.
```

---

## P1 — High-Value Improvements After MVP

### P1.1 Starter Categories and Suggested Packs

**User value:** High  
**Complexity:** S-M  
**Credit priority:** High after MVP

#### Suggested Packs

- Family Mix
- Kids Trivia
- Teen Trivia
- Movies & TV
- Music
- Sports
- Science & Nature
- Animals
- Geography
- History
- Food
- Video Games
- National Parks / Road Trip
- Weird Facts

#### Requirements

- Show recommended starter packs.
- Allow users to download packs by category.
- Use available categories from the trivia source when possible.
- Keep labels family-friendly.

#### Claude Code Prompt

```text
Add suggested starter categories and question packs.

Requirements:
- Add a recommended packs section to the Download Questions screen.
- Include Family Mix, Kids Trivia, Teen Trivia, Movies & TV, Music, Sports, Science & Nature, Animals, Geography, History, Food, Video Games, National Parks / Road Trip, and Weird Facts where supported.
- Map these friendly labels to available trivia source categories where possible.
- Keep this simple and do not add a backend.
- After changes, summarize category mappings and any limitations.
```

---

### P1.2 Bad Question Reporting

**User value:** High  
**Complexity:** S  
**Credit priority:** High after gameplay

#### Requirements

- Add a thumbs-down or “Report question” button.
- Show simple reasons:
  - Wrong answer
  - Bad wording
  - Too hard
  - Not appropriate
  - Duplicate
  - Other
- Save locally first.
- Do not sync to cloud yet.

#### Data Shape

```ts
type QuestionReport = {
  id: string;
  questionId: string;
  packId: string;
  source: string;
  reason: "wrong_answer" | "bad_wording" | "too_hard" | "not_appropriate" | "duplicate" | "other";
  note?: string;
  createdAt: string;
};
```

#### Claude Code Prompt

```text
Add local bad-question reporting.

Requirements:
- Add a small thumbs-down or “Report question” action on the result screen.
- Let users pick a simple reason: Wrong answer, Bad wording, Too hard, Not appropriate, Duplicate, or Other.
- Save the report locally using IndexedDB or the existing local storage layer.
- Include questionId, packId, source, reason, optional note, and timestamp.
- Do not add cloud sync or admin dashboards.
- Keep the UI quick and low-friction.
- After changes, summarize files modified and how reports are stored.
```

---

### P1.3 App Feedback

**User value:** Medium-high  
**Complexity:** XS-S  
**Credit priority:** Medium

#### Requirements

- Add feedback option in settings/help.
- Keep separate from bad-question reporting.
- MVP can be:
  - mailto link, or
  - local feedback form saved on device
- Categories:
  - Bug
  - Confusing
  - Idea
  - Other

#### Recommendation

Use a `mailto:` link first to save credits.

#### Claude Code Prompt

```text
Add a simple app feedback option.

Requirements:
- Add a feedback action in Settings or Help.
- Keep it separate from bad-question reporting.
- Use a simple mailto link first to minimize implementation complexity.
- Suggested categories in the email body: Bug, Confusing, Idea, Other.
- Do not add backend sync or forms yet.
- After changes, summarize files modified and how to test.
```

---

### P1.4 Age/Difficulty Selector

**User value:** Medium-high  
**Complexity:** M  
**Credit priority:** Medium

#### Requirements

- Add optional setup selection:
  - Kids
  - Teens
  - Adults
  - Mixed Family
- Use as a content preference/filter.
- Do not create full profiles.
- If exact age mapping is not available from APIs, use difficulty/category as a rough filter and communicate lightly.

#### Claude Code Prompt

```text
Add a simple age/difficulty preference.

Requirements:
- During setup or before starting a game, let the user choose Kids, Teens, Adults, or Mixed Family.
- Use this as a local content preference/filter.
- Do not create accounts or profiles.
- If exact API age data is unavailable, map this preference to available difficulty/category data as best as possible.
- Keep the behavior simple and transparent.
- After changes, summarize how each option maps to question filtering.
```

---

### P1.5 Add The Trivia API as a Second Source

**User value:** Medium-high  
**Complexity:** M-L  
**Credit priority:** Medium after OpenTDB works

#### Requirements

- Add The Trivia API as another download source.
- Normalize its questions to the same internal question format.
- Store source metadata.
- Do not alter gameplay logic.
- Download flow should allow source-specific or mixed packs.

#### Claude Code Prompt

```text
Add The Trivia API as a second question source.

Requirements:
- Keep the existing Open Trivia Database support working.
- Add The Trivia API only to the download flow.
- Normalize all questions into the existing internal TriviaQuestion format.
- Store source metadata so each question can be traced back to its source.
- Do not change gameplay to call APIs directly.
- Gameplay should continue to read only from local IndexedDB.
- Handle API failures gracefully.
- After changes, summarize the normalization logic and files modified.
```

---

## P2 — Useful Later

### P2.1 Local Player Names

**User value:** Medium  
**Complexity:** M  
**Credit priority:** Later

#### Requirements

- Allow local player names on a device.
- No login.
- No cloud sync.
- Optional selection before a session.
- Session result may be associated with selected player(s).

#### Claude Code Prompt

```text
Add lightweight local player names.

Requirements:
- Let users add local player names on this device.
- Allow selecting one or more players before starting a session.
- Store player names locally only.
- Do not add login, accounts, cloud sync, or leaderboards.
- Optionally attach selected players to session results.
- Keep the UI simple.
- After changes, summarize files modified and how local players are stored.
```

---

### P2.2 Downloaded Pack Management

**User value:** Medium-high  
**Complexity:** S-M  
**Credit priority:** Later, unless storage becomes confusing

#### Requirements

- Show all downloaded packs.
- Show question count and last updated.
- Allow delete.
- Optionally show source and categories.
- Do not add sync.

#### Claude Code Prompt

```text
Improve downloaded pack management.

Requirements:
- Add or refine a screen showing downloaded packs.
- Show pack name, source, question count, categories, and last updated timestamp.
- Allow deleting a downloaded pack with confirmation.
- Keep all behavior local.
- Do not add cloud sync.
- After changes, summarize files modified and manual tests.
```

---

### P2.3 Local Session History

**User value:** Medium  
**Complexity:** M  
**Credit priority:** Later

#### Requirements

- Save completed session summaries locally.
- Show recent sessions.
- No account or cross-device sync.

#### Claude Code Prompt

```text
Add local session history.

Requirements:
- Save completed session summaries locally.
- Show a simple recent sessions list with date, score, question count, and selected pack.
- Do not add accounts, profiles, cloud sync, or leaderboards.
- Keep this optional and lightweight.
- After changes, summarize files modified and how session history is stored.
```

---

## P3 — Future Features to Avoid Before Trip

These are good ideas but likely not worth limited credits before the trip.

### P3.1 Real Profiles / Accounts

Defer because this requires authentication, data ownership decisions, backend storage, and sync logic.

### P3.2 Shared Leaderboards

Defer because this requires profiles or shared session identity, backend storage, and conflict handling.

### P3.3 Cloud Sync for Reports and Feedback

Defer because local reporting is enough for MVP. Add export or sync later.

### P3.4 Admin Dashboard

Defer unless custom questions become essential before the trip.

### P3.5 User-Submitted Questions with Review

Defer because submission + approval + distribution adds workflow complexity.

### P3.6 Full Figma Component Library Rebuild

Defer because it can burn credits without improving the road-trip experience enough.

---

## 6. Custom Questions Roadmap

Custom family questions are valuable, but should start simple.

### Version 1: Admin JSON

- You maintain a JSON file of custom questions.
- App bundles or downloads it as a Family Questions pack.
- No UI needed.

### Version 2: Admin-Only Add Question Screen

- Hidden/admin-only screen.
- Add a custom question manually.
- Save locally or to a simple file/backend later.

### Version 3: Family Suggestions

- Family members suggest questions.
- Suggestions are saved as pending.
- You review and approve.
- Approved questions appear in a Family Questions pack.

### Recommendation

Do not build custom questions before the MVP unless everything else is stable. If needed, start with a JSON file.

---

## 7. Road-Trip Update Workflow

### Best Reliable Workflow

```text
Laptop
→ Claude Code
→ GitHub
→ Vercel auto-deploy
→ Family app updates on next load
```

### Before the Trip

- Set up GitHub repo.
- Set up auto-deploy from main branch.
- Test deployment.
- Test service worker updates.
- Test airplane mode.
- Keep a simple rollback path.
- Avoid making major architecture changes during the trip.

### On the Road

Use Claude Code for small improvements only:

- Copy tweaks
- Visual polish
- Category labels
- Bug fixes
- Starter pack changes
- Simple UI adjustments

Avoid:

- Adding accounts
- Adding sync
- Reworking storage
- Rebuilding the game engine
- Major dependency changes

### Phone-Only Updates

Phone-only updates may be possible using remote workflows, but do not rely on them for urgent fixes. Bring a laptop if the app matters during the trip.

---

## 8. Recommended Build Sequence

### Build 1: Installable Offline Shell

Goal: family can open the link, install/add to home screen, and reopen offline.

Includes:
- Install/setup UX
- Manifest/icons
- Service worker
- Offline status
- Basic app shell

### Build 2: Local Questions and Downloads

Goal: users can download questions and keep them on the device.

Includes:
- IndexedDB storage
- Bundled starter pack
- OpenTDB download flow
- Downloaded pack metadata
- Offline readiness checklist

### Build 3: Gameplay and Scoring

Goal: users can play in the car without service.

Includes:
- Basic multiple-choice game loop
- Session scoring
- End-of-session results
- Empty state handling

### Build 4: Design Pass

Goal: app feels polished and family-friendly.

Includes:
- Figma-lite design system pass
- Touch-friendly layout
- Consistent buttons/cards/type
- App icon refinement

### Build 5: Quality Controls

Goal: improve content and feedback quality.

Includes:
- Bad-question reporting
- App feedback
- Suggested starter categories
- Pack management

### Build 6: Expansion

Goal: expand content and personalization.

Includes:
- The Trivia API
- Age/difficulty selector
- Local player names
- Local session history

### Build 7: Future

Goal: custom content and shared features.

Includes:
- Admin custom questions
- User-submitted questions
- Profiles
- Leaderboards
- Sync

---

## 9. MVP Definition

The MVP is done when:

- A family member can open one link.
- iPhone and Android users get clear setup instructions.
- The app can be added to the phone home screen with a custom icon.
- The app opens after the first load with airplane mode on.
- The user can download questions while online.
- The user can see whether the app is ready for offline play.
- The user can play trivia fully offline.
- The app tracks session score.
- The UI feels reasonably polished and consistent.
- Failed network/API calls do not break the game.

---

## 10. Manual Test Checklist

### iPhone

- Open link in Safari.
- Add to Home Screen.
- Confirm custom icon appears.
- Launch from Home Screen.
- Download starter pack.
- Turn on airplane mode.
- Relaunch app.
- Start game.
- Complete session.
- Confirm score displays.

### Android / Samsung

- Open link in Chrome.
- Install app or Add to Home screen.
- Confirm custom icon appears.
- Launch from Home Screen.
- Download starter pack.
- Turn on airplane mode.
- Relaunch app.
- Start game.
- Complete session.
- Confirm score displays.

### Browser Without Installing

- Open app in browser.
- Confirm setup guidance appears.
- Continue in browser.
- Download questions.
- Play game.

### Offline Without Questions

- Clear local data or use new device.
- Open app offline after first shell load.
- Confirm app opens.
- Confirm clear message explains that questions need to be downloaded while online.

### Failed Download

- Simulate bad network.
- Attempt download.
- Confirm clear error and retry option.

### Update

- Deploy a small update.
- Reopen app.
- Confirm app still works.
- Confirm downloaded questions remain available.

---

## 11. Parking Lot

Keep these ideas, but do not build until core app is stable:

- Real user accounts
- Cross-device profiles
- Shared leaderboard
- Cloud feedback sync
- Admin dashboard
- User-submitted questions
- Moderation/review workflow
- Full design system rebuild
- Complex multiplayer
- Push notifications
- Real-time group play
