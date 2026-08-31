# REP — project instructions

Read this file fully. Do **not** read `docs/PRD.md` unless a session brief tells you to read a specific section of it.

## What this is
REP is a single-user Android lifting log. Full spec: `docs/PRD.md`. Build order: `docs/BUILD-SESSIONS.md`. Current state: `docs/PROGRESS.md`.

## Stack — do not substitute
- React Native + Expo, TypeScript, strict mode on
- SQLite via `expo-sqlite` + Drizzle ORM
- Zustand for state
- `expo-keep-awake` for screen wake lock
- No backend, no network calls, no auth, no analytics SDK in Phase 1

## Non-negotiable invariants

These are data-integrity and product controls. Never relax one to make a task easier. If a task appears to require breaking one, stop and ask.

1. **No Save button anywhere.** Every mutation writes to SQLite synchronously at the moment of the interaction, before any UI animation.
2. **UUID primary keys.** Never autoincrement integers.
3. **Every table has `user_id`, `created_at`, `updated_at`, `deleted_at`, `sync_state`** — even though there is one local user and no sync.
4. **Every query is scoped by `user_id`.** No unscoped reads or writes.
5. **Soft delete only.** Nothing is ever hard-deleted.
6. **All data access goes through `src/data/repositories/`.** No SQL and no Drizzle calls inside components or screens.
7. **Weights stored in kilograms** as a decimal. Conversion belongs in the display layer.
8. **Every exercise has a locked `load_convention`** (`per_side` | `total` | `bodyweight`) and the logging screen always displays it plus the derived total. This is a data-integrity control, not a convenience.
9. **No hardcoded user-facing strings in components.** All strings live in `src/strings.ts`.
10. **Import is additive and non-destructive.** Never overwrite or delete existing data.
11. **No AI, LLM or network calls in Phase 1.**

## Design tokens — `src/theme.ts`
```
bg              #0D0D0D
surface         #1A1A1A
accentPrimary   #F2F24B   active timer, primary action
accentSecondary #A5E838   confirmed / completed
textPrimary     #FFFFFF
textMuted       #8A8A8A   ghost pre-fill values, warm-up sets
```
Heavy condensed uppercase display face for numerals and headers. Minimum touch target 56dp. Numerals are the largest element on every screen. No ads, no modals, no onboarding.

## Directory layout
```
src/
  app/            expo-router screens
  components/
  data/
    schema.ts     drizzle schema
    repositories/ ALL data access
    migrations/
  domain/         pure functions: plate maths, parsers, conversions
  state/          zustand stores
  theme.ts
  strings.ts
docs/
  PRD.md
  BUILD-SESSIONS.md
  PROGRESS.md
```

## How to work

- **One session brief at a time.** Do not start work described in a later session.
- **Plan before writing code.** State the plan, list the files you will create or modify, and wait for approval.
- **Pure logic goes in `src/domain/` with unit tests.** Plate maths, the Keep parser and the programme JSON validator are all pure functions and must be tested. UI does not need tests.
- **At the end of every session:** run typecheck and tests, append a dated entry to `docs/PROGRESS.md` recording what shipped and any deviation from the brief, then stop. Do not begin the next session.
- **If the brief is ambiguous, ask.** Do not invent product decisions.
- **If a value is unknown (bar weight, plate denominations, machine conventions), leave it unset and block the dependent feature with a clear prompt.** Never guess a number that ends up in stored data.

## Commands
```
npm run typecheck
npm run test
npx expo start
```
