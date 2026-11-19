import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Slab } from '@/components/ui';
import { useDatabase } from '@/data/DatabaseProvider';
import { getProgrammeById } from '@/data/repositories/programmeRepository';
import { getSessionDetail, type SessionDetailExercise } from '@/data/repositories/historyRepository';
import { getSessionById } from '@/data/repositories/sessionRepository';
import { getTemplateById } from '@/data/repositories/templateRepository';
import type { session as sessionTable } from '@/data/schema';
import { formatElapsed } from '@/domain/duration';
import { formatLoggedExercise } from '@/domain/keepShorthand';
import { strings } from '@/strings';
import { color, size, type } from '@/theme';

// Item 7 — a summary screen shown once a workout is ended (from either exit
// route: session.tsx's top-bar long-press, or transition.tsx's SELECT NEXT
// EXERCISE long-press), so the last thing the user sees each day is what
// they actually did, not a blank Home screen. Reuses R6's history read-model
// (getSessionDetail/formatSessionExerciseShorthand) unchanged.

type Session = typeof sessionTable.$inferSelect;

type LoadState =
  | { status: 'loading' }
  | { status: 'none' }
  | { status: 'ready'; session: Session; title: string; durationLabel: string; exercises: SessionDetailExercise[] };

export default function SessionSummary() {
  const { db, userId } = useDatabase();
  const router = useRouter();
  const params = useLocalSearchParams<{ sessionId?: string }>();
  const sessionId = typeof params.sessionId === 'string' ? params.sessionId : null;
  const [state, setState] = useState<LoadState>(() => (sessionId ? { status: 'loading' } : { status: 'none' }));

  useEffect(() => {
    if (!sessionId) return;
    let cancelled = false;
    (async () => {
      const session = await getSessionById(db, userId, sessionId);
      if (!session) {
        if (!cancelled) setState({ status: 'none' });
        return;
      }

      let title: string = strings.sessionPlaceholderFreestyleTitle;
      if (session.templateId) {
        const template = await getTemplateById(db, userId, session.templateId);
        if (template) title = template.name;
      } else if (session.programmeId) {
        const programme = await getProgrammeById(db, userId, session.programmeId);
        if (programme) title = programme.name;
      }

      const durationLabel = session.endedAt
        ? formatElapsed(session.endedAt.getTime() - session.startedAt.getTime())
        : formatElapsed(0);
      const exercises = await getSessionDetail(db, userId, sessionId);

      if (!cancelled) setState({ status: 'ready', session, title, durationLabel, exercises });
    })();
    return () => {
      cancelled = true;
    };
  }, [db, userId, sessionId]);

  if (state.status === 'none') {
    router.replace('/');
    return null;
  }
  if (state.status === 'loading') return null;

  return (
    <SafeAreaView style={styles.root} edges={['top', 'bottom']}>
      <Stack.Screen options={{ headerShown: false }} />

      <View style={styles.header}>
        <Text style={[type.heading, styles.headerTitle]} numberOfLines={1}>
          {strings.sessionSummaryTitle.toUpperCase()}
        </Text>
      </View>

      <ScrollView style={styles.list} contentContainerStyle={styles.listContent}>
        <Text style={[type.display2, styles.sessionTitle]}>{state.title.toUpperCase()}</Text>
        <Text style={[type.body, styles.durationLine]}>{state.durationLabel}</Text>

        <View style={styles.gap} />

        {state.exercises.length === 0 ? (
          <Text style={[type.body, styles.emptyText]}>{strings.sessionSummaryEmpty}</Text>
        ) : (
          state.exercises.map((ex) => (
            <View key={ex.sessionExerciseId} style={styles.exerciseRow}>
              <Text style={[type.label, styles.exerciseName]}>{ex.exerciseName.toUpperCase()}</Text>
              <Text style={[type.body, styles.exerciseShorthand]}>
                {formatLoggedExercise(ex.sets, ex) || '—'}
              </Text>
            </View>
          ))
        )}
      </ScrollView>

      <Pressable style={styles.doneTouch} onPress={() => router.replace('/')}>
        <Slab tone="primary" height={size.bottomSlab}>
          <Text style={[type.label, styles.onSlabText]}>{strings.sessionSummaryDoneButton}</Text>
        </Slab>
      </Pressable>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: color.bg,
  },
  header: {
    height: size.topBar,
    backgroundColor: color.bar,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
  headerTitle: {
    color: color.textPrimary,
  },
  list: {
    flex: 1,
  },
  listContent: {
    paddingHorizontal: size.listRowPadding,
    paddingVertical: 24,
  },
  sessionTitle: {
    color: color.textPrimary,
  },
  durationLine: {
    color: color.textMuted,
    marginTop: 4,
  },
  gap: {
    height: 24,
  },
  emptyText: {
    color: color.textMuted,
  },
  exerciseRow: {
    paddingVertical: 10,
    borderBottomWidth: size.divider,
    borderBottomColor: color.divider,
  },
  exerciseName: {
    color: color.textPrimary,
  },
  exerciseShorthand: {
    color: color.textMuted,
    marginTop: 2,
  },
  doneTouch: {
    width: '100%',
  },
  onSlabText: {
    color: color.onSlab,
    textAlign: 'center',
  },
});
