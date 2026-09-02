import { Stack } from 'expo-router';
import { useState } from 'react';
import { ScrollView, StyleSheet, Text } from 'react-native';

import { ListRow } from '@/components/ui';
import { ExercisePicker } from '@/components/exercise/ExercisePicker';
import { ProgressChart } from '@/components/progress/ProgressChart';
import { useDatabase } from '@/data/DatabaseProvider';
import { listSessionHistoryForExercise, type ProgressSessionEntry } from '@/data/repositories/progressRepository';
import type { exercise as exerciseTable } from '@/data/schema';
import { buildProgressPoints } from '@/domain/progressChart';
import { formatSessionExerciseShorthand } from '@/domain/keepShorthand';
import { strings } from '@/strings';
import { color, size, type } from '@/theme';

// DESIGN-SPEC.md §6 screen 6 (Progress half) — pick an exercise, see top
// working-set weight and reps over time. progressChart.ts and
// progressRepository.ts are unchanged from the pre-rebuild build; this is a
// render against the new tokens, nothing more. No 1RM, no volume, no heatmaps.

type Exercise = typeof exerciseTable.$inferSelect;

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function formatEntryDate(d: Date): string {
  return `${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
}

export default function Progress() {
  const { db, userId } = useDatabase();
  const [pickerVisible, setPickerVisible] = useState(false);
  const [selected, setSelected] = useState<Exercise | null>(null);
  const [history, setHistory] = useState<ProgressSessionEntry[]>([]);

  async function handleSelect(exercise: Exercise) {
    setSelected(exercise);
    setPickerVisible(false);
    const rows = await listSessionHistoryForExercise(db, userId, exercise.id);
    setHistory(rows);
  }

  const points = buildProgressPoints(history);
  const isBodyweight = selected?.loadConvention === 'bodyweight';
  const tableRows = [...history].reverse();

  return (
    <ScrollView style={styles.root} contentContainerStyle={styles.content}>
      <Stack.Screen options={{ title: strings.progressTitle }} />

      <ListRow
        variant="value"
        label={selected ? selected.name.toUpperCase() : strings.progressPickPrompt}
        valueLabel={strings.progressChangeExerciseButton}
        onPress={() => setPickerVisible(true)}
      />

      {selected ? (
        points.length > 0 ? (
          <>
            <ProgressChart points={points} />
            <Text style={[type.caption, styles.sectionHeading]}>{strings.progressTableHeading}</Text>
            {tableRows.map((entry) => (
              <Text key={entry.sessionId} style={[type.body, styles.tableRow]}>
                {formatEntryDate(entry.startedAt)} — {formatSessionExerciseShorthand(entry.sets, isBodyweight) || '—'}
              </Text>
            ))}
          </>
        ) : (
          <Text style={[type.body, styles.emptyText]}>{strings.progressNoHistory}</Text>
        )
      ) : null}

      <ExercisePicker visible={pickerVisible} db={db} userId={userId} onClose={() => setPickerVisible(false)} onSelect={(ex) => void handleSelect(ex)} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: color.bg,
  },
  content: {
    flexGrow: 1,
    paddingBottom: 32,
  },
  sectionHeading: {
    color: color.textMuted,
    paddingHorizontal: size.listRowPadding,
    marginTop: 16,
    marginBottom: 8,
  },
  tableRow: {
    color: color.textPrimary,
    paddingHorizontal: size.listRowPadding,
    paddingVertical: 6,
  },
  emptyText: {
    color: color.textMuted,
    paddingHorizontal: size.listRowPadding,
    paddingVertical: 16,
  },
});
