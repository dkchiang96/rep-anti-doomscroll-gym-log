import { useBatteryLevel } from 'expo-battery';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { summarizeInstrumentation } from '@/domain/instrumentationSummary';
import { useInstrumentationStore } from '@/state/instrumentationStore';
import { strings } from '@/strings';
import { theme } from '@/theme';

export default function DebugScreen() {
  const records = useInstrumentationStore((s) => s.records);
  const batteryLevel = useBatteryLevel();
  const summary = summarizeInstrumentation(records);
  const batteryPct = batteryLevel >= 0 ? Math.round(batteryLevel * 100) : null;

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.container}>
        <Text style={styles.batteryText}>
          {batteryPct != null ? strings.debugBatteryLabel(batteryPct) : strings.debugBatteryUnavailable}
        </Text>

        {records.length === 0 ? (
          <Text style={styles.mutedText}>{strings.debugSessionEmpty}</Text>
        ) : (
          <>
            <Text style={styles.averagesText}>{strings.debugAveragesLabel(summary.avgTaps, summary.avgSeconds)}</Text>

            <View style={styles.headerRow}>
              <Text style={[styles.cell, styles.headerCell, styles.exerciseCell]}>{strings.debugExerciseColumn}</Text>
              <Text style={[styles.cell, styles.headerCell]}>{strings.debugTapsColumn}</Text>
              <Text style={[styles.cell, styles.headerCell]}>{strings.debugTimeColumn}</Text>
            </View>
            {records.map((r, i) => (
              <View key={i} style={styles.row}>
                <Text style={[styles.cell, styles.exerciseCell]} numberOfLines={1}>
                  {r.exerciseName} #{r.setIndex}
                </Text>
                <Text style={styles.cell}>{r.taps}</Text>
                <Text style={styles.cell}>{r.seconds}</Text>
              </View>
            ))}
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
    gap: 8,
  },
  batteryText: {
    color: theme.color.accentPrimary,
    fontSize: 20,
    fontWeight: '800',
  },
  averagesText: {
    color: theme.color.accentSecondary,
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 8,
  },
  mutedText: {
    color: theme.color.textMuted,
    fontSize: 14,
  },
  headerRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: theme.color.surface,
    paddingBottom: 6,
  },
  row: {
    flexDirection: 'row',
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: theme.color.surface,
  },
  cell: {
    flex: 1,
    color: theme.color.textPrimary,
    fontSize: 13,
    fontVariant: ['tabular-nums'],
  },
  headerCell: {
    color: theme.color.textMuted,
    textTransform: 'uppercase',
    fontSize: 11,
    fontWeight: '700',
  },
  exerciseCell: {
    flex: 2,
  },
});
