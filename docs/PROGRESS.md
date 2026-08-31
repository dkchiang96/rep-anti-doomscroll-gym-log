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
