# REP — progress log

## 2026-08-31 — Session 1: data layer

Shipped the schema, migrations, and repository layer per the brief. No UI or navigation added beyond gating the existing root layout's render on DB readiness.

**What shipped:**
- `src/data/schema.ts` — all 9 tables from PRD §8, with invariant-3 columns (`user_id`, `created_at`, `updated_at`, `deleted_at`, `sync_state`) applied to every table except `user` itself.
- Drizzle + drizzle-kit configured for `expo-sqlite`; initial migration generated to `drizzle/`.
- `src/data/db.ts` — opens the DB, runs migrations, seeds the single local user (UUID) on first launch. Wired into `src/app/_layout.tsx`, which now gates rendering the existing tabs behind DB readiness.
- `src/data/repositories/` — typed CRUD (create/get/list/update/soft-delete) for all 9 tables, all scoped by `user_id`.
- `src/theme.ts`, `src/strings.ts` from the CLAUDE.md tokens.
- Jest configured; repository round-trip test passes (session + 2 exercises + 5 sets, soft-delete one, confirms exclusion from scoped reads and presence in a raw table query).

**Deviations from the brief:**
- Tests run against `better-sqlite3` (in-memory, dev-dependency only) applying the same drizzle-kit-generated SQL, since `expo-sqlite` only runs in a real RN/Hermes runtime and can't execute under Jest. The app itself still runs on `expo-sqlite` exclusively.
- IDs generated via the `uuid` package rather than a native crypto module, so ID generation behaves identically in the app and under Jest. Note: `uuid@14+` is ESM-only and breaks Jest's CJS loader — pinned to `uuid@^11`.
- Added `babel-plugin-inline-import` (not in the original plan) — discovered while smoke-testing that the app actually bundles: Metro's default transformer tries to parse `.sql` migration files as JS, so the raw SQL needs to be inlined as a string literal at the babel step instead.
- Also added `.wasm` to Metro's `assetExts` so `expo-web` (already present in the scaffold, unrelated to this session) keeps bundling — `expo-sqlite`'s web backend needs it. Not required for the Android target.
- Verified via `npx expo export --platform android` and `--platform web` (Metro bundling only, no emulator) rather than a live device/browser session, since there is no screen yet to interact with.

**Exit check:** `npm run typecheck` and `npm run test` pass.

**Commit:** `feat(data): schema, migrations, repositories`

## 2026-08-31 — Session 1 follow-up: fix Expo Go 500 on launch

User tested on a real device via Expo Go and hit an HTTP 500 from the dev server. `expo export` (static bundling, used to smoke-test Session 1) had not caught this because it doesn't request the Hermes-bytecode dev bundle Expo Go actually uses.

**Root cause:** Metro's `unstable_enablePackageExports` resolver mishandles `drizzle-orm`: `drizzle-orm/expo-sqlite/driver.js` imports a sibling file (`../logger.js`) that sits outside `expo-sqlite`'s own `exports` subpath boundary in `drizzle-orm/package.json`. Metro's exports-aware resolver refused to follow that relative import once package-exports resolution was enabled (Metro's default), even though the file exists on disk and plain relative resolution would find it.

**Fix:** `config.resolver.unstable_enablePackageExports = false;` in `metro.config.js`, falling back to Metro's older resolution behavior. Verified against the exact bundle URL Expo Go requests (`.../entry.bundle?...&transform.bytecode=1&...`), which now returns 200 instead of 500. `npm run typecheck` and `npm run test` still pass.

**Commit:** `fix(build): disable metro package-exports resolution for drizzle-orm compat`

## 2026-08-31 — Session 1 follow-up 2: fix crypto.getRandomValues crash

With the bundling error fixed, the app got past the splash screen but then crashed on launch: `crypto.getRandomValues() not supported`, thrown from `src/data/id.ts`.

**Root cause:** `uuid`'s RNG depends on the Web Crypto `crypto.getRandomValues()` API. Node provides this natively (Node 19+), which is why Jest never caught it, but Hermes (React Native's JS engine) does not provide it out of the box.

**Fix:** added `react-native-get-random-values` and imported it for its side effect at the top of `src/data/id.ts`, before `uuid`. It patches `global.crypto.getRandomValues` using a native module — but only if `global.crypto.getRandomValues` isn't already a function, so it's a no-op under Jest (Node already has one) and doesn't touch `TurboModuleRegistry` there. `npm run typecheck`, `npm run test`, and `npx expo export --platform android` all still pass.

**Commit:** `fix(data): polyfill crypto.getRandomValues for uuid on Hermes`

## 2026-08-31 — Session 2: Google Keep importer

Shipped the Keep text parser, dumbbell convention reconciliation, and a minimal import screen, all validated against the real `docs/keep-export.txt` fixture (438 lines, ~40 sessions, June–August).

**What shipped:**
- `src/domain/keepParser.ts` — pure `parseKeepExport(text, { year })`. Handles working sets, drop sets (each subsequent weight group after the first in a line), bodyweight (`bw`) sets, trailing `(...)` annotations as notes, and dates fused onto the previous line (`bw 428 Jul` → `bw 4` + a new `28 Jul` session). Every unparseable token (`153³Ẁ`, `AWW3W4`, out-of-range rep counts like `103`, mangled tokens like `10AW4`) is reported in `needsReview`, never dropped or guessed. Lines with no weight/bw token at all (`incline smith - 4`, duration-only lines like `inclined walk`) are not force-fit into a set — they're flagged for manual review instead.
- `src/domain/conventionReconciliation.ts` — pure `detectConventionCandidates` (generic ~2x average-weight-jump detector across session history, not hardcoded to any exercise name) and `applyConventionDecisions` (rescales the pre-breakpoint segment to match the user's chosen locked convention). `buildConventionQuestions` additionally requires an explicit convention answer for any exercise named with "dumbbell", even with no detected jump, since per-side-vs-total ambiguity is inherent to the equipment.
- `src/data/repositories/importRepository.ts` — `importKeepSessions` orchestrates the write: dedupes exercises by case-insensitive name, infers `muscle_group` (free text, keyword-based) and `equipment_type` (uses the real per-set bodyweight signal first, falls back to name keywords), locks `load_convention` from the reconciliation decisions or `bodyweight`/`total` defaults, and chains drop-set `parentSetId` to the immediately preceding set. All writes go through the existing per-table repositories.
- `src/app/import.tsx` — paste box + required year field → parse → review screen (convention toggles + needsReview list, nothing hidden) → confirm → summary. Wired to a temporary "Import" tab in `app-tabs.tsx` since there's no real navigation yet (Session 3's job).
- `src/data/DatabaseProvider.tsx` + `_layout.tsx` update — a small React Context exposing `{ db, userId }` to screens. This didn't exist after Session 1 (`initDatabase()`'s result was discarded); any screen needing the database would have hit this gap, not just the importer.
- Schema: added nullable `session.raw_import_text` to store the verbatim Keep text per imported session (FR-8.4's last bullet); generated migration `0001_sparkling_vector`. Updated `src/data/__tests__/testDb.ts` to apply all journal migrations in order instead of hardcoding `0000`.
- Tests: `keepParser.test.ts` and `conventionReconciliation.test.ts` (unit cases plus full runs against the real fixture — confirms every known garbage token surfaces in `needsReview` and the 16 Aug incline/flat dumbbell press breaks are detected with no false positives elsewhere), and `importRepository.test.ts` (round-trips a small Keep paste through parsing, reconciliation, and every repository, checking dedup, normalized weights, and drop-set chaining in the actual SQLite schema).

**Deviations from the brief:**
- **Year is a required screen input, not inferred.** Keep dates carry no year, and the file's date order isn't reliably newest-first (e.g. `25 Aug` appears after `21 Aug` in the raw export), so an auto-decrementing year-rollover heuristic would misfire. A single flat year applies to the whole paste; a log spanning a real year boundary needs two separate imports.
- **`muscle_group` and non-dumbbell/non-bodyweight `equipment_type` are keyword-guessed, not blocked on a prompt.** Both are free/editable fields (not the invariant-8 locked field), unlike `load_convention`, `bar_weight_kg`, or plate denominations, which the brief's "never guess" rule is really protecting. Session 6's exercise picker is where these get a real editing UI.
- **Session `startedAt`/`endedAt` use a fixed neutral time (noon) with `endedAt = startedAt`**, since Keep never recorded times. Explicitly marks each imported session closed with zero known duration rather than fabricating a plausible-looking workout length.
- **The dumbbell-convention safety net is name-based** (`/\bdumbbell\b/i`) for exercises with no detected ratio jump, so an exercise like "hammer curl" (no literal "dumbbell" in the name) relies on the generic jump detector rather than the mandatory-question rule. Not caught by either in this fixture, but worth knowing as a gap the exercise picker will need to cover later.
- **Entry point is a temporary "Import" tab**, not a link on the home screen as originally planned — `app-tabs.tsx` uses `NativeTabs`, which needs a declared trigger per route rather than an arbitrary in-page link. Session 3 replaces this tab bar entirely.

**Exit check:** full history imports cleanly (`npm run typecheck` and `npm run test` pass, 20 tests). Every exercise created during import gets a `load_convention` (`bodyweight`, or the reconciled/default `per_side`/`total`). Verified via test assertions and a manual candidate dump that the only two flagged convention changes in the real fixture are incline and flat dumbbell press at their expected dates, with no false positives. `npx expo export --platform android` still bundles cleanly with the new screen and tab.

**Commit:** `feat(import): google keep parser and reconciliation`

## 2026-08-31 — Session 2 follow-up: editable review + real-data parser fixes

User tested against the real export and reported the Import tab wasn't showing up (stale Metro bundle — resolved by `expo start --clear`, unrelated to the code), then asked for two things: an in-screen way to correct `needsReview` lines instead of just reading them, and a suggested "most likely correct" interpretation per item. Their example — `glute isolator -12kg 10 16kg 10 10` should read as 12kg×10, then 16kg×10 twice — turned out to be a real parser bug, not something needing manual review at all.

**Root cause of the parser bug:** the name/data split only recognized a dash as its own whitespace-separated token. `-12kg` (dash glued directly to the weight, no space) matched neither the exact-dash path nor the no-dash fallback's data-start scan, so the whole line fell through to "no sets could be parsed."

**Fixes:**
- `src/domain/keepParser.ts` — `parseExerciseLine` now also recognizes a dash fused to the first weight/`bw` token (`-12kg`, `-bw`) as the name/data separator. Added a regression test using the exact reported line.
- Same file — fixed a second, related bug the fixture exposed: the fused-mid-line-date splitter (`bw 428 Jul` → `bw 4` + new `28 Jul` session) could land its synthetic header immediately before a *real* `28 Jul` header two lines later in this export, producing a phantom empty session and a bogus "duplicate date" flag. `parseKeepExport` now collapses an empty session into the next header when they share the same date, rather than emitting it. Real duplicate dates with actual exercises in both blocks (the genuine `27 Aug` repeat in this export) are still flagged.
- Re-ran the full fixture after both fixes: the `needsReview` list dropped from 15 to 13 items, with the two spurious ones gone (the "28 Jul" empty-session flag and its associated duplicate-date flag) and no new gaps introduced.

**New:** `src/domain/reviewSuggestions.ts` — pure `suggestReviewResolution(item)`, tested in isolation. Per the user's own account, most garbage in this kind of export is an accidental keypress from carrying a phone mid-workout, not hidden data — so token-level issues (`unparseable token`, `rep count out of plausible range`) are marked non-editable with a "likely accidental, rest of the sets were still imported" message, since the exercise's real sets are already captured and there's nothing to recover. Whole-line failures (`no sets could be parsed from this line`) get a targeted suggestion — single-word garbage reads as "probably accidental," a line matching duration/cardio wording (`mins`, `walk`, `treadmill`, …) reads as "no weight — nothing to import," anything else reads as "no weight/bw token found" — and are marked editable.

**Import screen now supports live correction:** `src/app/import.tsx` reworked its state from a static parse result to mutable `sessions` + `reviewItems` arrays. Each editable review row shows the suggestion, a text field pre-filled with the raw line, an **Ignore** button (drops the flag, no data change — this was already the de facto behavior, now explicit) and an **Add** button that re-parses the edited text with `parseExerciseLine` and, on success, splices the recovered exercise entry into its original session (tracked via a new `ReviewItem.sessionIndex` field). If the corrected line still contains its own garbage token, that's re-surfaced as a new review row rather than silently accepted. Editing can introduce a newly-relevant dumbbell exercise, so convention questions are recomputed after every fix and merged with the user's existing answers (never resetting a toggle they'd already set).

**Scope limits, called out rather than silently handled:**
- Token-level review items (already-captured sets, just one bad token) are informational only in this pass — editing them would mean splicing a correction into an existing exercise entry's set list, not adding a new one, which is a different (and lower-value, per the user's own "mostly accidental" framing) code path. Left for later if it turns out to matter.
- "Session had no parseable exercises" and duplicate-date flags stay read-only — there's no single failed line to re-parse for either.

**Verification:** `npm run typecheck` and `npm run test` pass (27 tests, up from 20). `npx expo export --platform android` still bundles.

## 2026-08-31 — Session 3: session lifecycle

Replaced Expo's default scaffold navigation with REP's real navigation skeleton and shipped session start/restore/end (FR-1.1–FR-1.3, FR-4.7).

**What shipped:**
- `src/app/_layout.tsx` — swapped `NativeTabs` for a plain `expo-router` `Stack` (the PRD's logging screen explicitly has "no tab, no drawer, no navigation" — FR-4.6 — so there was never going to be a real tab bar in this product). Fixed the `ThemeProvider` to `DarkTheme` (REP's palette has no light variant) and dropped the scaffold's animated splash overlay for a plain `SplashScreen.hideAsync()` once the DB is ready. Added `<StatusBar style="light" />`, needed now that the background is fixed near-black rather than scaffold blue.
- `src/app/index.tsx` — real Home screen. Checks `getActiveSession` on mount and renders `<Redirect href="/session" />` before any template UI paints if one is found under 6 hours old (FR-1.2); otherwise lists the active programme's templates as large buttons plus a FREESTYLE button (FR-1.1), styled directly from `theme.ts` tokens. Starting a session awaits `createSession(...)` before navigating (FR-1.3 — write before render) and disables the buttons meanwhile. The `homeImportLink` string, added but unused in Session 2, is now wired to push `/import`.
- `src/app/session.tsx` — new. Self-contained: loads the active session itself via `getActiveSession` rather than taking a route param, since only one session is ever current. Shows the template name (or "Freestyle"), a running elapsed timer (FR-4.7, `src/domain/duration.ts`'s `formatElapsed`), a placeholder line noting set logging comes next, and an End Session button (`endSession` then back to home). No back button — ending the session is the only way out.
- `src/domain/duration.ts` — pure `formatElapsed(ms)`, tested: `MM:SS` under an hour, an unpadded `H:MM:SS` once an hour passes, negative durations clamp to zero.
- Data layer: `getActiveSession` (sessionRepository — in-progress, not deleted, started within the last 6 hours), `getActiveProgramme` (programmeRepository — `isActive` row), `listTemplatesForProgramme` (templateRepository — non-archived templates for one programme, ordered by `orderIndex`). All follow the existing repository conventions. Covered by new `src/data/repositories/__tests__/sessionLifecycle.test.ts`.
- Deleted the now-fully-dead Expo scaffold: the demo `Explore` tab, `NativeTabs` bar (`app-tabs.tsx`/`.web.tsx`), the animated splash/hero icon components, `ThemedText`/`ThemedView` and their `constants/theme.ts`/`hooks/use-color-scheme.ts`/`hooks/use-theme.ts` support, `hint-row`, `web-badge`, `external-link`, `collapsible`, and `global.css`. Confirmed dead by grep before removal — nothing outside that cluster and the two rewritten files referenced them.

**Deviations from the brief:**
- No explicit navigation guard against reaching `/session` with no active session (e.g. stale deep link) beyond the `<Redirect href="/" />` `session.tsx` already does when `getActiveSession` comes back empty — this was the natural consequence of making the screen self-contained rather than a gap that needed separate handling.
- A stale in-progress session older than 6 hours is left untouched (not auto-ended) — the brief's restore window is a *display* rule (FR-1.2), and nothing in this session's scope calls for auto-closing old sessions. It just sits unrestored until a later session's UI can reach it.
- Added `<StatusBar style="light" />`, not mentioned in the brief — without it, the default status bar icons would be invisible against the app's fixed near-black background now that the scaffold's light blue splash/background is gone.

**Exit check:** starting a template session and a freestyle session both land on `/session` with the correct heading and a running elapsed timer; ending returns to `/`. Restore-on-relaunch was verified via the `getActiveSession` unit tests (in-progress-and-recent → restored, ended → not restored, >6h-old → not restored) rather than an actual force-kill on a device, since there's no emulator/device in this environment — worth a manual confirm on-device per the brief's acceptance criterion.

**Verification:** `npm run typecheck` and `npm run test` pass (38 tests, up from 27). `npx expo export --platform android` still bundles with the scaffold removed and the new screens in place.

**Commit:** `feat(session): lifecycle and crash restore`
