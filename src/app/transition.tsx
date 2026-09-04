import { useKeepAwake } from 'expo-keep-awake';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Clock, FlashOverlay, SetInputRow, Slab, TransportButton } from '@/components/ui';
import type { FlashOverlayHandle } from '@/components/ui';
import { NumericKeypad } from '@/components/transition/NumericKeypad';
import { ExitRecapModal, type RecapSection } from '@/components/transition/ExitRecapModal';
import { DayExercisePicker, type DayExerciseItem } from '@/components/transition/DayExercisePicker';
import { ExercisePicker } from '@/components/exercise/ExercisePicker';
import { runBackupRetention } from '@/data/backup';
import { useDatabase } from '@/data/DatabaseProvider';
import { getExerciseById, recordExerciseUsage } from '@/data/repositories/exerciseRepository';
import { getSessionDetail } from '@/data/repositories/historyRepository';
import {
  createSessionExercise,
  getMostRecentSessionExerciseForExercise,
  listSessionExercisesBySession,
} from '@/data/repositories/sessionExerciseRepository';
import { endSession, getActiveSession } from '@/data/repositories/sessionRepository';
import { listTemplateExercisesByTemplate } from '@/data/repositories/templateExerciseRepository';
import {
  createSet,
  listHistoricalWeightsForExercise,
  listSetsBySessionExercise,
  softDeleteSet,
  updateSet,
} from '@/data/repositories/setRepository';
import { getUser } from '@/data/repositories/userRepository';
import type { exercise as exerciseTable, session as sessionTable, setEntry as setEntryTable } from '@/data/schema';
import type { AppDatabase } from '@/data/types';
import { buildGhostSets, type GhostSet, type SetType } from '@/domain/ghostPrefill';
import { deriveLoadDisplay } from '@/domain/loadConvention';
import { formatSessionExerciseShorthand } from '@/domain/keepShorthand';
import { orderRowsForDisplay } from '@/domain/setRowOrdering';
import { didCrossInterval } from '@/domain/stopwatch';
import { inferWeightStep } from '@/domain/weightStep';
import { useAttachStopwatch, useStopwatch } from '@/state/stopwatchStore';
import { useFlashPreferenceStore } from '@/state/flashPreferenceStore';
import { useInstrumentationStore } from '@/state/instrumentationStore';
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

type LoadState =
  | { status: 'loading' }
  | { status: 'none' }
  | { status: 'ready'; session: Session; flashIntervalMs: number };

const DEFAULT_FLASH_INTERVAL_MS = 30_000;
const DEFAULT_WEIGHT_STEP_KG = 2.5;
// Fallback reps for a row padded out beyond real ghost/committed data (a
// setsDone count higher than anything history or this session has yet) —
// same fallback handleAddSet already used for a brand-new row.
const DEFAULT_BLANK_REPS = 8;

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
  const params = useLocalSearchParams<{ sessionExerciseId?: string; exerciseId?: string; setsDone?: string }>();
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
  const setsDoneParsed = typeof params.setsDone === 'string' ? Number(params.setsDone) : NaN;
  const setsDone = Number.isFinite(setsDoneParsed) ? setsDoneParsed : null;

  return (
    <TransitionScreen
      db={db}
      userId={userId}
      state={state}
      sessionExerciseId={sessionExerciseId}
      exerciseId={exerciseId}
      setsDone={setsDone}
    />
  );
}

function TransitionScreen({
  db,
  userId,
  state,
  sessionExerciseId,
  exerciseId,
  setsDone,
}: {
  db: AppDatabase;
  userId: string;
  state: Extract<LoadState, { status: 'ready' }>;
  sessionExerciseId: string | null;
  exerciseId: string | null;
  // The live screen's SETS DONE tally at the moment NEXT EXERCISE was
  // tapped, or null when arriving some other way (e.g. the exercise picker's
  // handlePickNextExercise, which doesn't carry a live-screen tally at all).
  // Null falls back to the old open-ended ghost-prefill behaviour; a real
  // number (0 included) is taken literally as "show exactly this many rows."
  setsDone: number | null;
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
  const [loaded, setLoaded] = useState(false);
  const [keypadTarget, setKeypadTarget] = useState<{ rowIndex: number; field: 'weight' | 'reps' } | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  // A templated session offers today's programme day (in sequence, done
  // exercises greyed out) before falling back to the full library — the
  // full ExercisePicker (pickerOpen above) stays reachable as the explicit
  // "substitute" route via the day picker's footer button.
  const [dayPickerOpen, setDayPickerOpen] = useState(false);
  const [dayItems, setDayItems] = useState<DayExerciseItem[]>([]);
  const flashTone = useFlashPreferenceStore((s) => s.tone);
  const recordSetCompletion = useInstrumentationStore((s) => s.recordSetCompletion);
  const router = useRouter();

  // Item 7: long-pressing SELECT NEXT EXERCISE is the primary way to end a
  // workout from here — it's the last exercise's screen, not the live screen,
  // for most real sessions. Same tap-to-confirm-armed pattern session.tsx's
  // bottom slab now uses (unified — see docs/PROGRESS.md), so a stray
  // long-press can't end a running workout.
  const [endArmed, setEndArmed] = useState(false);
  const disarmTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    return () => {
      if (disarmTimeoutRef.current) clearTimeout(disarmTimeoutRef.current);
    };
  }, []);

  // Item 2: a blocking recap before either exit route actually commits to
  // moving on. 'exercise' shows just the exercise about to be left (after
  // finalizeRemainingSets has already written it); 'end' shows every
  // exercise in the whole session, fetched fresh right before ending.
  const [recapMode, setRecapMode] = useState<'exercise' | 'end' | null>(null);
  const [recapSections, setRecapSections] = useState<RecapSection[]>([]);

  useEffect(() => {
    // Nothing to load without a current exercise — the render below checks
    // sessionExerciseId/exerciseId before it ever looks at `loaded`, so
    // there's no state to set for this branch.
    if (!sessionExerciseId || !exerciseId) return;
    let cancelled = false;
    (async () => {
      const [existingSets, previousSessionExercise, historicalWeights, ex] = await Promise.all([
        listSetsBySessionExercise(db, userId, sessionExerciseId),
        getMostRecentSessionExerciseForExercise(db, userId, exerciseId, session.id),
        listHistoricalWeightsForExercise(db, userId, exerciseId),
        getExerciseById(db, userId, exerciseId),
      ]);
      if (cancelled) return;

      setCommittedSets([...existingSets].sort((a, b) => a.index - b.index));
      if (previousSessionExercise) {
        const previousSets = await listSetsBySessionExercise(db, userId, previousSessionExercise.id);
        if (!cancelled) setGhostSets(buildGhostSets(previousSets));
      }
      setExercise(ex);
      const inferred = ex?.defaultWeightStep ?? inferWeightStep(historicalWeights);
      setWeightStep(inferred ?? DEFAULT_WEIGHT_STEP_KG);
      setLoaded(true);
    })();
    return () => {
      cancelled = true;
    };
  }, [db, userId, sessionExerciseId, exerciseId, session.id]);

  const mergedRows = useMemo<MergedRow[]>(() => {
    // setsDone (the live screen's tally) is taken literally when present:
    // exactly that many rows, ghost-prefilled where history covers them,
    // blank beyond it. Null (arrived some other way) falls back to the old
    // open-ended "however many ghost/committed rows exist" behaviour.
    const count =
      setsDone != null ? Math.max(committedSets.length, setsDone) : Math.max(committedSets.length, ghostSets.length);
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
        const ghost = ghostSets[i] ?? { weightKg: 0, reps: DEFAULT_BLANK_REPS, setType: 'working' as const, parentIndex: null };
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
  }, [committedSets, ghostSets, setsDone]);

  const displayOrder = useMemo(
    () => orderRowsForDisplay(mergedRows.map((r) => ({ index: r.rowIndex, parentIndex: r.parentIndex }))),
    [mergedRows],
  );
  const rowsByIndex = useMemo(() => new Map(mergedRows.map((r) => [r.rowIndex, r])), [mergedRows]);

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
    if (created) {
      setCommittedSets((prev) => [...prev, created]);
      recordSetCompletion(exercise?.name ?? '', created.index);
    }
    return created;
  }

  // Item 10: any row is directly editable, not just the next unconfirmed
  // ghost in order. Invariant 1 still holds — the edit writes to SQLite the
  // moment it happens — but writing row N before row N-1 exists would break
  // the index-contiguity setRowOrdering/drop-set parent-linking rely on, so
  // any ghost rows still ahead of targetIndex are silently committed first,
  // using whatever values they currently show (ghost defaults if the user
  // never touched them — the same values finalizeRemainingSets would use
  // for an untouched row at exit time anyway).
  async function commitThrough(targetIndex: number, patch: { weightKg?: number; reps?: number; setType?: SetType }) {
    if (!sessionExerciseId) return;
    let local = committedSets;
    for (let i = local.length; i <= targetIndex; i++) {
      const row = rowsByIndex.get(i);
      if (!row) break;
      const isTarget = i === targetIndex;
      const parentSetId = row.parentIndex != null ? (local[row.parentIndex]?.id ?? null) : null;
      const created = await createSet(db, {
        userId,
        sessionExerciseId,
        index: local.length,
        weightKg: isTarget ? (patch.weightKg ?? row.weightKg) : row.weightKg,
        reps: isTarget ? (patch.reps ?? row.reps) : row.reps,
        setType: isTarget ? (patch.setType ?? row.setType) : row.setType,
        parentSetId,
        restAfterSeconds: null,
        completedAt: new Date(),
      });
      if (created) {
        local = [...local, created];
        if (isTarget) recordSetCompletion(exercise?.name ?? '', created.index);
      }
    }
    setCommittedSets(local);
  }

  function applyValueToRow(row: MergedRow, patch: { weightKg?: number; reps?: number; setType?: SetType }) {
    if (row.isGhost) {
      void commitThrough(row.rowIndex, patch);
      return;
    }
    const set = committedSets[row.rowIndex];
    if (!set) return;
    void updateSet(db, userId, set.id, patch).then((updated) => {
      if (updated) setCommittedSets((prev) => prev.map((s, i) => (i === row.rowIndex ? updated : s)));
    });
  }

  function handleWeightStep(row: MergedRow, direction: 1 | -1) {
    applyValueToRow(row, { weightKg: round2(Math.max(0, row.weightKg + direction * weightStep)) });
  }

  function handleRepsStep(row: MergedRow, direction: 1 | -1) {
    applyValueToRow(row, { reps: Math.max(0, row.reps + direction) });
  }

  function handleToggleWarmup(row: MergedRow) {
    applyValueToRow(row, { setType: row.setType === 'warmup' ? 'working' : 'warmup' });
  }

  function handleSetBodyweight(row: MergedRow) {
    applyValueToRow(row, { weightKg: 0 });
  }

  function handleTapWeight(row: MergedRow) {
    setKeypadTarget({ rowIndex: row.rowIndex, field: 'weight' });
  }

  function handleTapReps(row: MergedRow) {
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

  // Today's programme day, in the order the template specifies — an
  // exercise is "done" once it has at least one committed set logged this
  // session, and is greyed out / untappable in that state.
  async function loadDayItems() {
    if (!session.templateId) return;
    const [templateExercises, detail] = await Promise.all([
      listTemplateExercisesByTemplate(db, userId, session.templateId),
      getSessionDetail(db, userId, session.id),
    ]);
    const doneExerciseIds = new Set(detail.filter((d) => d.sets.length > 0).map((d) => d.exerciseId));
    const sorted = [...templateExercises].sort((a, b) => a.orderIndex - b.orderIndex);
    const items: DayExerciseItem[] = [];
    for (const te of sorted) {
      const ex = await getExerciseById(db, userId, te.exerciseId);
      if (ex) items.push({ templateExerciseId: te.id, exercise: ex, done: doneExerciseIds.has(ex.id) });
    }
    setDayItems(items);
  }

  function openNextExercisePicker() {
    if (session.templateId) {
      void loadDayItems();
      setDayPickerOpen(true);
    } else {
      setPickerOpen(true);
    }
  }

  async function handlePickNextExercise(picked: Exercise) {
    setPickerOpen(false);
    setDayPickerOpen(false);
    const existing = await listSessionExercisesBySession(db, userId, session.id);
    let se = existing.find((s) => s.exerciseId === picked.id) ?? null;
    if (!se) {
      se = await createSessionExercise(db, {
        userId,
        sessionId: session.id,
        exerciseId: picked.id,
        orderIndex: existing.length,
      });
    }
    if (!se) return;
    void recordExerciseUsage(db, userId, picked.id);
    router.replace({ pathname: '/session', params: { sessionExerciseId: se.id, exerciseId: picked.id } });
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

  // No explicit "confirm" step — whatever is showing for this exercise
  // (ghost-prefilled or hand-edited) becomes the final record the moment the
  // user leaves it, via either exit route below. Iterates in ascending
  // rowIndex order (not display order) so a drop set's parent is always
  // already committed by the time the drop set itself is reached. Returns
  // the final array so callers can build a recap from it without waiting on
  // React state to re-render.
  async function finalizeRemainingSets(): Promise<CommittedSet[]> {
    if (!sessionExerciseId) return committedSets;
    let local = committedSets;
    for (let i = local.length; i < mergedRows.length; i++) {
      const row = rowsByIndex.get(i);
      if (!row) continue;
      const parentSetId = row.parentIndex != null ? (local[row.parentIndex]?.id ?? null) : null;
      const created = await createSet(db, {
        userId,
        sessionExerciseId,
        index: local.length,
        weightKg: row.weightKg,
        reps: row.reps,
        setType: row.setType,
        parentSetId,
        restAfterSeconds: null,
        completedAt: new Date(),
      });
      if (created) local = [...local, created];
    }
    setCommittedSets(local);
    return local;
  }

  function armEndConfirm() {
    void finalizeRemainingSets();
    setEndArmed(true);
    if (disarmTimeoutRef.current) clearTimeout(disarmTimeoutRef.current);
    disarmTimeoutRef.current = setTimeout(() => setEndArmed(false), 4000);
  }

  // Item 2: neither exit route acts immediately — each opens a blocking
  // recap of what's about to be locked in first (ExitRecapModal), so a
  // logging mistake surfaces before it's sealed rather than after.
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
      setRecapMode('end');
      return;
    }
    // Nothing logged for this slot yet (e.g. still in the pre-workout "Warm
    // up" state with no exercise picked) — there's nothing to recap, so go
    // straight to picking the next exercise instead of showing an empty
    // confirmation screen.
    if (!sessionExerciseId || !exerciseId || !exercise) {
      openNextExercisePicker();
      return;
    }
    const finalSets = await finalizeRemainingSets();
    setRecapSections([
      {
        name: exercise?.name ?? '',
        shorthand: formatSessionExerciseShorthand(finalSets, exercise?.loadConvention === 'bodyweight') || '—',
      },
    ]);
    setRecapMode('exercise');
  }

  async function finishSession() {
    await endSession(db, userId, session.id);
    // Backup failure must never block ending the session — same guarantee
    // session.tsx's own end-session control makes.
    try {
      await runBackupRetention();
    } catch {
      // intentionally swallowed
    }
    router.replace({ pathname: '/session-summary', params: { sessionId: session.id } });
  }

  function handleRecapConfirm() {
    const mode = recapMode;
    setRecapMode(null);
    if (mode === 'end') void finishSession();
    else if (mode === 'exercise') openNextExercisePicker();
  }

  function handleRecapBack() {
    setRecapMode(null);
  }

  const exerciseName = (exercise?.name ?? strings.sessionNoExerciseLabel).toUpperCase();
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
            {exercise
              ? displayOrder.map((rowIndex) => {
                  const row = rowsByIndex.get(rowIndex);
                  if (!row) return null;
                  const isDropSet = row.parentIndex != null;
                  if (!isDropSet) topLevelCounter += 1;
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
                      indent={isDropSet}
                      conventionLabel={display.conventionLabel}
                      totalLine={display.totalLine}
                      bodyweightRelevant={exercise.loadConvention === 'bodyweight'}
                      onWeightStep={(d) => handleWeightStep(row, d)}
                      onRepsStep={(d) => handleRepsStep(row, d)}
                      onToggleWarmup={() => handleToggleWarmup(row)}
                      onSetBodyweight={() => handleSetBodyweight(row)}
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

        <Pressable
          style={styles.nextExerciseTouch}
          onPress={() => void handleNextExercisePress()}
          onLongPress={armEndConfirm}
          delayLongPress={600}
        >
          <Slab tone="primary" height={size.bottomSlab}>
            <Text style={[type.label, endArmed ? styles.onSlabTextArmed : styles.onSlabText]}>
              {endArmed ? strings.sessionEndConfirmPrompt.toUpperCase() : strings.transitionSelectNextExerciseLabel}
            </Text>
          </Slab>
        </Pressable>
      </SafeAreaView>

      <FlashOverlay ref={flashRef} tone={flashTone} />

      <DayExercisePicker
        visible={dayPickerOpen}
        items={dayItems}
        onSelect={(picked) => void handlePickNextExercise(picked)}
        onAddInstead={() => {
          setDayPickerOpen(false);
          setPickerOpen(true);
        }}
        onClose={() => setDayPickerOpen(false)}
      />

      <ExercisePicker
        visible={pickerOpen}
        db={db}
        userId={userId}
        onClose={() => setPickerOpen(false)}
        onSelect={(picked) => void handlePickNextExercise(picked)}
      />

      <NumericKeypad
        visible={keypadTarget != null}
        label={keypadTarget?.field === 'reps' ? strings.keypadRepsLabel : strings.keypadWeightLabel}
        allowDecimal={keypadTarget?.field !== 'reps'}
        onConfirm={handleKeypadConfirm}
        onCancel={() => setKeypadTarget(null)}
      />

      <ExitRecapModal
        visible={recapMode != null}
        title={recapMode === 'end' ? strings.recapEndTitle : strings.recapExerciseTitle}
        sections={recapSections}
        confirmLabel={recapMode === 'end' ? strings.recapEndConfirmButton : strings.recapExerciseConfirmButton}
        onConfirm={handleRecapConfirm}
        onBack={handleRecapBack}
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
  // §2's danger token is reserved for destructive confirmations — this is
  // the confirm-armed state of the end-session long-press, same as
  // session.tsx's top-bar treatment.
  onSlabTextArmed: {
    color: color.danger,
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
  nextExerciseTouch: {
    width: '100%',
  },
});
