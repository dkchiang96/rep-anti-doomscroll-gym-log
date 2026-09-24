# REP — rebuild sessions

Eight sessions. **One session per Claude Code context window.** `/clear` between every session, paste only that session's brief, stop when its exit check passes.

This supersedes `BUILD-SESSIONS.md` for the UI layer. The data layer built by the original Sessions 1–2 is kept.

> The Timer Plus reference screenshots cited in these briefs are not included in the repository. See the note at the top of `DESIGN-SPEC.md`.

---

## Before you start

**1. Export your data first.** If you have imported your Keep history into the app, open Export data on the home screen and save both the CSV and the JSON off-device. Nothing in this plan is supposed to touch your data, but you are about to delete most of the app's source files and you want a way back.

**2. Commit on a clean tree, then branch.**

```
git status
git checkout -b rebuild-ui
```

**3. Commit at the end of every session.** Git is the undo button when a session goes sideways.

**4. Paste `DESIGN-SPEC.md` in full for sessions R1 onward.** It is short, it is the authority for every visual decision, and a session that hasn't read it will re-invent rounded cards. Do **not** paste `PRD.md` — it describes the old interaction model and will actively mislead.

---

## What is changing and why

The original build shipped a **log-driven** loop: log a set, a rest timer auto-starts, log the next set. In use that turned out to be wrong. The rebuilt app is **timer-driven**: the screen is a large count-up clock almost all the time, and logging happens once per exercise, on a separate screen, while the clock keeps running.

| Decision | Consequence |
|---|---|
| The rest timer is removed entirely | Session 5's rest-clock code is deleted |
| One clock, manually started, runs all session | New `useStopwatch`, `START`/`PAUSE`/`RESET` |
| Screen flash survives, as a 3-pulse burst every 30s | Flash decouples from rest, attaches to the stopwatch |
| Sets are logged once per exercise, not once per set | New transition screen; the live screen has no set list |
| Timer Plus is the visual reference | Full-bleed colour slabs, black text on colour, no cards |

---

## R0 — strip and stabilise

**Goal:** the data layer is intact and proven, the UI is gone, and the two known runtime bugs are fixed. Nothing renders except a placeholder.

**Read:** `CLAUDE.md`. Nothing else.

**Delete:**

```
src/app/index.tsx
src/app/session.tsx
src/app/import.tsx
src/app/programmes.tsx
src/app/import-programme.tsx
src/app/progress.tsx
src/app/archive.tsx
src/app/export.tsx
src/app/debug.tsx
src/components/logging/          (entire directory)
src/components/progress/         (entire directory)
src/components/HomeHeaderButton.tsx
src/domain/restClock.ts
assets/sounds/rest-beep.wav
```

Delete the corresponding test files for `restClock` only. **Keep every other test.**

**Keep, untouched:**

```
src/data/                        all schema, migrations, repositories, db.ts,
                                 DatabaseProvider.tsx, id.ts
src/domain/                      everything except restClock.ts
src/theme.ts, src/strings.ts     (rewritten in R1, not deleted)
src/state/instrumentationStore.ts
drizzle/                         all migrations
```

`src/domain/` holds the pure logic — parsers, plate maths, fuzzy matching, ghost pre-fill, convention derivation, chart points. **None of it is UI and none of it is being rebuilt.** Do not touch it.

**Do:**
- Reduce `src/app/_layout.tsx` to a minimal `expo-router` `Stack` that gates on DB readiness and renders a single placeholder `src/app/index.tsx` showing the word `REP`.
- **Fix the session-backup crash.** `src/data/backup.ts` throws `Call to function 'Ex...'` on every session end. It is an `expo-file-system` legacy API call that no longer resolves. Check the installed `expo-file-system` version's actual API and fix the call. Keep the existing try/catch so a backup failure can never block ending a session.
- **Fix `npm run lint`.** It fails with `Cannot find module 'eslint'` — `eslint` was auto-bootstrapped into `node_modules` by `expo lint` and later pruned because it was never a declared devDependency. Add it properly.
- Remove the now-dead `expo-audio`, `expo-camera`, and `expo-haptics` dependencies **only if nothing else imports them.** Grep first. `expo-keep-awake` stays — R3 needs it.

**Do not:**
- Drop, alter, or regenerate any database column. The rest-cue columns on `user` and `exercise.target_rest_seconds` become unused. **Leave them.** A destructive migration against a database holding real imported history is a much bigger risk than five dead columns. This is deliberate, not an oversight.
- Rebuild any screen.
- Touch `src/domain/` beyond deleting `restClock.ts`.

**Exit check:** `npm run typecheck`, `npm run test` and `npm run lint` all pass. `npx expo export --platform android` bundles. The app launches on device and shows `REP` with no red screen and no backup error toast.

**Commit:** `chore: strip UI layer, fix backup and lint`

---

## R1 — design system and the verification gate

**This session is the whole point. Do not let it end early.**

**Goal:** the design system exists, is loaded on a real device, and has been visually confirmed against the Timer Plus screenshots.

**Read:** `CLAUDE.md`, `DESIGN-SPEC.md` in full. Attach the five Timer Plus screenshots.

**Do:**
- Install and load **Bebas Neue** via `expo-font`. Also load **Inter** for body text.
- **The app must not render until the fonts have loaded**, and must log a visible error if they fail. The previous build fell back to the system font silently; that single failure caused most of the visual problems.
- Rewrite `src/theme.ts` with the §2 colour tokens and §3 type scale from `DESIGN-SPEC.md`. Colours are exported as named tokens only — **no component may contain a literal hex value.**
- Build `src/components/ui/`:
  - `Slab` — full-bleed coloured band. `borderRadius: 0`, no horizontal margin, height given as a fraction of viewport or a fixed dp value.
  - `Clock` — the `MM:SS` display, minutes running past 60, tabular figures, width reserved for three digits of minutes so it never reflows. §5.1.
  - `TransportButton` — the circular start/pause control. §5.3.
  - `ListRow` — with all four variants from §5.6: navigation, toggle, value, slider.
  - `FlashOverlay` — full-screen 3-pulse burst, §5.4. **Rendered as a sibling of the screen root, never inside a `ScrollView`.**
  - `SetInputRow` — §5.7, fixed height, flex-ratio internals.
- Build a throwaway `src/app/showcase.tsx` containing: the complete §5.1 live layout at a fixed time of `12:47`, one `SetInputRow` in confirmed state and one in ghost state, three `ListRow`s (one of each of the first three variants), and a button that fires the flash burst.

**Do not:**
- Copy pixel values out of any mock. The mock reference frame is 480px wide and maps to roughly 400dp on device — a factor of about 1.2. **All fixed sizes come from `DESIGN-SPEC.md` in dp; everything else is a percentage or a flex ratio.**
- Build any real screen.
- Use `borderRadius` anywhere except `TransportButton`.

**Exit check — this is a human gate, not a test suite.**

Run `showcase.tsx` on the real device. Screenshot it. Put the screenshot beside `Screenshot_20260830_192402_Timer_Plus.jpg` and check every row:

| Check | Pass condition |
|---|---|
| Font | No system sans anywhere. Condensed, uppercase, heavy. |
| Slabs | Touch both screen edges. Zero corner radius. |
| Proportions | Yellow / lime / canvas / bottom bands match Timer Plus side by side |
| Contrast | Black text on colour. Never accent-coloured numerals on black. |
| Clock size | Numerals fill ≥85% of screen width |
| Clock stability | Watch it pass 60:00. It must not resize, reflow, or clip. |
| Flash | Fills the **entire** screen including the status bar. Reads as a burst, not one blink. |
| Cards | None present |
| Touch targets | Every control ≥56dp |
| Readability | Legible from 1.5m in peripheral vision |

**If any row fails, fix it in this session.** Do not proceed to R2. This gate exists so the design is argued once, on one screen, instead of seven times across seven screens.

**Commit:** `feat(ui): design system and showcase`

---

## R2 — navigation shell and home

**Goal:** the app opens to a real home screen and no screen can strand the user.

**Read:** `CLAUDE.md`, `DESIGN-SPEC.md` §5.5, §5.6, §5.6.1, §6.

**Do:**
- `expo-router` `Stack`. Every secondary screen registers a header with a back control that falls back to Home when there is no push history (`router.canGoBack() ? router.back() : router.replace('/')`). The previous build stranded the user on the Import screen; that must not recur.
- Home per §5.6.1: template slabs for the active programme, then a `FREESTYLE` slab, then `PROGRAMMES` / `PROGRESS` / `HISTORY` / `SETTINGS` list rows.
- **Empty state:** with no active programme, the first slab reads `CREATE A PROGRAMME`. Freestyle stays. Import, Export, Archive and Debug all live under Settings, **not on Home.**
- Starting a session writes the session row before navigating. **The stopwatch does not start.** It renders at `00:00`, paused, waiting for a manual `START`.
- Restore: on launch, an in-progress session under 6 hours old opens straight into the live screen. The stopwatch resumes from its stored start time minus accumulated pause.
- Stub `src/app/settings.tsx` as a list of navigation rows to the screens R5 will build. Rows for unbuilt screens are present and disabled, never hidden.

**Do not:** build the live workout screen or any settings destination.

**Exit check:** Home renders correctly with and without an active programme. Every reachable screen returns to Home. Starting a session lands on a placeholder live screen with the clock at `00:00`, **not running.**

**Commit:** `feat(nav): shell and home screen`

---

## R3 — the live workout screen

**The most important session in this rebuild.**

**Read:** `CLAUDE.md`, `DESIGN-SPEC.md` §5.1, §5.3, §5.4, and decisions D1–D6, D11, D13.

**Do:**
- `src/app/session.tsx` — exactly the five zones of §5.1 and **nothing else**. No notes field, no set list, no scroll view, no back button.
- `src/domain/stopwatch.ts` — pure, tested. Given a start timestamp, accumulated pause duration, and now, return elapsed ms. Must survive the app being backgrounded and killed: elapsed is always derived from timestamps, never from a tick counter.
- `useStopwatch` hook — 250ms tick, `start` / `pause` / `reset`. State persists to the session row so a force-kill restores the correct elapsed time.
- Flash burst: fires on every 30s crossing while running, never while paused. Count crossings by diffing `Math.floor(elapsed / interval)` between readings, so a lagged tick after backgrounding still fires correctly rather than being skipped.
- `useKeepAwake()` for the whole screen.
- `SETS DONE` per D13: tap to increment, long-press to decrement, resets when the exercise changes. **Completely decoupled from the clock** — it must not start, stop, reset, or flash anything, and the clock must not change it.
- `RESET` is **long-press only.**
- `NEXT EXERCISE` navigates to the transition screen. **The clock keeps running.**

**Do not:** build set logging, the transition screen, or the exercise picker on this screen.

**Exit check:** on a real device — start a session, press START, confirm the flash fires every 30s and reads as a burst. Watch the clock pass 60:00 without clipping. Force-kill from the task switcher, reopen, and confirm elapsed time is correct. Tap SETS DONE several times and confirm the clock is unaffected. Confirm nothing on screen but the five zones.

**Commit:** `feat(session): live workout screen and stopwatch`

---

## R4 — the transition screen

**Goal:** log the exercise just finished and choose the next one, without the clock stopping or disappearing.

**Read:** `CLAUDE.md`, `DESIGN-SPEC.md` §5.2, §5.7, and decisions D7, D8, D10.

**Do:**
- `src/app/transition.tsx` — compact timer bar pinned at top (§5.2), scrollable list of `SetInputRow`s, `SELECT NEXT EXERCISE` slab at the bottom.
- **The clock is the same running stopwatch, not a second instance.** Value must be visually continuous across the navigation. Lift the stopwatch into context or a Zustand store rather than mounting a second hook.
- Ghost pre-fill from `src/domain/ghostPrefill.ts` (already built, do not rewrite): last session's sets for this exercise, in `text-muted`, editable. A row becomes confirmed on any interaction.
- One-tap `CONFIRM ALL` when the ghost values are already correct.
- Add a set, remove a set, attach a drop set to the preceding working set, toggle warm-up `W`.
- Writes are synchronous to SQLite on confirm, before any animation.
- Reuse `src/domain/loadConvention.ts` (already built): the convention label and derived total are permanently visible on every weight field. **This is a data-integrity control, not decoration. Do not cut it.**
- Reuse `src/components/logging`-era logic for the plate calculator by rebuilding its UI against the new design system; `src/domain/plates.ts` is unchanged.
- `SELECT NEXT EXERCISE` opens the picker (R5), then returns to the live screen with the new exercise loaded.

**Do not:** stop, reset, or re-mount the clock at any point. Build the picker itself here.

**Exit check:** on a real device — with the clock running, tap NEXT EXERCISE, confirm the clock keeps counting in the compact bar with no jump. Log five sets including one drop set and one warm-up. Confirm the flash still fires on this screen. Return to the live screen and confirm the clock is still continuous. Verify the sets are in the database.

**Commit:** `feat(logging): transition screen`

---

## R5 — list screens

**Goal:** everything that is not the workout loop, built entirely from `ListRow` and `Slab`.

**Read:** `CLAUDE.md`, `DESIGN-SPEC.md` §5.5, §5.6, §6.

**Do:** rebuild, against the new design system, using the existing repositories and domain functions unchanged:
- **Exercise picker** — muscle-group slabs, type-ahead search with keyboard pre-focused, inline create. `src/domain/fuzzyMatch.ts`, `muscleGroups.ts`, `exerciseRanking.ts` are already built and tested. Do not rewrite them.
- **Programmes** — programme and template CRUD, one active at a time.
- **Programme JSON import** — paste box and file picker, field-level validation errors, mandatory name-mapping review. `src/domain/programmeSchema.ts` and `programmeMatching.ts` are already built.
- **Keep import** — `src/domain/keepParser.ts`, `conventionReconciliation.ts`, `reviewSuggestions.ts` already built.
- **Archive** — multi-select with Select All and one bulk action, reversible.
- **Settings** — flash interval, flash colour, cue toggles, plate inventory, and navigation rows to Import, Export, Archive and Debug.
- **Export** — CSV and JSON via the share sheet.

**Do not:** rewrite anything in `src/domain/` or `src/data/`. This session is UI only. If a domain function seems wrong, stop and flag it rather than editing it.

**Exit check:** every screen reachable from Home or Settings, every screen returns to Home, no cards or rounded containers anywhere, all touch targets ≥56dp.

**Commit:** `feat(ui): list screens`

---

## R6 — history and progress

**Read:** `CLAUDE.md`, `DESIGN-SPEC.md` §5.6.

**Do:**
- **History** — reverse-chronological session list, each row showing date, template name and duration. Tapping one shows that session's exercises in Keep shorthand (`src/domain/keepShorthand.ts`, already built).
- **Progress** — pick an exercise, see top working-set weight and reps over time. `src/domain/progressChart.ts` and `src/data/repositories/progressRepository.ts` are already built and tested; this is a render against the new tokens, nothing more.
- Chart colours: weight in `slab-primary`, reps in `slab-secondary`, on `bg`. This is the one place accent colour is used as a foreground, because a line has no fill area.
- Nothing else. No 1RM, no volume, no heatmaps.

**Exit check:** the incline dumbbell press chart shows a continuous line across the 16 August convention change with no artificial 50% drop. `progressRepository.test.ts` already asserts this — confirm it still passes.

**Commit:** `feat(progress): history and chart`

---

## R7 — field test and release

**Do:**
- Verify every touch target on every screen against 56dp. The previous build had 32–44dp controls in dense rows; those rows no longer exist, but check.
- Confirm no component contains a literal hex colour: `grep -rn "#[0-9A-Fa-f]\{6\}" src/ --include="*.tsx"` should return nothing outside `theme.ts`.
- Measure battery drain across a 75-minute session with the wake lock active, using the debug screen's battery readout.
- Build a release APK: `npx eas login` then `npx eas build --platform android --profile preview`. **Run these yourself** — they need your Expo account and upload to Expo's servers.
- **Train a real session using only REP.** Log every issue afterwards in `docs/PROGRESS.md`. Do not fix anything mid-session.

**Exit check:** one complete real workout logged in REP, with Google Keep and Timer Plus both closed.

**Commit:** `feat: release build`

---

## Rules for every session

| Rule | Why |
|---|---|
| `/clear` between sessions, never `/compact` across them | Compaction carries stale detail forward and quietly degrades output |
| Paste `DESIGN-SPEC.md`, never `PRD.md` | The PRD describes the old rest-timer interaction model and will actively mislead |
| Ask for a plan, approve it, then let it code | A wrong plan caught in 200 tokens beats a wrong implementation caught in 20,000 |
| Commit at the end of every session | Cheap rollback |
| Never let it "just also fix" something from another session | That is how a rebuild becomes a rewrite |
| **Never let it touch `src/domain/` or `src/data/`** outside R0 | That code is tested, working, and not what you were unhappy with |
| Verify on device, not on `expo export` | The original build passed `expo export` on every session and still shipped a 500 error and a crash to your phone |
