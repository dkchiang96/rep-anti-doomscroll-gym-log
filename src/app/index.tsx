import { Redirect, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ListRow, Slab } from '@/components/ui';
import { useDatabase } from '@/data/DatabaseProvider';
import { getActiveProgramme } from '@/data/repositories/programmeRepository';
import { createSession, getActiveSession } from '@/data/repositories/sessionRepository';
import { listTemplatesForProgramme } from '@/data/repositories/templateRepository';
import type { programme as programmeTable, template as templateTable } from '@/data/schema';
import { strings } from '@/strings';
import { color, size, type } from '@/theme';

// DESIGN-SPEC.md §5.6.1 — slabs on top, list rows underneath. All four
// destination rows are live as of R6; the "create a programme" slab still
// replaces the template slabs (rather than being hidden) when no programme
// is active, same pattern as the settings.tsx stub.

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
    // Item 3: a freestyle start (template === null) still tags the session
    // to the active programme, if one exists, so the live screen can show
    // the programme's name instead of the generic "Freestyle" placeholder.
    await createSession(db, {
      userId,
      templateId: template?.id ?? null,
      programmeId: template?.programmeId ?? state.programme?.id ?? null,
      startedAt: new Date(),
      note: null,
      rawImportText: null,
      endedAt: null,
      source: 'manual',
    });
    router.replace('/session');
  };

  const activeProgramme = state.programme;

  // Item 1: the day slabs and the freestyle slab below them are one
  // continuous stack for spacing purposes — a slabGap goes before every
  // entry but the first, so the run of yellow day buttons and the hand-off
  // to the green freestyle button read as the same uniform rhythm instead
  // of the freestyle slab butting straight up against the last day.
  const daySlabs =
    state.templates.length > 0
      ? state.templates.map((tmpl) => ({ key: tmpl.id, label: tmpl.name, onPress: () => startSession(tmpl) }))
      : [{ key: 'create-programme', label: strings.homeCreateProgrammeSlab, onPress: () => router.push('/programmes') }];

  return (
    <SafeAreaView style={styles.root} edges={['top', 'bottom']}>
      <ScrollView style={styles.root} contentContainerStyle={styles.content}>
        {activeProgramme ? (
          <Text style={[type.label, styles.programmeHeading]}>{activeProgramme.name.toUpperCase()}</Text>
        ) : null}

        {daySlabs.map((slab, i) => (
          <View key={slab.key}>
            {i > 0 ? <View style={styles.slabGap} /> : null}
            <Pressable style={styles.slabTouch} disabled={starting} onPress={slab.onPress}>
              <Slab tone="primary" height={size.bottomSlab}>
                <Text style={[type.label, styles.onSlabText]}>{slab.label}</Text>
              </Slab>
            </Pressable>
          </View>
        ))}

        <View style={styles.slabGap} />
        <Pressable style={styles.slabTouch} disabled={starting} onPress={() => startSession(null)}>
          <Slab tone="secondary" height={size.bottomSlab}>
            <Text style={[type.label, styles.onSlabText]}>{strings.homeFreestyleLabel.toUpperCase()}</Text>
          </Slab>
        </Pressable>

        <View style={styles.gap} />

        <ListRow variant="navigation" label={strings.homeRowProgrammes} onPress={() => router.push('/programmes')} />
        <ListRow variant="navigation" label={strings.homeRowProgress} onPress={() => router.push('/progress')} />
        <ListRow variant="navigation" label={strings.homeRowHistory} onPress={() => router.push('/history')} />
        <ListRow variant="navigation" label={strings.homeRowSettings} onPress={() => router.push('/settings')} />
      </ScrollView>
    </SafeAreaView>
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
  slabGap: {
    height: 4,
  },
  programmeHeading: {
    color: color.textMuted,
    paddingHorizontal: size.listRowPadding,
    paddingTop: 16,
    paddingBottom: 8,
  },
  gap: {
    height: 32,
  },
});
