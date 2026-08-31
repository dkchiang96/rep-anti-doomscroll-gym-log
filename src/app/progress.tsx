import { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ExercisePicker } from '@/components/logging/ExercisePicker';
import { ProgressChart } from '@/components/progress/ProgressChart';
import { useDatabase } from '@/data/DatabaseProvider';
import { listExercises } from '@/data/repositories/exerciseRepository';
import { listSessionHistoryForExercise } from '@/data/repositories/progressRepository';
import type { exercise } from '@/data/schema';
import { deriveLoadDisplay } from '@/domain/loadConvention';
import { formatSessionExerciseShorthand } from '@/domain/keepShorthand';
import { buildProgressPoints, type ProgressSessionEntry } from '@/domain/progressChart';
import { strings } from '@/strings';
import { theme } from '@/theme';

type Exercise = typeof exercise.$inferSelect;

function formatDateLabel(date: Date): string {
  return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

export default function ProgressScreen() {
  const { db, userId } = useDatabase();

  const [allExercises, setAllExercises] = useState<Exercise[]>([]);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [selected, setSelected] = useState<Exercise | null>(null);
  const [history, setHistory] = useState<ProgressSessionEntry[]>([]);

  useEffect(() => {
    listExercises(db, userId).then(setAllExercises);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [db, userId]);

  useEffect(() => {
    if (!selected) {
      setHistory([]);
      return;
    }
    let cancelled = false;
    listSessionHistoryForExercise(db, userId, selected.id).then((entries) => {
      if (!cancelled) setHistory(entries);
    });
    return () => {
      cancelled = true;
    };
  }, [db, userId, selected]);

  const points = useMemo(() => buildProgressPoints(history), [history]);
  const isBodyweight = selected?.loadConvention === 'bodyweight';

  const tableRows = useMemo(
    () =>
      [...history].reverse().map((entry) => ({
        sessionId: entry.sessionId,
        dateLabel: formatDateLabel(entry.startedAt),
        shorthand: formatSessionExerciseShorthand(entry.sets, isBodyweight),
      })),
    [history, isBodyweight],
  );

  function handlePick(picked: Exercise) {
    setSelected(picked);
    setPickerOpen(false);
  }

  const conventionLabel = selected
    ? deriveLoadDisplay(selected.loadConvention, selected.equipmentType, 0).conventionLabel
    : null;

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.container}>
        {pickerOpen ? (
          <ExercisePicker
            db={db}
            userId={userId}
            existingExercises={allExercises}
            onPick={handlePick}
            onClose={() => setPickerOpen(false)}
          />
        ) : (
          <>
            {selected ? (
              <View style={styles.headerRow}>
                <View style={styles.headerTitleGroup}>
                  <Text style={styles.exerciseName}>{selected.name}</Text>
                  {conventionLabel ? <Text style={styles.conventionBadge}>{conventionLabel}</Text> : null}
                </View>
                <Pressable style={styles.changeButton} onPress={() => setPickerOpen(true)}>
                  <Text style={styles.changeButtonLabel}>{strings.progressChangeExerciseButton}</Text>
                </Pressable>
              </View>
            ) : (
              <Pressable style={styles.pickButton} onPress={() => setPickerOpen(true)}>
                <Text style={styles.pickButtonLabel}>{strings.progressPickPrompt}</Text>
              </Pressable>
            )}

            {selected && points.length > 0 ? <ProgressChart points={points} /> : null}

            {selected && points.length === 0 ? <Text style={styles.mutedText}>{strings.progressNoHistory}</Text> : null}

            {selected && tableRows.length > 0 ? (
              <>
                <Text style={styles.sectionHeading}>{strings.progressTableHeading}</Text>
                {tableRows.map((row) => (
                  <View key={row.sessionId} style={styles.tableRow}>
                    <Text style={styles.tableDate}>{row.dateLabel}</Text>
                    <Text style={styles.tableShorthand}>{row.shorthand}</Text>
                  </View>
                ))}
              </>
            ) : null}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: theme.color.bg,
  },
  container: {
    padding: 20,
    gap: 12,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  headerTitleGroup: {
    gap: 4,
    flexShrink: 1,
  },
  exerciseName: {
    color: theme.color.textPrimary,
    fontSize: 24,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
  conventionBadge: {
    color: theme.color.accentPrimary,
    fontSize: 12,
    fontWeight: '700',
  },
  changeButton: {
    minHeight: 40,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: theme.color.textMuted,
    justifyContent: 'center',
    paddingHorizontal: 12,
  },
  changeButtonLabel: {
    color: theme.color.textPrimary,
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  pickButton: {
    minHeight: theme.minTouchTarget,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: theme.color.accentPrimary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pickButtonLabel: {
    color: theme.color.accentPrimary,
    fontSize: 16,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  mutedText: {
    color: theme.color.textMuted,
    fontSize: 14,
  },
  sectionHeading: {
    color: theme.color.textPrimary,
    fontSize: 16,
    fontWeight: '700',
    textTransform: 'uppercase',
    marginTop: 8,
  },
  tableRow: {
    backgroundColor: theme.color.surface,
    borderRadius: 10,
    padding: 12,
    gap: 4,
  },
  tableDate: {
    color: theme.color.textMuted,
    fontSize: 12,
    textTransform: 'uppercase',
  },
  tableShorthand: {
    color: theme.color.textPrimary,
    fontSize: 15,
    fontWeight: '600',
  },
});
