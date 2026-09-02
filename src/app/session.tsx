import { Stack, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Clock } from '@/components/ui';
import { useDatabase } from '@/data/DatabaseProvider';
import { endSession, getActiveSession } from '@/data/repositories/sessionRepository';
import { getTemplateById } from '@/data/repositories/templateRepository';
import type { session as sessionTable } from '@/data/schema';
import { strings } from '@/strings';
import { color, type } from '@/theme';

// R2 placeholder only — R3 replaces this file entirely with the real five-zone
// live screen (DESIGN-SPEC.md §5.1). This version exists so starting or
// restoring a session has somewhere to land, and so the user isn't stranded
// before R3 exists: an END SESSION row, not in the R2 brief itself, follows
// directly from D9 ("no screen can strand the user").

type Session = typeof sessionTable.$inferSelect;

export default function SessionPlaceholder() {
  const { db, userId } = useDatabase();
  const router = useRouter();
  const [state, setState] = useState<
    'loading' | 'none' | { session: Session; title: string; elapsedMs: number }
  >('loading');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const active = await getActiveSession(db, userId);
      if (!active) {
        if (!cancelled) setState('none');
        return;
      }
      const template = active.templateId ? await getTemplateById(db, userId, active.templateId) : null;
      if (!cancelled) {
        // R3 builds the real ticking stopwatch (src/domain/stopwatch.ts) with
        // pause-duration persisted on the session row. Until then this is a
        // single reading taken once at load: ~0 for a freshly-started session
        // (satisfies the "00:00, not running" exit check), or real elapsed
        // time for a restored one, since there's no accumulated-pause state
        // to subtract yet.
        const elapsedMs = Math.max(0, Date.now() - active.startedAt.getTime());
        setState({ session: active, title: template?.name ?? strings.sessionPlaceholderFreestyleTitle, elapsedMs });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [db, userId]);

  if (state === 'none') {
    router.replace('/');
    return null;
  }

  if (state === 'loading') return null;

  const handleEndSession = async () => {
    await endSession(db, userId, state.session.id);
    router.replace('/');
  };

  return (
    <View style={styles.root}>
      <Stack.Screen options={{ title: state.title }} />
      <Text style={[type.display2, styles.title]}>{state.title}</Text>
      <Clock elapsedMs={state.elapsedMs} />
      <Pressable style={styles.endButton} onPress={handleEndSession}>
        <Text style={[type.label, styles.endButtonLabel]}>{strings.sessionEndButton}</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: color.bg,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 32,
  },
  title: {
    color: color.textPrimary,
    textAlign: 'center',
  },
  endButton: {
    minHeight: 56,
    minWidth: 56,
    paddingHorizontal: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  endButtonLabel: {
    color: color.danger,
  },
});
