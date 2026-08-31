import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { createExercise } from '@/data/repositories/exerciseRepository';
import type { exercise } from '@/data/schema';
import type { AppDatabase } from '@/data/types';
import { matchExercises } from '@/domain/fuzzyMatch';
import { rankExercises } from '@/domain/exerciseRanking';
import { MUSCLE_GROUPS, OTHER_MUSCLE_GROUP_CHIP, resolveMuscleGroupChip, type MuscleGroupChip } from '@/domain/muscleGroups';
import type { EquipmentType, LoadConvention } from '@/domain/loadConvention';
import { strings } from '@/strings';
import { theme } from '@/theme';

type Exercise = typeof exercise.$inferSelect;

const EQUIPMENT_TYPES: EquipmentType[] = [
  'barbell',
  'dumbbell',
  'selectorised',
  'plate_loaded',
  'cable',
  'bodyweight',
  'other',
];

const CONVENTIONS: LoadConvention[] = ['per_side', 'total', 'bodyweight'];

// FR-3.12.1: house defaults on creation. plate_loaded and other genuinely
// vary — no default, the user must choose.
function defaultConventionFor(equipmentType: EquipmentType): LoadConvention | null {
  switch (equipmentType) {
    case 'dumbbell':
    case 'cable':
      return 'per_side';
    case 'barbell':
    case 'selectorised':
      return 'total';
    case 'bodyweight':
      return 'bodyweight';
    default:
      return null;
  }
}

interface ExercisePickerProps {
  db: AppDatabase;
  userId: string;
  existingExercises: Exercise[];
  onPick: (exercise: Exercise) => void;
  onClose: () => void;
}

export function ExercisePicker({ db, userId, existingExercises, onPick, onClose }: ExercisePickerProps) {
  const [query, setQuery] = useState('');
  const [activeChip, setActiveChip] = useState<MuscleGroupChip | null>(null);
  const [creating, setCreating] = useState(false);
  const [equipmentType, setEquipmentType] = useState<EquipmentType>('barbell');
  const [loadConvention, setLoadConvention] = useState<LoadConvention | null>(
    defaultConventionFor('barbell'),
  );

  // FR-2.2: search ignores the active chip entirely — a legacy free-text
  // muscle_group value (e.g. the importer's "Legs") must never make an
  // exercise unreachable, since chip filtering below only recognises the
  // fixed FR-2.1 taxonomy.
  const searchResults = useMemo(() => {
    if (query.trim().length === 0) return [];
    return matchExercises(query, existingExercises).map((m) => m.exercise);
  }, [existingExercises, query]);

  const browseResults = useMemo(() => {
    if (query.trim().length > 0 || activeChip == null) return [];
    const inChip = existingExercises.filter((e) => resolveMuscleGroupChip(e.muscleGroup) === activeChip);
    return rankExercises(inChip);
  }, [existingExercises, query, activeChip]);

  const results = query.trim().length > 0 ? searchResults : browseResults;

  function selectEquipmentType(type: EquipmentType) {
    setEquipmentType(type);
    setLoadConvention(defaultConventionFor(type));
  }

  function handlePick(picked: Exercise) {
    onPick(picked);
  }

  async function handleCreate() {
    const name = query.trim();
    if (name.length === 0 || loadConvention == null || activeChip == null || activeChip === OTHER_MUSCLE_GROUP_CHIP) {
      return;
    }
    const created = await createExercise(db, {
      userId,
      name,
      aliases: [],
      muscleGroup: activeChip,
      equipmentType,
      loadConvention,
      barWeightKg: null,
      defaultWeightStep: null,
      source: 'user',
      lastUsedAt: null,
    });
    if (created) handlePick(created);
  }

  const canCreate = activeChip != null && activeChip !== OTHER_MUSCLE_GROUP_CHIP;

  return (
    <View style={styles.container}>
      <View style={styles.headerRow}>
        <Text style={styles.title}>{strings.addExerciseTitle}</Text>
        <Pressable onPress={onClose}>
          <Text style={styles.closeLabel}>{strings.addExerciseClose}</Text>
        </Pressable>
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        <View style={styles.chipRow}>
          {[...MUSCLE_GROUPS, OTHER_MUSCLE_GROUP_CHIP].map((group) => (
            <Pressable
              key={group}
              style={[styles.chip, activeChip === group && styles.chipActive]}
              onPress={() => setActiveChip((prev) => (prev === group ? null : group))}>
              <Text style={[styles.chipLabel, activeChip === group && styles.chipLabelActive]}>
                {group.toUpperCase()}
              </Text>
            </Pressable>
          ))}
        </View>
      </ScrollView>

      <TextInput
        style={styles.searchInput}
        placeholder={strings.addExerciseSearchPlaceholder}
        placeholderTextColor={theme.color.textMuted}
        value={query}
        onChangeText={(text) => {
          setQuery(text);
          setCreating(false);
        }}
        autoFocus
      />

      {results.length > 0 ? (
        <View style={styles.results}>
          {results.map((m) => (
            <Pressable key={m.id} style={styles.resultRow} onPress={() => handlePick(m)}>
              <Text style={styles.resultLabel}>{m.name}</Text>
            </Pressable>
          ))}
        </View>
      ) : null}

      {query.trim().length > 0 && searchResults.length === 0 && !creating ? (
        <Pressable style={styles.createPrompt} onPress={() => setCreating(true)}>
          <Text style={styles.createPromptLabel}>{strings.addExerciseCreateAs(query.trim())}</Text>
        </Pressable>
      ) : null}

      {creating ? (
        <View style={styles.createForm}>
          {!canCreate ? <Text style={styles.warningText}>{strings.addExerciseMuscleGroupRequired}</Text> : null}

          <Text style={styles.fieldLabel}>{strings.addExerciseEquipmentLabel}</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <View style={styles.chipRow}>
              {EQUIPMENT_TYPES.map((type) => (
                <Pressable
                  key={type}
                  style={[styles.chip, equipmentType === type && styles.chipActive]}
                  onPress={() => selectEquipmentType(type)}>
                  <Text style={[styles.chipLabel, equipmentType === type && styles.chipLabelActive]}>
                    {type.replace('_', ' ').toUpperCase()}
                  </Text>
                </Pressable>
              ))}
            </View>
          </ScrollView>

          <Text style={styles.fieldLabel}>{strings.addExerciseConventionLabel}</Text>
          <View style={styles.chipRow}>
            {CONVENTIONS.map((c) => (
              <Pressable
                key={c}
                style={[styles.chip, loadConvention === c && styles.chipActive]}
                onPress={() => setLoadConvention(c)}>
                <Text style={[styles.chipLabel, loadConvention === c && styles.chipLabelActive]}>
                  {c.replace('_', ' ').toUpperCase()}
                </Text>
              </Pressable>
            ))}
          </View>
          {loadConvention == null ? (
            <Text style={styles.warningText}>{strings.addExerciseConventionRequired}</Text>
          ) : null}

          <Pressable
            style={[styles.createButton, (!canCreate || loadConvention == null) && styles.createButtonDisabled]}
            disabled={!canCreate || loadConvention == null}
            onPress={handleCreate}>
            <Text style={styles.createButtonLabel}>{strings.addExerciseCreateButton}</Text>
          </Pressable>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: theme.color.surface,
    borderRadius: 16,
    padding: 16,
    gap: 12,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  title: {
    color: theme.color.textPrimary,
    fontSize: 16,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
  closeLabel: {
    color: theme.color.textMuted,
    fontSize: 14,
  },
  searchInput: {
    color: theme.color.textPrimary,
    fontSize: 16,
    backgroundColor: theme.color.bg,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  results: {
    gap: 4,
  },
  resultRow: {
    minHeight: theme.minTouchTarget,
    justifyContent: 'center',
    paddingHorizontal: 8,
  },
  resultLabel: {
    color: theme.color.textPrimary,
    fontSize: 16,
  },
  createPrompt: {
    minHeight: theme.minTouchTarget,
    justifyContent: 'center',
    paddingHorizontal: 8,
  },
  createPromptLabel: {
    color: theme.color.accentSecondary,
    fontSize: 14,
    fontWeight: '700',
  },
  createForm: {
    gap: 10,
  },
  fieldLabel: {
    color: theme.color.textMuted,
    fontSize: 11,
    textTransform: 'uppercase',
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chip: {
    borderRadius: 8,
    borderWidth: 1,
    borderColor: theme.color.textMuted,
    paddingHorizontal: 10,
    paddingVertical: 6,
    minHeight: 32,
    justifyContent: 'center',
  },
  chipActive: {
    backgroundColor: theme.color.accentPrimary,
    borderColor: theme.color.accentPrimary,
  },
  chipLabel: {
    color: theme.color.textMuted,
    fontSize: 12,
    fontWeight: '700',
  },
  chipLabelActive: {
    color: theme.color.bg,
  },
  warningText: {
    color: theme.color.accentPrimary,
    fontSize: 12,
  },
  createButton: {
    minHeight: theme.minTouchTarget,
    borderRadius: 12,
    backgroundColor: theme.color.accentPrimary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  createButtonDisabled: {
    opacity: 0.4,
  },
  createButtonLabel: {
    color: theme.color.bg,
    fontSize: 16,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
});
