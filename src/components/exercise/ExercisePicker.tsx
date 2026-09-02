import { useEffect, useMemo, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { createExercise, listExercises } from '@/data/repositories/exerciseRepository';
import type { exercise as exerciseTable } from '@/data/schema';
import type { AppDatabase } from '@/data/types';
import { matchExercises } from '@/domain/fuzzyMatch';
import { rankExercises } from '@/domain/exerciseRanking';
import type { EquipmentType, LoadConvention } from '@/domain/loadConvention';
import { MUSCLE_GROUPS, OTHER_MUSCLE_GROUP_CHIP, resolveMuscleGroupChip, type MuscleGroupChip } from '@/domain/muscleGroups';
import { strings } from '@/strings';
import { color, size, type } from '@/theme';

// DESIGN-SPEC.md §5.6/§6 screen 4 — muscle-group slabs, autofocused
// type-ahead search, inline create. FR-2.1: chips always render first — with
// no chip selected and no search text, only chips show, never an
// undifferentiated list. Reused from both transition.tsx ("select next
// exercise") and programmes.tsx ("add exercise to template").

type Exercise = typeof exerciseTable.$inferSelect;

export const EQUIPMENT_TYPES: EquipmentType[] = ['barbell', 'dumbbell', 'selectorised', 'plate_loaded', 'cable', 'bodyweight', 'other'];

// Barbell defaults to `total` and bodyweight is fixed — both unambiguous
// enough to skip the extra tap. Every other equipment type varies by
// machine/exercise and is never defaulted silently, per invariant 8.
function defaultConventionFor(equipment: EquipmentType): LoadConvention | null {
  if (equipment === 'bodyweight') return 'bodyweight';
  if (equipment === 'barbell') return 'total';
  return null; // ambiguous — must be chosen explicitly
}

type ExercisePickerProps = {
  visible: boolean;
  db: AppDatabase;
  userId: string;
  onClose: () => void;
  onSelect: (exercise: Exercise) => void;
};

export function ExercisePicker({ visible, db, userId, onClose, onSelect }: ExercisePickerProps) {
  const [library, setLibrary] = useState<Exercise[]>([]);
  const [chip, setChip] = useState<MuscleGroupChip | null>(null);
  const [query, setQuery] = useState('');
  const [creating, setCreating] = useState(false);
  const [createEquipment, setCreateEquipment] = useState<EquipmentType | null>(null);
  const [createConvention, setCreateConvention] = useState<LoadConvention | null>(null);

  useEffect(() => {
    if (!visible) return;
    let cancelled = false;
    (async () => {
      const all = await listExercises(db, userId);
      if (cancelled) return;
      setLibrary(all);
      setChip(null);
      setQuery('');
      setCreating(false);
      setCreateEquipment(null);
      setCreateConvention(null);
    })();
    return () => {
      cancelled = true;
    };
  }, [visible, db, userId]);

  const results = useMemo(() => {
    if (query.trim().length > 0) {
      return matchExercises(query, library).map((m) => m.exercise);
    }
    if (chip && chip !== OTHER_MUSCLE_GROUP_CHIP) {
      const inChip = library.filter((ex) => resolveMuscleGroupChip(ex.muscleGroup) === chip);
      return rankExercises(inChip);
    }
    if (chip === OTHER_MUSCLE_GROUP_CHIP) {
      const inOther = library.filter((ex) => resolveMuscleGroupChip(ex.muscleGroup) === OTHER_MUSCLE_GROUP_CHIP);
      return rankExercises(inOther);
    }
    return [];
  }, [query, chip, library]);

  const trimmedQuery = query.trim();
  const hasExactMatch = results.some((ex) => ex.name.trim().toLowerCase() === trimmedQuery.toLowerCase());
  const showCreateRow = trimmedQuery.length > 0 && !hasExactMatch;

  function handleSelect(exercise: Exercise) {
    onSelect(exercise);
  }

  function handleStartCreate() {
    setCreating(true);
    setCreateEquipment(null);
    setCreateConvention(null);
  }

  async function handleConfirmCreate() {
    if (!chip || chip === OTHER_MUSCLE_GROUP_CHIP || !createEquipment) return;
    const convention = defaultConventionFor(createEquipment) ?? createConvention;
    if (!convention) return;
    const created = await createExercise(db, {
      userId,
      name: trimmedQuery,
      aliases: [],
      muscleGroup: chip,
      equipmentType: createEquipment,
      loadConvention: convention,
      barWeightKg: null,
      defaultWeightStep: null,
      source: 'user',
      lastUsedAt: null,
    });
    if (created) onSelect(created);
  }

  const conventionRequired = createEquipment != null && defaultConventionFor(createEquipment) == null;

  return (
    <Modal visible={visible} transparent={false} animationType="slide" onRequestClose={onClose}>
      <SafeAreaView style={styles.root} edges={['top', 'bottom']}>
        <View style={styles.header}>
          <Text style={[type.heading, styles.headerTitle]}>{strings.addExerciseTitle}</Text>
          <Pressable onPress={onClose} style={styles.closeTouch}>
            <Text style={[type.label, styles.closeLabel]}>{strings.addExerciseClose}</Text>
          </Pressable>
        </View>

        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder={strings.addExerciseSearchPlaceholder}
          placeholderTextColor={color.textMuted}
          autoFocus
          style={styles.searchInput}
        />

        <View style={styles.chipRow}>
          {[...MUSCLE_GROUPS, OTHER_MUSCLE_GROUP_CHIP].map((group) => (
            <Pressable
              key={group}
              onPress={() => setChip((prev) => (prev === group ? null : group))}
              style={[styles.chipTouch, chip === group ? styles.chipActive : styles.chipInactive]}
            >
              <Text style={[type.caption, chip === group ? styles.chipLabelActive : styles.chipLabelInactive]}>
                {group.toUpperCase()}
              </Text>
            </Pressable>
          ))}
        </View>

        <ScrollView style={styles.list} contentContainerStyle={styles.listContent}>
          {results.map((ex) => (
            <Pressable key={ex.id} onPress={() => handleSelect(ex)} style={styles.resultRow}>
              <Text style={[type.label, styles.resultLabel]}>{ex.name.toUpperCase()}</Text>
              <View style={styles.divider} />
            </Pressable>
          ))}

          {showCreateRow ? (
            !chip || chip === OTHER_MUSCLE_GROUP_CHIP ? (
              <Text style={[type.body, styles.hintText]}>{strings.addExerciseMuscleGroupRequired}</Text>
            ) : !creating ? (
              <Pressable onPress={handleStartCreate} style={styles.createRow}>
                <Text style={[type.label, styles.createLabel]}>{strings.addExerciseCreateAs(trimmedQuery)}</Text>
              </Pressable>
            ) : (
              <View style={styles.createPanel}>
                <Text style={[type.caption, styles.fieldLabel]}>{strings.addExerciseEquipmentLabel}</Text>
                <View style={styles.chipRow}>
                  {EQUIPMENT_TYPES.map((eq) => (
                    <Pressable
                      key={eq}
                      onPress={() => {
                        setCreateEquipment(eq);
                        setCreateConvention(null);
                      }}
                      style={[styles.chipTouch, createEquipment === eq ? styles.chipActive : styles.chipInactive]}
                    >
                      <Text style={[type.caption, createEquipment === eq ? styles.chipLabelActive : styles.chipLabelInactive]}>
                        {eq.toUpperCase()}
                      </Text>
                    </Pressable>
                  ))}
                </View>

                {conventionRequired ? (
                  <>
                    <Text style={[type.caption, styles.fieldLabel]}>{strings.addExerciseConventionLabel}</Text>
                    <Text style={[type.body, styles.hintText]}>{strings.addExerciseConventionRequired}</Text>
                    <View style={styles.chipRow}>
                      {(['per_side', 'total'] as LoadConvention[]).map((c) => (
                        <Pressable
                          key={c}
                          onPress={() => setCreateConvention(c)}
                          style={[styles.chipTouch, createConvention === c ? styles.chipActive : styles.chipInactive]}
                        >
                          <Text style={[type.caption, createConvention === c ? styles.chipLabelActive : styles.chipLabelInactive]}>
                            {c === 'per_side' ? strings.importConventionPerSide.toUpperCase() : strings.importConventionTotal.toUpperCase()}
                          </Text>
                        </Pressable>
                      ))}
                    </View>
                  </>
                ) : null}

                <Pressable
                  onPress={() => void handleConfirmCreate()}
                  disabled={!createEquipment || (conventionRequired && !createConvention)}
                  style={[
                    styles.confirmCreateTouch,
                    !createEquipment || (conventionRequired && !createConvention) ? styles.confirmCreateDisabled : null,
                  ]}
                >
                  <Text style={[type.label, styles.confirmCreateLabel]}>{strings.addExerciseCreateButton}</Text>
                </Pressable>
              </View>
            )
          ) : null}
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: color.bg,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    height: size.topBar,
    paddingHorizontal: size.listRowPadding,
    backgroundColor: color.bar,
  },
  headerTitle: {
    color: color.textPrimary,
  },
  closeTouch: {
    minHeight: size.minTouchTarget,
    minWidth: size.minTouchTarget,
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeLabel: {
    color: color.slabSecondary,
  },
  searchInput: {
    ...type.display1,
    color: color.textPrimary,
    paddingHorizontal: size.listRowPadding,
    minHeight: size.minTouchTarget,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    paddingHorizontal: size.listRowPadding,
    paddingVertical: 8,
  },
  chipTouch: {
    minHeight: size.minTouchTarget,
    paddingHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: color.divider,
  },
  chipActive: {
    backgroundColor: color.slabSecondary,
    borderColor: color.slabSecondary,
  },
  chipInactive: {
    backgroundColor: 'transparent',
  },
  chipLabelActive: {
    color: color.onSlab,
  },
  chipLabelInactive: {
    color: color.textPrimary,
  },
  list: {
    flex: 1,
  },
  listContent: {
    paddingBottom: 32,
  },
  resultRow: {
    minHeight: size.listRow,
    justifyContent: 'center',
    paddingHorizontal: size.listRowPadding,
  },
  resultLabel: {
    color: color.textPrimary,
  },
  divider: {
    height: size.divider,
    backgroundColor: color.divider,
    marginTop: 8,
  },
  hintText: {
    color: color.textMuted,
    paddingHorizontal: size.listRowPadding,
    paddingVertical: 12,
  },
  createRow: {
    minHeight: size.listRow,
    justifyContent: 'center',
    paddingHorizontal: size.listRowPadding,
  },
  createLabel: {
    color: color.slabSecondary,
  },
  createPanel: {
    paddingHorizontal: size.listRowPadding,
    paddingTop: 8,
    gap: 4,
  },
  fieldLabel: {
    color: color.textMuted,
    marginTop: 12,
  },
  confirmCreateTouch: {
    minHeight: size.minTouchTarget,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: color.slabPrimary,
    marginTop: 16,
  },
  confirmCreateDisabled: {
    opacity: 0.4,
  },
  confirmCreateLabel: {
    color: color.onSlab,
  },
});
