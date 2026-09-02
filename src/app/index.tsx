import { Redirect, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { ListRow, Slab } from '@/components/ui';
import { useDatabase } from '@/data/DatabaseProvider';
import { getActiveProgramme } from '@/data/repositories/programmeRepository';
import { createSession, getActiveSession } from '@/data/repositories/sessionRepository';
import { listTemplatesForProgramme } from '@/data/repositories/templateRepository';
import type { programme as programmeTable, template as templateTable } from '@/data/schema';
import { strings } from '@/strings';
import { color, size, type } from '@/theme';

// DESIGN-SPEC.md §5.6.1 — slabs on top, list rows underneath. PROGRAMMES,
// PROGRESS and HISTORY rows (and the "create a programme" slab) are disabled
// until R5/R6 build their destinations — present, never hidden, same pattern
// as the settings.tsx stub.

type Programme = typeof programmeTable.$inferSelect;
type Template = typeof templateTable.$inferSelect;

type LoadState =
  | { status: 'checkingSession' }
  | { status: 'hasActiveSession' }
  | { status: 'ready'; programme: Programme | null; templates: Template[] };

export default function Home() {
  const { db, userId } = useDatabase();
  const router = useRouter();
  const [state, setState] = useState<LoadState>({ status: 'checkingSession' });
  const [starting, setStarting] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      // FR-1.2 restore: an in-progress session under 6 hours old opens
      // straight into the live screen, before any template UI paints.
      const active = await getActiveSession(db, userId);
      if (active) {
        if (!cancelled) setState({ status: 'hasActiveSession' });
        return;
      }

      const programme = await getActiveProgramme(db, userId);
      const templates = programme ? await listTemplatesForProgramme(db, userId, programme.id) : [];
      if (!cancelled) setState({ status: 'ready', programme, templates });
    })();
    return () => {
      cancelled = true;
    };
  }, [db, userId]);

  if (state.status === 'hasActiveSession') {
    return <Redirect href="/session" />;
  }

  if (state.status === 'checkingSession') return null;

  const startSession = async (template: Template | null) => {
    if (starting) return;
    setStarting(true);
    // D2/D9: the session row is written before navigating; the stopwatch
    // itself does not start (R3 owns that) — the live screen opens paused.
    await createSession(db, {
      userId,
      templateId: template?.id ?? null,
      programmeId: template?.programmeId ?? null,
      startedAt: new Date(),
      note: null,
      rawImportText: null,
      endedAt: null,
      source: 'manual',
    });
    router.replace('/session');
  };

  return (
    <ScrollView style={styles.root} contentContainerStyle={styles.content}>
      {state.templates.length > 0 ? (
        state.templates.map((tmpl) => (
          <Pressable key={tmpl.id} style={styles.slabTouch} disabled={starting} onPress={() => startSession(tmpl)}>
            <Slab tone="primary" height={size.bottomSlab}>
              <Text style={[type.label, styles.onSlabText]}>{tmpl.name}</Text>
            </Slab>
          </Pressable>
        ))
      ) : (
        <Slab tone="primary" height={size.bottomSlab}>
          <Text style={[type.label, styles.onSlabText]}>{strings.homeCreateProgrammeSlab}</Text>
        </Slab>
      )}

      <Pressable style={styles.slabTouch} disabled={starting} onPress={() => startSession(null)}>
        <Slab tone="secondary" height={size.bottomSlab}>
          <Text style={[type.label, styles.onSlabText]}>{strings.homeFreestyleLabel}</Text>
        </Slab>
      </Pressable>

      <View style={styles.gap} />

      <ListRow variant="navigation" label={strings.homeRowProgrammes} onPress={() => router.push('/programmes')} />
      <ListRow variant="navigation" label={strings.homeRowProgress} disabled onPress={() => {}} />
      <ListRow variant="navigation" label={strings.homeRowHistory} disabled onPress={() => {}} />
      <ListRow variant="navigation" label={strings.homeRowSettings} onPress={() => router.push('/settings')} />
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
  },
  slabTouch: {
    width: '100%',
    minHeight: size.minTouchTarget,
  },
  onSlabText: {
    color: color.onSlab,
    textAlign: 'center',
  },
  gap: {
    height: 32,
  },
});
