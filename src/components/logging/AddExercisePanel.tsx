import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { createExercise } from '@/data/repositories/exerciseRepository';
import type { exercise } from '@/data/schema';
import type { AppDatabase } from '@/data/types';
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

interface AddExercisePanelProps {
  db: AppDatabase;
  userId: string;
  existingExercises: Exercise[];
  onPick: (exercise: Exercise) => void;
  onClose: () => void;
}

export function AddExercisePanel({ db, userId, existingExercises, onPick, onClose }: AddExercisePanelProps) {
  const [query, setQuery] = useState('');
  const [creating, setCreating] = useState(false);
  const [muscleGroup, setMuscleGroup] = useState('');
  const [equipmentType, setEquipmentType] = useState<EquipmentType>('barbell');
  const [loadConvention, setLoadConvention] = useState<LoadConvention | null>(
    defaultConventionFor('barbell'),
  );

  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (q.length === 0) return [];
    return existingExercises
      .filter((e) => e.name.toLowerCase().includes(q) || e.aliases.some((a) => a.toLowerCase().includes(q)))
      .slice(0, 8);
  }, [existingExercises, query]);

  function selectEquipmentType(type: EquipmentType) {
    setEquipmentType(type);
    setLoadConvention(defaultConventionFor(type));
  }

  async function handleCreate() {
    const name = query.trim();
    if (name.length === 0 || loadConvention == null) return;
    const created = await createExercise(db, {
      userId,
      name,
      aliases: [],
      muscleGroup: muscleGroup.trim().length > 0 ? muscleGroup.trim() : strings.exerciseUnspecifiedMuscleGroup,
      equipmentType,
      loadConvention,
      barWeightKg: null,
      defaultWeightStep: null,
      source: 'user',
      lastUsedAt: null,
    });
    if (created) onPick(created);
  }

  return (
    <View style={styles.container}>
      <View style={styles.headerRow}>
        <Text style={styles.title}>{strings.addExerciseTitle}</Text>
        <Pressable onPress={onClose}>
          <Text style={styles.closeLabel}>{strings.addExerciseClose}</Text>
        </Pressable>
      </View>

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

      {matches.length > 0 ? (
        <View style={styles.results}>
          {matches.map((m) => (
            <Pressable key={m.id} style={styles.resultRow} onPress={() => onPick(m)}>
              <Text style={styles.resultLabel}>{m.name}</Text>
            </Pressable>
          ))}
        </View>
      ) : null}

      {query.trim().length > 0 && matches.length === 0 && !creating ? (
        <Pressable style={styles.createPrompt} onPress={() => setCreating(true)}>
          <Text style={styles.createPromptLabel}>{strings.addExerciseCreateAs(query.trim())}</Text>
        </Pressable>
      ) : null}

      {creating ? (
        <View style={styles.createForm}>
          <TextInput
            style={styles.searchInput}
            placeholder={strings.addExerciseMuscleGroupPlaceholder}
            placeholderTextColor={theme.color.textMuted}
            value={muscleGroup}
            onChangeText={setMuscleGroup}
          />

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
            style={[styles.createButton, loadConvention == null && styles.createButtonDisabled]}
            disabled={loadConvention == null}
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
