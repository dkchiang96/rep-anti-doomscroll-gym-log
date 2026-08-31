import { useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import {
  getMostRecentSessionExerciseForExercise,
  updateSessionExercise,
} from '@/data/repositories/sessionExerciseRepository';
import {
  createSet,
  listHistoricalWeightsForExercise,
  listSetsBySessionExercise,
  updateSet,
} from '@/data/repositories/setRepository';
import type { exercise, sessionExercise, setEntry } from '@/data/schema';
import type { AppDatabase } from '@/data/types';
import { buildGhostSets, type GhostSet, type SetType } from '@/domain/ghostPrefill';
import { deriveLoadDisplay } from '@/domain/loadConvention';
import { orderRowsForDisplay } from '@/domain/setRowOrdering';
import { inferWeightStep } from '@/domain/weightStep';
import { strings } from '@/strings';
import { theme } from '@/theme';

import { NumericKeypad } from './NumericKeypad';
import { SetRow } from './SetRow';

type Exercise = typeof exercise.$inferSelect;
type SessionExercise = typeof sessionExercise.$inferSelect;
type CommittedSet = typeof setEntry.$inferSelect;

const DEFAULT_WEIGHT_STEP_KG = 2.5;

interface MergedRow {
  rowIndex: number;
  isGhost: boolean;
  weightKg: number;
  reps: number;
  setType: SetType;
  parentIndex: number | null;
}

interface ExerciseBlockProps {
  db: AppDatabase;
  userId: string;
  sessionId: string;
  sessionExercise: SessionExercise;
  exercise: Exercise;
  isSupersetLinked: boolean;
  canReorderUp: boolean;
  canReorderDown: boolean;
  onSkipToggle: () => void;
  onSupersetToggle: () => void;
  onReorderUp: () => void;
  onReorderDown: () => void;
}

export function ExerciseBlock({
  db,
  userId,
  sessionId,
  sessionExercise: se,
  exercise: ex,
  isSupersetLinked,
  canReorderUp,
  canReorderDown,
  onSkipToggle,
  onSupersetToggle,
  onReorderUp,
  onReorderDown,
}: ExerciseBlockProps) {
  const [committedSets, setCommittedSets] = useState<CommittedSet[]>([]);
  const [ghostSets, setGhostSets] = useState<GhostSet[]>([]);
  const [weightStep, setWeightStep] = useState(ex.defaultWeightStep ?? DEFAULT_WEIGHT_STEP_KG);
  const [noteText, setNoteText] = useState(se.note ?? '');
  const [keypadTarget, setKeypadTarget] = useState<{ rowIndex: number; field: 'weight' | 'reps' } | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [existingSets, previousSessionExercise, historicalWeights] = await Promise.all([
        listSetsBySessionExercise(db, userId, se.id),
        getMostRecentSessionExerciseForExercise(db, userId, ex.id, sessionId),
        listHistoricalWeightsForExercise(db, userId, ex.id),
      ]);
      if (cancelled) return;

      setCommittedSets([...existingSets].sort((a, b) => a.index - b.index));

      if (previousSessionExercise) {
        const previousSets = await listSetsBySessionExercise(db, userId, previousSessionExercise.id);
        if (cancelled) return;
        setGhostSets(buildGhostSets(previousSets));
      }

      if (ex.defaultWeightStep == null) {
        const inferred = inferWeightStep(historicalWeights);
        if (!cancelled && inferred != null) setWeightStep(inferred);
      }

      setLoaded(true);
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [db, userId, se.id, ex.id, sessionId]);

  const mergedRows = useMemo<MergedRow[]>(() => {
    const count = Math.max(committedSets.length, ghostSets.length);
    const rows: MergedRow[] = [];
    for (let i = 0; i < count; i++) {
      if (i < committedSets.length) {
        const set = committedSets[i];
        const parentIndex = set.parentSetId
          ? committedSets.findIndex((s) => s.id === set.parentSetId)
          : -1;
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

  async function commitNewSet(input: {
    weightKg: number;
    reps: number;
    setType: SetType;
    parentSetId: string | null;
  }) {
    const created = await createSet(db, {
      userId,
      sessionExerciseId: se.id,
      index: committedSets.length,
      weightKg: input.weightKg,
      reps: input.reps,
      setType: input.setType,
      parentSetId: input.parentSetId,
      restAfterSeconds: null,
      completedAt: new Date(),
    });
    if (created) setCommittedSets((prev) => [...prev, created]);
  }

  function handleConfirmGhost(rowIndex: number) {
    const ghost = ghostSets[rowIndex];
    if (!ghost) return;
    const parentSetId = ghost.parentIndex != null ? (committedSets[ghost.parentIndex]?.id ?? null) : null;
    void commitNewSet({ weightKg: ghost.weightKg, reps: ghost.reps, setType: ghost.setType, parentSetId });
  }

  function handleAddSet() {
    const tail = committedSets[committedSets.length - 1] ?? ghostSets[ghostSets.length - 1];
    void commitNewSet({
      weightKg: tail?.weightKg ?? 0,
      reps: tail?.reps ?? 8,
      setType: 'working',
      parentSetId: null,
    });
  }

  function handleAddDropSet(parentRowIndex: number) {
    const parent = committedSets[parentRowIndex];
    if (!parent) return;
    void commitNewSet({
      weightKg: parent.weightKg,
      reps: parent.reps,
      setType: 'dropset',
      parentSetId: parent.id,
    });
  }

  function handleWeightChange(row: MergedRow, newWeight: number) {
    if (row.isGhost) {
      setGhostSets((prev) => prev.map((g, i) => (i === row.rowIndex ? { ...g, weightKg: newWeight } : g)));
      return;
    }
    const set = committedSets[row.rowIndex];
    void updateSet(db, userId, set.id, { weightKg: newWeight }).then((updated) => {
      if (updated) setCommittedSets((prev) => prev.map((s, i) => (i === row.rowIndex ? updated : s)));
    });
  }

  function handleRepsChange(row: MergedRow, newReps: number) {
    if (row.isGhost) {
      setGhostSets((prev) => prev.map((g, i) => (i === row.rowIndex ? { ...g, reps: newReps } : g)));
      return;
    }
    const set = committedSets[row.rowIndex];
    void updateSet(db, userId, set.id, { reps: newReps }).then((updated) => {
      if (updated) setCommittedSets((prev) => prev.map((s, i) => (i === row.rowIndex ? updated : s)));
    });
  }

  function handleToggleWarmup(row: MergedRow) {
    const newType: SetType = row.setType === 'warmup' ? 'working' : 'warmup';
    if (row.isGhost) {
      setGhostSets((prev) => prev.map((g, i) => (i === row.rowIndex ? { ...g, setType: newType } : g)));
      return;
    }
    const set = committedSets[row.rowIndex];
    void updateSet(db, userId, set.id, { setType: newType }).then((updated) => {
      if (updated) setCommittedSets((prev) => prev.map((s, i) => (i === row.rowIndex ? updated : s)));
    });
  }

  function handleKeypadConfirm(value: number) {
    if (!keypadTarget) return;
    const row = rowsByIndex.get(keypadTarget.rowIndex);
    setKeypadTarget(null);
    if (!row) return;
    if (keypadTarget.field === 'weight') handleWeightChange(row, Math.max(0, value));
    else handleRepsChange(row, Math.max(0, Math.round(value)));
  }

  function commitNote() {
    if (noteText === (se.note ?? '')) return;
    void updateSessionExercise(db, userId, se.id, { note: noteText.length > 0 ? noteText : null });
  }

  let topLevelCounter = 0;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.headerTitleBlock}>
          <Text style={styles.name}>{ex.name}</Text>
          {isSupersetLinked ? <Text style={styles.supersetBadge}>{strings.exerciseSupersetBadge}</Text> : null}
        </View>
        <View style={styles.headerControls}>
          <Pressable style={styles.headerButton} disabled={!canReorderUp} onPress={onReorderUp}>
            <Text style={[styles.headerButtonLabel, !canReorderUp && styles.headerButtonLabelDisabled]}>▲</Text>
          </Pressable>
          <Pressable style={styles.headerButton} disabled={!canReorderDown} onPress={onReorderDown}>
            <Text style={[styles.headerButtonLabel, !canReorderDown && styles.headerButtonLabelDisabled]}>▼</Text>
          </Pressable>
          <Pressable style={styles.headerButton} onPress={onSupersetToggle}>
            <Text style={styles.headerButtonLabel}>{strings.exerciseSupersetToggle}</Text>
          </Pressable>
          <Pressable style={styles.headerButton} onPress={onSkipToggle}>
            <Text style={styles.headerButtonLabel}>{strings.exerciseSkipToggle}</Text>
          </Pressable>
        </View>
      </View>

      <TextInput
        style={styles.noteInput}
        placeholder={strings.exerciseNotePlaceholder}
        placeholderTextColor={theme.color.textMuted}
        value={noteText}
        onChangeText={setNoteText}
        onBlur={commitNote}
      />

      {!loaded ? (
        <Text style={styles.loadingText}>{strings.loading}</Text>
      ) : (
        <View style={styles.sets}>
          {displayOrder.map((rowIndex) => {
            const row = rowsByIndex.get(rowIndex);
            if (!row) return null;
            const isDropSet = row.parentIndex != null;
            const label = isDropSet ? strings.setDropSetMarker : String(++topLevelCounter);
            const disabled = row.isGhost && row.rowIndex !== nextGhostIndex;
            const display = deriveLoadDisplay(ex.loadConvention, ex.equipmentType, row.weightKg);

            return (
              <SetRow
                key={row.rowIndex}
                displayIndex={label}
                weightKg={row.weightKg}
                reps={row.reps}
                setType={row.setType}
                isGhost={row.isGhost}
                isDropSet={isDropSet}
                disabled={disabled}
                conventionLabel={display.conventionLabel}
                totalLine={display.totalLine}
                weightStep={weightStep}
                onWeightChange={(w) => handleWeightChange(row, w)}
                onRepsChange={(r) => handleRepsChange(row, r)}
                onToggleWarmup={() => handleToggleWarmup(row)}
                onConfirm={() => handleConfirmGhost(row.rowIndex)}
                onOpenKeypad={(field) => setKeypadTarget({ rowIndex: row.rowIndex, field })}
                onAddDropSet={
                  !row.isGhost && row.setType === 'working' ? () => handleAddDropSet(row.rowIndex) : undefined
                }
              />
            );
          })}

          <Pressable style={styles.addSetButton} onPress={handleAddSet}>
            <Text style={styles.addSetLabel}>{strings.exerciseAddSet}</Text>
          </Pressable>
        </View>
      )}

      <NumericKeypad
        visible={keypadTarget != null}
        label={keypadTarget?.field === 'reps' ? strings.keypadRepsLabel : strings.keypadWeightLabel}
        allowDecimal={keypadTarget?.field !== 'reps'}
        onConfirm={handleKeypadConfirm}
        onCancel={() => setKeypadTarget(null)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: theme.color.bg,
    borderRadius: 16,
    padding: 12,
    gap: 10,
    borderWidth: 1,
    borderColor: theme.color.surface,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  headerTitleBlock: {
    flexShrink: 1,
  },
  name: {
    color: theme.color.textPrimary,
    fontSize: 20,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
  supersetBadge: {
    color: theme.color.accentPrimary,
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  headerControls: {
    flexDirection: 'row',
    gap: 6,
  },
  headerButton: {
    minWidth: 36,
    minHeight: 36,
    borderRadius: 8,
    backgroundColor: theme.color.surface,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 8,
  },
  headerButtonLabel: {
    color: theme.color.textPrimary,
    fontSize: 13,
    fontWeight: '700',
  },
  headerButtonLabelDisabled: {
    color: theme.color.textMuted,
  },
  noteInput: {
    color: theme.color.textPrimary,
    fontSize: 13,
    borderBottomWidth: 1,
    borderBottomColor: theme.color.surface,
    paddingVertical: 4,
  },
  loadingText: {
    color: theme.color.textMuted,
    fontSize: 13,
  },
  sets: {
    gap: 8,
  },
  addSetButton: {
    alignSelf: 'flex-start',
    minHeight: 40,
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  addSetLabel: {
    color: theme.color.accentSecondary,
    fontSize: 13,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
});
