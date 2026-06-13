# Naughty by Nature — Road Trip Trivia
## Design System · 2026 Summer Tour Edition

---

## Brand Voice

Warm, playful, outdoorsy. Campfire energy. This app lives in a dark car on a long highway — every element must be legible at a glance and inviting to tap. No cold grays, no sterile blues. Everything reads like it belongs on the back of a vintage band tee.

---

## Color Tokens

All colors use the **Midnight palette** — a warm near-black canvas with sandy cream text and burnt orange accents.

| Token | Hex | Usage |
|---|---|---|
| `--bg` | `#0A0A08` | Page / screen background |
| `--surface` | `#141208` | Cards, input fields, sections |
| `--surface-2` | `#1C1A0E` | Elevated surfaces, nested sections |
| `--fg` | `#E8C68A` | Primary text — headings, body, button labels |
| `--fg-sub` | `#C4A060` | Secondary text — section labels, captions, metadata |
| `--fg-dim` | `#5A4E30` | Disabled / tertiary — inactive states only |
| `--accent` | `#D4601A` | Primary CTA — buttons, active tabs, highlights |
| `--accent-fg` | `#0A0A08` | Text on accent backgrounds |
| `--green` | `#3D6840` | Selected state — category chips, secondary actions |
| `--green-fg` | `#E8C68A` | Text on green backgrounds |
| `--border` | `#2A2416` | Hairline borders, dividers, outlines |

### Color usage rules

- **Never** use pure black (`#000000`) or pure white (`#ffffff`) — always use the warm-tinted versions above.
- The **accent** color (`#D4601A`) is reserved for primary CTAs and active states. Do not use it for decorative purposes.
- **Green** (`#3D6840`) is for selected/confirmed states only (e.g., a category chip the user has chosen).
- **All text** must meet AA contrast (4.5:1) against its background. `--fg` on `--bg` passes at ~6:1.

---

## Typography

Three font families. Load all three from Google Fonts.

```css
@import url('https://fonts.googleapis.com/css2?family=Lilita+One&family=Fredoka:wght@300;400;600&family=DM+Mono:wght@400;500&display=swap');
```

### Display — Lilita One

Used for: screen titles, question text, CTA button labels, large numbers, answer reveals.

```
font-family: 'Lilita One', cursive;
font-weight: 400 (only weight available)
```

| Role | Size | Example |
|---|---|---|
| Screen hero | 40–44px | Splash title |
| Section heading | 22–26px | "Naughty by Nature" app bar |
| Question text | 24px | In-game question body |
| Primary button | 18–20px | "Start", "Let's Ride ✌", "Next →" |
| Answer reveal | 22px | Revealed answer text |

### Body — Fredoka

Used for: all UI labels, descriptions, category chips, secondary buttons, body copy.

```
font-family: 'Fredoka', sans-serif;
font-weight: 400 (normal), 600 (emphasis)
```

| Role | Size | Weight | Example |
|---|---|---|---|
| Section label | 11px | 400 | "WHAT ARE WE PLAYING?" |
| UI label | 12–13px | 400 | Mode toggle, category pill text |
| Body / description | 12–13px | 400 | Download section description |
| Emphasized label | 12px | 600 | Active mode label |

**Section labels** (the small uppercase "WHAT ARE WE PLAYING?", "TRIVIA CATEGORIES", etc.) always use:
```css
font-family: 'Fredoka', sans-serif;
font-size: 11px;
font-weight: 400;
color: var(--fg-sub);  /* #C4A060 */
letter-spacing: 0.08em;
text-transform: uppercase;
```

### Mono — DM Mono

Used for: question counters, timestamps, metadata tags, and any developer-facing/diagnostic text.

```
font-family: 'DM Mono', monospace;
font-weight: 400 (normal), 500 (medium)
```

| Role | Size | Example |
|---|---|---|
| Counter / progress | 10px | "4 / 25" |
| Screen labels | 10px | "01 — Splash" |
| Metadata | 10px | tour stop list |

---

## Spacing

Base unit: **4px**. All spacing is a multiple of 4.

| Token | Value | Usage |
|---|---|---|
| `space-1` | 4px | Micro gaps (icon → label) |
| `space-2` | 8px | Tight internal padding |
| `space-3` | 12px | Default gap between UI elements |
| `space-4` | 16px | Section internal padding |
| `space-5` | 20px | Screen horizontal padding |
| `space-6` | 24px | Between major sections |
| `space-8` | 32px | Screen-level vertical rhythm |

---

## Border Radius

| Token | Value | Usage |
|---|---|---|
| `radius-pill` | 999px | Category chips, badge-style tags |
| `radius-sm` | 7–8px | Mode toggle buttons, small inputs |
| `radius-md` | 10–12px | Cards, modals, primary buttons |
| `radius-lg` | 14px | Large CTAs (Splash "Tap to Begin") |
| `radius-phone` | 44px | Device frame only |

---

## Components

### Primary Button

The main action button. Used for "Start", "Let's Ride ✌", "Tap to Begin".

```
Background:  --accent (#D4601A)
Text color:  --accent-fg (#0A0A08)
Font:        Lilita One, 18–20px
Padding:     14–16px vertical, full width
Radius:      radius-md (12px) or radius-lg (14px) for splash
```

**Disabled state:**
```
Background:  --surface (#141208)
Text color:  --fg-sub (#C4A060)
Border:      1px solid --fg-dim (#5A4E30)
```

---

### Secondary / Ghost Button

Used for "Download questions", Back navigation, destructive-light actions.

```
Background:  transparent
Text color:  --accent (#D4601A)
Border:      1px solid --accent
Font:        Fredoka, 12px, weight 600
Radius:      radius-sm (8px)
```

---

### Mode Toggle (Segmented Control)

Two-up grid. "Trivia" and "Table Talk".

**Active state:**
```
Background:  --accent (#D4601A)
Text:        --accent-fg (#0A0A08)
Border:      1px solid --accent
Font:        Fredoka 13px, weight 600
```

**Inactive state:**
```
Background:  --surface (#141208)
Text:        --fg (#E8C68A)
Border:      1px solid --border
Font:        Fredoka 13px, weight 400
```

Each button also shows a sub-label in 10px Fredoka:
- "Trivia" → "Questions with answers"
- "Table Talk" → "Conversation starters"

---

### Category Chip

Pill-shaped toggleable tag. Used for trivia category selection.

**Selected:**
```
Background:  --green (#3D6840)
Text:        --green-fg (#E8C68A)
Border:      1px solid --green
Prefix:      "✓ "
```

**Unselected:**
```
Background:  transparent
Text:        --fg (#E8C68A)
Border:      1px solid --border
```

```
Font:        Fredoka, 11px
Padding:     4px 10px
Radius:      radius-pill (999px)
```

---

### Round Length Selector

Four-option row. Options: "10", "25", "50", "∞".

**Active:**
```
Background:  --accent (#D4601A)
Text:        --accent-fg (#0A0A08)
Border:      1px solid --accent
```

**Inactive:**
```
Background:  transparent
Text:        --fg (#E8C68A)
Border:      1px solid --border
```

```
Font:        Lilita One, 14px
Padding:     8px vertical
Radius:      radius-sm (8px)
Layout:      equal-width flex row, gap 6px
```

---

### Surface Card / Section Box

Used for the "Download more trivia" section and any grouped content.

```
Background:  --surface (#141208)
Border:      1px solid --border (#2A2416)
Radius:      radius-md (10px)
Padding:     12–16px
```

---

### Answer Reveal Button (dashed state)

Shown before the user taps to see the answer.

```
Background:  --surface (#141208)
Text:        --fg (#E8C68A)
Border:      1px dashed --fg-sub (#C4A060)
Font:        Fredoka, 13px
Radius:      radius-md (12px)
Padding:     14px
Width:       100%
```

### Answer Reveal (revealed state)

```
Background:  --green (#3D6840)
Text:        --green-fg (#E8C68A)
Font:        Lilita One, 22px
Radius:      radius-md (12px)
Padding:     14px 16px
Alignment:   center
```

---

### Progress Bar

Thin accent-colored bar at the top of the question screen.

```
Track:       height 3px, background --surface-2, radius 2px
Fill:        background --accent, radius 2px
Width:       (current question / total) × 100%
Transition:  width 0.3s ease
```

---

### Category Badge (Question screen)

Small pill in the top-right of the question screen showing the active category.

```
Text:        --accent (#D4601A)
Border:      1px solid --accent
Radius:      radius-pill (999px)
Font:        Fredoka, 11px
Padding:     3px 8px
```

---

### Navigation Bar (Question screen)

Back + Next row at the bottom of the question screen.

**Back button:**
```
Flex:        1 (narrower)
Font:        Lilita One, 16px
Active:      bg --surface-2, text --fg, border 1px solid --fg-sub
Disabled:    bg --surface, text --fg-sub, border 1px solid --fg-dim
Radius:      radius-md (12px)
Padding:     13px
```

**Next button:**
```
Flex:        2 (wider)
Font:        Lilita One, 16px
Active:      bg --accent, text --accent-fg, border 1px solid --accent
Disabled:    bg --surface, text --fg-sub, border 1px solid --fg-dim
Radius:      radius-md (12px)
Padding:     13px
```

---

## Screen Patterns

### Splash Screen

Layout (top → bottom):
1. Status bar (44px)
2. Small mono label: "2026 Summer Tour" — DM Mono 10px, `--fg-sub`
3. **Hero image** — NBN Bigfoot illustration, 340×340px, `object-fit: contain`, centered, flex-grows to fill vertical space
4. **Title** — "Road Trip Trivia" in Lilita One 32px, `--fg`, centered
5. **Primary CTA** — "Tap to Begin" full-width, accent button, radius-lg
6. Tour stop list — DM Mono 11px, `--fg-dim`, centered

On tap of CTA: button text changes to "Loading… ✌" and background shifts to `--green`.

---

### Setup Screen

Scrollable. Horizontal padding: 20px.

Layout (top → bottom):
1. App name — "Naughty by Nature" Lilita One 22px, `--accent`, centered
2. Sub-label — "2026 Summer Tour" Fredoka 11px, `--fg-sub`, centered
3. **Mode toggle** — 2-column grid
4. **Category chips** — wrapping flex row
5. **Round length selector** — 4-option row
6. **Download section** — surface card with two dropdown inputs + ghost button
7. **Start** — primary button, full width
8. **Saved questions** — text link, `--accent`, centered

---

### Question Screen

Fixed layout (no scroll).

Layout (top → bottom):
1. Top nav row: Home button (left) · "N / Total" counter (center) · Category badge (right)
2. Progress bar
3. Question body — Lilita One 24px, `--fg`, vertically centered in remaining space
4. Answer reveal — dashed button → green reveal card on tap
5. Back / Next row

---

## Motion & Interaction

- Button press: no animation needed — color swap on tap is sufficient
- Answer reveal: instant swap (no fade) — the snap feels satisfying
- Progress bar: `transition: width 0.3s ease` on question change
- Splash CTA: color change from accent → green on tap

---

## Assets

| File | Usage |
|---|---|
| `Naughtybynature_front.png` | Splash screen hero (340×340, object-fit: contain, white bg) |
| `NBN_back.png` | Reference only — not used in app screens |

---

## Implementation Notes

- This is a **mobile-first** app. Target width: 375px (iPhone SE / standard). Max-width for screens: 430px.
- All screens use the same background color — no per-screen background changes.
- Fonts must be loaded before first render to avoid FOUT. Use `font-display: swap` or preload the Google Fonts link.
- The app is used in a car. Tap targets must be minimum **44×44px**. Prefer 48px+ for primary actions.
- Keep interactive elements away from the bottom 34px (home indicator zone on iPhone).
