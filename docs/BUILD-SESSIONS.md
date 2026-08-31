# REP — build sessions

Ten sessions. **One session per Claude Code context window.** Start each with `/clear`, paste only that session's brief, and stop when its exit check passes.

Each brief is self-contained on purpose. Do not paste the PRD into a session unless the brief says to.

---

## Session 0 — install and scaffold

**See `SETUP-GUIDE-WINDOWS.md` for the full step-by-step version of this.**

Summary: install Node.js (LTS), Git for Windows, VS Code and Claude Code (`irm https://claude.ai/install.ps1 | iex` in PowerShell). Create `Documents\rep`, put `CLAUDE.md` in the root and `PRD.md`, `BUILD-SESSIONS.md` and `keep-export.txt` in `docs/`. Then have Claude Code check current Expo docs, scaffold a TypeScript Expo project in that folder, initialise git, and create `docs/PROGRESS.md`.

**Commit before every session.** Git is your undo button when a session goes sideways.

---

## Session 1 — data layer

**Goal:** the schema, migrations and repository layer exist and are proven to work. No UI.

**Read:** `CLAUDE.md`, and §8 (Data model) plus §7 (Multi-user readiness) of `docs/PRD.md`. Nothing else.

**Do:**
- Install and configure `expo-sqlite`, Drizzle ORM, Drizzle Kit
- Write `src/data/schema.ts` implementing §8 exactly, including every column in invariant 3
- Generate the initial migration and run it on app start
- Write `src/data/repositories/` with typed CRUD for each table, all `user_id`-scoped, soft-delete only
- Seed a single local user with a generated UUID on first launch
- `src/theme.ts` and `src/strings.ts` from the tokens in `CLAUDE.md`
- Set up Jest; write repository round-trip tests

**Do not:** build any screen, any navigation, or any parser.

**Exit check:** `npm run typecheck` and `npm run test` pass. A test creates a session with two exercises and five sets, reads them back, soft-deletes one, and confirms it is excluded from reads but still present in the table.

**Commit:** `feat(data): schema, migrations, repositories`

---

## Session 2 — Google Keep importer

**Goal:** the real workout history is in the database.

**Read:** `CLAUDE.md`, FR-8.4 in `docs/PRD.md`, and `docs/keep-export.txt` (paste your Keep notes into this file first).

**Do:**
- `src/domain/keepParser.ts` — a pure function, text in, structured sessions out. Must handle:
  - `exercise - 22.5kg 10 8 7 5 12.5kg 10 7.5kg 10` → 4 working sets at 22.5kg plus 2 drop sets
  - `bw 10 10 8 6` → bodyweight sets
  - trailing annotations `(superset)`, `(too light)`, `(change)` → notes
  - unparseable tokens (`153³Ẁ`, `AWW3W4`, `103`) → returned in a `needsReview` array, **never silently dropped**
  - dates fused into the previous line (`bw 428 Jul`)
- Unit tests using the real export as fixture
- A minimal import screen: paste text → parse → review list → confirm
- **The dumbbell convention reconciliation step:** flag exercises whose recorded load halves or doubles across the history and ask the user which convention applied to each period. Around 16 Aug, incline dumbbell press goes 45→22.5 and flat dumbbell press 40→20. Both are convention changes, not strength changes.
- Store the original raw text alongside every imported session

**Do not:** build the logging screen or the exercise picker.

**Exit check:** the full Keep history imports. Every exercise has a load convention. Nothing is dropped without appearing in the review list.

**Commit:** `feat(import): google keep parser and reconciliation`

---

## Session 3 — session lifecycle

**Goal:** start a session, survive being killed, end a session.

**Read:** `CLAUDE.md`, FR-1.1 to FR-1.3 in `docs/PRD.md`.

**Do:**
- expo-router navigation skeleton
- Home screen listing templates as large buttons plus a FREESTYLE option (templates can be stubbed from the data layer)
- Start session writes the row before rendering
- On launch, if a session is in progress and under 6 hours old, open straight into it
- End session
- Session elapsed timer (FR-4.7)
- Apply the theme tokens

**Do not:** build set logging yet.

**Exit check:** start a session, force-kill from the Android task switcher, reopen, land back in the same session with the elapsed timer correct.

**Commit:** `feat(session): lifecycle and crash restore`

---

## Session 4 — the core logging loop

**This is the most important session in the build.**

**Read:** `CLAUDE.md`, §6.3 of `docs/PRD.md` in full.

**Do:**
- Exercise view showing last session's sets as muted ghost values, pre-filled and editable
- "Last session" = most recent session containing this exercise, **not** the same weekday
- One-tap confirm when the ghost values are correct
- Large steppers, long-press to accelerate, tap-numeral for keypad
- Synchronous write on commit, before any animation
- Warm-up `W` toggle (FR-3.7): muted, indented, retroactively togglable, kept in pre-fill, excluded from charts
- Drop sets attached to the preceding working set (FR-3.8)
- Superset grouping (FR-3.9)
- Per-exercise and per-session notes
- Add, skip and reorder exercises mid-session
- **FR-3.12 — load convention permanently displayed** with the derived total beneath the weight field. Do not cut this.

**Exit check:** log a full push session, 7 exercises and about 25 sets, in under 90 seconds of screen time. `PER DUMBBELL` and `45 kg total` are visible at all times on dumbbell work.

**Commit:** `feat(logging): core set loop`

---

## Session 5 — rest clock

**Read:** `CLAUDE.md`, §6.4 of `docs/PRD.md`.

**Do:**
- Auto-start on set commit, counting up, no button
- 30-second full-screen accent flash, roughly 300ms
- Configurable interval; optional sound, vibration and camera flash, all defaulting **off**
- `expo-keep-awake` for the whole session, brightness untouched
- Clock permanently visible on the logging screen — no tab, no drawer
- Rest suppressed between superset pairs
- Per-exercise target rest, default 60s, shown as a soft marker not an alarm

**Exit check:** complete a session without leaving the logging screen and without the display sleeping. Flash is visible from 1.5m in peripheral vision.

**Commit:** `feat(timer): rest clock and flash cue`

---

## Session 6 — exercise picker

**Read:** `CLAUDE.md`, §6.2 of `docs/PRD.md`.

**Do:**
- Muscle-group chips first, always
- Type-ahead search with keyboard pre-focused, fuzzy-matching name and aliases so `pull back row machinr` resolves
- Inline "Add [text] as new exercise" with muscle group pre-selected and a load-convention picker
- Results ranked by frequency and recency

**Do not:** bundle an external exercise database. The library comes from imports only.

**Exit check:** any exercise in the history is reachable in under 3 seconds. A new custom exercise is created without leaving the picker.

**Commit:** `feat(exercises): picker and inline create`

---

## Session 7 — templates and programme import

**After this session the app replaces both Google Keep and the WhatsApp photo.**

**Read:** `CLAUDE.md`, §6.5 and §6.6 of `docs/PRD.md`, plus Appendix A.

**Do:**
- Programme and template CRUD; one active programme drives the home screen
- Save a completed session as a template
- **Programme JSON import** (FR-6.1, 6.2): paste box and `.json` share-target intake
- Strict validation with field-level human-readable errors, never a stack trace
- **Name-mapping review screen** (FR-6.4): fuzzy-match every programme exercise against the library with a confidence indicator; accept, remap or create. Nothing imports silently
- **Session plan strip** (FR-5.6): horizontally scrollable list of the day's remaining exercises in programme order, completed ones dimmed, tap to jump
- **Target display** (FR-5.7): `4 × 6-10` on the exercise header, faint target on the active set row. Never pre-fills, never blocks

**Exit check:** the "One Month. One Focus." programme imports end to end in under two minutes with at least 80% of exercises auto-matched. A full session runs without opening WhatsApp.

**Commit:** `feat(programme): templates, json import, plan strip`

---

## Session 8 — plate calculator and archiving

**Read:** `CLAUDE.md`, FR-3.13 and FR-5.8 of `docs/PRD.md`.

**Do:**
- `src/domain/plates.ts` as pure, tested functions: forward (target → plates per side) and reverse (plates → total)
- **Bar weight is required per exercise with no default.** Unset bar weight blocks the calculator with a prompt. Never guess
- Configurable plate inventory with denominations, colours and quantity per side; defaults editable
- Closest-achievable load with an explicit delta when a target is unreachable. Never silently round
- Plate chips rendered in real colours
- Calculator respects the exercise's load convention
- Archive for templates and programmes: **multi-select with Select All and one bulk action**, reversible the same way, never destructive, archived items retain their links to historical sessions

**Exit check:** an 80kg squat resolves to correct plates per side. An entire retired programme is archived in one action and restored in one action.

**Commit:** `feat(plates): calculator, inventory, archiving`

---

## Session 9 — progress chart

**Read:** `CLAUDE.md`, §6.7 of `docs/PRD.md`.

**Do:**
- One screen: pick an exercise, see top **working**-set weight and reps over time on a shared axis
- Warm-up sets excluded
- Session table beneath the chart, most recent first, in Keep shorthand
- Nothing else. No 1RM, no volume, no strength score, no heatmap

**Exit check:** the incline dumbbell press chart shows a continuous line across the 16 August convention change, with no artificial 50% drop.

**Commit:** `feat(progress): per-exercise chart`

---

## Session 10 — polish, export, field test

**Do:**
- Export to CSV and JSON via the Android share sheet
- Automatic database backup on session end, last 30 retained
- Visual pass against the design tokens; check contrast at arm's length in bright light
- Measure battery drain across a 75-minute session with the wake lock active
- Instrument taps-per-set and time-per-set; expose on a debug screen
- Build a release APK with EAS

**Exit check:** train a real session using only REP. Log every issue in `docs/PROGRESS.md` afterwards, do not fix them mid-session.

**Commit:** `feat: export, backup, release build`

---

## Keeping sessions inside the context window

| Rule | Why |
|---|---|
| `/clear` between sessions, never `/compact` across them | Compaction carries stale detail forward and quietly degrades output |
| Paste one brief only | The full PRD is over 5,000 words. Loading it every session wastes most of the window before work starts |
| Ask for a plan, approve it, then let it code | A wrong plan caught in 200 tokens beats a wrong implementation caught in 20,000 |
| Commit at the end of every session | Cheap rollback when a session goes wrong |
| `docs/PROGRESS.md` is the memory between sessions | Not the context window |
| If a session starts sprawling, stop it and split the brief | A session that will not finish cleanly will not finish correctly |
| Never let it "just also fix" something from another session | That is how scope creep enters a 10-day build |
