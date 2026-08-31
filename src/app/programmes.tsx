import { useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ExercisePicker } from '@/components/logging/ExercisePicker';
import { NumericKeypad } from '@/components/logging/NumericKeypad';
import { useDatabase } from '@/data/DatabaseProvider';
import { newId } from '@/data/id';
import { listExercises } from '@/data/repositories/exerciseRepository';
import { createProgramme, listProgrammes, setActiveProgramme, updateProgramme } from '@/data/repositories/programmeRepository';
import {
  createTemplateExercise,
  listTemplateExercisesByTemplate,
  softDeleteTemplateExercise,
  updateTemplateExercise,
} from '@/data/repositories/templateExerciseRepository';
import { createTemplate, listTemplates, updateTemplate } from '@/data/repositories/templateRepository';
import type { exercise, programme, template, templateExercise } from '@/data/schema';
import { strings } from '@/strings';
import { theme } from '@/theme';

type Programme = typeof programme.$inferSelect;
type Template = typeof template.$inferSelect;
type TemplateExercise = typeof templateExercise.$inferSelect;
type Exercise = typeof exercise.$inferSelect;

type Stage = 'list' | 'programme' | 'template';

export default function ProgrammesScreen() {
  const { db, userId } = useDatabase();
  const router = useRouter();

  const [stage, setStage] = useState<Stage>('list');
  const [programmes, setProgrammes] = useState<Programme[]>([]);
  // Templates saved from a freestyle session (no programme) aren't reachable
  // any other way, so the list screen surfaces them directly.
  const [standaloneTemplates, setStandaloneTemplates] = useState<Template[]>([]);
  const [allExercises, setAllExercises] = useState<Exercise[]>([]);
  const [newProgrammeName, setNewProgrammeName] = useState('');

  const [selectedProgramme, setSelectedProgramme] = useState<Programme | null>(null);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [newTemplateName, setNewTemplateName] = useState('');
  const [newTemplateDayHint, setNewTemplateDayHint] = useState('');

  const [selectedTemplate, setSelectedTemplate] = useState<Template | null>(null);
  const [templateExercises, setTemplateExercises] = useState<TemplateExercise[]>([]);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [keypadTarget, setKeypadTarget] = useState<{
    id: string;
    field: 'targetSets' | 'targetRepsMin' | 'targetRepsMax';
  } | null>(null);

  const exerciseById = useMemo(() => new Map(allExercises.map((e) => [e.id, e])), [allExercises]);

  useEffect(() => {
    reloadProgrammes();
    reloadStandaloneTemplates();
    listExercises(db, userId).then(setAllExercises);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [db, userId]);

  async function reloadProgrammes() {
    setProgrammes(await listProgrammes(db, userId));
  }

  async function reloadStandaloneTemplates() {
    const all = await listTemplates(db, userId);
    setStandaloneTemplates(all.filter((t) => t.programmeId === null && !t.isArchived));
  }

  async function handleCreateProgramme() {
    const name = newProgrammeName.trim();
    if (name.length === 0) return;
    const created = await createProgramme(db, {
      userId,
      name,
      notes: null,
      isActive: false,
      isArchived: false,
      version: 1,
      source: 'manual',
    });
    if (created) {
      setNewProgrammeName('');
      setProgrammes((prev) => [...prev, created]);
    }
  }

  async function handleSetActive(id: string) {
    await setActiveProgramme(db, userId, id);
    await reloadProgrammes();
  }

  async function openProgramme(p: Programme) {
    setSelectedProgramme(p);
    setTemplates((await listTemplates(db, userId)).filter((t) => t.programmeId === p.id).sort((a, b) => a.orderIndex - b.orderIndex));
    setStage('programme');
  }

  function commitProgrammeNotes(text: string) {
    if (!selectedProgramme) return;
    if (text === (selectedProgramme.notes ?? '')) return;
    void updateProgramme(db, userId, selectedProgramme.id, { notes: text.length > 0 ? text : null }).then((updated) => {
      if (updated) setSelectedProgramme(updated);
    });
  }

  async function handleCreateTemplate() {
    if (!selectedProgramme) return;
    const name = newTemplateName.trim();
    if (name.length === 0) return;
    const created = await createTemplate(db, {
      userId,
      programmeId: selectedProgramme.id,
      name,
      dayHint: newTemplateDayHint.trim().length > 0 ? newTemplateDayHint.trim() : null,
      orderIndex: templates.length,
      isArchived: false,
    });
    if (created) {
      setNewTemplateName('');
      setNewTemplateDayHint('');
      setTemplates((prev) => [...prev, created]);
    }
  }

  async function handleReorderTemplate(t: Template, direction: 'up' | 'down') {
    const ordered = [...templates].sort((a, b) => a.orderIndex - b.orderIndex);
    const idx = ordered.findIndex((x) => x.id === t.id);
    const swapIdx = direction === 'up' ? idx - 1 : idx + 1;
    if (idx < 0 || swapIdx < 0 || swapIdx >= ordered.length) return;
    const a = ordered[idx];
    const b = ordered[swapIdx];
    const [updatedA, updatedB] = await Promise.all([
      updateTemplate(db, userId, a.id, { orderIndex: b.orderIndex }),
      updateTemplate(db, userId, b.id, { orderIndex: a.orderIndex }),
    ]);
    setTemplates((prev) =>
      prev.map((x) => (x.id === updatedA?.id ? updatedA : x.id === updatedB?.id ? updatedB : x)),
    );
  }

  async function openTemplate(t: Template, fromProgramme: Programme | null) {
    setSelectedProgramme(fromProgramme);
    setSelectedTemplate(t);
    const exercises = await listTemplateExercisesByTemplate(db, userId, t.id);
    setTemplateExercises(exercises.sort((a, b) => a.orderIndex - b.orderIndex));
    setStage('template');
  }

  function commitTemplateName(text: string) {
    if (!selectedTemplate) return;
    if (text === selectedTemplate.name) return;
    void updateTemplate(db, userId, selectedTemplate.id, { name: text }).then((updated) => {
      if (updated) {
        setSelectedTemplate(updated);
        setTemplates((prev) => prev.map((t) => (t.id === updated.id ? updated : t)));
      }
    });
  }

  async function handlePickExercise(ex: Exercise) {
    if (!selectedTemplate) return;
    const created = await createTemplateExercise(db, {
      userId,
      templateId: selectedTemplate.id,
      exerciseId: ex.id,
      orderIndex: templateExercises.length,
      targetSets: 3,
      targetRepsMin: 8,
      targetRepsMax: 12,
      supersetGroupId: null,
      notes: null,
    });
    if (created) {
      setTemplateExercises((prev) => [...prev, created]);
      setAllExercises((prev) => (prev.some((e) => e.id === ex.id) ? prev : [...prev, ex]));
    }
    setPickerOpen(false);
  }

  async function handleReorderExercise(te: TemplateExercise, direction: 'up' | 'down') {
    const ordered = [...templateExercises].sort((a, b) => a.orderIndex - b.orderIndex);
    const idx = ordered.findIndex((x) => x.id === te.id);
    const swapIdx = direction === 'up' ? idx - 1 : idx + 1;
    if (idx < 0 || swapIdx < 0 || swapIdx >= ordered.length) return;
    const a = ordered[idx];
    const b = ordered[swapIdx];
    const [updatedA, updatedB] = await Promise.all([
      updateTemplateExercise(db, userId, a.id, { orderIndex: b.orderIndex }),
      updateTemplateExercise(db, userId, b.id, { orderIndex: a.orderIndex }),
    ]);
    setTemplateExercises((prev) =>
      prev.map((x) => (x.id === updatedA?.id ? updatedA : x.id === updatedB?.id ? updatedB : x)),
    );
  }

  async function handleSupersetToggle(te: TemplateExercise) {
    if (te.supersetGroupId) {
      const groupId = te.supersetGroupId;
      const linked = templateExercises.filter((x) => x.supersetGroupId === groupId);
      const updated = await Promise.all(
        linked.map((x) => updateTemplateExercise(db, userId, x.id, { supersetGroupId: null })),
      );
      setTemplateExercises((prev) => prev.map((x) => updated.find((u) => u?.id === x.id) ?? x));
      return;
    }
    const ordered = [...templateExercises].sort((a, b) => a.orderIndex - b.orderIndex);
    const idx = ordered.findIndex((x) => x.id === te.id);
    const partner = ordered[idx + 1];
    if (!partner) return;
    const groupId = newId();
    const [updatedTe, updatedPartner] = await Promise.all([
      updateTemplateExercise(db, userId, te.id, { supersetGroupId: groupId }),
      updateTemplateExercise(db, userId, partner.id, { supersetGroupId: groupId }),
    ]);
    setTemplateExercises((prev) =>
      prev.map((x) => (x.id === updatedTe?.id ? updatedTe : x.id === updatedPartner?.id ? updatedPartner : x)),
    );
  }

  async function handleRemoveExercise(te: TemplateExercise) {
    await softDeleteTemplateExercise(db, userId, te.id);
    setTemplateExercises((prev) => prev.filter((x) => x.id !== te.id));
  }

  function handleKeypadConfirm(value: number) {
    if (!keypadTarget) return;
    const target = keypadTarget;
    setKeypadTarget(null);
    const rounded = Math.max(1, Math.round(value));
    void updateTemplateExercise(db, userId, target.id, { [target.field]: rounded }).then((updated) => {
      if (updated) setTemplateExercises((prev) => prev.map((x) => (x.id === updated.id ? updated : x)));
    });
  }

  if (stage === 'list') {
    return (
      <SafeAreaView style={styles.safeArea}>
        <ScrollView contentContainerStyle={styles.container}>
          <Text style={styles.title}>{strings.programmesTitle}</Text>

          {programmes.length === 0 ? (
            <Text style={styles.mutedText}>{strings.programmesEmpty}</Text>
          ) : (
            programmes.map((p) => (
              <View key={p.id} style={styles.card}>
                <Pressable style={styles.cardHeaderRow} onPress={() => openProgramme(p)}>
                  <Text style={styles.cardTitle}>{p.name}</Text>
                  {p.isActive ? <Text style={styles.activeBadge}>{strings.programmesActiveBadge}</Text> : null}
                </Pressable>
                {!p.isActive ? (
                  <Pressable style={styles.smallButton} onPress={() => handleSetActive(p.id)}>
                    <Text style={styles.smallButtonLabel}>{strings.programmesSetActiveButton}</Text>
                  </Pressable>
                ) : null}
              </View>
            ))
          )}

          <TextInput
            style={styles.textInput}
            value={newProgrammeName}
            onChangeText={setNewProgrammeName}
            placeholder={strings.programmesNamePlaceholder}
            placeholderTextColor={theme.color.textMuted}
          />
          <Pressable style={styles.primaryButton} onPress={handleCreateProgramme}>
            <Text style={styles.primaryButtonLabel}>{strings.programmesNewButton}</Text>
          </Pressable>

          <Pressable style={styles.secondaryButton} onPress={() => router.push('/import-programme')}>
            <Text style={styles.secondaryButtonLabel}>{strings.programmesImportLink}</Text>
          </Pressable>

          {standaloneTemplates.length > 0 ? (
            <>
              <Text style={styles.sectionHeading}>{strings.programmesStandaloneHeading}</Text>
              {standaloneTemplates.map((t) => (
                <Pressable key={t.id} style={styles.card} onPress={() => openTemplate(t, null)}>
                  <Text style={styles.cardTitle}>{t.name}</Text>
                </Pressable>
              ))}
            </>
          ) : null}
        </ScrollView>
      </SafeAreaView>
    );
  }

  if (stage === 'programme' && selectedProgramme) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <ScrollView contentContainerStyle={styles.container}>
          <Pressable onPress={() => setStage('list')}>
            <Text style={styles.backLink}>{strings.programmesBackButton}</Text>
          </Pressable>
          <Text style={styles.title}>{selectedProgramme.name}</Text>
          <TextInput
            style={styles.textInput}
            defaultValue={selectedProgramme.notes ?? ''}
            placeholder={strings.programmeDetailNotesPlaceholder}
            placeholderTextColor={theme.color.textMuted}
            onEndEditing={(e) => commitProgrammeNotes(e.nativeEvent.text)}
            multiline
          />

          <Text style={styles.sectionHeading}>{strings.programmeDetailTemplatesHeading}</Text>
          {templates.length === 0 ? <Text style={styles.mutedText}>{strings.programmeDetailEmpty}</Text> : null}
          {[...templates]
            .sort((a, b) => a.orderIndex - b.orderIndex)
            .map((t, idx, arr) => (
              <View key={t.id} style={styles.card}>
                <View style={styles.cardHeaderRow}>
                  <Pressable style={styles.cardTitleTouchArea} onPress={() => openTemplate(t, selectedProgramme)}>
                    <Text style={styles.cardTitle}>{t.name}</Text>
                  </Pressable>
                  <View style={styles.reorderRow}>
                    <Pressable disabled={idx === 0} onPress={() => handleReorderTemplate(t, 'up')}>
                      <Text style={[styles.reorderButton, idx === 0 && styles.reorderButtonDisabled]}>▲</Text>
                    </Pressable>
                    <Pressable disabled={idx === arr.length - 1} onPress={() => handleReorderTemplate(t, 'down')}>
                      <Text style={[styles.reorderButton, idx === arr.length - 1 && styles.reorderButtonDisabled]}>▼</Text>
                    </Pressable>
                  </View>
                </View>
                {t.dayHint ? (
                  <Pressable onPress={() => openTemplate(t, selectedProgramme)}>
                    <Text style={styles.mutedText}>{t.dayHint}</Text>
                  </Pressable>
                ) : null}
              </View>
            ))}

          <TextInput
            style={styles.textInput}
            value={newTemplateName}
            onChangeText={setNewTemplateName}
            placeholder={strings.programmeDetailNewTemplateNamePlaceholder}
            placeholderTextColor={theme.color.textMuted}
          />
          <TextInput
            style={styles.textInput}
            value={newTemplateDayHint}
            onChangeText={setNewTemplateDayHint}
            placeholder={strings.programmeDetailNewTemplateDayHintPlaceholder}
            placeholderTextColor={theme.color.textMuted}
          />
          <Pressable style={styles.primaryButton} onPress={handleCreateTemplate}>
            <Text style={styles.primaryButtonLabel}>{strings.programmeDetailNewTemplateButton}</Text>
          </Pressable>
        </ScrollView>
      </SafeAreaView>
    );
  }

  if (stage === 'template' && selectedTemplate) {
    const ordered = [...templateExercises].sort((a, b) => a.orderIndex - b.orderIndex);
    return (
      <SafeAreaView style={styles.safeArea}>
        <ScrollView contentContainerStyle={styles.container}>
          <Pressable onPress={() => setStage(selectedProgramme ? 'programme' : 'list')}>
            <Text style={styles.backLink}>{strings.programmesBackButton}</Text>
          </Pressable>
          <TextInput
            style={styles.title}
            defaultValue={selectedTemplate.name}
            onEndEditing={(e) => commitTemplateName(e.nativeEvent.text)}
          />

          <Text style={styles.sectionHeading}>{strings.templateDetailExercisesHeading}</Text>
          {ordered.length === 0 ? <Text style={styles.mutedText}>{strings.templateDetailEmpty}</Text> : null}
          {ordered.map((te, idx) => {
            const ex = exerciseById.get(te.exerciseId);
            return (
              <View key={te.id} style={styles.card}>
                <View style={styles.cardHeaderRow}>
                  <Text style={styles.cardTitle}>{ex?.name ?? '…'}</Text>
                  <View style={styles.reorderRow}>
                    <Pressable disabled={idx === 0} onPress={() => handleReorderExercise(te, 'up')}>
                      <Text style={[styles.reorderButton, idx === 0 && styles.reorderButtonDisabled]}>▲</Text>
                    </Pressable>
                    <Pressable disabled={idx === ordered.length - 1} onPress={() => handleReorderExercise(te, 'down')}>
                      <Text style={[styles.reorderButton, idx === ordered.length - 1 && styles.reorderButtonDisabled]}>▼</Text>
                    </Pressable>
                  </View>
                </View>

                {te.supersetGroupId ? <Text style={styles.supersetBadge}>{strings.templateExerciseSupersetBadge}</Text> : null}

                <View style={styles.targetRow}>
                  <Pressable onPress={() => setKeypadTarget({ id: te.id, field: 'targetSets' })}>
                    <Text style={styles.targetFieldLabel}>{strings.templateExerciseSetsLabel}</Text>
                    <Text style={styles.targetFieldValue}>{te.targetSets}</Text>
                  </Pressable>
                  <Pressable onPress={() => setKeypadTarget({ id: te.id, field: 'targetRepsMin' })}>
                    <Text style={styles.targetFieldLabel}>{strings.templateExerciseRepsMinLabel}</Text>
                    <Text style={styles.targetFieldValue}>{te.targetRepsMin}</Text>
                  </Pressable>
                  <Pressable onPress={() => setKeypadTarget({ id: te.id, field: 'targetRepsMax' })}>
                    <Text style={styles.targetFieldLabel}>{strings.templateExerciseRepsMaxLabel}</Text>
                    <Text style={styles.targetFieldValue}>{te.targetRepsMax}</Text>
                  </Pressable>
                </View>

                <View style={styles.reorderRow}>
                  <Pressable style={styles.smallButton} onPress={() => handleSupersetToggle(te)}>
                    <Text style={styles.smallButtonLabel}>{strings.templateExerciseSupersetToggle}</Text>
                  </Pressable>
                  <Pressable style={styles.smallButton} onPress={() => handleRemoveExercise(te)}>
                    <Text style={styles.smallButtonLabel}>{strings.templateExerciseRemoveButton}</Text>
                  </Pressable>
                </View>
              </View>
            );
          })}

          {pickerOpen ? (
            <ExercisePicker
              db={db}
              userId={userId}
              existingExercises={allExercises}
              onPick={handlePickExercise}
              onClose={() => setPickerOpen(false)}
            />
          ) : (
            <Pressable style={styles.primaryButton} onPress={() => setPickerOpen(true)}>
              <Text style={styles.primaryButtonLabel}>{strings.templateDetailAddExerciseButton}</Text>
            </Pressable>
          )}

          <NumericKeypad
            visible={keypadTarget != null}
            label={
              keypadTarget?.field === 'targetSets'
                ? strings.templateExerciseSetsLabel
                : keypadTarget?.field === 'targetRepsMin'
                  ? strings.templateExerciseRepsMinLabel
                  : strings.templateExerciseRepsMaxLabel
            }
            allowDecimal={false}
            onConfirm={handleKeypadConfirm}
            onCancel={() => setKeypadTarget(null)}
          />
        </ScrollView>
      </SafeAreaView>
    );
  }

  return <SafeAreaView style={styles.safeArea} />;
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: theme.color.bg,
  },
  container: {
    padding: 20,
    gap: 12,
  },
  title: {
    color: theme.color.textPrimary,
    fontSize: 26,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
  backLink: {
    color: theme.color.textMuted,
    fontSize: 14,
  },
  sectionHeading: {
    color: theme.color.textPrimary,
    fontSize: 16,
    fontWeight: '700',
    textTransform: 'uppercase',
    marginTop: 8,
  },
  mutedText: {
    color: theme.color.textMuted,
    fontSize: 14,
  },
  card: {
    backgroundColor: theme.color.surface,
    borderRadius: 12,
    padding: 14,
    gap: 8,
  },
  cardHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  cardTitle: {
    color: theme.color.textPrimary,
    fontSize: 17,
    fontWeight: '700',
  },
  cardTitleTouchArea: {
    flexShrink: 1,
  },
  activeBadge: {
    color: theme.color.accentSecondary,
    fontSize: 11,
    fontWeight: '800',
  },
  reorderRow: {
    flexDirection: 'row',
    gap: 12,
  },
  reorderButton: {
    color: theme.color.textPrimary,
    fontSize: 16,
    paddingHorizontal: 4,
  },
  reorderButtonDisabled: {
    color: theme.color.textMuted,
  },
  supersetBadge: {
    color: theme.color.accentPrimary,
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  targetRow: {
    flexDirection: 'row',
    gap: 20,
  },
  targetFieldLabel: {
    color: theme.color.textMuted,
    fontSize: 10,
    textTransform: 'uppercase',
  },
  targetFieldValue: {
    color: theme.color.accentPrimary,
    fontSize: 20,
    fontWeight: '800',
  },
  textInput: {
    minHeight: theme.minTouchTarget,
    borderRadius: 8,
    backgroundColor: theme.color.surface,
    color: theme.color.textPrimary,
    paddingHorizontal: 12,
    fontSize: 16,
  },
  primaryButton: {
    minHeight: theme.minTouchTarget,
    borderRadius: 8,
    backgroundColor: theme.color.accentPrimary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryButtonLabel: {
    color: theme.color.bg,
    fontSize: 16,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
  secondaryButton: {
    minHeight: theme.minTouchTarget,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: theme.color.textMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryButtonLabel: {
    color: theme.color.textPrimary,
    fontSize: 15,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  smallButton: {
    minHeight: 40,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: theme.color.textMuted,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
  },
  smallButtonLabel: {
    color: theme.color.textPrimary,
    fontSize: 13,
    fontWeight: '700',
  },
});
