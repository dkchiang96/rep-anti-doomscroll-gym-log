import { Redirect, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useDatabase } from '@/data/DatabaseProvider';
import { endSession, getActiveSession } from '@/data/repositories/sessionRepository';
import { getTemplateById } from '@/data/repositories/templateRepository';
import type { session as sessionTable } from '@/data/schema';
import { formatElapsed } from '@/domain/duration';
import { strings } from '@/strings';
import { theme } from '@/theme';

type Session = typeof sessionTable.$inferSelect;

export default function SessionScreen() {
  const { db, userId } = useDatabase();
  const router = useRouter();

  const [session, setSession] = useState<Session | null | undefined>(undefined);
  const [heading, setHeading] = useState<string>(strings.homeFreestyleLabel);
  const [now, setNow] = useState(() => Date.now());
  const [ending, setEnding] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const active = await getActiveSession(db, userId);
      if (cancelled) return;
      setSession(active);
      if (active?.templateId) {
        const t = await getTemplateById(db, userId, active.templateId);
        if (!cancelled && t) setHeading(t.name);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [db, userId]);

  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, []);

  async function handleEnd() {
    if (!session || ending) return;
    setEnding(true);
    await endSession(db, userId, session.id);
    router.replace('/');
  }

  if (session === undefined) {
    return <SafeAreaView style={styles.safeArea} />;
  }

  if (session === null) {
    return <Redirect href="/" />;
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        <Text style={styles.heading}>{heading}</Text>

        <View style={styles.elapsedBlock}>
          <Text style={styles.elapsedLabel}>{strings.sessionElapsedLabel}</Text>
          <Text style={styles.elapsedValue}>{formatElapsed(now - session.startedAt.getTime())}</Text>
        </View>

        <Text style={styles.placeholder}>{strings.sessionLoggingPlaceholder}</Text>

        <Pressable style={styles.endButton} disabled={ending} onPress={handleEnd}>
          <Text style={styles.endButtonLabel}>{strings.sessionEndButton}</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: theme.color.bg,
  },
  container: {
    flex: 1,
    padding: 20,
    gap: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  heading: {
    color: theme.color.textPrimary,
    fontSize: 24,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
  elapsedBlock: {
    alignItems: 'center',
    marginTop: 24,
    marginBottom: 24,
  },
  elapsedLabel: {
    color: theme.color.textMuted,
    fontSize: 14,
    textTransform: 'uppercase',
  },
  elapsedValue: {
    color: theme.color.accentPrimary,
    fontSize: 72,
    fontWeight: '800',
    fontVariant: ['tabular-nums'],
  },
  placeholder: {
    color: theme.color.textMuted,
    fontSize: 14,
    textAlign: 'center',
  },
  endButton: {
    minHeight: theme.minTouchTarget,
    minWidth: 200,
    borderRadius: 12,
    backgroundColor: theme.color.surface,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 32,
  },
  endButtonLabel: {
    color: theme.color.textPrimary,
    fontSize: 18,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
});
