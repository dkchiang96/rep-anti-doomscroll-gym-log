import { useKeepAwake } from 'expo-keep-awake';
import { Stack, useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Clock, FlashOverlay, Slab, TransportButton, TransportResetButton } from '@/components/ui';
import type { FlashOverlayHandle } from '@/components/ui';
import { useDatabase } from '@/data/DatabaseProvider';
import { getExerciseById } from '@/data/repositories/exerciseRepository';
import { getActiveSession } from '@/data/repositories/sessionRepository';
import { listTemplateExercisesByTemplate } from '@/data/repositories/templateExerciseRepository';
import { getTemplateById } from '@/data/repositories/templateRepository';
import { getUser } from '@/data/repositories/userRepository';
import type { session as sessionTable } from '@/data/schema';
import { didCrossInterval } from '@/domain/stopwatch';
import { useStopwatch } from '@/state/useStopwatch';
import { strings } from '@/strings';
import { color, liveZoneFlex, size, tabularNums, type } from '@/theme';

// DESIGN-SPEC.md §5.1 — the live workout screen. Exactly the five zones
// below and nothing else: no notes field, no set list, no scroll view, no
// back button (D9 is intentionally suspended here — the Android system back
// gesture still works; the in-app UI just never offers a way to leave a
// running workout by accident). NEXT EXERCISE routes to /transition, which
// doesn't exist until R4 — out of scope for this session per the brief.

type Session = typeof sessionTable.$inferSelect;

type CurrentExercise = {
  id: string;
  name: string;
  targetSets: number;
  targetRepsMin: number;
  targetRepsMax: number;
} | null;

type LoadState =
  | { status: 'loading' }
  | { status: 'none' }
  | { status: 'ready'; session: Session; title: string; exercise: CurrentExercise; flashIntervalMs: number };

const DEFAULT_FLASH_INTERVAL_MS = 30_000;

export default function LiveSession() {
  useKeepAwake();
  const { db, userId } = useDatabase();
  const router = useRouter();
  const [state, setState] = useState<LoadState>({ status: 'loading' });

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const active = await getActiveSession(db, userId);
      if (!active) {
        if (!cancelled) setState({ status: 'none' });
        return;
      }

      const user = await getUser(db, userId);
      const flashIntervalMs = (user?.restFlashIntervalSeconds ?? 30) * 1000 || DEFAULT_FLASH_INTERVAL_MS;

      let title: string = strings.sessionPlaceholderFreestyleTitle;
      let exercise: CurrentExercise = null;
      if (active.templateId) {
        const template = await getTemplateById(db, userId, active.templateId);
        if (template) title = template.name;

        const templateExercises = await listTemplateExercisesByTemplate(db, userId, active.templateId);
        const first = [...templateExercises].sort((a, b) => a.orderIndex - b.orderIndex)[0];
        if (first) {
          const ex = await getExerciseById(db, userId, first.exerciseId);
          if (ex) {
            exercise = {
              id: first.id,
              name: ex.name,
              targetSets: first.targetSets,
              targetRepsMin: first.targetRepsMin,
              targetRepsMax: first.targetRepsMax,
            };
          }
        }
      }

      if (!cancelled) setState({ status: 'ready', session: active, title, exercise, flashIntervalMs });
    })();
    return () => {
      cancelled = true;
    };
  }, [db, userId]);

  if (state.status === 'none') {
    router.replace('/');
    return null;
  }

  if (state.status === 'loading') return null;

  const goToTransition = () => {
    // /transition doesn't exist until R4 (out of scope for this session per
    // the brief) — the cast is deliberate and should error once that route
    // is added, as a reminder to drop it.
    // @ts-expect-error — /transition is built in R4.
    router.push('/transition');
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
  onNextExercise: () => void;
}) {
  const { session, title, exercise, flashIntervalMs } = state;
  const stopwatch = useStopwatch(db, userId, session);
  const flashRef = useRef<FlashOverlayHandle>(null);
  const previousElapsedRef = useRef(stopwatch.elapsedMs);

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

  const exerciseName = (exercise?.name ?? strings.homeFreestyleLabel).toUpperCase();

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
          {exercise ? (
            <>
              <Text style={[type.label, styles.onSlabText]}>{strings.sessionTargetHeading}</Text>
              <Text style={[type.display1, styles.onSlabText]}>
                {strings.targetSetsRepsLabel(exercise.targetSets, exercise.targetRepsMin, exercise.targetRepsMax)}
              </Text>
            </>
          ) : (
            <Text style={[type.label, styles.onSlabText]}>{strings.homeFreestyleLabel.toUpperCase()}</Text>
          )}
        </Slab>

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

        <Pressable style={styles.nextExerciseTouch} onPress={onNextExercise}>
          <Slab tone="primary" height={size.bottomSlab}>
            <Text style={[type.label, styles.onSlabText]}>{strings.sessionNextExerciseLabel}</Text>
          </Slab>
        </Pressable>
      </SafeAreaView>

      <FlashOverlay ref={flashRef} />
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
