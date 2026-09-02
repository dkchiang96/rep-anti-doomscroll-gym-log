import { useBatteryLevel } from 'expo-battery';
import { Stack } from 'expo-router';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { summarizeInstrumentation } from '@/domain/instrumentationSummary';
import { useInstrumentationStore } from '@/state/instrumentationStore';
import { strings } from '@/strings';
import { color, size, tabularNums, type } from '@/theme';

// DESIGN-SPEC.md §6 screen 7's Debug destination — battery reading and the
// taps/time-per-set instrumentation from Session 10, rebuilt against the new
// design system. src/domain/instrumentationSummary.ts is unchanged.

export default function Debug() {
  const batteryLevel = useBatteryLevel();
  const records = useInstrumentationStore((s) => s.records);
  const summary = summarizeInstrumentation(records);

  const batteryPct = batteryLevel != null && batteryLevel >= 0 ? Math.round(batteryLevel * 100) : null;

  return (
    <ScrollView style={styles.root} contentContainerStyle={styles.content}>
      <Stack.Screen options={{ title: strings.debugTitle }} />

      <Text style={[type.display1, tabularNums, styles.batteryText]}>
        {batteryPct != null ? strings.debugBatteryLabel(batteryPct) : strings.debugBatteryUnavailable}
      </Text>

      {records.length === 0 ? (
        <Text style={[type.body, styles.emptyText]}>{strings.debugSessionEmpty}</Text>
      ) : (
        <>
          <Text style={[type.body, styles.averagesText]}>{strings.debugAveragesLabel(summary.avgTaps, summary.avgSeconds)}</Text>
          <View style={styles.headerRow}>
            <Text style={[type.caption, styles.columnLabel, styles.exerciseColumn]}>{strings.debugExerciseColumn}</Text>
            <Text style={[type.caption, styles.columnLabel]}>{strings.debugTapsColumn}</Text>
            <Text style={[type.caption, styles.columnLabel]}>{strings.debugTimeColumn}</Text>
          </View>
          {records.map((r, i) => (
            <View key={i} style={styles.row}>
              <Text style={[type.body, styles.exerciseColumn, styles.cellText]} numberOfLines={1}>
                {r.exerciseName || '—'} #{r.setIndex + 1}
              </Text>
              <Text style={[type.body, styles.cellText, tabularNums]}>{r.taps}</Text>
              <Text style={[type.body, styles.cellText, tabularNums]}>{r.seconds}</Text>
            </View>
          ))}
        </>
      )}
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
    paddingHorizontal: size.listRowPadding,
    paddingTop: 16,
    paddingBottom: 32,
    gap: 8,
  },
  batteryText: {
    color: color.textPrimary,
  },
  emptyText: {
    color: color.textMuted,
    marginTop: 16,
  },
  averagesText: {
    color: color.textMuted,
    marginTop: 8,
  },
  headerRow: {
    flexDirection: 'row',
    marginTop: 16,
  },
  columnLabel: {
    color: color.textMuted,
    width: 80,
  },
  exerciseColumn: {
    flex: 1,
    width: undefined,
  },
  row: {
    flexDirection: 'row',
    paddingVertical: 6,
    borderBottomWidth: size.divider,
    borderBottomColor: color.divider,
  },
  cellText: {
    color: color.textPrimary,
    width: 80,
  },
});
