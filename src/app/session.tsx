import { Redirect, useRouter } from 'expo-router';
import { useKeepAwake } from 'expo-keep-awake';
import { useEffect, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ExerciseBlock, type ExerciseTarget } from '@/components/logging/ExerciseBlock';
import { ExercisePicker } from '@/components/logging/ExercisePicker';
import { RestClock } from '@/components/logging/RestClock';
import { RestFlashOverlay } from '@/components/logging/RestFlashOverlay';
import { useRestClock, type RestSettings } from '@/components/logging/useRestClock';
import { useDatabase } from '@/data/DatabaseProvider';
import { newId } from '@/data/id';
import { getExerciseById, listExercises, recordExerciseUsage } from '@/data/repositories/exerciseRepository';
import { seedDefaultPlateInventoryIfEmpty } from '@/data/repositories/plateInventoryRepository';
import {
  createSessionExercise,
  listSessionExercisesBySession,
  updateSessionExercise,
} from '@/data/repositories/sessionExerciseRepository';
import { runBackupRetention } from '@/data/backup';
import { endSession, getActiveSession, updateSession } from '@/data/repositories/sessionRepository';
import { listTemplateExercisesByTemplate } from '@/data/repositories/templateExerciseRepository';
import { getTemplateById } from '@/data/repositories/templateRepository';
import { createTemplateFromSession } from '@/data/repositories/templateFromSessionRepository';
import { getUser, updateRestSettings } from '@/data/repositories/userRepository';
import type {
  exercise as exerciseTable,
  plateInventory as plateInventoryTable,
  session as sessionTable,
  sessionExercise as sessionExerciseTable,
} from '@/data/schema';
import { formatElapsed } from '@/domain/duration';
import { resolveTargetRestSeconds } from '@/domain/restClock';
import { strings } from '@/strings';
import { theme } from '@/theme';

type Session = typeof sessionTable.$inferSelect;
type SessionExercise = typeof sessionExerciseTable.$inferSelect;
type Exercise = typeof exerciseTable.$inferSelect;
type PlateInventoryRow = typeof plateInventoryTable.$inferSelect;

interface Progress {
  committed: number;
  ghost: number;
}

function isComplete(progress: Progress | undefined): boolean {
  if (!progress) return false;
  return progress.ghost > 0 ? progress.committed >= progress.ghost : progress.committed > 0;
}

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
  const [plateInventory, setPlateInventory] = useState<PlateInventoryRow[]>([]);
  const [sessionNote, setSessionNote] = useState('');
  const [addPanelOpen, setAddPanelOpen] = useState(false);

  const [restSettings, setRestSettings] = useState<RestSettings>(DEFAULT_REST_SETTINGS);
  const [restStartedAt, setRestStartedAt] = useState<number | null>(null);
  const [restTargetSeconds, setRestTargetSeconds] = useState<number | null>(null);

  const [targetsByExerciseId, setTargetsByExerciseId] = useState<Map<string, ExerciseTarget>>(new Map());
  const [progressBySessionExerciseId, setProgressBySessionExerciseId] = useState<Map<string, Progress>>(new Map());
  const [saveTemplateOpen, setSaveTemplateOpen] = useState(false);
  const [saveTemplateName, setSaveTemplateName] = useState('');
  const [saveTemplateSaved, setSaveTemplateSaved] = useState(false);

  const scrollViewRef = useRef<ScrollView>(null);
  const exerciseListYRef = useRef(0);
  const blockYRef = useRef(new Map<string, number>());

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const active = await getActiveSession(db, userId);
      if (cancelled) return;
      setSession(active);
      if (!active) return;

      setSessionNote(active.note ?? '');
      if (active.templateId) {
        const [t, templateExercises] = await Promise.all([
          getTemplateById(db, userId, active.templateId),
          listTemplateExercisesByTemplate(db, userId, active.templateId),
        ]);
        if (cancelled) return;
        if (t) setHeading(t.name);
        setTargetsByExerciseId(
          new Map(
            templateExercises.map((te) => [
              te.exerciseId,
              { targetSets: te.targetSets, targetRepsMin: te.targetRepsMin, targetRepsMax: te.targetRepsMax },
            ]),
          ),
        );
      }

      const [sessionExercises, exercises, user, plates] = await Promise.all([
        listSessionExercisesBySession(db, userId, active.id),
        listExercises(db, userId),
        getUser(db, userId),
        seedDefaultPlateInventoryIfEmpty(db, userId),
      ]);
      if (cancelled) return;
      setAllExercises(exercises);
      setPlateInventory(plates);
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
    // Best-effort: a backup failure (disk full, permissions) should never
    // block ending the session, which is the actual user-facing action.
    try {
      await runBackupRetention();
    } catch (err) {
      console.warn('Session backup failed', err);
    }
    router.replace('/');
  }

  function commitSessionNote() {
    if (!session) return;
    if (sessionNote === (session.note ?? '')) return;
    void updateSession(db, userId, session.id, { note: sessionNote.length > 0 ? sessionNote : null });
  }

  function handleProgressChanged(sessionExerciseId: string, committed: number, ghost: number) {
    setProgressBySessionExerciseId((prev) => {
      const next = new Map(prev);
      next.set(sessionExerciseId, { committed, ghost });
      return next;
    });
  }

  function scrollToBlock(sessionExerciseId: string) {
    const y = exerciseListYRef.current + (blockYRef.current.get(sessionExerciseId) ?? 0);
    scrollViewRef.current?.scrollTo({ y: Math.max(0, y - 16), animated: true });
  }

  async function handleSaveAsTemplate() {
    if (!session) return;
    const name = saveTemplateName.trim();
    if (name.length === 0) return;
    const created = await createTemplateFromSession(db, userId, session.id, name, session.programmeId, 0);
    if (created) {
      setSaveTemplateSaved(true);
      setSaveTemplateOpen(false);
      setSaveTemplateName('');
    }
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
      <ScrollView ref={scrollViewRef} contentContainerStyle={styles.container}>
        <Text style={styles.heading}>{heading}</Text>

        <View style={styles.elapsedBlock}>
          <Text style={styles.elapsedLabel}>{strings.sessionElapsedLabel}</Text>
          <Text style={styles.elapsedValue}>{formatElapsed(now - session.startedAt.getTime())}</Text>
        </View>

        {session.templateId && active.length > 0 ? (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.planStrip}>
            <View style={styles.planStripRow}>
              {active.map((it) => {
                const done = isComplete(progressBySessionExerciseId.get(it.sessionExercise.id));
                return (
                  <Pressable
                    key={it.sessionExercise.id}
                    style={[styles.planChip, done && styles.planChipDone]}
                    accessibilityLabel={strings.sessionPlanStripJumpAccessibility}
                    onPress={() => scrollToBlock(it.sessionExercise.id)}>
                    <Text style={[styles.planChipLabel, done && styles.planChipLabelDone]}>{it.exercise.name}</Text>
                  </Pressable>
                );
              })}
            </View>
          </ScrollView>
        ) : null}

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

        <View style={styles.exerciseList} onLayout={(e) => (exerciseListYRef.current = e.nativeEvent.layout.y)}>
          {active.map((it, idx) => (
            <View key={it.sessionExercise.id} onLayout={(e) => blockYRef.current.set(it.sessionExercise.id, e.nativeEvent.layout.y)}>
              <ExerciseBlock
                db={db}
                userId={userId}
                sessionId={session.id}
                sessionExercise={it.sessionExercise}
                exercise={it.exercise}
                isSupersetLinked={it.sessionExercise.supersetGroupId != null}
                canReorderUp={idx > 0}
                canReorderDown={idx < active.length - 1}
                target={targetsByExerciseId.get(it.exercise.id) ?? null}
                onSkipToggle={() => handleSkipToggle(it.sessionExercise)}
                onSupersetToggle={() => handleSupersetToggle(it.sessionExercise)}
                onReorderUp={() => handleReorder(it.sessionExercise, 'up')}
                onReorderDown={() => handleReorder(it.sessionExercise, 'down')}
                onSetCommitted={() => handleSetCommitted(it)}
                onExerciseUpdated={handleExerciseUpdated}
                onProgressChanged={(committed, ghost) => handleProgressChanged(it.sessionExercise.id, committed, ghost)}
                plateInventory={plateInventory}
                onPlateInventoryChanged={setPlateInventory}
              />
            </View>
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

        {saveTemplateOpen ? (
          <View style={styles.saveTemplateBox}>
            <TextInput
              style={styles.sessionNoteInput}
              value={saveTemplateName}
              onChangeText={setSaveTemplateName}
              placeholder={strings.sessionSaveTemplateNamePlaceholder}
              placeholderTextColor={theme.color.textMuted}
              autoFocus
            />
            <View style={styles.saveTemplateActions}>
              <Pressable style={styles.secondaryButtonSmall} onPress={() => setSaveTemplateOpen(false)}>
                <Text style={styles.secondaryButtonSmallLabel}>{strings.sessionSaveTemplateCancel}</Text>
              </Pressable>
              <Pressable style={styles.primaryButtonSmall} onPress={handleSaveAsTemplate}>
                <Text style={styles.primaryButtonSmallLabel}>{strings.sessionSaveTemplateConfirm}</Text>
              </Pressable>
            </View>
          </View>
        ) : (
          <Pressable style={styles.saveTemplateLink} onPress={() => setSaveTemplateOpen(true)}>
            <Text style={styles.saveTemplateLinkLabel}>{strings.sessionSaveTemplateButton}</Text>
          </Pressable>
        )}
        {saveTemplateSaved ? <Text style={styles.saveTemplateSavedText}>{strings.sessionSaveTemplateSaved}</Text> : null}

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
  planStrip: {
    maxHeight: 44,
  },
  planStripRow: {
    flexDirection: 'row',
    gap: 8,
  },
  planChip: {
    minHeight: 36,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: theme.color.accentPrimary,
    paddingHorizontal: 14,
    justifyContent: 'center',
  },
  planChipDone: {
    borderColor: theme.color.textMuted,
    opacity: 0.5,
  },
  planChipLabel: {
    color: theme.color.accentPrimary,
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  planChipLabelDone: {
    color: theme.color.textMuted,
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
  saveTemplateLink: {
    minHeight: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveTemplateLinkLabel: {
    color: theme.color.textMuted,
    fontSize: 13,
    textDecorationLine: 'underline',
  },
  saveTemplateBox: {
    gap: 8,
  },
  saveTemplateActions: {
    flexDirection: 'row',
    gap: 10,
  },
  saveTemplateSavedText: {
    color: theme.color.accentSecondary,
    fontSize: 13,
    textAlign: 'center',
  },
  primaryButtonSmall: {
    flex: 1,
    minHeight: 44,
    borderRadius: 8,
    backgroundColor: theme.color.accentPrimary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryButtonSmallLabel: {
    color: theme.color.bg,
    fontSize: 14,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
  secondaryButtonSmall: {
    flex: 1,
    minHeight: 44,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: theme.color.textMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryButtonSmallLabel: {
    color: theme.color.textPrimary,
    fontSize: 14,
    fontWeight: '700',
  },
});
