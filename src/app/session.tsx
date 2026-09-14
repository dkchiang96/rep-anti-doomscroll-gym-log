import { useKeepAwake } from 'expo-keep-awake';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Clock, FlashOverlay, Slab, TransportButton, TransportResetButton, useRestNotifications } from '@/components/ui';
import type { FlashOverlayHandle } from '@/components/ui';
import { ExitRecapModal, type RecapSection } from '@/components/transition/ExitRecapModal';
import { runBackupRetention } from '@/data/backup';
import { useDatabase } from '@/data/DatabaseProvider';
import { getExerciseById } from '@/data/repositories/exerciseRepository';
import { getSessionDetail } from '@/data/repositories/historyRepository';
import { getProgrammeById } from '@/data/repositories/programmeRepository';
import { listSessionHistoryForExercise } from '@/data/repositories/progressRepository';
import { endSession, getActiveSession } from '@/data/repositories/sessionRepository';
import { listTemplateExercisesByTemplate } from '@/data/repositories/templateExerciseRepository';
import { getTemplateById } from '@/data/repositories/templateRepository';
import { getUser } from '@/data/repositories/userRepository';
import type { session as sessionTable } from '@/data/schema';
import type { EquipmentType, LoadConvention } from '@/domain/loadConvention';
import { formatSessionExerciseShorthand } from '@/domain/keepShorthand';
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
  // Null when the exercise was picked mid-session (R5's exercise picker) and
  // isn't part of the active template — the lime slab falls back to the
  // FREESTYLE label in that case, same as a templateless session.
  target: { sets: number; repsMin: number; repsMax: number } | null;
} | null;

type LoadState =
  | { status: 'loading' }
  | { status: 'none' }
  | {
      status: 'ready';
      session: Session;
      title: string;
      exercise: CurrentExercise;
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
  }>();
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
        ? { sets: overrideTargetSets, repsMin: overrideTargetRepsMin, repsMax: overrideTargetRepsMax }
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
      if (active.templateId) {
        const template = await getTemplateById(db, userId, active.templateId);
        if (template) title = template.name;
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
            target: overrideTarget ?? (templateExercise
              ? { sets: templateExercise.targetSets, repsMin: templateExercise.targetRepsMin, repsMax: templateExercise.targetRepsMax }
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

      if (!cancelled) setState({ status: 'ready', session: active, title, exercise, flashIntervalMs, notificationsEnabled });
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

  return <LiveSessionScreen db={db} userId={userId} state={state} onNextExercise={goToTransition} />;
}

function LiveSessionScreen({
  db,
  userId,
  state,
  onNextExercise,
}: {
  db: ReturnType<typeof useDatabase>['db'];
  userId: string;
  state: Extract<LoadState, { status: 'ready' }>;
  onNextExercise: (setsDone: number) => void;
}) {
  const { session, title, exercise, flashIntervalMs, notificationsEnabled } = state;
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
  useEffect(() => {
    let cancelled = false;
    (async () => {
      // No synchronous setState before this await — the empty-history case
      // for "no exercise yet" resolves through the same async path as a
      // real fetch, rather than branching out of the effect body directly.
      const history = exercise ? await listSessionHistoryForExercise(db, userId, exercise.id) : [];
      if (cancelled) return;
      const isBodyweight = exercise?.loadConvention === 'bodyweight';
      const rounds = history
        .filter((entry) => entry.sessionId !== session.id)
        .slice(-3)
        .reverse()
        .map((entry) => ({
          sessionId: entry.sessionId,
          label: `${formatRecentRoundDate(entry.startedAt)} — ${formatSessionExerciseShorthand(entry.sets, isBodyweight) || '—'}`,
        }));
      setRecentRounds(rounds);
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

  async function handleNextExercisePress() {
    if (endArmed) {
      if (disarmTimeoutRef.current) clearTimeout(disarmTimeoutRef.current);
      setEndArmed(false);
      const detail = await getSessionDetail(db, userId, session.id);
      setRecapSections(
        detail.map((ex) => ({
          name: ex.exerciseName,
          shorthand: formatSessionExerciseShorthand(ex.sets, ex.isBodyweight) || '—',
        })),
      );
      setRecapOpen(true);
      return;
    }
    onNextExercise(setsDone);
  }

  async function handleRecapConfirm() {
    setRecapOpen(false);
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

  // Distinct from the top bar's session-level title (which legitimately
  // reads FREESTYLE for a templateless session) — reusing the same word here
  // for "no exercise picked yet" read as a duplicated/broken label.
  const exerciseName = (exercise?.name ?? strings.sessionNoExerciseLabel).toUpperCase();

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
          {exercise?.target ? (
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
              <Text key={round.sessionId} style={[type.caption, styles.recentRoundsLine]} numberOfLines={1}>
                {round.label}
              </Text>
            ))}
          </View>
        ) : null}

        <View style={[styles.canvas, { flex: liveZoneFlex.canvas }]}>
          <Pressable
            style={styles.setsDoneTouch}
            onPress={() => setSetsDone((n) => n + 1)}
            onLongPress={() => setSetsDone((n) => Math.max(0, n - 1))}
            delayLongPress={600}
          >
            <Text style={[type.display1, tabularNums, styles.setsDoneNumeral]}>{setsDone}</Text>
            <Text style={[type.caption, styles.setsDoneLabel]}>{strings.sessionSetsDoneLabel}</Text>
          </Pressable>

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
          onLongPress={armEndConfirm}
          delayLongPress={600}
        >
          <Slab tone="primary" height={size.bottomSlab}>
            <Text style={[type.label, endArmed ? styles.onSlabTextArmed : styles.onSlabText]}>
              {endArmed ? strings.sessionEndConfirmPrompt.toUpperCase() : strings.sessionNextExerciseLabel}
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
  // Item 8: a compact, deliberately small-type strip — a glance while
  // deciding what to target, not a sixth zone competing with the numerals
  // DESIGN-SPEC.md §5.1 reserves as the largest element on this screen.
  recentRoundsStrip: {
    width: '100%',
    backgroundColor: color.bg,
    paddingHorizontal: 16,
    paddingVertical: 4,
  },
  recentRoundsHeading: {
    color: color.textMuted,
  },
  recentRoundsLine: {
    color: color.textMuted,
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
