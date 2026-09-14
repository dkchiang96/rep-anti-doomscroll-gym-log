import { Stack } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { ProgressChart } from '@/components/progress/ProgressChart';
import { useDatabase } from '@/data/DatabaseProvider';
import { listExercises } from '@/data/repositories/exerciseRepository';
import { listSessionHistoryForExercise, type ProgressSessionEntry } from '@/data/repositories/progressRepository';
import type { exercise as exerciseTable } from '@/data/schema';
import { buildProgressPoints, filterLastNDays } from '@/domain/progressChart';
import { formatSessionExerciseShorthand } from '@/domain/keepShorthand';
import { MUSCLE_GROUPS, OTHER_MUSCLE_GROUP_CHIP, resolveMuscleGroupChip, type MuscleGroupChip } from '@/domain/muscleGroups';
import { strings } from '@/strings';
import { color, size, type } from '@/theme';

// DESIGN-SPEC.md §6 screen 6 (Progress half) — item 9 (this session's punch
// list): pick a muscle group instead of a single exercise, and see every
// exercise in that group stacked, each with its own last-30-days chart and
// table — a single merged chart across exercises with very different weight
// scales would be unreadable. progressRepository.ts and progressChart.ts are
// otherwise unchanged.

type Exercise = typeof exerciseTable.$inferSelect;

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function formatEntryDate(d: Date): string {
  return `${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
}

// Item 1: a time-range filter above the muscle-group chips. `null` means
// "all time" — filterLastNDays is simply skipped rather than passed
// Infinity, since it already treats "no call" as the unbounded case.
type RangeOption = { key: string; label: string; days: number | null };
const RANGE_OPTIONS: RangeOption[] = [
  { key: '30d', label: strings.progressRange30d, days: 30 },
  { key: '90d', label: strings.progressRange90d, days: 90 },
  { key: '6m', label: strings.progressRange6m, days: 182 },
  { key: '1y', label: strings.progressRange1y, days: 365 },
  { key: 'all', label: strings.progressRangeAll, days: null },
];

export default function Progress() {
  const { db, userId } = useDatabase();
  const [library, setLibrary] = useState<Exercise[]>([]);
  const [chip, setChip] = useState<MuscleGroupChip | null>(null);
  const [range, setRange] = useState<RangeOption>(RANGE_OPTIONS[0]);
  const [historyByExercise, setHistoryByExercise] = useState<Record<string, ProgressSessionEntry[]>>({});
  // Date.now() is impure — read once from an effect rather than during
  // render, same pattern used elsewhere in this codebase (session.tsx,
  // useStopwatch) for the React Compiler's purity rule.
  const [nowMs, setNowMs] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const now = Date.now();
      const all = await listExercises(db, userId);
      if (cancelled) return;
      setNowMs(now);
      setLibrary(all);
    })();
    return () => {
      cancelled = true;
    };
  }, [db, userId]);

  const groupExercises = useMemo(() => {
    if (!chip) return [];
    return library
      .filter((ex) => resolveMuscleGroupChip(ex.muscleGroup) === chip)
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [library, chip]);

  useEffect(() => {
    if (groupExercises.length === 0) return;
    let cancelled = false;
    (async () => {
      const entries = await Promise.all(
        groupExercises.map(async (ex) => [ex.id, await listSessionHistoryForExercise(db, userId, ex.id)] as const),
      );
      if (cancelled) return;
      setHistoryByExercise(Object.fromEntries(entries));
    })();
    return () => {
      cancelled = true;
    };
  }, [db, userId, groupExercises]);

  function handlePickChip(next: MuscleGroupChip) {
    setChip((prev) => (prev === next ? null : next));
  }

  return (
    <ScrollView style={styles.root} contentContainerStyle={styles.content}>
      <Stack.Screen options={{ title: strings.progressTitle }} />

      <Text style={[type.body, styles.prompt]}>{strings.progressPickPrompt}</Text>

      <View style={styles.chipRow}>
        {RANGE_OPTIONS.map((option) => (
          <Pressable
            key={option.key}
            onPress={() => setRange(option)}
            style={[styles.chipTouch, range.key === option.key ? styles.chipActive : styles.chipInactive]}
          >
            <Text style={[type.caption, range.key === option.key ? styles.chipLabelActive : styles.chipLabelInactive]}>
              {option.label}
            </Text>
          </Pressable>
        ))}
      </View>

      <View style={styles.chipRow}>
        {[...MUSCLE_GROUPS, OTHER_MUSCLE_GROUP_CHIP].map((group) => (
          <Pressable
            key={group}
            onPress={() => handlePickChip(group)}
            style={[styles.chipTouch, chip === group ? styles.chipActive : styles.chipInactive]}
          >
            <Text style={[type.caption, chip === group ? styles.chipLabelActive : styles.chipLabelInactive]}>
              {group.toUpperCase()}
            </Text>
          </Pressable>
        ))}
      </View>

      {chip && groupExercises.length === 0 ? <Text style={[type.body, styles.emptyText]}>{strings.progressGroupEmpty}</Text> : null}

      {nowMs != null
        ? groupExercises.map((ex) => {
            const allHistory = historyByExercise[ex.id] ?? [];
            const recentHistory = range.days != null ? filterLastNDays(allHistory, nowMs, range.days) : allHistory;
            const points = buildProgressPoints(recentHistory);
            const isBodyweight = ex.loadConvention === 'bodyweight';
            const tableRows = [...recentHistory].reverse();

            return (
              <View key={ex.id} style={styles.exerciseSection}>
                <Text style={[type.heading, styles.exerciseName]}>{ex.name.toUpperCase()}</Text>

                {points.length > 0 ? (
                  <>
                    <ProgressChart points={points} />
                    <Text style={[type.caption, styles.sectionHeading]}>{strings.progressTableHeading(range.label)}</Text>
                    {tableRows.map((entry) => (
                      <Text key={entry.sessionId} style={[type.body, styles.tableRow]}>
                        {formatEntryDate(entry.startedAt)} — {formatSessionExerciseShorthand(entry.sets, isBodyweight) || '—'}
                      </Text>
                    ))}
                  </>
                ) : (
                  <Text style={[type.body, styles.emptyText]}>{strings.progressGroupNoRecentData}</Text>
                )}
              </View>
            );
          })
        : null}
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
  prompt: {
    color: color.textPrimary,
    paddingHorizontal: size.listRowPadding,
    paddingTop: 16,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    paddingHorizontal: size.listRowPadding,
    paddingVertical: 12,
  },
  chipTouch: {
    minHeight: size.minTouchTarget,
    paddingHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: color.divider,
  },
  chipActive: {
    backgroundColor: color.slabSecondary,
    borderColor: color.slabSecondary,
  },
  chipInactive: {
    backgroundColor: 'transparent',
  },
  chipLabelActive: {
    color: color.onSlab,
  },
  chipLabelInactive: {
    color: color.textPrimary,
  },
  exerciseSection: {
    marginTop: 24,
    borderTopWidth: size.divider,
    borderTopColor: color.divider,
    paddingTop: 16,
  },
  exerciseName: {
    color: color.textPrimary,
    paddingHorizontal: size.listRowPadding,
    marginBottom: 8,
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
