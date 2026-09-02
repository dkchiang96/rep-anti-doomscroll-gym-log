import { useKeepAwake } from 'expo-keep-awake';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Clock, FlashOverlay, SetInputRow, Slab, TransportButton } from '@/components/ui';
import type { FlashOverlayHandle } from '@/components/ui';
import { NumericKeypad } from '@/components/transition/NumericKeypad';
import { PlateCalculator } from '@/components/transition/PlateCalculator';
import { useDatabase } from '@/data/DatabaseProvider';
import { getExerciseById } from '@/data/repositories/exerciseRepository';
import { getMostRecentSessionExerciseForExercise } from '@/data/repositories/sessionExerciseRepository';
import { getActiveSession } from '@/data/repositories/sessionRepository';
import { seedDefaultPlateInventoryIfEmpty } from '@/data/repositories/plateInventoryRepository';
import {
  createSet,
  listHistoricalWeightsForExercise,
  listSetsBySessionExercise,
  softDeleteSet,
  updateSet,
} from '@/data/repositories/setRepository';
import { getUser } from '@/data/repositories/userRepository';
import type { exercise as exerciseTable, plateInventory as plateInventoryTable, session as sessionTable, setEntry as setEntryTable } from '@/data/schema';
import type { AppDatabase } from '@/data/types';
import { buildGhostSets, type GhostSet, type SetType } from '@/domain/ghostPrefill';
import { deriveLoadDisplay } from '@/domain/loadConvention';
import type { PlateConvention } from '@/domain/plates';
import { orderRowsForDisplay } from '@/domain/setRowOrdering';
import { didCrossInterval } from '@/domain/stopwatch';
import { inferWeightStep } from '@/domain/weightStep';
import { useAttachStopwatch, useStopwatch } from '@/state/stopwatchStore';
import { strings } from '@/strings';
import { color, size, type } from '@/theme';

// DESIGN-SPEC.md §5.2/§5.7/§6 screen 3 — the transition screen. D7/D8: sets
// are logged once per exercise, here, with the clock (D10) shrunk to a
// compact bar but never stopped, never re-mounted — see
// src/state/stopwatchStore.ts. Building the real exercise picker is R5's
// job (per the brief); SELECT NEXT EXERCISE is a disabled slab for now,
// same "present, never hidden" treatment R2 used for unbuilt destinations —
// the Android system back gesture returns to the live screen in the
// meantime, same accepted exemption R3 already established for that screen.

type Session = typeof sessionTable.$inferSelect;
type Exercise = typeof exerciseTable.$inferSelect;
type CommittedSet = typeof setEntryTable.$inferSelect;
type PlateInventoryRow = typeof plateInventoryTable.$inferSelect;

type LoadState =
  | { status: 'loading' }
  | { status: 'none' }
  | { status: 'ready'; session: Session; flashIntervalMs: number };

const DEFAULT_FLASH_INTERVAL_MS = 30_000;
const DEFAULT_WEIGHT_STEP_KG = 2.5;

interface MergedRow {
  rowIndex: number;
  isGhost: boolean;
  weightKg: number;
  reps: number;
  setType: SetType;
  parentIndex: number | null;
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

export default function Transition() {
  const { db, userId } = useDatabase();
  const router = useRouter();
  const params = useLocalSearchParams<{ sessionExerciseId?: string; exerciseId?: string }>();
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
      if (!cancelled) setState({ status: 'ready', session: active, flashIntervalMs });
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

  const sessionExerciseId = typeof params.sessionExerciseId === 'string' ? params.sessionExerciseId : null;
  const exerciseId = typeof params.exerciseId === 'string' ? params.exerciseId : null;

  return (
    <TransitionScreen
      db={db}
      userId={userId}
      state={state}
      sessionExerciseId={sessionExerciseId}
      exerciseId={exerciseId}
    />
  );
}

function TransitionScreen({
  db,
  userId,
  state,
  sessionExerciseId,
  exerciseId,
}: {
  db: AppDatabase;
  userId: string;
  state: Extract<LoadState, { status: 'ready' }>;
  sessionExerciseId: string | null;
  exerciseId: string | null;
}) {
  const { session, flashIntervalMs } = state;
  useAttachStopwatch(db, userId, session);
  const stopwatch = useStopwatch();
  useKeepAwake();

  const { height: windowHeight } = useWindowDimensions();
  const compactBarHeight = Math.round(windowHeight * 0.13);

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

  const [exercise, setExercise] = useState<Exercise | null>(null);
  const [committedSets, setCommittedSets] = useState<CommittedSet[]>([]);
  const [ghostSets, setGhostSets] = useState<GhostSet[]>([]);
  const [weightStep, setWeightStep] = useState(DEFAULT_WEIGHT_STEP_KG);
  const [plateInventory, setPlateInventory] = useState<PlateInventoryRow[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [keypadTarget, setKeypadTarget] = useState<{ rowIndex: number; field: 'weight' | 'reps' } | null>(null);
  const [calculatorRowIndex, setCalculatorRowIndex] = useState<number | null>(null);

  useEffect(() => {
    // Nothing to load without a current exercise — the render below checks
    // sessionExerciseId/exerciseId before it ever looks at `loaded`, so
    // there's no state to set for this branch.
    if (!sessionExerciseId || !exerciseId) return;
    let cancelled = false;
    (async () => {
      const [existingSets, previousSessionExercise, historicalWeights, ex, inventory] = await Promise.all([
        listSetsBySessionExercise(db, userId, sessionExerciseId),
        getMostRecentSessionExerciseForExercise(db, userId, exerciseId, session.id),
        listHistoricalWeightsForExercise(db, userId, exerciseId),
        getExerciseById(db, userId, exerciseId),
        seedDefaultPlateInventoryIfEmpty(db, userId),
      ]);
      if (cancelled) return;

      setCommittedSets([...existingSets].sort((a, b) => a.index - b.index));
      if (previousSessionExercise) {
        const previousSets = await listSetsBySessionExercise(db, userId, previousSessionExercise.id);
        if (!cancelled) setGhostSets(buildGhostSets(previousSets));
      }
      setExercise(ex);
      setPlateInventory(inventory);
      const inferred = ex?.defaultWeightStep ?? inferWeightStep(historicalWeights);
      setWeightStep(inferred ?? DEFAULT_WEIGHT_STEP_KG);
      setLoaded(true);
    })();
    return () => {
      cancelled = true;
    };
  }, [db, userId, sessionExerciseId, exerciseId, session.id]);

  const mergedRows = useMemo<MergedRow[]>(() => {
    const count = Math.max(committedSets.length, ghostSets.length);
    const rows: MergedRow[] = [];
    for (let i = 0; i < count; i++) {
      if (i < committedSets.length) {
        const set = committedSets[i];
        const parentIndex = set.parentSetId ? committedSets.findIndex((s) => s.id === set.parentSetId) : -1;
        rows.push({
          rowIndex: i,
          isGhost: false,
          weightKg: set.weightKg,
          reps: set.reps,
          setType: set.setType,
          parentIndex: parentIndex >= 0 ? parentIndex : null,
        });
      } else {
        const ghost = ghostSets[i];
        rows.push({
          rowIndex: i,
          isGhost: true,
          weightKg: ghost.weightKg,
          reps: ghost.reps,
          setType: ghost.setType,
          parentIndex: ghost.parentIndex,
        });
      }
    }
    return rows;
  }, [committedSets, ghostSets]);

  const displayOrder = useMemo(
    () => orderRowsForDisplay(mergedRows.map((r) => ({ index: r.rowIndex, parentIndex: r.parentIndex }))),
    [mergedRows],
  );
  const rowsByIndex = useMemo(() => new Map(mergedRows.map((r) => [r.rowIndex, r])), [mergedRows]);
  const nextGhostIndex = committedSets.length;

  function resolveGhostParentId(ghost: GhostSet): string | null {
    if (ghost.parentIndex == null) return null;
    return committedSets[ghost.parentIndex]?.id ?? null;
  }

  async function commitNewSet(input: { weightKg: number; reps: number; setType: SetType; parentSetId: string | null }) {
    if (!sessionExerciseId) return null;
    const created = await createSet(db, {
      userId,
      sessionExerciseId,
      index: committedSets.length,
      weightKg: input.weightKg,
      reps: input.reps,
      setType: input.setType,
      parentSetId: input.parentSetId,
      restAfterSeconds: null,
      completedAt: new Date(),
    });
    if (created) setCommittedSets((prev) => [...prev, created]);
    return created;
  }

  function applyValueToRow(row: MergedRow, patch: { weightKg?: number; reps?: number; setType?: SetType }) {
    if (row.isGhost) {
      if (row.rowIndex !== nextGhostIndex) return; // gated: ghosts confirm top-to-bottom (see setRowOrdering's index-contiguity note)
      const ghost = ghostSets[row.rowIndex];
      void commitNewSet({
        weightKg: patch.weightKg ?? ghost.weightKg,
        reps: patch.reps ?? ghost.reps,
        setType: patch.setType ?? ghost.setType,
        parentSetId: resolveGhostParentId(ghost),
      });
      return;
    }
    const set = committedSets[row.rowIndex];
    if (!set) return;
    void updateSet(db, userId, set.id, patch).then((updated) => {
      if (updated) setCommittedSets((prev) => prev.map((s, i) => (i === row.rowIndex ? updated : s)));
    });
  }

  function handleWeightStep(row: MergedRow, direction: 1 | -1) {
    if (row.isGhost && row.rowIndex !== nextGhostIndex) return;
    applyValueToRow(row, { weightKg: round2(Math.max(0, row.weightKg + direction * weightStep)) });
  }

  function handleRepsStep(row: MergedRow, direction: 1 | -1) {
    if (row.isGhost && row.rowIndex !== nextGhostIndex) return;
    applyValueToRow(row, { reps: Math.max(0, row.reps + direction) });
  }

  function handleToggleWarmup(row: MergedRow) {
    if (row.isGhost && row.rowIndex !== nextGhostIndex) return;
    applyValueToRow(row, { setType: row.setType === 'warmup' ? 'working' : 'warmup' });
  }

  const plateConvention: PlateConvention | null =
    exercise && exercise.loadConvention !== 'bodyweight' ? exercise.loadConvention : null;
  const usesPlateCalculator =
    plateConvention != null && exercise != null && (exercise.equipmentType === 'barbell' || exercise.equipmentType === 'plate_loaded');

  function handleTapWeight(row: MergedRow) {
    if (row.isGhost && row.rowIndex !== nextGhostIndex) return;
    if (usesPlateCalculator) setCalculatorRowIndex(row.rowIndex);
    else setKeypadTarget({ rowIndex: row.rowIndex, field: 'weight' });
  }

  function handleTapReps(row: MergedRow) {
    if (row.isGhost && row.rowIndex !== nextGhostIndex) return;
    setKeypadTarget({ rowIndex: row.rowIndex, field: 'reps' });
  }

  function handleKeypadConfirm(value: number) {
    if (!keypadTarget) return;
    const row = rowsByIndex.get(keypadTarget.rowIndex);
    const field = keypadTarget.field;
    setKeypadTarget(null);
    if (!row) return;
    if (field === 'weight') applyValueToRow(row, { weightKg: Math.max(0, value) });
    else applyValueToRow(row, { reps: Math.max(0, Math.round(value)) });
  }

  function handlePlateApply(weightKg: number) {
    if (calculatorRowIndex == null) return;
    const row = rowsByIndex.get(calculatorRowIndex);
    setCalculatorRowIndex(null);
    if (!row) return;
    applyValueToRow(row, { weightKg });
  }

  function handleAddSet() {
    const tail = committedSets[committedSets.length - 1] ?? ghostSets[ghostSets.length - 1];
    void commitNewSet({ weightKg: tail?.weightKg ?? 0, reps: tail?.reps ?? 8, setType: 'working', parentSetId: null });
  }

  function handleAddDropSet(row: MergedRow) {
    if (row.isGhost) return;
    const parent = committedSets[row.rowIndex];
    if (!parent) return;
    void commitNewSet({ weightKg: parent.weightKg, reps: parent.reps, setType: 'dropset', parentSetId: parent.id });
  }

  // Removal is scoped to the most-recently-committed set (undo-last) — an
  // arbitrary mid-list delete would need to reindex every set after it,
  // which is exactly the index-contiguity invariant ghost pre-fill and
  // drop-set parent-linking depend on elsewhere in this screen.
  function handleRemoveLastSet() {
    const last = committedSets[committedSets.length - 1];
    if (!last) return;
    void softDeleteSet(db, userId, last.id).then(() => {
      setCommittedSets((prev) => prev.slice(0, -1));
    });
  }

  async function handleConfirmAll() {
    if (!sessionExerciseId) return;
    let local = committedSets;
    for (let i = nextGhostIndex; i < ghostSets.length; i++) {
      const ghost = ghostSets[i];
      const parentSetId = ghost.parentIndex != null ? (local[ghost.parentIndex]?.id ?? null) : null;
      const created = await createSet(db, {
        userId,
        sessionExerciseId,
        index: local.length,
        weightKg: ghost.weightKg,
        reps: ghost.reps,
        setType: ghost.setType,
        parentSetId,
        restAfterSeconds: null,
        completedAt: new Date(),
      });
      if (created) local = [...local, created];
    }
    setCommittedSets(local);
  }

  const exerciseName = (exercise?.name ?? strings.homeFreestyleLabel).toUpperCase();
  let topLevelCounter = 0;

  return (
    <View style={styles.outer}>
      <Stack.Screen options={{ headerShown: false }} />

      <SafeAreaView style={styles.root} edges={['top', 'bottom']}>
        <Slab tone="primary" height={compactBarHeight}>
          <View style={styles.compactBarContent}>
            <View style={styles.compactBarText}>
              <Text style={[type.caption, styles.onSlabText]} numberOfLines={1}>
                {exerciseName}
              </Text>
              <Clock elapsedMs={stopwatch.elapsedMs} variant="compact" />
            </View>
            <TransportButton
              variant="small"
              state={stopwatch.isRunning ? 'pause' : 'start'}
              onPress={stopwatch.isRunning ? stopwatch.pause : stopwatch.start}
            />
          </View>
        </Slab>

        {!sessionExerciseId || !exerciseId ? (
          <View style={styles.emptyState}>
            <Text style={[type.body, styles.emptyStateText]}>{strings.transitionNoExerciseMessage}</Text>
          </View>
        ) : !loaded ? null : (
          <ScrollView style={styles.list} contentContainerStyle={styles.listContent}>
            {nextGhostIndex < ghostSets.length ? (
              <Pressable onPress={() => void handleConfirmAll()}>
                <Slab tone="secondary" height={size.listRow}>
                  <Text style={[type.label, styles.onSlabText]}>{strings.transitionConfirmAllButton}</Text>
                </Slab>
              </Pressable>
            ) : null}

            {exercise
              ? displayOrder.map((rowIndex) => {
                  const row = rowsByIndex.get(rowIndex);
                  if (!row) return null;
                  const isDropSet = row.parentIndex != null;
                  if (!isDropSet) topLevelCounter += 1;
                  const disabled = row.isGhost && row.rowIndex !== nextGhostIndex;
                  const display = deriveLoadDisplay(exercise.loadConvention, exercise.equipmentType, row.weightKg);
                  const isLastCommitted = !row.isGhost && row.rowIndex === committedSets.length - 1;

                  return (
                    <SetInputRow
                      key={row.rowIndex}
                      setLabel={isDropSet ? strings.setDropSetMarker : String(topLevelCounter)}
                      weightKg={row.weightKg}
                      reps={row.reps}
                      confirmed={!row.isGhost}
                      warmup={row.setType === 'warmup'}
                      disabled={disabled}
                      indent={isDropSet}
                      conventionLabel={display.conventionLabel}
                      totalLine={display.totalLine}
                      onWeightStep={(d) => handleWeightStep(row, d)}
                      onRepsStep={(d) => handleRepsStep(row, d)}
                      onToggleWarmup={() => handleToggleWarmup(row)}
                      onTapWeight={() => handleTapWeight(row)}
                      onTapReps={() => handleTapReps(row)}
                      onAddDropSet={!row.isGhost && row.setType === 'working' ? () => handleAddDropSet(row) : undefined}
                      onRemove={isLastCommitted ? handleRemoveLastSet : undefined}
                    />
                  );
                })
              : null}

            {exercise ? (
              <Pressable style={styles.addSetTouch} onPress={handleAddSet}>
                <Text style={[type.label, styles.addSetLabel]}>{strings.transitionAddSetButton}</Text>
              </Pressable>
            ) : null}
          </ScrollView>
        )}

        {/* SELECT NEXT EXERCISE opens the real exercise picker in R5 — until
            then this is a disabled slab (present, never hidden, same
            treatment R2 used for other not-yet-built destinations). Design
            law bans opacity-based tinting, so there's no legal way to paint
            it visually "disabled"; it just doesn't respond to touch. */}
        <View pointerEvents="none">
          <Slab tone="primary" height={size.bottomSlab}>
            <Text style={[type.label, styles.onSlabText]}>{strings.transitionSelectNextExerciseLabel}</Text>
          </Slab>
        </View>
      </SafeAreaView>

      <FlashOverlay ref={flashRef} />

      <NumericKeypad
        visible={keypadTarget != null}
        label={keypadTarget?.field === 'reps' ? strings.keypadRepsLabel : strings.keypadWeightLabel}
        allowDecimal={keypadTarget?.field !== 'reps'}
        onConfirm={handleKeypadConfirm}
        onCancel={() => setKeypadTarget(null)}
      />

      {exercise && plateConvention && usesPlateCalculator ? (
        <PlateCalculator
          visible={calculatorRowIndex != null}
          db={db}
          userId={userId}
          exerciseId={exercise.id}
          exerciseName={exercise.name}
          convention={plateConvention}
          barWeightKg={exercise.barWeightKg}
          targetKg={calculatorRowIndex != null ? (rowsByIndex.get(calculatorRowIndex)?.weightKg ?? 0) : 0}
          inventory={plateInventory}
          onClose={() => setCalculatorRowIndex(null)}
          onApplyWeight={handlePlateApply}
          onBarWeightSet={(bw) => setExercise((prev) => (prev ? { ...prev, barWeightKg: bw } : prev))}
          onInventoryChanged={setPlateInventory}
        />
      ) : null}
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
  compactBarContent: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 24,
  },
  compactBarText: {
    flex: 1,
  },
  onSlabText: {
    color: color.onSlab,
    textAlign: 'center',
  },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  emptyStateText: {
    color: color.textMuted,
    textAlign: 'center',
  },
  list: {
    flex: 1,
  },
  listContent: {
    paddingBottom: 24,
  },
  addSetTouch: {
    minHeight: size.minTouchTarget,
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  addSetLabel: {
    color: color.slabSecondary,
  },
});
