import { useKeepAwake } from 'expo-keep-awake';
import { Stack, useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { BackHandler, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import {
  cancelRestNotifications,
  Clock,
  FlashOverlay,
  LapButton,
  Slab,
  TransportButton,
  TransportResetButton,
  useRestNotifications,
} from '@/components/ui';
import type { FlashOverlayHandle } from '@/components/ui';
import { ExitRecapModal, type RecapSection } from '@/components/transition/ExitRecapModal';
import { runBackupRetention } from '@/data/backup';
import { useDatabase } from '@/data/DatabaseProvider';
import { getExerciseById } from '@/data/repositories/exerciseRepository';
import { getSessionDetail } from '@/data/repositories/historyRepository';
import { getProgrammeById } from '@/data/repositories/programmeRepository';
import { listSessionHistoryForExercise } from '@/data/repositories/progressRepository';
import { getSessionExerciseById } from '@/data/repositories/sessionExerciseRepository';
import { endSession, getActiveSession, updateSession } from '@/data/repositories/sessionRepository';
import { cancelCardioLap, listSetsBySessionExercise, startCardioLap, stopCardioLap } from '@/data/repositories/setRepository';
import { listTemplateExercisesByTemplate } from '@/data/repositories/templateExerciseRepository';
import { getTemplateById } from '@/data/repositories/templateRepository';
import { getUser } from '@/data/repositories/userRepository';
import type { session as sessionTable } from '@/data/schema';
import type { EquipmentType, LoadConvention } from '@/domain/loadConvention';
import { formatLoggedExercise, formatSessionExerciseShorthand } from '@/domain/keepShorthand';
import { formatCardioShorthand, formatCardioTarget, tracks, type CardioMetric, type ExerciseKind } from '@/domain/cardio';
import { progressAdvice, type ProgressAdvice } from '@/domain/progressReadiness';
import { didCrossInterval } from '@/domain/stopwatch';
import { useAttachStopwatch, useStopwatch } from '@/state/stopwatchStore';
import { useFlashPreferenceStore } from '@/state/flashPreferenceStore';
import { strings } from '@/strings';
import { color, liveZoneFlex, size, tabularNums, type } from '@/theme';

// DESIGN-SPEC.md §5.1 — the live workout screen. Exactly the five zones
// below and nothing else: no notes field, no set list, no scroll view, no
// back button (D9 is intentionally suspended here — the Android system back
// gesture still works; the in-app UI just never offers a way to leave a
// running workout by accident).
//
// Item 7 (this session's punch list): long-pressing the NEXT EXERCISE bottom
// slab arms a tap-to-confirm "end session" state — the same control and
// pattern transition.tsx's SELECT NEXT EXERCISE slab already used, so both
// screens' exit route is now the same gesture in the same place instead of
// two different ones (this screen previously used a top-bar long-press).
// The top bar is plain, non-interactive chrome again.

type Session = typeof sessionTable.$inferSelect;

type CurrentExercise = {
  id: string;
  sessionExerciseId: string;
  name: string;
  equipmentType: EquipmentType;
  loadConvention: LoadConvention;
  barWeightKg: number | null;
  kind: ExerciseKind;
  /** Cardio only: what each round records. */
  track: CardioMetric[] | null;
  // Null when the exercise was picked mid-session (R5's exercise picker) and
  // isn't part of the active template — the lime slab falls back to the
  // FREESTYLE label in that case, same as a templateless session. The
  // distance/time/calories/load fields are cardio per-round targets.
  target: {
    sets: number;
    repsMin: number;
    repsMax: number;
    distanceM: number | null;
    timeSeconds: number | null;
    calories: number | null;
    loadKg: number | null;
  } | null;
} | null;

type LoadState =
  | { status: 'loading' }
  | { status: 'none' }
  | {
      status: 'ready';
      session: Session;
      title: string;
      exercise: CurrentExercise;
      // The programme day's free-text warm-up / warm-down (template).
      dayNotes: { warmUp: string | null; warmDown: string | null };
      flashIntervalMs: number;
      notificationsEnabled: boolean;
    };

const DEFAULT_FLASH_INTERVAL_MS = 30_000;

// Same small hand-rolled date formatter progress.tsx/history.tsx already
// each carry their own copy of — not extracted into a shared util there
// either; three duplicated lines beat a new abstraction for something this
// small (see docs/PROGRESS.md's R6 entry).
const RECENT_ROUND_MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
function formatRecentRoundDate(d: Date): string {
  return `${d.getDate()} ${RECENT_ROUND_MONTHS[d.getMonth()]}`;
}

export default function LiveSession() {
  useKeepAwake();
  const { db, userId } = useDatabase();
  const router = useRouter();
  const params = useLocalSearchParams<{
    sessionExerciseId?: string;
    exerciseId?: string;
    targetSets?: string;
    targetRepsMin?: string;
    targetRepsMax?: string;
    warmDown?: string;
  }>();
  // Warm down: the timed session continues past the last exercise with no
  // exercise selected — see LiveSessionScreen's warm-down handling.
  const warmDown = params.warmDown === '1';
  const pickedSessionExerciseId = typeof params.sessionExerciseId === 'string' ? params.sessionExerciseId : null;
  const pickedExerciseId = typeof params.exerciseId === 'string' ? params.exerciseId : null;
  // Item 5: a substituted-in exercise carries its replaced exercise's target
  // across as route params, since it can't be found by matching today's
  // template (it isn't part of it) the way a same-exercise pick is below.
  // Kept as primitives here (recomputed inside the effect below) rather than
  // a derived object, so the effect's dependency array can list stable
  // values instead of a new object identity every render.
  const overrideTargetSets = params.targetSets != null ? Number(params.targetSets) : NaN;
  const overrideTargetRepsMin = params.targetRepsMin != null ? Number(params.targetRepsMin) : NaN;
  const overrideTargetRepsMax = params.targetRepsMax != null ? Number(params.targetRepsMax) : NaN;
  const [state, setState] = useState<LoadState>({ status: 'loading' });

  useEffect(() => {
    let cancelled = false;
    const overrideTarget =
      Number.isFinite(overrideTargetSets) && Number.isFinite(overrideTargetRepsMin) && Number.isFinite(overrideTargetRepsMax)
        ? {
            sets: overrideTargetSets,
            repsMin: overrideTargetRepsMin,
            repsMax: overrideTargetRepsMax,
            distanceM: null,
            timeSeconds: null,
            calories: null,
            loadKg: null,
          }
        : null;
    (async () => {
      const active = await getActiveSession(db, userId);
      if (!active) {
        if (!cancelled) setState({ status: 'none' });
        return;
      }

      const user = await getUser(db, userId);
      const flashIntervalMs = (user?.restFlashIntervalSeconds ?? 30) * 1000 || DEFAULT_FLASH_INTERVAL_MS;
      const notificationsEnabled = user?.restNotificationEnabled ?? true;

      let title: string = strings.sessionPlaceholderFreestyleTitle;
      let templateExercises: Awaited<ReturnType<typeof listTemplateExercisesByTemplate>> = [];
      let dayNotes: { warmUp: string | null; warmDown: string | null } = { warmUp: null, warmDown: null };
      if (active.templateId) {
        const template = await getTemplateById(db, userId, active.templateId);
        if (template) {
          title = template.name;
          dayNotes = { warmUp: template.warmUp, warmDown: template.warmDown };
        }
        templateExercises = await listTemplateExercisesByTemplate(db, userId, active.templateId);
      } else if (active.programmeId) {
        // Item 3: a freestyle session still tagged to the active programme
        // (see index.tsx's startSession) shows the programme's name here
        // instead of the generic "Freestyle" — a true templateless,
        // programmeless session is the only case that still reads Freestyle.
        const programme = await getProgrammeById(db, userId, active.programmeId);
        if (programme) title = programme.name;
      }

      let exercise: CurrentExercise = null;

      if (pickedSessionExerciseId && pickedExerciseId) {
        // R5: the exercise picker (from the transition screen) already
        // created/found the session_exercise row before navigating here —
        // just load its exercise and, if it happens to be part of today's
        // template, its target.
        const ex = await getExerciseById(db, userId, pickedExerciseId);
        if (ex) {
          const templateExercise = templateExercises.find((te) => te.exerciseId === ex.id) ?? null;
          exercise = {
            id: ex.id,
            sessionExerciseId: pickedSessionExerciseId,
            name: ex.name,
            equipmentType: ex.equipmentType,
            loadConvention: ex.loadConvention,
            barWeightKg: ex.barWeightKg,
            kind: ex.kind,
            track: ex.track,
            target: overrideTarget ?? (templateExercise
              ? {
                  sets: templateExercise.targetSets,
                  repsMin: templateExercise.targetRepsMin,
                  repsMax: templateExercise.targetRepsMax,
                  distanceM: templateExercise.targetDistanceM,
                  timeSeconds: templateExercise.targetTimeSeconds,
                  calories: templateExercise.targetCalories,
                  loadKg: templateExercise.targetLoadKg,
                }
              : null),
          };
        }
      }
      // A templated session no longer jumps straight to the programme's
      // first exercise — it opens on the same "Warm up" state a freestyle
      // session does. The programme's first workout is reached the same way
      // every subsequent one is: NEXT EXERCISE → the day picker
      // (transition.tsx), which lists this template's exercises in the
      // programme's own sequence.

      if (!cancelled) setState({ status: 'ready', session: active, title, exercise, dayNotes, flashIntervalMs, notificationsEnabled });
    })();
    return () => {
      cancelled = true;
    };
  }, [db, userId, pickedSessionExerciseId, pickedExerciseId, overrideTargetSets, overrideTargetRepsMin, overrideTargetRepsMax]);

  if (state.status === 'none') {
    router.replace('/');
    return null;
  }

  if (state.status === 'loading') return null;

  const goToTransition = (setsDone: number) => {
    // D10: the clock is persistent chrome, not a fresh screen — the shared
    // stopwatchStore (attached below) is what keeps it continuous across
    // this push, not anything passed here. Freestyle sessions (no current
    // exercise yet — R5's picker is what assigns one) still navigate, so the
    // slab is never a dead tap; the transition screen shows an empty state.
    // setsDone carries the live screen's tally across so the transition
    // screen shows exactly that many rows — see docs/PROGRESS.md's R5
    // follow-up for why this reverses D13's original "never the source of
    // truth" wording.
    router.push({
      pathname: '/transition',
      params: state.exercise
        ? { sessionExerciseId: state.exercise.sessionExerciseId, exerciseId: state.exercise.id, setsDone: String(setsDone) }
        : {},
    });
  };

  return <LiveSessionScreen db={db} userId={userId} state={state} warmDown={warmDown} onNextExercise={goToTransition} />;
}

function LiveSessionScreen({
  db,
  userId,
  state,
  warmDown,
  onNextExercise,
}: {
  db: ReturnType<typeof useDatabase>['db'];
  userId: string;
  state: Extract<LoadState, { status: 'ready' }>;
  warmDown: boolean;
  onNextExercise: (setsDone: number) => void;
}) {
  const { session, title, exercise, dayNotes, flashIntervalMs, notificationsEnabled } = state;
  const router = useRouter();
  useAttachStopwatch(db, userId, session);
  const stopwatch = useStopwatch();
  // Item 3: same rest-reminder hook and trigger condition as transition.tsx
  // — only while the clock is actually running, mirroring the on-screen
  // flash below.
  useRestNotifications({ enabled: notificationsEnabled && stopwatch.isRunning, intervalSeconds: flashIntervalMs / 1000 });
  const flashTone = useFlashPreferenceStore((s) => s.tone);
  const flashRef = useRef<FlashOverlayHandle>(null);
  const previousElapsedRef = useRef(stopwatch.elapsedMs);

  // Item 8: the last 3 times this exercise was performed, for a glance while
  // deciding what to target — excludes the current (still-empty at this
  // point) session.
  const [recentRounds, setRecentRounds] = useState<{ sessionId: string; label: string }[]>([]);
  // Read-only nudge (src/domain/progressReadiness.ts), from the last
  // sessions' RPE and reps. Needs a target, so never shows for freestyle/
  // ad-hoc exercises; strength only.
  const [advice, setAdvice] = useState<ProgressAdvice | null>(null);
  useEffect(() => {
    let cancelled = false;
    (async () => {
      // No synchronous setState before this await — the empty-history case
      // for "no exercise yet" resolves through the same async path as a
      // real fetch, rather than branching out of the effect body directly.
      const history = exercise ? await listSessionHistoryForExercise(db, userId, exercise.id) : [];
      if (cancelled) return;
      const isBodyweight = exercise?.loadConvention === 'bodyweight';
      const previous = history.filter((entry) => entry.sessionId !== session.id).reverse();
      const rounds = previous
        .slice(0, 3)
        .map((entry) => ({
          sessionId: entry.sessionId,
          label: `${formatRecentRoundDate(entry.startedAt)} — ${
            (exercise?.kind === 'cardio'
              ? formatCardioShorthand(entry.sets, exercise.track ?? [])
              : formatSessionExerciseShorthand(entry.sets, isBodyweight)) || '—'
          }`,
        }));
      setRecentRounds(rounds);
      setAdvice(exercise?.kind === 'strength' && exercise.target ? progressAdvice(previous, exercise.target.repsMax) : null);
    })();
    return () => {
      cancelled = true;
    };
  }, [db, userId, exercise, session.id]);

  // Long-press (matching RESET's pattern) arms a brief tap-to-confirm state
  // rather than acting immediately, so a stray long-press can't end a
  // running workout; it auto-disarms if untouched. Confirming doesn't end
  // the session immediately either — it opens a blocking recap of the whole
  // workout so far first (ExitRecapModal, shared with transition.tsx).
  const [endArmed, setEndArmed] = useState(false);
  const disarmTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [recapOpen, setRecapOpen] = useState(false);
  // Optional session note, written as you type on the end-of-workout recap.
  const [sessionNote, setSessionNote] = useState(session.note ?? '');
  function handleSessionNoteChange(text: string) {
    setSessionNote(text);
    void updateSession(db, userId, session.id, { note: text.trim().length > 0 ? text : null });
  }
  const [recapSections, setRecapSections] = useState<RecapSection[]>([]);

  useEffect(() => {
    return () => {
      if (disarmTimeoutRef.current) clearTimeout(disarmTimeoutRef.current);
    };
  }, []);

  function armEndConfirm() {
    setEndArmed(true);
    if (disarmTimeoutRef.current) clearTimeout(disarmTimeoutRef.current);
    disarmTimeoutRef.current = setTimeout(() => setEndArmed(false), 4000);
  }

  async function openEndRecap() {
    const detail = await getSessionDetail(db, userId, session.id);
    setRecapSections(
      detail.map((ex) => ({
        name: ex.exerciseName,
        shorthand: formatLoggedExercise(ex.sets, ex) || '—',
      })),
    );
    setRecapOpen(true);
  }

  async function handleNextExercisePress() {
    if (endArmed) {
      if (disarmTimeoutRef.current) clearTimeout(disarmTimeoutRef.current);
      setEndArmed(false);
      await openEndRecap();
      return;
    }
    // Warm down is the last leg of a workout, so the bottom slab is the end
    // control here rather than "next exercise" (still behind the same
    // blocking recap).
    if (warmDown) {
      await openEndRecap();
      return;
    }
    onNextExercise(setsDone);
  }

  // Back from a timer that has an exercise (or is in warm down) goes to the
  // choose-exercise screen with its picker open, not to whichever logging or
  // timer screen came before. The warm-up state (no exercise yet) keeps the
  // default back behaviour.
  useFocusEffect(
    useCallback(() => {
      if (!exercise && !warmDown) return undefined;
      const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
        router.push({ pathname: '/transition', params: { openPicker: '1' } });
        return true;
      });
      return () => subscription.remove();
    }, [exercise, warmDown, router]),
  );

  async function handleRecapConfirm() {
    setRecapOpen(false);
    void cancelRestNotifications();
    await endSession(db, userId, session.id);
    // Backup failure must never block ending the session — same try/catch
    // the pre-rebuild build wrapped this call in.
    try {
      await runBackupRetention();
    } catch {
      // intentionally swallowed
    }
    router.replace({ pathname: '/session-summary', params: { sessionId: session.id } });
  }

  useEffect(() => {
    const previous = previousElapsedRef.current;
    previousElapsedRef.current = stopwatch.elapsedMs;
    if (!stopwatch.isRunning) return;
    if (didCrossInterval(previous, stopwatch.elapsedMs, flashIntervalMs)) {
      flashRef.current?.fire();
    }
  }, [stopwatch.elapsedMs, stopwatch.isRunning, flashIntervalMs]);

  // D13 (single control, per R3): tap increments, long-press decrements.
  // Resets whenever the current exercise identity changes. Entirely
  // decoupled from the clock — never touches stopwatch state.
  const [setsDone, setSetsDone] = useState(0);
  const exerciseKey = exercise?.id ?? null;
  const previousExerciseKeyRef = useRef(exerciseKey);
  useEffect(() => {
    if (previousExerciseKeyRef.current !== exerciseKey) {
      previousExerciseKeyRef.current = exerciseKey;
      setSetsDone(0);
    }
  }, [exerciseKey]);

  // Cardio lap timer (src/components/ui/LapButton.tsx) — replaces the tally
  // for a cardio station that tracks time. The running lap's start lives on
  // the session_exercise row, so it's reloaded here (as is the count of
  // rounds already recorded) and survives the app being killed.
  const usesLap = exercise?.kind === 'cardio' && tracks(exercise.track, 'time');
  const [lapStartedAt, setLapStartedAt] = useState<number | null>(null);
  const [nowMs, setNowMs] = useState(() => Date.now());
  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!exercise || !usesLap) return;
      const [se, rounds] = await Promise.all([
        getSessionExerciseById(db, userId, exercise.sessionExerciseId),
        listSetsBySessionExercise(db, userId, exercise.sessionExerciseId),
      ]);
      if (cancelled) return;
      setLapStartedAt(se?.lapStartedAt ? se.lapStartedAt.getTime() : null);
      setSetsDone(rounds.length);
      setNowMs(Date.now());
    })();
    return () => {
      cancelled = true;
    };
  }, [db, userId, exercise, usesLap]);
  useEffect(() => {
    if (lapStartedAt == null) return undefined;
    const interval = setInterval(() => setNowMs(Date.now()), 250);
    return () => clearInterval(interval);
  }, [lapStartedAt]);

  async function handleLapStart() {
    if (!exercise) return;
    const startedAt = new Date();
    await startCardioLap(db, userId, exercise.sessionExerciseId, startedAt);
    setNowMs(startedAt.getTime());
    setLapStartedAt(startedAt.getTime());
  }

  async function handleLapStop() {
    if (!exercise) return;
    const target = exercise.target;
    const track = exercise.track ?? [];
    // The round starts at the station's per-round targets; the real
    // numbers are corrected on the logging screen if they differ.
    const created = await stopCardioLap(db, userId, exercise.sessionExerciseId, {
      weightKg: tracks(track, 'load_kg') ? (target?.loadKg ?? 0) : 0,
      reps: tracks(track, 'reps') ? (target?.repsMax ?? 0) : 0,
      distanceM: tracks(track, 'distance_m') ? (target?.distanceM ?? null) : null,
      calories: tracks(track, 'calories') ? (target?.calories ?? null) : null,
    });
    setLapStartedAt(null);
    if (created) setSetsDone((n) => n + 1);
  }

  async function handleLapCancel() {
    if (!exercise) return;
    await cancelCardioLap(db, userId, exercise.sessionExerciseId);
    setLapStartedAt(null);
  }

  // Distinct from the top bar's session-level title (which legitimately
  // reads FREESTYLE for a templateless session) — reusing the same word here
  // for "no exercise picked yet" read as a duplicated/broken label.
  const exerciseName = (warmDown ? strings.sessionWarmDownLabel : (exercise?.name ?? strings.sessionNoExerciseLabel)).toUpperCase();

  return (
    // FlashOverlay is a sibling of this outer, edge-to-edge View (not nested
    // inside the inset-padded SafeAreaView below) so its absolute fill covers
    // the true physical screen bounds, status bar included — DESIGN-SPEC.md
    // §5.4: "the entire screen... covers the status bar."
    <View style={styles.outer}>
      <Stack.Screen options={{ headerShown: false }} />

      <SafeAreaView style={styles.root} edges={['top', 'bottom']}>
        <View style={styles.topBar}>
          <Text style={[type.heading, styles.topBarTitle]} numberOfLines={1}>
            {title.toUpperCase()}
          </Text>
        </View>

        <Slab tone="primary" flex={liveZoneFlex.yellow}>
          <Text style={[type.display2, styles.onSlabText]}>{exerciseName}</Text>
          <Clock elapsedMs={stopwatch.elapsedMs} />
        </Slab>

        <Slab tone="secondary" flex={liveZoneFlex.lime}>
          {warmDown ? (
            <Text style={[type.label, styles.onSlabText]}>{strings.sessionWarmDownHint.toUpperCase()}</Text>
          ) : exercise?.kind === 'cardio' && exercise.target ? (
            <>
              <Text style={[type.label, styles.onSlabText]}>{strings.sessionTargetHeading}</Text>
              <Text style={[type.display2, styles.onSlabText]} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.6}>
                {formatCardioTarget(exercise.target, exercise.track ?? []).toUpperCase()}
              </Text>
            </>
          ) : exercise?.target ? (
            <>
              <Text style={[type.label, styles.onSlabText]}>{strings.sessionTargetHeading}</Text>
              <Text style={[type.display1, styles.onSlabText]}>
                {strings.targetSetsRepsLabel(exercise.target.sets, exercise.target.repsMin, exercise.target.repsMax)}
              </Text>
            </>
          ) : (
            // "No target" covers both a true freestyle session and an
            // ad-hoc exercise added mid-session that isn't part of today's
            // template — "FREESTYLE" here would misdescribe the latter, and
            // duplicated the top bar's title in the former.
            <Text style={[type.label, styles.onSlabText]}>{strings.sessionNoTargetLabel.toUpperCase()}</Text>
          )}
        </Slab>

        {recentRounds.length > 0 ? (
          <View style={styles.recentRoundsStrip}>
            <Text style={[type.caption, styles.recentRoundsHeading]}>{strings.sessionRecentRoundsHeading}</Text>
            {recentRounds.map((round) => (
              <Text
                key={round.sessionId}
                style={[type.heading, tabularNums, styles.recentRoundsLine]}
                numberOfLines={1}
                adjustsFontSizeToFit
                minimumFontScale={0.7}
              >
                {round.label}
              </Text>
            ))}
            {advice ? (
              <Text style={[type.label, styles.readyToProgressLine]} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7}>
                {strings.progressAdvice[advice]}
              </Text>
            ) : null}
          </View>
        ) : null}

        {/* The programme day's free-text warm-up / warm-down: shown in the
            warm-up state (no exercise yet) and the warm-down state, in the
            space Last 3 rounds uses once an exercise is picked. */}
        {(() => {
          const dayNote = warmDown ? dayNotes.warmDown : !exercise ? dayNotes.warmUp : null;
          if (!dayNote) return null;
          return (
            <View style={styles.recentRoundsStrip}>
              <Text style={[type.caption, styles.recentRoundsHeading]}>
                {warmDown ? strings.sessionWarmDownNoteHeading : strings.sessionWarmUpNoteHeading}
              </Text>
              <Text style={[type.heading, styles.recentRoundsLine]} numberOfLines={5} adjustsFontSizeToFit minimumFontScale={0.5}>
                {dayNote}
              </Text>
            </View>
          );
        })()}

        <View style={[styles.canvas, { flex: liveZoneFlex.canvas }]}>
          {warmDown ? null : usesLap ? (
            <LapButton
              running={lapStartedAt != null}
              lapElapsedSeconds={lapStartedAt != null ? Math.max(0, (nowMs - lapStartedAt) / 1000) : 0}
              roundsDone={setsDone}
              targetRounds={exercise?.target?.sets ?? null}
              onStart={() => void handleLapStart()}
              onStop={() => void handleLapStop()}
              onCancel={() => void handleLapCancel()}
            />
          ) : (
            <Pressable
              style={styles.setsDoneTouch}
              onPress={() => setSetsDone((n) => n + 1)}
              onLongPress={() => setSetsDone((n) => Math.max(0, n - 1))}
              delayLongPress={600}
            >
              <Text style={[type.display1, tabularNums, styles.setsDoneNumeral]}>{setsDone}</Text>
              <Text style={[type.caption, styles.setsDoneLabel]}>{strings.sessionSetsDoneLabel}</Text>
            </Pressable>
          )}

          <View style={styles.transportGroup}>
            <TransportResetButton onLongPress={stopwatch.reset} />
            <TransportButton
              state={stopwatch.isRunning ? 'pause' : 'start'}
              onPress={stopwatch.isRunning ? stopwatch.pause : stopwatch.start}
              label={stopwatch.isRunning ? strings.sessionTransportPauseLabel : strings.sessionTransportStartLabel}
            />
          </View>
        </View>

        <Pressable
          style={styles.nextExerciseTouch}
          onPress={() => void handleNextExercisePress()}
          onLongPress={warmDown ? undefined : armEndConfirm}
          delayLongPress={600}
        >
          <Slab tone="primary" height={size.bottomSlab}>
            <Text style={[type.label, endArmed ? styles.onSlabTextArmed : styles.onSlabText]}>
              {endArmed
                ? strings.sessionEndConfirmPrompt.toUpperCase()
                : warmDown
                  ? strings.sessionWarmDownEndLabel.toUpperCase()
                  : strings.sessionNextExerciseLabel}
            </Text>
          </Slab>
        </Pressable>
      </SafeAreaView>

      <FlashOverlay ref={flashRef} tone={flashTone} />

      <ExitRecapModal
        visible={recapOpen}
        title={strings.recapEndTitle}
        sections={recapSections}
        confirmLabel={strings.recapEndConfirmButton}
        onConfirm={() => void handleRecapConfirm()}
        onBack={() => setRecapOpen(false)}
        sessionNote={{ initialValue: sessionNote, onChange: handleSessionNoteChange }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  outer: {
    flex: 1,
    backgroundColor: color.bg,
  },
  root: {
    flex: 1,
    backgroundColor: color.bg,
  },
  topBar: {
    height: size.topBar,
    backgroundColor: color.bar,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
  topBarTitle: {
    color: color.textPrimary,
  },
  onSlabText: {
    color: color.onSlab,
    textAlign: 'center',
  },
  // §2's danger token is reserved for destructive confirmations — this is
  // the confirm-armed state of the end-session long-press on the bottom slab.
  onSlabTextArmed: {
    color: color.danger,
    textAlign: 'center',
  },
  // Item 8: a glance while deciding what to target. The lines are heading-
  // size white (readable from the bench without picking the phone up — see
  // docs/PROGRESS.md 2026-11-19); the small muted heading keeps it reading
  // as reference, and the clock stays the largest element (§5.1).
  recentRoundsStrip: {
    width: '100%',
    backgroundColor: color.bg,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  recentRoundsHeading: {
    color: color.textMuted,
  },
  recentRoundsLine: {
    color: color.textPrimary,
  },
  // §2's confirmed/completed accent — a positive nudge, not a warning.
  readyToProgressLine: {
    color: color.slabSecondary,
    marginTop: 2,
  },
  canvas: {
    width: '100%',
    backgroundColor: color.bg,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-evenly',
  },
  setsDoneTouch: {
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: size.minTouchTarget,
    minHeight: size.minTouchTarget,
  },
  setsDoneNumeral: {
    color: color.textPrimary,
  },
  setsDoneLabel: {
    color: color.textMuted,
  },
  transportGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  nextExerciseTouch: {
    width: '100%',
  },
});
