import { Redirect, useRouter } from 'expo-router';
import { useKeepAwake } from 'expo-keep-awake';
import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ExerciseBlock } from '@/components/logging/ExerciseBlock';
import { ExercisePicker } from '@/components/logging/ExercisePicker';
import { RestClock } from '@/components/logging/RestClock';
import { RestFlashOverlay } from '@/components/logging/RestFlashOverlay';
import { useRestClock, type RestSettings } from '@/components/logging/useRestClock';
import { useDatabase } from '@/data/DatabaseProvider';
import { newId } from '@/data/id';
import { getExerciseById, listExercises, recordExerciseUsage } from '@/data/repositories/exerciseRepository';
import {
  createSessionExercise,
  listSessionExercisesBySession,
  updateSessionExercise,
} from '@/data/repositories/sessionExerciseRepository';
import { endSession, getActiveSession, updateSession } from '@/data/repositories/sessionRepository';
import { getTemplateById } from '@/data/repositories/templateRepository';
import { getUser, updateRestSettings } from '@/data/repositories/userRepository';
import type { exercise as exerciseTable, session as sessionTable, sessionExercise as sessionExerciseTable } from '@/data/schema';
import { formatElapsed } from '@/domain/duration';
import { resolveTargetRestSeconds } from '@/domain/restClock';
import { strings } from '@/strings';
import { theme } from '@/theme';

type Session = typeof sessionTable.$inferSelect;
type SessionExercise = typeof sessionExerciseTable.$inferSelect;
type Exercise = typeof exerciseTable.$inferSelect;

interface Item {
  sessionExercise: SessionExercise;
  exercise: Exercise;
}

function activeSorted(items: Item[]) {
  return items.filter((it) => !it.sessionExercise.skippedAt).sort((a, b) => a.sessionExercise.orderIndex - b.sessionExercise.orderIndex);
}

function skippedSorted(items: Item[]) {
  return items.filter((it) => it.sessionExercise.skippedAt).sort((a, b) => a.sessionExercise.orderIndex - b.sessionExercise.orderIndex);
}

const DEFAULT_REST_SETTINGS: RestSettings = {
  flashIntervalSeconds: 30,
  soundEnabled: false,
  vibrationEnabled: false,
  cameraFlashEnabled: false,
};

export default function SessionScreen() {
  useKeepAwake(); // FR-4.5: screen stays awake for the whole session.

  const { db, userId } = useDatabase();
  const router = useRouter();

  const [session, setSession] = useState<Session | null | undefined>(undefined);
  const [heading, setHeading] = useState<string>(strings.homeFreestyleLabel);
  const [now, setNow] = useState(() => Date.now());
  const [ending, setEnding] = useState(false);

  const [items, setItems] = useState<Item[]>([]);
  const [allExercises, setAllExercises] = useState<Exercise[]>([]);
  const [sessionNote, setSessionNote] = useState('');
  const [addPanelOpen, setAddPanelOpen] = useState(false);

  const [restSettings, setRestSettings] = useState<RestSettings>(DEFAULT_REST_SETTINGS);
  const [restStartedAt, setRestStartedAt] = useState<number | null>(null);
  const [restTargetSeconds, setRestTargetSeconds] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const active = await getActiveSession(db, userId);
      if (cancelled) return;
      setSession(active);
      if (!active) return;

      setSessionNote(active.note ?? '');
      if (active.templateId) {
        const t = await getTemplateById(db, userId, active.templateId);
        if (!cancelled && t) setHeading(t.name);
      }

      const [sessionExercises, exercises, user] = await Promise.all([
        listSessionExercisesBySession(db, userId, active.id),
        listExercises(db, userId),
        getUser(db, userId),
      ]);
      if (cancelled) return;
      setAllExercises(exercises);
      if (user) {
        setRestSettings({
          flashIntervalSeconds: user.restFlashIntervalSeconds,
          soundEnabled: user.restSoundEnabled,
          vibrationEnabled: user.restVibrationEnabled,
          cameraFlashEnabled: user.restCameraFlashEnabled,
        });
      }

      const exerciseById = new Map(exercises.map((e) => [e.id, e]));
      const loadedItems: Item[] = [];
      for (const se of sessionExercises) {
        const ex = exerciseById.get(se.exerciseId) ?? (await getExerciseById(db, userId, se.exerciseId));
        if (ex) loadedItems.push({ sessionExercise: se, exercise: ex });
      }
      if (!cancelled) setItems(loadedItems);
    })();
    return () => {
      cancelled = true;
    };
  }, [db, userId]);

  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, []);

  const restClock = useRestClock(restStartedAt, restTargetSeconds, restSettings);

  function handleSetCommitted(it: Item) {
    // FR-3.9 / Session 5 brief: rest is suppressed between superset pairs.
    if (it.sessionExercise.supersetGroupId != null) return;
    setRestStartedAt(Date.now());
    setRestTargetSeconds(resolveTargetRestSeconds(it.exercise.targetRestSeconds));
  }

  function handleRestSettingsChange(patch: Partial<RestSettings>) {
    setRestSettings((prev) => {
      const next = { ...prev, ...patch };
      void updateRestSettings(db, userId, {
        restFlashIntervalSeconds: next.flashIntervalSeconds,
        restSoundEnabled: next.soundEnabled,
        restVibrationEnabled: next.vibrationEnabled,
        restCameraFlashEnabled: next.cameraFlashEnabled,
      });
      return next;
    });
  }

  async function handleEnd() {
    if (!session || ending) return;
    setEnding(true);
    await endSession(db, userId, session.id);
    router.replace('/');
  }

  function commitSessionNote() {
    if (!session) return;
    if (sessionNote === (session.note ?? '')) return;
    void updateSession(db, userId, session.id, { note: sessionNote.length > 0 ? sessionNote : null });
  }

  function patchItem(updated: SessionExercise) {
    setItems((prev) => prev.map((it) => (it.sessionExercise.id === updated.id ? { ...it, sessionExercise: updated } : it)));
  }

  function handleExerciseUpdated(updated: Exercise) {
    setItems((prev) => prev.map((it) => (it.exercise.id === updated.id ? { ...it, exercise: updated } : it)));
  }

  async function handleSkipToggle(se: SessionExercise) {
    const updated = await updateSessionExercise(db, userId, se.id, { skippedAt: se.skippedAt ? null : new Date() });
    if (updated) patchItem(updated);
  }

  async function handleReorder(se: SessionExercise, direction: 'up' | 'down') {
    const active = activeSorted(items);
    const idx = active.findIndex((it) => it.sessionExercise.id === se.id);
    const swapIdx = direction === 'up' ? idx - 1 : idx + 1;
    if (idx < 0 || swapIdx < 0 || swapIdx >= active.length) return;

    const a = active[idx].sessionExercise;
    const b = active[swapIdx].sessionExercise;
    const [updatedA, updatedB] = await Promise.all([
      updateSessionExercise(db, userId, a.id, { orderIndex: b.orderIndex }),
      updateSessionExercise(db, userId, b.id, { orderIndex: a.orderIndex }),
    ]);
    if (updatedA) patchItem(updatedA);
    if (updatedB) patchItem(updatedB);
  }

  async function handleSupersetToggle(se: SessionExercise) {
    if (se.supersetGroupId) {
      const groupId = se.supersetGroupId;
      const linked = items.filter((it) => it.sessionExercise.supersetGroupId === groupId);
      const updated = await Promise.all(
        linked.map((it) => updateSessionExercise(db, userId, it.sessionExercise.id, { supersetGroupId: null })),
      );
      updated.forEach((u) => u && patchItem(u));
      return;
    }

    const active = activeSorted(items);
    const idx = active.findIndex((it) => it.sessionExercise.id === se.id);
    const partner = active[idx + 1];
    if (!partner) return;

    const groupId = newId();
    const [updatedSe, updatedPartner] = await Promise.all([
      updateSessionExercise(db, userId, se.id, { supersetGroupId: groupId }),
      updateSessionExercise(db, userId, partner.sessionExercise.id, { supersetGroupId: groupId }),
    ]);
    if (updatedSe) patchItem(updatedSe);
    if (updatedPartner) patchItem(updatedPartner);
  }

  async function handleExercisePicked(exercise: Exercise) {
    if (!session) return;
    const nextOrder = items.length > 0 ? Math.max(...items.map((it) => it.sessionExercise.orderIndex)) + 1 : 0;
    const [created, used] = await Promise.all([
      createSessionExercise(db, {
        userId,
        sessionId: session.id,
        exerciseId: exercise.id,
        orderIndex: nextOrder,
        supersetGroupId: null,
        note: null,
        skippedAt: null,
      }),
      recordExerciseUsage(db, userId, exercise.id),
    ]);
    const pickedExercise = used ?? exercise;
    if (created) {
      setItems((prev) => [...prev, { sessionExercise: created, exercise: pickedExercise }]);
      setAllExercises((prev) =>
        prev.some((e) => e.id === pickedExercise.id) ? prev.map((e) => (e.id === pickedExercise.id ? pickedExercise : e)) : [...prev, pickedExercise],
      );
    }
    setAddPanelOpen(false);
  }

  if (session === undefined) {
    return <SafeAreaView style={styles.safeArea} />;
  }

  if (session === null) {
    return <Redirect href="/" />;
  }

  const active = activeSorted(items);
  const skipped = skippedSorted(items);

  return (
    <SafeAreaView style={styles.safeArea}>
      <RestFlashOverlay
        flashing={restClock.flashing}
        cameraReady={restClock.cameraReady}
        torchOn={restClock.torchOn}
      />
      <ScrollView contentContainerStyle={styles.container}>
        <Text style={styles.heading}>{heading}</Text>

        <View style={styles.elapsedBlock}>
          <Text style={styles.elapsedLabel}>{strings.sessionElapsedLabel}</Text>
          <Text style={styles.elapsedValue}>{formatElapsed(now - session.startedAt.getTime())}</Text>
        </View>

        <RestClock
          elapsedMs={restClock.elapsedMs}
          targetSeconds={restClock.targetSeconds}
          running={restStartedAt != null}
          settings={restSettings}
          onSettingsChange={handleRestSettingsChange}
        />

        <TextInput
          style={styles.sessionNoteInput}
          placeholder={strings.sessionNotePlaceholder}
          placeholderTextColor={theme.color.textMuted}
          value={sessionNote}
          onChangeText={setSessionNote}
          onBlur={commitSessionNote}
        />

        <View style={styles.exerciseList}>
          {active.map((it, idx) => (
            <ExerciseBlock
              key={it.sessionExercise.id}
              db={db}
              userId={userId}
              sessionId={session.id}
              sessionExercise={it.sessionExercise}
              exercise={it.exercise}
              isSupersetLinked={it.sessionExercise.supersetGroupId != null}
              canReorderUp={idx > 0}
              canReorderDown={idx < active.length - 1}
              onSkipToggle={() => handleSkipToggle(it.sessionExercise)}
              onSupersetToggle={() => handleSupersetToggle(it.sessionExercise)}
              onReorderUp={() => handleReorder(it.sessionExercise, 'up')}
              onReorderDown={() => handleReorder(it.sessionExercise, 'down')}
              onSetCommitted={() => handleSetCommitted(it)}
              onExerciseUpdated={handleExerciseUpdated}
            />
          ))}
        </View>

        {addPanelOpen ? (
          <ExercisePicker
            db={db}
            userId={userId}
            existingExercises={allExercises}
            onPick={handleExercisePicked}
            onClose={() => setAddPanelOpen(false)}
          />
        ) : (
          <Pressable style={styles.addExerciseButton} onPress={() => setAddPanelOpen(true)}>
            <Text style={styles.addExerciseLabel}>{strings.sessionAddExerciseButton}</Text>
          </Pressable>
        )}

        {skipped.length > 0 ? (
          <View style={styles.skippedSection}>
            <Text style={styles.skippedHeading}>{strings.exerciseSkippedHeading}</Text>
            {skipped.map((it) => (
              <Pressable
                key={it.sessionExercise.id}
                style={styles.skippedRow}
                onPress={() => handleSkipToggle(it.sessionExercise)}>
                <Text style={styles.skippedLabel}>{it.exercise.name}</Text>
              </Pressable>
            ))}
          </View>
        ) : null}

        <Pressable style={styles.endButton} disabled={ending} onPress={handleEnd}>
          <Text style={styles.endButtonLabel}>{strings.sessionEndButton}</Text>
        </Pressable>
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
    gap: 16,
  },
  heading: {
    color: theme.color.textPrimary,
    fontSize: 24,
    fontWeight: '800',
    textTransform: 'uppercase',
    textAlign: 'center',
  },
  elapsedBlock: {
    alignItems: 'center',
  },
  elapsedLabel: {
    color: theme.color.textMuted,
    fontSize: 14,
    textTransform: 'uppercase',
  },
  elapsedValue: {
    color: theme.color.accentPrimary,
    fontSize: 56,
    fontWeight: '800',
    fontVariant: ['tabular-nums'],
  },
  sessionNoteInput: {
    color: theme.color.textPrimary,
    fontSize: 14,
    backgroundColor: theme.color.surface,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  exerciseList: {
    gap: 16,
  },
  addExerciseButton: {
    minHeight: theme.minTouchTarget,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: theme.color.accentSecondary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addExerciseLabel: {
    color: theme.color.accentSecondary,
    fontSize: 16,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  skippedSection: {
    gap: 4,
  },
  skippedHeading: {
    color: theme.color.textMuted,
    fontSize: 12,
    textTransform: 'uppercase',
  },
  skippedRow: {
    minHeight: 44,
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  skippedLabel: {
    color: theme.color.textMuted,
    fontSize: 15,
    textDecorationLine: 'line-through',
  },
  endButton: {
    minHeight: theme.minTouchTarget,
    borderRadius: 12,
    backgroundColor: theme.color.surface,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
  },
  endButtonLabel: {
    color: theme.color.textPrimary,
    fontSize: 18,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
});
