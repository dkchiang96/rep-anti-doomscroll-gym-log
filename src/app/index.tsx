import { Redirect, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useDatabase } from '@/data/DatabaseProvider';
import { getActiveProgramme } from '@/data/repositories/programmeRepository';
import { createSessionExercise } from '@/data/repositories/sessionExerciseRepository';
import { createSession, getActiveSession } from '@/data/repositories/sessionRepository';
import { listTemplateExercisesByTemplate } from '@/data/repositories/templateExerciseRepository';
import { listTemplatesForProgramme } from '@/data/repositories/templateRepository';
import type { template } from '@/data/schema';
import { useInstrumentationStore } from '@/state/instrumentationStore';
import { strings } from '@/strings';
import { theme } from '@/theme';

type Template = typeof template.$inferSelect;

export default function HomeScreen() {
  const { db, userId } = useDatabase();
  const router = useRouter();

  const [activeSessionId, setActiveSessionId] = useState<string | null | undefined>(undefined);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [starting, setStarting] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const active = await getActiveSession(db, userId);
      if (cancelled) return;
      setActiveSessionId(active?.id ?? null);
      if (active) return;

      const programme = await getActiveProgramme(db, userId);
      const list = programme ? await listTemplatesForProgramme(db, userId, programme.id) : [];
      if (!cancelled) setTemplates(list);
    })();
    return () => {
      cancelled = true;
    };
  }, [db, userId]);

  async function startSession(templateId: string | null, programmeId: string | null) {
    if (starting) return;
    setStarting(true);
    useInstrumentationStore.getState().resetForNewSession();
    const created = await createSession(db, {
      userId,
      templateId,
      programmeId,
      startedAt: new Date(),
      endedAt: null,
      note: null,
      source: 'manual',
    });
    if (created && templateId) {
      const templateExercises = await listTemplateExercisesByTemplate(db, userId, templateId);
      for (const te of templateExercises.sort((a, b) => a.orderIndex - b.orderIndex)) {
        await createSessionExercise(db, {
          userId,
          sessionId: created.id,
          exerciseId: te.exerciseId,
          orderIndex: te.orderIndex,
          supersetGroupId: te.supersetGroupId,
          note: null,
          skippedAt: null,
        });
      }
    }
    if (created) router.replace('/session');
    setStarting(false);
  }

  if (activeSessionId === undefined) {
    return <SafeAreaView style={styles.safeArea} />;
  }

  if (activeSessionId) {
    return <Redirect href="/session" />;
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        {templates.length === 0 ? (
          <Text style={styles.hint}>{strings.homeNoProgrammeHint}</Text>
        ) : (
          templates.map((t) => (
            <Pressable
              key={t.id}
              style={styles.templateButton}
              disabled={starting}
              onPress={() => startSession(t.id, t.programmeId)}>
              <Text style={styles.templateLabel}>{t.name}</Text>
            </Pressable>
          ))
        )}

        <Pressable style={styles.freestyleButton} disabled={starting} onPress={() => startSession(null, null)}>
          <Text style={styles.freestyleLabel}>{strings.homeFreestyleLabel}</Text>
        </Pressable>

        <Pressable style={styles.importLink} onPress={() => router.push('/programmes')}>
          <Text style={styles.importLinkLabel}>{strings.homeProgrammesLink}</Text>
        </Pressable>

        <Pressable style={styles.importLink} onPress={() => router.push('/archive')}>
          <Text style={styles.importLinkLabel}>{strings.homeArchiveLink}</Text>
        </Pressable>

        <Pressable style={styles.importLink} onPress={() => router.push('/progress')}>
          <Text style={styles.importLinkLabel}>{strings.homeProgressLink}</Text>
        </Pressable>

        <Pressable style={styles.importLink} onPress={() => router.push('/import')}>
          <Text style={styles.importLinkLabel}>{strings.homeImportLink}</Text>
        </Pressable>

        <Pressable style={styles.importLink} onPress={() => router.push('/export')}>
          <Text style={styles.importLinkLabel}>{strings.homeExportLink}</Text>
        </Pressable>

        <Pressable style={styles.importLink} onPress={() => router.push('/debug')}>
          <Text style={styles.importLinkLabel}>{strings.homeDebugLink}</Text>
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
  },
  templateButton: {
    minHeight: theme.minTouchTarget * 1.5,
    borderRadius: 12,
    backgroundColor: theme.color.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  templateLabel: {
    color: theme.color.textPrimary,
    fontSize: 28,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
  freestyleButton: {
    minHeight: theme.minTouchTarget,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: theme.color.accentPrimary,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
  },
  freestyleLabel: {
    color: theme.color.accentPrimary,
    fontSize: 18,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  hint: {
    color: theme.color.textMuted,
    fontSize: 15,
    textAlign: 'center',
  },
  importLink: {
    minHeight: theme.minTouchTarget,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 24,
  },
  importLinkLabel: {
    color: theme.color.textMuted,
    fontSize: 14,
    textDecorationLine: 'underline',
  },
});
