import { Stack, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { ExercisePicker } from '@/components/exercise/ExercisePicker';
import { ListRow } from '@/components/ui';
import { NumericKeypad } from '@/components/transition/NumericKeypad';
import { useDatabase } from '@/data/DatabaseProvider';
import { getExerciseById } from '@/data/repositories/exerciseRepository';
import { newId } from '@/data/id';
import { createProgramme, listProgrammes, setActiveProgramme, updateProgramme } from '@/data/repositories/programmeRepository';
import { createTemplate, listTemplates, updateTemplate } from '@/data/repositories/templateRepository';
import {
  createTemplateExercise,
  listTemplateExercisesByTemplate,
  softDeleteTemplateExercise,
  updateTemplateExercise,
} from '@/data/repositories/templateExerciseRepository';
import type { exercise as exerciseTable, programme as programmeTable, template as templateTable, templateExercise as templateExerciseTable } from '@/data/schema';
import { strings } from '@/strings';
import { color, size, type } from '@/theme';

// DESIGN-SPEC.md §5.6/§6 screen 5 — programme + template CRUD, one active at
// a time, built entirely from ListRow/Slab-style rows. Expansion is done
// in-place (selected programme/template ids) rather than as separate routes:
// nothing in the design spec's 7-screen inventory reserves a route for
// "programme detail" or "template detail".

type Programme = typeof programmeTable.$inferSelect;
type Template = typeof templateTable.$inferSelect;
type TemplateExerciseRow = typeof templateExerciseTable.$inferSelect;
type Exercise = typeof exerciseTable.$inferSelect;

const DEFAULT_TARGET_SETS = 3;
const DEFAULT_TARGET_REPS_MIN = 8;
const DEFAULT_TARGET_REPS_MAX = 12;

type KeypadTarget = { templateExerciseId: string; field: 'sets' | 'repsMin' | 'repsMax' };

export default function Programmes() {
  const { db, userId } = useDatabase();
  const router = useRouter();

  const [programmes, setProgrammes] = useState<Programme[]>([]);
  const [standaloneTemplates, setStandaloneTemplates] = useState<Template[]>([]);
  const [newProgrammeName, setNewProgrammeName] = useState('');

  const [expandedProgrammeId, setExpandedProgrammeId] = useState<string | null>(null);
  const [templatesByProgramme, setTemplatesByProgramme] = useState<Record<string, Template[]>>({});
  const [newTemplateName, setNewTemplateName] = useState('');
  const [newTemplateDayHint, setNewTemplateDayHint] = useState('');

  const [editingProgrammeId, setEditingProgrammeId] = useState<string | null>(null);
  const [editProgrammeName, setEditProgrammeName] = useState('');
  const [editingTemplateId, setEditingTemplateId] = useState<string | null>(null);
  const [editTemplateName, setEditTemplateName] = useState('');

  const [expandedTemplateId, setExpandedTemplateId] = useState<string | null>(null);
  const [exercisesByTemplate, setExercisesByTemplate] = useState<Record<string, TemplateExerciseRow[]>>({});
  const [exerciseNames, setExerciseNames] = useState<Record<string, string>>({});
  const [pickerOpenForTemplate, setPickerOpenForTemplate] = useState<string | null>(null);
  const [keypadTarget, setKeypadTarget] = useState<KeypadTarget | null>(null);

  async function fetchProgrammes() {
    const [all, standalone] = await Promise.all([listProgrammes(db, userId), listTemplates(db, userId)]);
    return {
      programmes: all.filter((p) => !p.isArchived),
      standaloneTemplates: standalone.filter((t) => !t.isArchived && t.programmeId == null),
    };
  }

  async function reloadProgrammes() {
    const result = await fetchProgrammes();
    setProgrammes(result.programmes);
    setStandaloneTemplates(result.standaloneTemplates);
  }

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const result = await fetchProgrammes();
      if (cancelled) return;
      setProgrammes(result.programmes);
      setStandaloneTemplates(result.standaloneTemplates);
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [db, userId]);

  async function handleCreateProgramme() {
    const name = newProgrammeName.trim();
    if (!name) return;
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
      await reloadProgrammes();
    }
  }

  async function handleSetActive(programmeId: string) {
    await setActiveProgramme(db, userId, programmeId);
    await reloadProgrammes();
  }

  function startEditProgrammeName(prog: Programme) {
    setEditingProgrammeId(prog.id);
    setEditProgrammeName(prog.name);
  }

  async function handleSaveProgrammeName() {
    const name = editProgrammeName.trim();
    if (!editingProgrammeId || !name) return;
    await updateProgramme(db, userId, editingProgrammeId, { name });
    setEditingProgrammeId(null);
    setEditProgrammeName('');
    await reloadProgrammes();
  }

  function startEditTemplateName(tmpl: Template) {
    setEditingTemplateId(tmpl.id);
    setEditTemplateName(tmpl.name);
  }

  async function handleSaveTemplateName(programmeId: string | null) {
    const name = editTemplateName.trim();
    if (!editingTemplateId || !name) return;
    await updateTemplate(db, userId, editingTemplateId, { name });
    setEditingTemplateId(null);
    setEditTemplateName('');
    if (programmeId) {
      const all = await listTemplates(db, userId);
      const forProgramme = all.filter((t) => t.programmeId === programmeId && !t.isArchived);
      setTemplatesByProgramme((prev) => ({ ...prev, [programmeId]: forProgramme.sort((a, b) => a.orderIndex - b.orderIndex) }));
    } else {
      await reloadProgrammes();
    }
  }

  async function toggleProgrammeExpanded(programmeId: string) {
    if (expandedProgrammeId === programmeId) {
      setExpandedProgrammeId(null);
      return;
    }
    setExpandedProgrammeId(programmeId);
    setExpandedTemplateId(null);
    if (!templatesByProgramme[programmeId]) {
      const all = await listTemplates(db, userId);
      const forProgramme = all.filter((t) => t.programmeId === programmeId && !t.isArchived);
      setTemplatesByProgramme((prev) => ({ ...prev, [programmeId]: forProgramme.sort((a, b) => a.orderIndex - b.orderIndex) }));
    }
  }

  async function handleCreateTemplate(programmeId: string) {
    const name = newTemplateName.trim();
    if (!name) return;
    const existing = templatesByProgramme[programmeId] ?? [];
    const created = await createTemplate(db, {
      userId,
      programmeId,
      name,
      dayHint: newTemplateDayHint.trim() || null,
      orderIndex: existing.length,
      isArchived: false,
    });
    if (created) {
      setTemplatesByProgramme((prev) => ({ ...prev, [programmeId]: [...existing, created] }));
      setNewTemplateName('');
      setNewTemplateDayHint('');
    }
  }

  async function loadExerciseNames(rows: TemplateExerciseRow[]) {
    const missing = rows.filter((r) => !exerciseNames[r.exerciseId]);
    if (missing.length === 0) return;
    const loaded: Record<string, string> = {};
    for (const row of missing) {
      const ex = await getExerciseById(db, userId, row.exerciseId);
      if (ex) loaded[row.exerciseId] = ex.name;
    }
    setExerciseNames((prev) => ({ ...prev, ...loaded }));
  }

  async function toggleTemplateExpanded(templateId: string) {
    if (expandedTemplateId === templateId) {
      setExpandedTemplateId(null);
      return;
    }
    setExpandedTemplateId(templateId);
    const rows = (await listTemplateExercisesByTemplate(db, userId, templateId)).sort((a, b) => a.orderIndex - b.orderIndex);
    setExercisesByTemplate((prev) => ({ ...prev, [templateId]: rows }));
    await loadExerciseNames(rows);
  }

  async function refreshTemplateExercises(templateId: string) {
    const rows = (await listTemplateExercisesByTemplate(db, userId, templateId)).sort((a, b) => a.orderIndex - b.orderIndex);
    setExercisesByTemplate((prev) => ({ ...prev, [templateId]: rows }));
    await loadExerciseNames(rows);
  }

  async function handleAddExercise(templateId: string, picked: Exercise) {
    setPickerOpenForTemplate(null);
    const existing = exercisesByTemplate[templateId] ?? [];
    await createTemplateExercise(db, {
      userId,
      templateId,
      exerciseId: picked.id,
      orderIndex: existing.length,
      targetSets: DEFAULT_TARGET_SETS,
      targetRepsMin: DEFAULT_TARGET_REPS_MIN,
      targetRepsMax: DEFAULT_TARGET_REPS_MAX,
      supersetGroupId: null,
      notes: null,
    });
    setExerciseNames((prev) => ({ ...prev, [picked.id]: picked.name }));
    await refreshTemplateExercises(templateId);
  }

  async function handleRemoveExercise(templateId: string, row: TemplateExerciseRow) {
    await softDeleteTemplateExercise(db, userId, row.id);
    await refreshTemplateExercises(templateId);
  }

  async function handleReorder(templateId: string, row: TemplateExerciseRow, direction: -1 | 1) {
    const rows = exercisesByTemplate[templateId] ?? [];
    const idx = rows.findIndex((r) => r.id === row.id);
    const swapIdx = idx + direction;
    if (idx === -1 || swapIdx < 0 || swapIdx >= rows.length) return;
    const other = rows[swapIdx];
    await Promise.all([
      updateTemplateExercise(db, userId, row.id, { orderIndex: other.orderIndex }),
      updateTemplateExercise(db, userId, other.id, { orderIndex: row.orderIndex }),
    ]);
    await refreshTemplateExercises(templateId);
  }

  async function handleToggleSuperset(templateId: string, row: TemplateExerciseRow) {
    const rows = exercisesByTemplate[templateId] ?? [];
    const idx = rows.findIndex((r) => r.id === row.id);
    const next = rows[idx + 1];
    if (!next) return;
    if (row.supersetGroupId && row.supersetGroupId === next.supersetGroupId) {
      await Promise.all([
        updateTemplateExercise(db, userId, row.id, { supersetGroupId: null }),
        updateTemplateExercise(db, userId, next.id, { supersetGroupId: null }),
      ]);
    } else {
      // Bug fix: previously this only ever wrote row+next's group, so an
      // exercise already paired with its OTHER neighbour (e.g. row already
      // grouped with the exercise above it, or next already grouped with the
      // exercise after it) kept its old supersetGroupId on that stale
      // partner — the badge stuck around on an exercise that was no longer
      // really grouped with anyone. Explicitly clear those stale partners
      // first so "this exercise + the one below it" is always a clean pair.
      const updates: Promise<unknown>[] = [];
      const prev = rows[idx - 1];
      if (prev && row.supersetGroupId && prev.supersetGroupId === row.supersetGroupId) {
        updates.push(updateTemplateExercise(db, userId, prev.id, { supersetGroupId: null }));
      }
      const afterNext = rows[idx + 2];
      if (afterNext && next.supersetGroupId && afterNext.supersetGroupId === next.supersetGroupId) {
        updates.push(updateTemplateExercise(db, userId, afterNext.id, { supersetGroupId: null }));
      }
      const groupId = newId();
      updates.push(updateTemplateExercise(db, userId, row.id, { supersetGroupId: groupId }));
      updates.push(updateTemplateExercise(db, userId, next.id, { supersetGroupId: groupId }));
      await Promise.all(updates);
    }
    await refreshTemplateExercises(templateId);
  }

  function handleKeypadConfirm(value: number) {
    if (!keypadTarget) return;
    const { templateExerciseId, field } = keypadTarget;
    setKeypadTarget(null);
    const patch =
      field === 'sets'
        ? { targetSets: Math.max(1, Math.round(value)) }
        : field === 'repsMin'
          ? { targetRepsMin: Math.max(1, Math.round(value)) }
          : { targetRepsMax: Math.max(1, Math.round(value)) };
    void updateTemplateExercise(db, userId, templateExerciseId, patch).then(() => {
      if (expandedTemplateId) void refreshTemplateExercises(expandedTemplateId);
    });
  }

  return (
    <ScrollView style={styles.root} contentContainerStyle={styles.content}>
      <Stack.Screen options={{ title: strings.programmesTitle }} />

      <View style={styles.newRow}>
        <TextInput
          value={newProgrammeName}
          onChangeText={setNewProgrammeName}
          placeholder={strings.programmesNamePlaceholder}
          placeholderTextColor={color.textMuted}
          style={styles.input}
        />
        <Pressable onPress={() => void handleCreateProgramme()} style={styles.createTouch}>
          <Text style={[type.label, styles.createLabel]}>{strings.programmesNewButton}</Text>
        </Pressable>
      </View>

      {programmes.length === 0 ? <Text style={[type.body, styles.emptyText]}>{strings.programmesEmpty}</Text> : null}

      {programmes.map((programme) => (
        <View key={programme.id}>
          <ListRow
            variant="navigation"
            label={programme.name.toUpperCase()}
            subLabel={programme.isActive ? strings.programmesActiveBadge : undefined}
            onPress={() => void toggleProgrammeExpanded(programme.id)}
          />
          {expandedProgrammeId === programme.id ? (
            <View style={styles.expandedPanel}>
              {editingProgrammeId === programme.id ? (
                <View style={styles.newRow}>
                  <TextInput
                    value={editProgrammeName}
                    onChangeText={setEditProgrammeName}
                    placeholder={strings.programmesNamePlaceholder}
                    placeholderTextColor={color.textMuted}
                    autoFocus
                    style={styles.input}
                  />
                  <Pressable onPress={() => void handleSaveProgrammeName()} style={styles.secondaryTouch}>
                    <Text style={[type.label, styles.secondaryLabel]}>{strings.addExerciseSaveButton}</Text>
                  </Pressable>
                  <Pressable onPress={() => setEditingProgrammeId(null)} style={styles.secondaryTouch}>
                    <Text style={[type.label, styles.cancelLabel]}>{strings.addExerciseCancelButton}</Text>
                  </Pressable>
                </View>
              ) : (
                <Pressable onPress={() => startEditProgrammeName(programme)} style={styles.secondaryTouch}>
                  <Text style={[type.label, styles.secondaryLabel]}>{strings.programmeRenameButton}</Text>
                </Pressable>
              )}

              {!programme.isActive ? (
                <Pressable onPress={() => void handleSetActive(programme.id)} style={styles.secondaryTouch}>
                  <Text style={[type.label, styles.secondaryLabel]}>{strings.programmesSetActiveButton}</Text>
                </Pressable>
              ) : null}

              <Text style={[type.caption, styles.sectionHeading]}>{strings.programmeDetailTemplatesHeading}</Text>
              {(templatesByProgramme[programme.id] ?? []).length === 0 ? (
                <Text style={[type.body, styles.emptyText]}>{strings.programmeDetailEmpty}</Text>
              ) : null}
              {(templatesByProgramme[programme.id] ?? []).map((tmpl) => (
                <TemplateSection
                  key={tmpl.id}
                  template={tmpl}
                  expanded={expandedTemplateId === tmpl.id}
                  exercises={exercisesByTemplate[tmpl.id] ?? []}
                  exerciseNames={exerciseNames}
                  editing={editingTemplateId === tmpl.id}
                  editName={editTemplateName}
                  onEditNameChange={setEditTemplateName}
                  onStartEdit={() => startEditTemplateName(tmpl)}
                  onSaveEdit={() => void handleSaveTemplateName(programme.id)}
                  onCancelEdit={() => setEditingTemplateId(null)}
                  onToggle={() => void toggleTemplateExpanded(tmpl.id)}
                  onAddExercise={() => setPickerOpenForTemplate(tmpl.id)}
                  onRemoveExercise={(row) => void handleRemoveExercise(tmpl.id, row)}
                  onReorder={(row, dir) => void handleReorder(tmpl.id, row, dir)}
                  onToggleSuperset={(row) => void handleToggleSuperset(tmpl.id, row)}
                  onEditField={(templateExerciseId, field) => setKeypadTarget({ templateExerciseId, field })}
                />
              ))}

              <View style={styles.newRow}>
                <TextInput
                  value={newTemplateName}
                  onChangeText={setNewTemplateName}
                  placeholder={strings.programmeDetailNewTemplateNamePlaceholder}
                  placeholderTextColor={color.textMuted}
                  style={styles.input}
                />
                <TextInput
                  value={newTemplateDayHint}
                  onChangeText={setNewTemplateDayHint}
                  placeholder={strings.programmeDetailNewTemplateDayHintPlaceholder}
                  placeholderTextColor={color.textMuted}
                  style={styles.dayHintInput}
                />
                <Pressable onPress={() => void handleCreateTemplate(programme.id)} style={styles.createTouch}>
                  <Text style={[type.label, styles.createLabel]}>{strings.programmeDetailNewTemplateButton}</Text>
                </Pressable>
              </View>
            </View>
          ) : null}
        </View>
      ))}

      {standaloneTemplates.length > 0 ? (
        <>
          <Text style={[type.caption, styles.sectionHeading]}>{strings.programmesStandaloneHeading}</Text>
          {standaloneTemplates.map((tmpl) => (
            <TemplateSection
              key={tmpl.id}
              template={tmpl}
              expanded={expandedTemplateId === tmpl.id}
              exercises={exercisesByTemplate[tmpl.id] ?? []}
              exerciseNames={exerciseNames}
              editing={editingTemplateId === tmpl.id}
              editName={editTemplateName}
              onEditNameChange={setEditTemplateName}
              onStartEdit={() => startEditTemplateName(tmpl)}
              onSaveEdit={() => void handleSaveTemplateName(null)}
              onCancelEdit={() => setEditingTemplateId(null)}
              onToggle={() => void toggleTemplateExpanded(tmpl.id)}
              onAddExercise={() => setPickerOpenForTemplate(tmpl.id)}
              onRemoveExercise={(row) => void handleRemoveExercise(tmpl.id, row)}
              onReorder={(row, dir) => void handleReorder(tmpl.id, row, dir)}
              onToggleSuperset={(row) => void handleToggleSuperset(tmpl.id, row)}
              onEditField={(templateExerciseId, field) => setKeypadTarget({ templateExerciseId, field })}
            />
          ))}
        </>
      ) : null}

      <View style={styles.gap} />
      <ListRow variant="navigation" label={strings.programmesImportLink} onPress={() => router.push('/import-programme')} />

      <ExercisePicker
        visible={pickerOpenForTemplate != null}
        db={db}
        userId={userId}
        onClose={() => setPickerOpenForTemplate(null)}
        onSelect={(picked) => {
          if (pickerOpenForTemplate) void handleAddExercise(pickerOpenForTemplate, picked);
        }}
      />

      <NumericKeypad
        visible={keypadTarget != null}
        label={
          keypadTarget?.field === 'sets'
            ? strings.templateExerciseSetsLabel
            : keypadTarget?.field === 'repsMin'
              ? strings.templateExerciseRepsMinLabel
              : strings.templateExerciseRepsMaxLabel
        }
        allowDecimal={false}
        onConfirm={handleKeypadConfirm}
        onCancel={() => setKeypadTarget(null)}
      />
    </ScrollView>
  );
}

function TemplateSection({
  template,
  expanded,
  exercises,
  exerciseNames,
  editing,
  editName,
  onEditNameChange,
  onStartEdit,
  onSaveEdit,
  onCancelEdit,
  onToggle,
  onAddExercise,
  onRemoveExercise,
  onReorder,
  onToggleSuperset,
  onEditField,
}: {
  template: Template;
  expanded: boolean;
  exercises: TemplateExerciseRow[];
  exerciseNames: Record<string, string>;
  editing: boolean;
  editName: string;
  onEditNameChange: (value: string) => void;
  onStartEdit: () => void;
  onSaveEdit: () => void;
  onCancelEdit: () => void;
  onToggle: () => void;
  onAddExercise: () => void;
  onRemoveExercise: (row: TemplateExerciseRow) => void;
  onReorder: (row: TemplateExerciseRow, direction: -1 | 1) => void;
  onToggleSuperset: (row: TemplateExerciseRow) => void;
  onEditField: (templateExerciseId: string, field: 'sets' | 'repsMin' | 'repsMax') => void;
}) {
  return (
    <View style={styles.templateBlock}>
      <ListRow
        variant="navigation"
        label={template.name.toUpperCase()}
        subLabel={template.dayHint ?? undefined}
        onPress={onToggle}
      />
      {expanded ? (
        <View style={styles.expandedPanel}>
          {editing ? (
            <View style={styles.newRow}>
              <TextInput
                value={editName}
                onChangeText={onEditNameChange}
                placeholder={strings.programmeDetailNewTemplateNamePlaceholder}
                placeholderTextColor={color.textMuted}
                autoFocus
                style={styles.input}
              />
              <Pressable onPress={onSaveEdit} style={styles.secondaryTouch}>
                <Text style={[type.label, styles.secondaryLabel]}>{strings.addExerciseSaveButton}</Text>
              </Pressable>
              <Pressable onPress={onCancelEdit} style={styles.secondaryTouch}>
                <Text style={[type.label, styles.cancelLabel]}>{strings.addExerciseCancelButton}</Text>
              </Pressable>
            </View>
          ) : (
            <Pressable onPress={onStartEdit} style={styles.secondaryTouch}>
              <Text style={[type.label, styles.secondaryLabel]}>{strings.templateRenameButton}</Text>
            </Pressable>
          )}

          <Text style={[type.caption, styles.sectionHeading]}>{strings.templateDetailExercisesHeading}</Text>
          {exercises.length === 0 ? <Text style={[type.body, styles.emptyText]}>{strings.templateDetailEmpty}</Text> : null}
          {exercises.map((row, i) => {
            const next = exercises[i + 1];
            const isSupersetWithNext = next != null && row.supersetGroupId != null && row.supersetGroupId === next.supersetGroupId;
            return (
              <View key={row.id} style={styles.exerciseRow}>
                <View style={styles.exerciseRowMain}>
                  <Text style={[type.label, styles.exerciseName]} numberOfLines={1}>
                    {(exerciseNames[row.exerciseId] ?? '…').toUpperCase()}
                  </Text>
                  {row.supersetGroupId ? <Text style={[type.caption, styles.supersetBadge]}>{strings.templateExerciseSupersetBadge}</Text> : null}
                </View>
                <View style={styles.exerciseTargets}>
                  <Pressable onPress={() => onEditField(row.id, 'sets')} style={styles.targetTouch}>
                    <Text style={[type.caption, styles.targetLabel]}>{strings.templateExerciseSetsLabel}</Text>
                    <Text style={[type.label, styles.targetValue]}>{row.targetSets}</Text>
                  </Pressable>
                  <Pressable onPress={() => onEditField(row.id, 'repsMin')} style={styles.targetTouch}>
                    <Text style={[type.caption, styles.targetLabel]}>{strings.templateExerciseRepsMinLabel}</Text>
                    <Text style={[type.label, styles.targetValue]}>{row.targetRepsMin}</Text>
                  </Pressable>
                  <Pressable onPress={() => onEditField(row.id, 'repsMax')} style={styles.targetTouch}>
                    <Text style={[type.caption, styles.targetLabel]}>{strings.templateExerciseRepsMaxLabel}</Text>
                    <Text style={[type.label, styles.targetValue]}>{row.targetRepsMax}</Text>
                  </Pressable>
                </View>
                <View style={styles.exerciseActions}>
                  <Pressable onPress={() => onReorder(row, -1)} disabled={i === 0} style={styles.smallTouch}>
                    <Text style={[type.label, styles.smallTouchLabel]}>↑</Text>
                  </Pressable>
                  <Pressable onPress={() => onReorder(row, 1)} disabled={i === exercises.length - 1} style={styles.smallTouch}>
                    <Text style={[type.label, styles.smallTouchLabel]}>↓</Text>
                  </Pressable>
                  {next ? (
                    <Pressable onPress={() => onToggleSuperset(row)} style={styles.smallTouch}>
                      <Text style={[type.caption, isSupersetWithNext ? styles.smallTouchLabelActive : styles.smallTouchLabel]}>
                        {strings.templateExerciseSupersetToggle}
                      </Text>
                    </Pressable>
                  ) : null}
                  <Pressable onPress={() => onRemoveExercise(row)} style={styles.smallTouch}>
                    <Text style={[type.caption, styles.removeLabel]}>{strings.templateExerciseRemoveButton}</Text>
                  </Pressable>
                </View>
              </View>
            );
          })}
          <Pressable onPress={onAddExercise} style={styles.secondaryTouch}>
            <Text style={[type.label, styles.secondaryLabel]}>{strings.templateDetailAddExerciseButton}</Text>
          </Pressable>
        </View>
      ) : null}
    </View>
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
  gap: {
    height: 32,
  },
  newRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: size.listRowPadding,
    paddingVertical: 8,
  },
  input: {
    ...type.body,
    color: color.textPrimary,
    borderWidth: 2,
    borderColor: color.divider,
    minHeight: size.minTouchTarget,
    paddingHorizontal: 12,
    flex: 1,
  },
  dayHintInput: {
    ...type.body,
    color: color.textPrimary,
    borderWidth: 2,
    borderColor: color.divider,
    minHeight: size.minTouchTarget,
    paddingHorizontal: 12,
    width: 90,
  },
  createTouch: {
    minHeight: size.minTouchTarget,
    paddingHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: color.slabPrimary,
  },
  createLabel: {
    color: color.onSlab,
  },
  emptyText: {
    color: color.textMuted,
    paddingHorizontal: size.listRowPadding,
    paddingVertical: 12,
  },
  expandedPanel: {
    paddingHorizontal: size.listRowPadding,
    paddingBottom: 16,
    gap: 8,
  },
  secondaryTouch: {
    minHeight: size.minTouchTarget,
    justifyContent: 'center',
  },
  secondaryLabel: {
    color: color.slabSecondary,
  },
  cancelLabel: {
    color: color.textMuted,
  },
  sectionHeading: {
    color: color.textMuted,
    marginTop: 12,
  },
  templateBlock: {
    marginLeft: 12,
  },
  exerciseRow: {
    paddingVertical: 8,
    borderBottomWidth: size.divider,
    borderBottomColor: color.divider,
  },
  exerciseRowMain: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  exerciseName: {
    color: color.textPrimary,
    flexShrink: 1,
  },
  supersetBadge: {
    color: color.slabSecondary,
  },
  exerciseTargets: {
    flexDirection: 'row',
    gap: 16,
    marginTop: 4,
  },
  targetTouch: {
    minHeight: size.minTouchTarget,
    alignItems: 'flex-start',
    justifyContent: 'center',
  },
  targetLabel: {
    color: color.textMuted,
  },
  targetValue: {
    color: color.textPrimary,
  },
  exerciseActions: {
    flexDirection: 'row',
    gap: 16,
    marginTop: 4,
  },
  smallTouch: {
    minHeight: size.minTouchTarget,
    minWidth: size.minTouchTarget,
    alignItems: 'center',
    justifyContent: 'center',
  },
  smallTouchLabel: {
    color: color.textMuted,
  },
  smallTouchLabelActive: {
    color: color.slabSecondary,
  },
  removeLabel: {
    color: color.danger,
  },
});
