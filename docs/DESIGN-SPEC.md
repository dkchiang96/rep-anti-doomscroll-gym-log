# REP — Design Spec v1.1

**Status:** authoritative. Where this document and PRD v0.3 §5 disagree, this document wins.
**Purpose:** turn the Timer Plus screenshots into rules a coding agent can execute without re-inventing rounded cards.

> **About the reference screenshots.** This spec was written against screenshots of [Timer Plus](https://play.google.com/store/apps/details?id=com.vgfit.timerplus) by Uniqo Lab, the interval timer REP's visual design is inspired by. The reference set cited below is not included in this repository; filenames refer to the author's local copies. REP is an independent, non-commercial personal project and is not affiliated with or endorsed by Uniqo Lab.

---

## 0. Why v0 looked wrong

Three root causes, diagnosed from the shipped screenshots. Every rule below exists to prevent one of them recurring.

| # | Failure | Symptom |
|---|---|---|
| **F1** | Display font never loaded | Every screen rendered in the Android system sans. Timer Plus uses a heavy condensed grotesque for 100% of its text. |
| **F2** | Colour applied to text instead of to blocks | Yellow digits on black. Timer Plus is **black digits on a full-bleed yellow slab**. This inversion is the single biggest reason the app doesn't feel like the reference. |
| **F3** | Everything wrapped in a rounded grey card | Session note, exercise block, set rows, End Session. Timer Plus contains **zero cards**. |

Plus **F4**: the Home screen distributed six text links across the full viewport height with ~250px of dead space between each.

---

## 1. Locked interaction decisions

These are product decisions, recorded here because they determine the layout.

| ID | Decision |
|---|---|
| **D1** | The rest timer is **removed**. There is exactly one clock: a count-up stopwatch. |
| **D2** | The stopwatch is **manually started**. Starting a session does not start the clock. |
| **D3** | The stopwatch runs continuously across the session. Controls: START / PAUSE / RESET. |
| **D4** | The screen flashes every 30s while the clock runs. The interval is configurable. **Flash is the rest estimator** — the user counts flashes, not seconds. |
| **D5** | Sound, vibration, and camera-flash cues default OFF. |
| **D6** | During a working set the screen shows **only**: the clock, the current exercise name, the target reps. Nothing else. |
| **D7** | Actual weight and reps are logged **once per exercise**, on a dedicated transition screen, after the last set of that exercise and before the next exercise is selected. |
| **D8** | Ghost pre-fill (last session's sets for this exercise) appears on the transition screen, not the live screen. |
| **D9** | Every screen is reachable back to Home. No screen can strand the user. |
| **D10** | **The clock never stops or disappears when logging.** On the transition screen it shrinks to a compact bar and keeps running. It is not a separate screen — it is persistent chrome. |
| **D11** | The 30s cue is a **burst**: the whole screen fills with accent colour several times in rapid succession, not one slow pulse. |
| **D12** | **Timer Plus is the tiebreaker.** Where this spec is silent or ambiguous, match the Timer Plus screenshots. Do not invent. |
| **D13** | **Amends D6.** The live screen also shows a manual sets-done counter (tap to increment, long-press to decrement — see R3's deviation note; not the two flanking `−`/`+` steppers originally specified below), in the canvas zone next to the transport button. It never touches the timer and never writes to the `sets` table directly. It resets whenever the exercise changes. **Amended again 2026-09-02 (R5 follow-up):** the count now *is* the source of truth for how many rows the transition screen shows — tapping NEXT EXERCISE carries the live tally across, and the transition screen renders exactly that many rows (ghost-prefilled from history where available, blank beyond it), reversing this row's original "never the source of truth" wording. A tally of 0 shows 0 rows, even when ghost history exists for that exercise — the user's explicit call. |

---

## 2. Colour

**Honest caveat: I cannot eyedrop exact hex values from a JPEG.** The PRD tokens below are the authority; they were derived from the same screenshots and are close enough that any drift is invisible at arm's length. If you want pixel-exact values, sample the PNGs yourself and replace this table.

| Token | Value | Use |
|---|---|---|
| `bg` | `#0D0D0D` | Canvas behind slabs |
| `bar` | `#1A1A1A` | Top bar, bottom bar only |
| `slab-primary` | `#F2F24B` | Full-bleed yellow slab |
| `slab-secondary` | `#A5E838` | Full-bleed lime slab |
| `on-slab` | `#000000` | **All** text sitting on a slab |
| `text-primary` | `#FFFFFF` | Text on canvas |
| `text-muted` | `#8A8A8A` | Ghost values, inactive tabs, secondary labels |
| `divider` | `#2A2A2A` | 1px hairlines |
| `danger` | `#E5484D` | Destructive confirmations only |

### Colour law

1. **Accent colours are backgrounds, not foregrounds.** `slab-primary` and `slab-secondary` may only be used as `backgroundColor`. Using them as `color` on text is a spec violation — that is F2.
2. **Exception:** a single accent-coloured word may appear on the canvas for an inline link or an active tab label. Never for a numeral.
3. There is no light theme. `ThemeProvider` stays pinned to dark.
4. No gradients. No shadows. No elevation. No opacity-based tinting.

---

## 3. Type

### Fonts

| Role | Face | Notes |
|---|---|---|
| Display | **Bebas Neue** | All numerals, all headers, all buttons, all labels. Uppercase only. |
| Body | **Inter** | Only for free-text the user typed, and multi-sentence explanatory copy. |

**Bebas Neue must be loaded via `expo-font` and verified rendering on device before any screen is built.** F1 was silent — the app fell back to the system font with no error. Add a startup assertion or a visible test string.

Bebas Neue has no lowercase and no bold weight. Do not request `fontWeight`. Emphasis comes from size, never weight.

### Scale

| Token | Size | Line height | Use |
|---|---|---|---|
| `timer` | Fill ≥85% of viewport width | 0.85 | The stopwatch numerals, and only those |
| `display-1` | 64 | 0.9 | Secondary large numerals (lap interval, weight entry) |
| `display-2` | 40 | 1.0 | Exercise name on the live screen |
| `heading` | 28 | 1.1 | Screen titles |
| `label` | 18 | 1.2 | Slab captions, button text |
| `caption` | 14 | 1.3 | Muted secondary labels |
| `body` | 16 | 1.5 | Inter only |

Numerals use tabular figures (`fontVariant: ['tabular-nums']`) so the clock does not jitter between digits.

---

## 4. Layout law

### The slab

The core primitive. A slab is a **full-bleed horizontal band**:

- `width: 100%`, touching both screen edges. **Zero horizontal margin. Zero horizontal padding on its parent.**
- `borderRadius: 0`
- A solid `slab-primary` or `slab-secondary` background
- Black content, horizontally centred
- Vertical padding only

Slabs stack vertically with **no gap between them**. Adjacent slabs of different colours share a hard edge. This is the entire visual identity of Timer Plus.

### Banned outright

The following appear nowhere in the app. This list exists because v0 used all of them.

| Banned | Why |
|---|---|
| `borderRadius` on any container | F3 — **one exception: the circular transport button, §5.3** |
| Grey `#1A1A1A` "surface" cards | F3 — `bar` is for the top/bottom bar only |
| Horizontal padding on screen-level containers | Breaks full-bleed |
| Shadows, elevation, blur | Not in the reference |
| Accent colour as text colour on a numeral | F2 |
| Border-only "ghost" buttons on the canvas | The v0 Freestyle button; use a slab |
| `justifyContent: 'space-between'` on a screen container | F4 — content packs to the top |
| Underlined text links as primary navigation | F4 |
| Any font that is not Bebas Neue or Inter | F1 |

### Screen structure

Every screen is: **top bar → content (packed from the top) → optional bottom bar.**

- Top bar: `bar` background, 56dp tall, back/home affordance left, title centred, nothing else.
- Content: `flex-start`. Never distributed.
- Bottom bar: only on the live workout screen.

### Touch targets

Minimum **56dp**, no exceptions. Any control that cannot be 56dp does not belong on that screen. Sweaty hands, phone at 1.5m on a floor stand.

---

## 5. Component specs

### 5.1 Live workout screen — the hero

**This screen is closely modelled on the layout of Timer Plus's Rounds screen** (`Screenshot_20260830_192402_Timer_Plus.jpg`). Same zones, same proportions, same order. Only the labels change.

```
┌────────────────────────────────────┐
│ ‹        PUSH DAY            ⚙     │  bar, 56dp
├────────────────────────────────────┤
│ ▓▓▓▓▓▓▓▓ slab-primary ▓▓▓▓▓▓▓▓▓▓▓▓ │
│      INCLINE DUMBBELL PRESS        │  ← where PREPARE sits
│                                    │
│        1 2 : 4 7                   │  ← black, ≥85% viewport width
│                                    │
├────────────────────────────────────┤
│ ░░░░░░░ slab-secondary ░░░░░░░░░░░ │
│            TARGET:                 │  ← where WORK: sits
│           4 × 6-10                 │
├────────────────────────────────────┤
│                                    │
│    3         ( ▶ )                 │  ← circular transport, canvas zone
│  SETS DONE   START                 │
│                                    │
├────────────────────────────────────┤
│ ▓▓▓▓▓  NEXT EXERCISE  ▓▓▓▓▓▓▓▓▓▓▓▓ │  ← replaces the tab bar
└────────────────────────────────────┘
```

**Zone mapping — do not deviate:**

| Timer Plus zone | REP content | Viewport height |
|---|---|---|
| Yellow `PREPARE` + big clock | Current exercise name + the stopwatch | 35–45% |
| Lime `WORK: 01:00` | `TARGET:` + `4 × 6-10` | 12–18% |
| Black zone with `3 / ROUNDS LEFT` + circular play | Sets-done stepper (`−` / count / `+`) + circular transport button | 20–25% |
| Bottom tab bar | Single full-bleed `NEXT EXERCISE` slab | 80dp |

- Numerals are the largest element on the screen by a wide margin. If they look too big, they are correct.
- `MM:SS` under an hour; `H:MM:SS` above. The clock **must not reflow or resize** at the hour boundary — reserve the width.
- Exercise name is `display-2`, black, on the yellow slab. Long names wrap to two lines; the clock does not shrink to accommodate them.
- If the session has no template, the lime slab reads `FREESTYLE` with no target.
- Sets-done stepper (D13): same 56dp square, `divider`-border, no-fill button used elsewhere (§5.7's stepper, at a smaller size) flanking the count on both sides. Count uses tabular figures so the column width doesn't shift between 1 and 2 digits.

### 5.2 Compact timer bar (D10)

The same clock, shrunk, for the transition screen. **It is the identical component in a compact variant — not a second timer, not a re-mount.** The running value must be visually continuous when the screen changes.

- `slab-primary`, full-bleed, **12–15% of viewport height**
- Clock at `display-1`, black, centred
- Current exercise name at `caption`, black, above the numerals
- Circular transport button shrinks to 56dp and moves inline to the right edge of the slab
- Pinned to the top. Does not scroll away when the input list scrolls.

### 5.3 Circular transport button

The one place `borderRadius` is permitted, because Timer Plus uses it and D12 makes Timer Plus the tiebreaker.

| Property | Value |
|---|---|
| Shape | Perfect circle |
| Size | 120dp on the live screen, 56dp in the compact bar |
| Fill | `slab-primary` |
| Icon | Black play / pause glyph, ~40% of diameter |
| Label | `START` / `PAUSE` in `slab-primary` text on canvas, beneath the circle (live screen only) |
| Reset | Separate 56dp circular outline button, `divider` border, no fill, left of the primary circle. Requires a long-press or a confirm — a stray tap must not wipe the clock. |

### 5.4 Flash burst (D11)

**Corrected in v1.1.** v1.0 specified a single slow pulse. That is wrong — Timer Plus fires a rapid burst.

| Property | Value |
|---|---|
| Coverage | **The entire screen.** Covers the status bar, the top bar, and every sibling. |
| Colour | `slab-primary` or `slab-secondary` — user-selectable, default `slab-secondary` |
| Pattern | **3 pulses**, each ~100ms on / ~100ms off, total burst ~600ms |
| Trigger | Every 30s crossing (configurable) while the clock runs |
| While paused | Never fires |

**I cannot verify the exact pulse count or timing from static screenshots — 3 × 100ms is my reading of "a few times in a second." Watch Timer Plus and correct the numbers if they're off.** Get this wrong and it either reads as a single blink or as a strobe.

Implementation constraints:
- Rendered as a sibling of the screen root. **Never nested inside a `ScrollView`** — an absolutely-positioned overlay inside a scroll view clips and scrolls with the content instead of covering the physical screen.
- Fires on the transition screen too, not just the live screen. The clock is still running there.
- Must not steal focus from an open keypad or text input.

### 5.5 Primary action

A `slab-primary` slab, full-bleed, ~80dp tall, black `label` text, centred. Not a button with a border. Not rounded.

### 5.6 List row — the pattern for every non-workout screen

**Modelled directly on the Timer Plus SETTINGS tab** (`Screenshot_20260830_192426_Timer_Plus.jpg`) and More tab (`Screenshot_20260830_192332_Timer_Plus.jpg`). Home, exercise picker, programmes, history and settings are all built from this one row and nothing else.

Anatomy: **full-bleed row, label hard-left, control hard-right, 1px `divider` between rows.** No card, no radius, no inset, no background fill.

| Property | Value |
|---|---|
| Height | 72dp minimum |
| Horizontal padding | 24dp on the row's own content only. The **divider spans the full screen width.** |
| Label | `label` (18), uppercase, `text-primary` |
| Sub-label | `caption` (14), `text-muted`, directly beneath the label. Optional. |
| Disabled row | Label drops to `text-muted`. Row stays visible, never hidden. |

Four variants, all right-aligned:

| Variant | Right-hand control | Used for |
|---|---|---|
| **Navigation** | `›` chevron, `text-muted` | Programmes, Archive, Progress, Import, Export |
| **Toggle** | Pill switch. Off = `text-muted` track, white knob. On = `slab-secondary` track and knob. | Cue toggles, warm-up flags |
| **Value** | Value in `text-muted` + `›` chevron | Flash interval, bar weight, load convention |
| **Slider** | `slab-secondary` track, `slab-secondary` knob, full row width | Nothing in Phase 1; reserved |

Header bar on list screens: title centred in `heading`, a `slab-secondary`-coloured `DONE` or `‹` at the appropriate edge. This is the one place accent colour may be used as text (§2 rule 2).

**Section grouping** uses vertical whitespace between row blocks, exactly as the Timer Plus settings screen separates SOUND from VOICE ASSIST. Never a card, never a heading chip.

### 5.6.1 Home screen composition

Home is: **slabs on top, list rows underneath.**

1. One `slab-primary` slab per template of the active programme (PUSH / PULL / LEGS), stacked, no gaps
2. One `slab-secondary` slab: `FREESTYLE`
3. A gap
4. List rows: `PROGRAMMES ›`, `PROGRESS ›`, `HISTORY ›`, `SETTINGS ›`

If no active programme exists, item 1 is replaced by a single `slab-primary` slab reading `CREATE A PROGRAMME`. Freestyle stays. This is the F4 fix.

### 5.7 Set input row (transition screen)

The compact timer bar takes only 12–15% of the screen, so **the input controls get the rest and must be large**. This is the second-most-used surface in the app.

```
┌────────────────────────────────────┐
│  SET 1        KG            REPS   │
│  [ − ]  22.5  [ + ]   [ − ] 10 [ + ]│
└────────────────────────────────────┘
```

**Corrected 2026-09-02 (R5 follow-up).** The mock above puts weight and reps controls side by side in one row. On a real device this doesn't fit: two 72dp stepper pairs plus a 64pt numeral each need more width than a phone has, and the numerals were squeezed to near-zero width — effectively invisible, reported by the user as "the +/- buttons don't work." Weight and reps controls now **stack vertically**, each getting the row's full width, with a small `KG`/`REPS` caption above each:

```
┌────────────────────────────────────┐
│  SET 1                             │
│  KG                                │
│  [W] [ − ]      22.5       [ + ]   │
│  REPS                              │
│      [ − ]       10        [ + ]   │
└────────────────────────────────────┘
```

| Property | Value |
|---|---|
| Row height | **88dp minimum**, grows to fit the stacked layout above |
| Numerals | `display-1` (64), tabular figures |
| Stepper buttons | **72dp squares**, `divider` border, no fill, black-on-canvas glyph |
| Long-press | Accelerates in two stages |
| Tap numeral | Opens a full-width keypad. Keys are **72dp minimum**. |
| Rows separated by | 1px `divider`. No cards, no gaps, no radius. |

Ghost values (last session's) render in `text-muted`. Confirmed values render in `text-primary`. A row becomes confirmed on any interaction, or via a one-tap confirm-all.

The `W` warm-up toggle is a 56dp square at the row's left edge, outline only, filling `slab-secondary` when active.

---

## 6. Screen inventory

Seven screens. Anything not on this list does not get built.

**Screens 1, 4, 5, 6 and 7 are built entirely from §5.6 list rows and §5.5 slabs. No other layout primitive is permitted on them.**

| # | Screen | Contains |
|---|---|---|
| 1 | **Home** | Per §5.6.1. |
| 2 | **Live workout** | Exactly the five zones in §5.1. **Nothing else.** No notes field, no set list, no scroll. |
| 3 | **Transition** | Compact timer bar pinned at top (§5.2, still running), then large set-input rows for the exercise just finished (§5.7), then a slab to select the next exercise. |
| 4 | **Exercise picker** | Muscle-group slabs, then type-ahead search, then inline create. |
| 5 | **Programmes** | Programme + template CRUD, JSON import, name-mapping review. |
| 6 | **History / Progress** | Session list; per-exercise chart. |
| 7 | **Settings** | Flash interval, cue toggles, Keep import, export, archive, debug. |

### Home screen fix (F4)

Content packs to the top. Slabs stack edge to edge. Secondary rows are dividered list rows, not centred underlined links floating in space.

---

## 7. Verification gate

**No production screen is built until this passes.**

1. Load Bebas Neue. Build a single throwaway showcase screen: the full §5.1 live layout at a fixed time, a working flash burst on a 5s loop, and one §5.7 set input row below the fold.
2. Run it on the real device in Expo Go.
3. Screenshot it.
4. Place that screenshot beside `Screenshot_20260830_192402_Timer_Plus.jpg` (the Rounds screen).
5. Check each row:

| Check | Pass condition |
|---|---|
| Font | No system-sans anywhere. Condensed, uppercase, heavy. |
| Slabs | Touch both screen edges. Zero corner radius. |
| Zone proportions | Yellow/lime/canvas/bottom bands match Timer Plus side by side. |
| Contrast | Black text on colour, not colour text on black. |
| Clock size | Numerals ≥85% of viewport width. |
| Transport button | Circular, filled, ~120dp. |
| Flash | Fills the **whole** screen including the status bar. Reads as a burst, not one blink. Compare against Timer Plus running live. |
| Timer continuity | Toggling between full and compact variants does not reset or visibly jump the running value. |
| Input size | Set-row numerals and stepper buttons operable at arm's length. |
| Cards | None present. |
| Readability | Legible from 1.5m, held at arm's length, peripheral glance. |

**If any row fails, fix the showcase screen. Do not proceed.** This gate exists so the design is litigated once, on one screen, instead of seven times across seven screens.

---

## 8. Known non-design defects

Tracked here so they are not confused with visual work.

| Item | Note |
|---|---|
| Blue gear circle, "Tools" pill | **Expo Go dev menu, not REP.** Will not exist in an EAS build. Ignore. |
| "Session backup failed — Call to function 'Ex...'" | Real bug. `expo-file-system` legacy API in `src/data/backup.ts`. Separate fix. |
| No templates on Home | Data state, not a bug — no active programme exists. The empty state is the design fix. |
| `HOME` yellow text in the header | Replace with a standard back chevron in the top bar. |
