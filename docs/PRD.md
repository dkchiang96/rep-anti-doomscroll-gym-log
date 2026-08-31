# PRD: REP — a zero-friction lifting log

| Field | Value |
|---|---|
| Product name | **REP** |
| Author | Chief Product Officer (drafted with Derrick Chiang) |
| Date | 30 August 2026 |
| Version | 0.3 (build-ready) |
| Phase 1 target | Gym-usable in 7 days, feature-complete in 10 |
| Primary user | Derrick Chiang (n=1), architected for n=many |
| Secondary purpose | Portfolio artifact demonstrating AI-assisted product and engineering skill |

---

## 1. Problem

Derrick trains roughly three lifting sessions per week and currently runs his workout on **three disconnected tools**:

1. **Google Keep** — free-text sets and reps, one note per push/pull/legs cycle
2. **Timer Plus** — stopwatch left running, screen-flashing every 30 seconds as an attention cue during rest
3. **A WhatsApp photo** of an LLM-generated training programme

This stack works, which is why it has survived. It fails in six specific ways, all evidenced in the raw data:

| # | Failure | Evidence |
|---|---|---|
| P1 | **App-switching between logger and timer**, occasionally killing an app and losing the session | User-reported |
| P2 | **No structured recall of last performance.** Copy-pasting last week's block on a small screen is slow and error-prone | User-reported |
| P3 | **No validated input.** Notes contain `153³Ẁ`, `AWW3W4`, `103` (a stray `3`), and `428 Jul` where a date fused into a previous line | Keep export, 15 Aug / 4 Aug notes |
| P4 | **Silent unit drift.** Around 16 Aug the dumbbell convention changed from pair-total to per-dumbbell (45→22.5, 25→12.5, 40→20). Any chart built on this history shows a 50% strength collapse that did not occur | Keep export, 30 Jul vs 25 Aug |
| P5 | **Attention drift during rest.** Without an external cue, rest periods stretch far beyond intent via doomscrolling or mind-wandering | User-reported |
| P6 | **The programme lives outside the log.** A JPEG in WhatsApp cannot pre-fill anything, cannot be searched, and drifts out of sync with what is actually trained. Checking it mid-session means leaving the log, opening WhatsApp and pinch-zooming a photo while standing at the rack | Programme photo vs Keep history; user-reported |
| P7 | **Load arithmetic is unresolved at the point of lifting.** Barbell totals must be computed mentally under fatigue, and the per-side-versus-total question for dumbbells is genuinely ambiguous to the user at the moment of entry — which is precisely why P4 happened | User-reported; Keep export |

**The one-sentence problem:** *recording a set should cost less attention than not recording it, and the record should never be lost or silently corrupted.*

---

## 2. Goals and non-goals

### Phase 1 goals
- **G1.** Log a working set in **≤ 2 taps and ≤ 3 seconds**, with last session's numbers pre-filled
- **G2.** Make the rest clock a permanent part of the logging screen so no app-switching is ever required
- **G3.** Guarantee zero data loss — no session is ever lost to a crash, a kill, or a backgrounding
- **G4.** Show, per exercise, whether weight and reps are going up over time. Nothing more
- **G5.** Import the entire Google Keep history so day one is not day zero
- **G6.** Import an LLM-generated training programme in one paste, stored as reusable templates
- **G7.** Build single-user, but on a schema and architecture that supports multi-user publishing without a rewrite
- **G8.** Remove all load ambiguity and all mental arithmetic at the point of lifting

### Explicit non-goals for Phase 1
Accounts and login UI · cloud sync · social features · any runtime AI or LLM call · nutrition · body composition · smartwatch · estimated 1RM · muscle-group volume analytics · exercise demonstration videos · streaks and gamification · push notifications · iOS · non-lifting session types.

> **Rationale:** the research on this category is unanimous. Products that stay fast and narrow (Strong, FitNotes) retain long-term users; products that try to be a social network, an AI coach, a wellness dashboard and a shop at the same time accumulate friction and get abandoned. Every non-goal above is deferred, not deleted.

### Guiding principles
1. **Manual always works.** No AI feature in any phase may become the only path to record something. The user must always be able to run the app at zero marginal cost.
2. **The last session is the default.** The app's opinion about today is always "what you did last time, ready to be beaten".
3. **Nothing is ever saved manually.** There is no Save button anywhere in the product.
4. **Screen real estate is for numbers.** Chrome, labels and decoration lose to digits.
5. **Single-user is a deployment choice, not an architectural one.** See §7.

---

## 3. Success metrics

| Metric | Target | How measured |
|---|---|---|
| Median taps to log one set | ≤ 2 | Instrumented locally, read from the debug screen |
| Median time to log one set | ≤ 3s | Same |
| Sessions lost or corrupted | **0** | Manual audit |
| Time from app open to first set logged | < 10s | Instrumented |
| Google Keep retired | Within 14 days of Phase 1 launch | Binary, self-reported |
| Sessions logged in-app vs total sessions trained | 100% for 4 consecutive weeks | Manual audit |
| Programme import: exercises auto-matched to library | ≥ 80% without manual mapping | Import review screen |
| Monthly running cost | USD 0 in Phase 1, ≤ USD 5 thereafter | Billing |

---

## 4. Technical approach

**React Native + Expo (TypeScript), local-first on SQLite via Drizzle ORM.**

| Layer | Choice | Why |
|---|---|---|
| Framework | React Native + Expo | One codebase ships to iOS in Phase 4 with near-zero rewrite. Expo EAS Build produces an Android build without a local Android Studio toolchain |
| Language | TypeScript | Largest training corpus of any mobile stack, so **any** AI coding tool produces good output — not just Claude Code. This is the portability requirement |
| Storage | SQLite (`expo-sqlite`) + Drizzle ORM | Plain file on device, openable in any SQLite browser. No vendor, no lock-in, no network dependency, zero cost. Drizzle's schema definitions port directly to Postgres later |
| State | Zustand | Small surface, easy to reason about |
| Charts | `victory-native` or hand-rolled `react-native-svg` | Only one chart type is needed in Phase 1 |
| Screen-on | `expo-keep-awake` | Phone sits on a stand in peripheral vision; the display must not sleep mid-session |
| Backup | Local JSON/CSV export via Android share sheet | Phase 1 needs durability, not sync |
| Phase 2+ backend (if needed) | Supabase free tier | Postgres, auth and storage inside the USD 5 ceiling. Drizzle schema migrates without redefinition. Deferred |

**Rejected:** *Flutter* (smaller LLM corpus weakens the portability goal) · *native Kotlin* (zero iOS reuse) · *PWA* (unreliable wake-lock and full-screen flashing across Android browsers, and a weaker portfolio artifact).

**Uncertainty declared:** current Expo SDK version numbers and any third-party dataset licences are **not verified in this document**. Check both at build time.

---

## 5. Design direction

Cloned from the Timer Plus screenshots, which are the user's proven visual comfort zone.

| Token | Value | Use |
|---|---|---|
| `bg` | `#0D0D0D` | App background |
| `surface` | `#1A1A1A` | Cards, rows |
| `accent-primary` | `#F2F24B` (yellow) | Active timer, primary action |
| `accent-secondary` | `#A5E838` (lime) | Confirmed / completed state |
| `text-primary` | `#FFFFFF` | Display numerals, labels |
| `text-muted` | `#8A8A8A` | Ghost/placeholder values from last session, warm-up sets |

- **Type:** one heavy condensed uppercase display face for numerals and headers (Bebas Neue, Oswald or Archivo Narrow), one neutral sans for body. Numerals are the largest element on every screen.
- **Touch targets:** minimum 56dp. Assume sweaty hands and a phone at arm's length on a floor stand.
- **Contrast:** black background, high-saturation accent. Readable at a glance from 1.5m in peripheral vision.
- **No ads, no upsells, no modals, no onboarding carousel, ever.**

---

## 6. Phase 1 — functional requirements

### 6.1 Session start

**FR-1.1** App opens to a single screen showing the templates of the **active programme** as large buttons (e.g. PUSH, PULL, LEGS), plus a smaller FREESTYLE option.

**FR-1.2** If a session is already in progress (started, not ended, less than 6 hours old), the app opens **directly into that session**, restored exactly as it was.

**FR-1.3** Starting a session writes a session row to disk before any UI renders.

*Acceptance:* force-kill the app mid-session from the Android task switcher, reopen, and land on the exact same screen with every logged set intact.

### 6.2 Exercise selection

**FR-2.1** Selecting an exercise presents **muscle group chips first** (Chest, Back, Shoulders, Biceps, Triceps, Quads, Hamstrings, Glutes, Calves, Core), never an undifferentiated list.

**FR-2.2** Below the chips, a **type-ahead search field with the keyboard already focused**. Typing filters across exercise name *and* stored aliases, fuzzy-matched so `pull back row machinr` still resolves.

**FR-2.3** If no match, the same field offers **"Add [typed text] as new exercise"** inline, with muscle group pre-selected from the active chip and a load-convention picker. No separate creation screen.

**FR-2.4** The library is **seeded from the user's own imported history** (approximately 25 exercises) plus any exercises introduced by an imported programme, ranked by frequency and recency. **No bundled 1,300-exercise database** — that is the exact long-list scrolling problem this design exists to avoid.

**FR-2.5** Every exercise carries a **locked load convention**, chosen once at creation:
- `per_side` — the number entered is one dumbbell / one side
- `total` — the number entered is the whole load
- `bodyweight` — no load; optional added-weight field

Changing it later triggers an explicit warning and offers to retro-convert history.

> **This requirement exists solely because of the 16 August dumbbell drift. It is the single most important data-integrity control in the product.**

### 6.3 Set logging — the core loop

**FR-3.1** On opening an exercise, the app displays **last session's sets as muted ghost values**, pre-filled and editable, in the same order and count.

**FR-3.2** "Last session" means **the most recent session in which this exercise was performed**, not the same calendar weekday. Actual training dates drift (legs on 28 Jul, 4 Aug, 15 Aug, 21 Aug), so a weekday anchor would frequently return nothing.

**FR-3.3** Confirming a set that matches the ghost values costs **one tap**.

**FR-3.4** Adjusting weight or reps uses **large stepper buttons**, long-press to accelerate, tap-on-numeral for direct keypad entry. Step size is per exercise. The app learns the user's gym's cable stack ladder (his history shows 11.3 / 18.0 / 24.8 / 31.5 / 38.3 / 45.0 / 51.8 — a consistent 6.75kg increment) and offers it as the step.

**FR-3.5** Committing a set writes to SQLite synchronously **before** the UI animates.

**FR-3.6** Set types: `working`, `warmup`, `dropset`, `failure`.

**FR-3.7 — Warm-up sets.** Each set row carries a small **W toggle** (single tap, no menu). Warm-up sets:
- render in `text-muted` and are visually indented
- are **included** in the ghost pre-fill for the next session, since warm-up patterns repeat
- are **excluded** from all progress charts and from the top-set calculation
- can be toggled retroactively at any time

**FR-3.8** Drop sets attach to the preceding working set and render indented, matching how the Keep notes already express them (`22.5kg 10 8 7 5 12.5kg 10 7.5kg 10`).

**FR-3.9** **Supersets:** two or more exercises can be grouped; the app alternates between them in the logging view and suppresses the rest clock between paired exercises.

**FR-3.10** A one-line free-text note per exercise and per session (`too light`, `change`, `sick`, `did extra 1 set` all appear in the existing history).

**FR-3.11** Any exercise can be added, skipped or reordered mid-session without leaving the logging screen. Machines get occupied; the app must not fight that.

**FR-3.12 — Load convention is always visible.** The weight field on the logging screen carries a **permanent inline label** stating which convention is active, and a derived read-only total beneath it:

```
INCLINE DUMBBELL PRESS
      22.5 kg          PER DUMBBELL
      45 kg total
```

The user must never have to remember, infer or guess which number the app expects. This is the direct fix for P7, and the preventive control for P4.

**FR-3.12.1** House defaults on creation, overridable per exercise:
- Dumbbell exercises → `per_side`, because that is the number printed on the dumbbell and the convention the user has followed since 16 Aug
- Barbell and selectorised machines → `total`
- Single-arm cable and single-leg work → `per_side`
- Plate-loaded machines → **no default; the user must choose**, because these genuinely vary by machine

**FR-3.12.2** Where the convention is `per_side`, the derived total is always shown and is never editable. There is exactly one source of truth per exercise.

**FR-3.13 — Plate calculator.** Applies to any exercise whose equipment type is `barbell` or `plate_loaded`.

**FR-3.13.1** Tapping the weight numeral opens a sheet showing **plates per side** for the entered target, largest first (e.g. 80kg on a 20kg bar → 25 + 5 per side).

**FR-3.13.2** **Bar weight is a required per-exercise field with no assumed default.** Standard Olympic bars are 20kg, but trap bars range roughly 20–35kg by model and fixed-weight bars vary. **The app must not guess this**; an unset bar weight blocks the calculator and prompts the user rather than producing a wrong total.

**FR-3.13.3** A configurable **plate inventory** (denominations available at the gym, defaulting to 25 / 20 / 15 / 10 / 5 / 2.5 / 1.25 kg, editable). If a target is not achievable with the inventory, the sheet shows the **closest achievable load** and the delta, never a silently rounded number.

**FR-3.13.4** **Reverse mode:** tap plate chips to add them and read off the resulting total. This is the mode used when a bar is already loaded by a previous user.

**FR-3.13.5** Plate chips render in their real-world colours, defaulting to the IWF convention (25 red, 20 blue, 15 yellow, 10 green, 5 white) and fully editable per gym. **This inventory is the same data structure Phase 2b needs for colour-based plate recognition, so building it now is not throwaway work.**

**FR-3.13.6** For `plate_loaded` machines the calculator respects the exercise's load convention: per-side inventories compute one side, total conventions compute both.

*Acceptance:* a full push session (7 exercises, ~25 sets) is logged in under 90 seconds of cumulative screen time, and a barbell squat working set is loaded without any mental arithmetic or reference to another app.

### 6.4 Rest clock

**FR-4.1** Auto-starts the instant a set is committed. No button.

**FR-4.2** **Counts up.** Target rest defaults to 60s and is settable per exercise, but is displayed as a soft marker, not an alarm.

**FR-4.3** Every **30 seconds** the screen flashes — a full-screen accent-colour pulse of roughly 300ms. This replicates the user's proven attention mechanism from Timer Plus.

**FR-4.4** Flash interval, and optional sound / vibration / camera-flash cues, are configurable and default to **screen flash only** (matching his current settings: Sound OFF, Vibration OFF, Screen Flash ON).

**FR-4.5** The screen stays awake for the whole session via wake lock. Brightness is not overridden.

**FR-4.6** The clock is **always visible on the logging screen** — no tab, no drawer, no navigation.

**FR-4.7** A **session elapsed timer** shows total time in the gym today, running from session start.

*Acceptance:* a full session is completed without ever leaving the logging screen and without the display sleeping.

### 6.5 Templates and programmes

**FR-5.1** A **template** is a named, ordered list of exercises with optional target sets and rep ranges (e.g. `4 x 6-10`).

**FR-5.2** A **programme** is a named collection of templates (e.g. "One Month One Focus — June" containing PUSH+ABS, PULL, LEGS+GLUTES+ABS). One programme is **active** at a time; its templates are the home-screen buttons.

**FR-5.3** Templates are editable in-app, and can be created from scratch or **saved from a completed session** ("save this session as a template").

**FR-5.4** Targets are **advisory only**. They pre-fill nothing and block nothing. Actual last-session values always win for pre-fill (FR-3.1). This is deliberate: the log records reality, the programme records intent.

**FR-5.5** Programmes are versioned. Switching programmes never alters historical sessions.

**FR-5.6 — Session plan strip.** When a session is started from a template, the logging screen carries a **horizontally scrollable strip of the day's remaining exercises** in programme order, with completed ones dimmed. Tapping one jumps to it.

> **Rationale:** the WhatsApp photo is not consulted only for rep ranges — it is consulted for *what comes next*. Showing targets without showing the running order would leave that photo on the home screen. This requirement is what actually retires it.

**FR-5.7 — Target display.** Where a session runs from a template, the exercise header shows the programme target in accent colour, e.g. `4 × 6-10`. A faint target also appears on the active set row only. Targets never pre-fill a value and never block a value — last session's actuals always win (FR-3.1, FR-5.4).

**FR-5.8 — Archiving.** Any template or programme can be archived. Archiving:
- is reachable in two taps from the home screen
- supports **multi-select with a single bulk Archive action**, including a Select All control
- is fully reversible via the same multi-select mechanism in the archive view
- **never deletes anything.** Archived templates retain their link to historical sessions, and those sessions remain in all charts

*Acceptance:* an entire retired programme's templates are archived in one action, and a full session is completed without opening WhatsApp at any point.

### 6.6 Programme import

**FR-6.1** The canonical import format is **JSON** conforming to the schema in Appendix A. Rationale: any LLM can be asked to emit it reliably, it validates deterministically, and it costs nothing at runtime.

**FR-6.2** Import routes, in priority order:
1. **Paste JSON** into a text box in-app *(Phase 1)*
2. **Open a `.json` file** shared to REP from Drive, WhatsApp or Files *(Phase 1)*
3. **Paste unstructured text** and parse it with a lenient rule-based parser *(Phase 1.5)*
4. **Photograph a printed or image programme** and extract it with vision *(Phase 2 — this is where the existing WhatsApp JPEG gets handled)*

**FR-6.3** The user is given a **copy-paste prompt** (Appendix B) to hand any LLM alongside their programme. The LLM does the formatting work outside the app, so the app carries no AI cost.

**FR-6.4** Import runs a mandatory **name-mapping review screen**. Every exercise in the programme is matched against the existing library by fuzzy match and shown with its confidence. For each row the user can accept the match, remap it, or create a new exercise. **Nothing is imported silently.**

**FR-6.5** Invalid JSON produces a specific, human-readable error naming the offending field. Never a stack trace, never a silent failure.

**FR-6.6** Import is **additive and non-destructive**. It never overwrites history and never deletes existing templates.

*Acceptance:* the existing "One Month. One Focus." programme is imported end-to-end in under two minutes, with at least 80% of its exercises auto-matched.

### 6.7 Progress view

**FR-7.1** One screen. Pick an exercise, see a chart over time.

**FR-7.2** Default series: **top working-set weight** and **reps at that set**, on a shared time axis. Warm-up sets excluded. This is the only metric the user has said he acts on.

**FR-7.3** A table beneath the chart lists every past session for that exercise, most recent first, in the same shorthand as the Keep notes.

**FR-7.4** No estimated 1RM, no volume aggregation, no strength scores, no muscle-group heatmaps in Phase 1.

### 6.8 Data durability and portability

**FR-8.1** All writes are synchronous to SQLite. There is no in-memory-only session state.

**FR-8.2** **Export** to CSV and JSON via the Android share sheet, on demand.

**FR-8.3** **Automatic local backup** of the database file on every session end, keeping the last 30.

**FR-8.4** **Keep importer** — a one-off parser for the Google Keep text format. It must handle:
- `exercise - 22.5kg 10 8 7 5 12.5kg 10 7.5kg 10` → 4 working sets at 22.5kg + 2 drop sets
- `bw 10 10 8 6` → bodyweight sets
- inline `(superset)`, `(too light)`, `(change)` annotations → notes
- garbage tokens (`153³Ẁ`, `AWW3W4`) → flagged for manual review, **never silently dropped**
- **a mandatory review step for the 16 Aug dumbbell convention change**, presenting a before/after and asking which convention each historical entry used
- the original Keep text retained verbatim alongside the parsed rows

---

## 7. Multi-user readiness (non-functional, Phase 1)

The app ships single-user with no login screen. It must nonetheless be built so that adding accounts and sync is a feature, not a rewrite. These are **hard requirements for Phase 1**, costing roughly half a day.

| # | Requirement |
|---|---|
| MU-1 | **Every row carries `user_id`** from day one. The local user gets a generated UUID, never a hardcoded `0` or an implicit singleton |
| MU-2 | **Primary keys are UUIDs, not autoincrement integers.** Integer keys collide the moment two devices or two users merge |
| MU-3 | **Every row carries `created_at`, `updated_at`, `deleted_at`** (soft delete) and a `sync_state` column, even though nothing syncs yet |
| MU-4 | **All data access goes through a repository layer.** No SQL in components. Swapping SQLite for SQLite-plus-Postgres touches one directory |
| MU-5 | **No query is unscoped.** Every read and write filters by `user_id`, even when there is only one |
| MU-6 | **Exercise library is split conceptually into `system` and `user` exercises.** Phase 1 creates only user exercises, but the flag exists so a public release can ship a curated base library without a migration |
| MU-7 | **Weights stored canonically in kilograms** as a decimal; the display layer converts. Pounds support later is a formatting change, not a data change |
| MU-8 | **No user-facing string is hardcoded in a component.** One strings file. Cheap now, saves a painful i18n retrofit |
| MU-9 | **No PII in the schema.** Nothing that would trigger a privacy review on publication |
| MU-10 | Business logic contains **no assumption that the device owner is the data owner** |

---

## 8. Data model

```
user
  id (uuid), display_name, created_at, updated_at

exercise
  id (uuid), user_id, name, aliases[], muscle_group,
  equipment_type (barbell|dumbbell|selectorised|plate_loaded|cable|bodyweight|other),
  load_convention (per_side|total|bodyweight),
  bar_weight_kg (nullable, REQUIRED where equipment_type = barbell),
  default_weight_step, source (user|system|imported),
  created_at, updated_at, deleted_at, last_used_at, use_count

plate_inventory
  id (uuid), user_id, gym_label, denomination_kg, colour_hex,
  quantity_per_side, is_active

programme
  id (uuid), user_id, name, notes, is_active, is_archived, version,
  source (manual|json_import|text_import|vision_import),
  created_at, updated_at, archived_at, deleted_at

template
  id (uuid), user_id, programme_id (nullable), name, day_hint,
  order_index, is_archived, created_at, updated_at, archived_at, deleted_at

template_exercise
  id (uuid), template_id, exercise_id, order_index,
  target_sets, target_reps_min, target_reps_max,
  superset_group_id (nullable), notes

session
  id (uuid), user_id, template_id (nullable), programme_id (nullable),
  started_at, ended_at, note, source (manual|import),
  created_at, updated_at, deleted_at

session_exercise
  id (uuid), session_id, exercise_id, order_index,
  superset_group_id (nullable), note

set
  id (uuid), session_exercise_id, index, weight_kg, reps,
  set_type (working|warmup|dropset|failure),
  parent_set_id (nullable, for drop sets),
  rest_after_seconds, completed_at
```

---

## 9. Build plan

| Day | Deliverable |
|---|---|
| 1 | Scaffold, SQLite schema **with the §7 multi-user columns**, Drizzle migrations, repository layer, design tokens |
| 2 | Keep importer + dumbbell convention reconciliation flow. **Real data in the database on day 2** |
| 3 | Session start, template selection, session restore-on-crash |
| 4 | Set logging loop: ghost pre-fill, steppers, commit, warm-up toggle, drop sets, **load convention display and derived total** |
| 5 | Rest clock, 30s screen flash, wake lock, session elapsed timer |
| 6 | Exercise picker: muscle-group chips, type-ahead, inline create |
| 7 | Templates, programme JSON import, name-mapping review, **session plan strip and target display**. **Gym-usable from here** |
| 8 | Plate calculator, plate inventory, archive with multi-select |
| 9 | Progress chart |
| 10 | Visual polish, export, live gym test |

**Honest revision:** the original estimate was 7 days. Programme import and the multi-user schema took it to 9; the plate calculator, archiving and target display take it to **10**.

The app is **usable in a real gym on day 7** and **fully replaces the WhatsApp photo on day 7**, because the session plan strip and target display ship alongside templates. Days 8–10 are quality-of-life and analytics.

If a hard 7-day deadline matters more than completeness, ship days 1–7 and treat 8–10 as week two. Nothing in days 8–10 blocks gym use. **What must not be cut is FR-3.12 on day 4** — the load convention display is a data-integrity control, not a convenience, and shipping without it recreates the 16 August problem inside a brand new app.

The single biggest risk to this timeline is building an exercise library rather than seeding it from imports. **Do not build the library.**

---

## 10. Later phases (gated, not scheduled)

Each phase ships only after the previous one has been used for **four uninterrupted weeks** without falling back to Google Keep.

### Phase 1.5 — small gaps
- Duration-only session type for Hyrox, CAL500 classes, walking and mobility, so weekly training time is complete
- Lenient plain-text programme parser (import route 3)

### Phase 2 — reduce input cost further
**Recommended change from the original plan: lead with voice, not camera.**

The stated bar is that capture must not be slower than typing. Realistic photo flow — raise, frame, shoot, upload, infer, *confirm* — is 4–7 seconds plus aiming. Voice ("sixty for eight") is roughly 2 seconds, hands-free, and works with chalk and sweat. Category research also shows camera accuracy degrades sharply for heavy barbell work under gym lighting and occlusion.

- **2a. Voice logging** — on-device speech-to-text where possible, LLM parse only on failure, keeping cost near zero
- **2b. Vision for context, not for sets** — a one-off inventory walk photographing the gym's equipment, plus a colour-to-weight mapping for plates (red = 25kg). Slow, batchable, off the critical path: exactly where vision is strong
- **2c. Vision for programme import** — photograph the existing WhatsApp JPEG and extract it into the Appendix A schema
- **2d. Vision for live weight reading** — kept, but behind a flag and benchmarked against typing. Ships only if it wins on measured time

*Cost control:* every AI path has a manual equivalent, and AI can be disabled entirely in settings, returning the app to USD 0.

### Phase 3 — programming and rep counting
- AI programme suggestion grounded in actual history, the stored equipment inventory, and user-specified exercise exclusions (**e.g. no bent-over rows, no Romanian deadlifts**). Output conforms to the Appendix A schema, so it flows through the existing import pipeline. Programme rotates every 2–3 months
- Smartwatch rep counting, Wear OS first
- Camera-based rep counting — **flagged low return, high effort**. Requires propping, framing, lighting, and current computer vision struggles with heavy compound lifts. Revisit only if the above prove insufficient

### Phase 4 — health expansion, iOS, publication
- iOS build from the same codebase
- Body weight, body fat, measurements, the shoulder-to-waist ratio already tracked on the paper programme
- Nutrition and protein targets
- Smart scale integration
- **Public release**: accounts and sync become a feature build on the §7 foundation, not a rewrite
- **Constraint:** if any of this compromises the logging screen's speed, it ships as a companion app sharing the same data store, not as a tab in this one

---

## 11. Risks

| Risk | Severity | Mitigation |
|---|---|---|
| Scope creep pulls Phase 2 into week one | High | Non-goals in §2 are contractual. AI ships only after four clean weeks |
| Screen-on wake lock drains battery over a 75-minute session | Medium | Measure on day 9. Dark UI already minimises OLED draw; add a dim-between-flashes mode if needed |
| Keep importer mangles history, poisoning the charts | High | Mandatory human review; nothing silently dropped; original text retained verbatim |
| LLM emits invalid programme JSON | Medium | Strict validation with field-level errors; the Appendix B prompt includes the schema and a worked example |
| Multi-user scaffolding is built but never used, wasting half a day | Low | Accepted. Half a day now versus a schema migration later is a good trade |
| Nine-day estimate slips | Medium | Days 1–7 are the shippable core. Days 8–9 can slip a week without blocking gym use |

---

## Appendix A — Programme import schema

```json
{
  "schema_version": "1.0",
  "programme": {
    "name": "One Month. One Focus. — June",
    "notes": "Progressive overload focus. No pilates or yoga in this plan.",
    "templates": [
      {
        "name": "PUSH + ABS",
        "day_hint": "Tuesday",
        "exercises": [
          {
            "name": "Incline Dumbbell Press",
            "muscle_group": "Chest",
            "load_convention": "per_side",
            "target_sets": 4,
            "target_reps_min": 6,
            "target_reps_max": 10,
            "superset_group": null,
            "notes": ""
          },
          {
            "name": "Cable Lateral Raise",
            "muscle_group": "Shoulders",
            "load_convention": "per_side",
            "target_sets": 4,
            "target_reps_min": 12,
            "target_reps_max": 20,
            "superset_group": null,
            "notes": "single hand each side"
          }
        ]
      }
    ]
  }
}
```

**Field rules**
- `muscle_group` must be one of: `Chest, Back, Shoulders, Biceps, Triceps, Quads, Hamstrings, Glutes, Calves, Core`
- `load_convention` must be one of: `per_side, total, bodyweight`
- `target_reps_min` and `target_reps_max` are equal for a fixed rep target
- `superset_group` is any shared string across exercises performed as a superset, otherwise `null`
- All fields except `notes`, `day_hint` and `superset_group` are required

## Appendix B — Prompt for generating a programme

> I have a training programme below. Convert it into JSON matching this exact schema, and output **only** the JSON with no commentary, no markdown fences and no explanation.
>
> `[paste the schema and field rules from Appendix A]`
>
> Rules:
> - Use `per_side` for dumbbell and single-arm exercises, `total` for barbells and machines, `bodyweight` for unweighted exercises.
> - Convert set-and-rep notation like `4 x 6-10` into `target_sets: 4, target_reps_min: 6, target_reps_max: 10`.
> - Keep the exercise names exactly as written in my programme. Do not standardise them.
> - Omit warm-ups, cardio, classes and mobility work.
>
> My programme:
> `[paste programme]`

---

## 12. Resolved decisions

| Question | Decision |
|---|---|
| Non-lifting sessions | Out of Phase 1. Duration-only session type in Phase 1.5 |
| Templates | **In.** Grouped under programmes, activated one at a time |
| Warm-up sets | **In.** One-tap W toggle, kept in pre-fill, excluded from charts |
| Product name | **REP** |
| Public release | Ships local and single-user, but §7 makes multi-user a feature build rather than a rewrite |
| Programme targets on the logging screen | **Shown.** Exercise header plus active set row, with a session plan strip for running order (FR-5.6, FR-5.7) |
| Archiving | **In,** with multi-select and a bulk action, fully reversible, never destructive (FR-5.8) |
| Plate calculator | **In,** Phase 1, day 8 (FR-3.13) |
| Per-side versus total ambiguity | **Resolved by permanent on-screen labelling and a derived total** (FR-3.12), not by user memory |

## 13. Open questions

1. **What is the bar weight for each barbell exercise at your gym?** The squat bar is almost certainly 20kg, but trap bars range roughly 20–35kg by model. **This is not assumed anywhere in the build** — an unset bar weight blocks the calculator by design. Needed before day 8, not before day 1.
2. **What plate denominations does your gym actually stock, and what colours are they?** The default inventory in FR-3.13.3 is a guess based on standard commercial gyms and should be replaced with a real inventory. You mentioned red plates are 25kg, which matches the IWF convention, but the rest is unverified.
3. **The hip thrust machine at 22.5kg — is that per side or total?** Same question for the abductor and adductor machines. These need a convention set at import time, and I cannot determine it from the Keep notes.
4. Should the session plan strip also surface the programme's own priority ranking (your programme lists "if short on time, drop: biceps, triceps, abductor, adductor"), so a rushed session knows what to cut? *Recommendation: yes, but Phase 1.5.*
