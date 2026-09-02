import { Stack } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { useDatabase } from '@/data/DatabaseProvider';
import { getSessionDetail, listSessionSummaries, type SessionDetailExercise, type SessionSummary } from '@/data/repositories/historyRepository';
import { formatElapsed } from '@/domain/duration';
import { formatSessionExerciseShorthand } from '@/domain/keepShorthand';
import { strings } from '@/strings';
import { color, size, type } from '@/theme';

// DESIGN-SPEC.md §6 screen 6 (history half) / §5.6 — reverse-chronological
// session list built from plain dividered rows, no card. Tapping a row
// expands its exercise list in place (in Keep shorthand, per FR-7.3's
// grammar run in reverse) rather than pushing an 8th screen — the screen
// inventory reserves no separate "session detail" route.

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function formatSessionDate(d: Date): string {
  return `${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
}

export default function History() {
  const { db, userId } = useDatabase();
  const [sessions, setSessions] = useState<SessionSummary[]>([]);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [detail, setDetail] = useState<SessionDetailExercise[] | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const rows = await listSessionSummaries(db, userId);
      if (!cancelled) setSessions(rows);
    })();
    return () => {
      cancelled = true;
    };
  }, [db, userId]);

  async function toggleRow(id: string) {
    if (expanded === id) {
      setExpanded(null);
      setDetail(null);
      return;
    }
    setExpanded(id);
    setDetail(null);
    setLoadingDetail(true);
    const rows = await getSessionDetail(db, userId, id);
    setLoadingDetail(false);
    setDetail(rows);
  }

  return (
    <ScrollView style={styles.root} contentContainerStyle={styles.content}>
      <Stack.Screen options={{ title: strings.historyTitle }} />

      {sessions.length === 0 ? <Text style={[type.body, styles.emptyText]}>{strings.historyEmpty}</Text> : null}

      {sessions.map((s) => {
        const isExpanded = expanded === s.id;
        const durationLabel = s.endedAt ? formatElapsed(s.endedAt.getTime() - s.startedAt.getTime()) : strings.historyInProgress;
        const templateLabel = s.templateName ?? strings.homeFreestyleLabel;
        return (
          <View key={s.id}>
            <Pressable style={styles.row} onPress={() => void toggleRow(s.id)}>
              <View style={styles.rowLabels}>
                <Text style={[type.label, styles.dateLabel]}>{formatSessionDate(s.startedAt)}</Text>
                <Text style={[type.caption, styles.subLabel]}>
                  {templateLabel.toUpperCase()} · {durationLabel}
                </Text>
              </View>
              <View style={styles.divider} />
            </Pressable>

            {isExpanded ? (
              <View style={styles.detail}>
                {loadingDetail ? null : detail && detail.length > 0 ? (
                  detail.map((ex) => (
                    <Text key={ex.sessionExerciseId} style={[type.body, styles.detailLine]}>
                      {ex.exerciseName.toUpperCase()} — {formatSessionExerciseShorthand(ex.sets, ex.isBodyweight) || '—'}
                    </Text>
                  ))
                ) : (
                  <Text style={[type.body, styles.detailEmpty]}>{strings.historyDetailEmpty}</Text>
                )}
              </View>
            ) : null}
          </View>
        );
      })}
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
  emptyText: {
    color: color.textMuted,
    paddingHorizontal: size.listRowPadding,
    paddingVertical: 16,
  },
  row: {
    width: '100%',
    minHeight: size.listRow,
    justifyContent: 'center',
  },
  rowLabels: {
    paddingHorizontal: size.listRowPadding,
    paddingVertical: 12,
  },
  dateLabel: {
    color: color.textPrimary,
  },
  subLabel: {
    color: color.textMuted,
    marginTop: 2,
  },
  divider: {
    height: size.divider,
    width: '100%',
    backgroundColor: color.divider,
  },
  detail: {
    paddingHorizontal: size.listRowPadding,
    paddingVertical: 12,
    gap: 6,
  },
  detailLine: {
    color: color.textMuted,
  },
  detailEmpty: {
    color: color.textMuted,
  },
});
