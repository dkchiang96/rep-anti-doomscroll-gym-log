import { useMemo, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { StepperButton } from '@/components/ui';
import { updateExercise } from '@/data/repositories/exerciseRepository';
import { updatePlateInventory } from '@/data/repositories/plateInventoryRepository';
import type { plateInventory } from '@/data/schema';
import type { AppDatabase } from '@/data/types';
import { calculatePlatesForTarget, calculateTotalFromPlates, type PlateConvention } from '@/domain/plates';
import { strings } from '@/strings';
import { color, size, tabularNums, type } from '@/theme';

import { NumericKeypad } from './NumericKeypad';

// FR-3.13, rebuilt against the new design system. Plates render as
// rectangular colour blocks, not circular chips — a circle would violate
// DESIGN-SPEC.md §4's borderRadius ban (the one exception is the transport
// button). Adding/removing denominations from the inventory is deferred to
// R5's Settings screen, which owns "plate inventory" per its own Do list —
// this sheet only edits quantities for whatever's already seeded.

type PlateInventoryRow = typeof plateInventory.$inferSelect;

type Mode = 'forward' | 'reverse';

type PlateCalculatorProps = {
  visible: boolean;
  db: AppDatabase;
  userId: string;
  exerciseId: string;
  exerciseName: string;
  convention: PlateConvention;
  barWeightKg: number | null;
  targetKg: number;
  inventory: PlateInventoryRow[];
  onClose: () => void;
  onApplyWeight: (weightKg: number) => void;
  onBarWeightSet: (barWeightKg: number) => void;
  onInventoryChanged: (rows: PlateInventoryRow[]) => void;
};

export function PlateCalculator({
  visible,
  db,
  userId,
  exerciseId,
  exerciseName,
  convention,
  barWeightKg,
  targetKg,
  inventory,
  onClose,
  onApplyWeight,
  onBarWeightSet,
  onInventoryChanged,
}: PlateCalculatorProps) {
  const [mode, setMode] = useState<Mode>('forward');
  const [target, setTarget] = useState(targetKg);
  const [targetKeypadOpen, setTargetKeypadOpen] = useState(false);
  const [barWeightKeypadOpen, setBarWeightKeypadOpen] = useState(false);
  const [reverseCounts, setReverseCounts] = useState<Record<string, number>>({});

  const activeInventory = useMemo(
    () =>
      inventory
        .filter((p) => p.isActive)
        .map((p) => ({ denominationKg: p.denominationKg, colourHex: p.colourHex, quantityPerSide: p.quantityPerSide })),
    [inventory],
  );

  const sortedInventory = useMemo(
    () => [...inventory].filter((p) => p.isActive).sort((a, b) => b.denominationKg - a.denominationKg),
    [inventory],
  );

  const forwardResult = useMemo(
    () => (barWeightKg == null ? null : calculatePlatesForTarget(target, barWeightKg, convention, activeInventory)),
    [barWeightKg, target, convention, activeInventory],
  );

  const reverseTotal = useMemo(() => {
    if (barWeightKg == null) return null;
    const selected = inventory
      .filter((p) => (reverseCounts[p.id] ?? 0) > 0)
      .map((p) => ({ denominationKg: p.denominationKg, count: reverseCounts[p.id] }));
    return calculateTotalFromPlates(selected, barWeightKg, convention);
  }, [barWeightKg, convention, inventory, reverseCounts]);

  function handleClose() {
    setMode('forward');
    setReverseCounts({});
    onClose();
  }

  function handleSetBarWeight(value: number) {
    setBarWeightKeypadOpen(false);
    void updateExercise(db, userId, exerciseId, { barWeightKg: value }).then(() => onBarWeightSet(value));
  }

  function handleTargetConfirm(value: number) {
    setTargetKeypadOpen(false);
    setTarget(Math.max(0, value));
  }

  function handleApply(weightKg: number) {
    onApplyWeight(weightKg);
    handleClose();
  }

  function handleReverseStep(row: PlateInventoryRow, direction: 1 | -1) {
    setReverseCounts((prev) => {
      const current = prev[row.id] ?? 0;
      const next = Math.max(0, Math.min(row.quantityPerSide, current + direction));
      return { ...prev, [row.id]: next };
    });
  }

  function handleQuantityStep(row: PlateInventoryRow, direction: 1 | -1) {
    const next = Math.max(0, row.quantityPerSide + direction);
    void updatePlateInventory(db, userId, row.id, { quantityPerSide: next }).then((updated) => {
      if (updated) onInventoryChanged(inventory.map((p) => (p.id === updated.id ? updated : p)));
    });
  }

  return (
    <Modal visible={visible} transparent={false} animationType="slide" onRequestClose={handleClose}>
      <SafeAreaView style={styles.root} edges={['top', 'bottom']}>
        <View style={styles.header}>
          <Text style={[type.heading, styles.headerTitle]} numberOfLines={1}>
            {exerciseName.toUpperCase()}
          </Text>
          <Pressable onPress={handleClose} style={styles.closeTouch}>
            <Text style={[type.label, styles.closeLabel]}>{strings.plateCalcClose}</Text>
          </Pressable>
        </View>

        {barWeightKg == null ? (
          <View style={styles.blockedBox}>
            <Text style={[type.label, styles.blockedHeading]}>{strings.plateCalcBarWeightRequiredHeading}</Text>
            <Text style={[type.body, styles.blockedBody]}>{strings.plateCalcBarWeightRequiredBody}</Text>
            <Pressable style={styles.primaryTouch} onPress={() => setBarWeightKeypadOpen(true)}>
              <Text style={[type.label, styles.primaryLabel]}>{strings.plateCalcSetBarWeightButton}</Text>
            </Pressable>
          </View>
        ) : (
          <ScrollView contentContainerStyle={styles.content}>
            <View style={styles.tabRow}>
              <Pressable style={styles.tabTouch} onPress={() => setMode('forward')}>
                <Text style={[type.label, mode === 'forward' ? styles.tabActive : styles.tabInactive]}>
                  {strings.plateCalcForwardTab}
                </Text>
              </Pressable>
              <Pressable style={styles.tabTouch} onPress={() => setMode('reverse')}>
                <Text style={[type.label, mode === 'reverse' ? styles.tabActive : styles.tabInactive]}>
                  {strings.plateCalcReverseTab}
                </Text>
              </Pressable>
            </View>

            {mode === 'forward' && forwardResult ? (
              <View style={styles.section}>
                <Text style={[type.caption, styles.fieldLabel]}>{strings.plateCalcTargetLabel}</Text>
                <Pressable onPress={() => setTargetKeypadOpen(true)}>
                  <Text style={[type.display1, tabularNums, styles.targetValue]}>{target}</Text>
                </Pressable>

                <Text style={[type.caption, styles.fieldLabel]}>{strings.plateCalcPerSideHeading}</Text>
                {forwardResult.platesPerSide.length === 0 ? (
                  <Text style={[type.body, styles.mutedText]}>{strings.plateCalcNoPlatesConfigured}</Text>
                ) : (
                  <View style={styles.plateRow}>
                    {forwardResult.platesPerSide.map((p) => (
                      <View key={p.denominationKg} style={styles.plateGroup}>
                        {Array.from({ length: p.count }).map((_, i) => (
                          <View key={i} style={[styles.plateBlock, { backgroundColor: p.colourHex }]}>
                            <Text style={[type.caption, styles.plateBlockLabel]}>{p.denominationKg}</Text>
                          </View>
                        ))}
                      </View>
                    ))}
                  </View>
                )}

                <Text style={[type.display2, styles.achievedText]}>
                  {strings.plateCalcAchievedLabel(forwardResult.achievedTotalKg)}
                </Text>
                {forwardResult.deltaKg !== 0 ? (
                  <Text style={[type.caption, styles.deltaText]}>{strings.plateCalcDeltaLabel(forwardResult.deltaKg)}</Text>
                ) : null}

                <Pressable style={styles.primaryTouch} onPress={() => handleApply(forwardResult.achievedTotalKg)}>
                  <Text style={[type.label, styles.primaryLabel]}>{strings.plateCalcApplyButton}</Text>
                </Pressable>
              </View>
            ) : null}

            {mode === 'reverse' ? (
              <View style={styles.section}>
                {sortedInventory.map((row) => (
                  <View key={row.id} style={styles.reverseRow}>
                    <View style={[styles.plateBlock, { backgroundColor: row.colourHex }]}>
                      <Text style={[type.caption, styles.plateBlockLabel]}>{row.denominationKg}</Text>
                    </View>
                    <StepperButton
                      label={strings.setInputStepperMinus}
                      onPress={() => handleReverseStep(row, -1)}
                      size={size.minTouchTarget}
                    />
                    <Text style={[type.display1, tabularNums, styles.reverseCount]}>{reverseCounts[row.id] ?? 0}</Text>
                    <StepperButton
                      label={strings.setInputStepperPlus}
                      onPress={() => handleReverseStep(row, 1)}
                      size={size.minTouchTarget}
                    />
                  </View>
                ))}

                <Text style={[type.caption, styles.fieldLabel]}>{strings.plateCalcReverseTotalLabel}</Text>
                <Text style={[type.display2, styles.achievedText]}>{reverseTotal ?? 0} kg</Text>

                <Pressable style={styles.primaryTouch} onPress={() => handleApply(reverseTotal ?? 0)}>
                  <Text style={[type.label, styles.primaryLabel]}>{strings.plateCalcApplyButton}</Text>
                </Pressable>
              </View>
            ) : null}

            <View style={styles.section}>
              <Text style={[type.caption, styles.fieldLabel]}>{strings.plateCalcInventoryToggle}</Text>
              {sortedInventory.map((row) => (
                <View key={row.id} style={styles.inventoryRow}>
                  <View style={[styles.plateBlock, { backgroundColor: row.colourHex }]}>
                    <Text style={[type.caption, styles.plateBlockLabel]}>{row.denominationKg}</Text>
                  </View>
                  <Text style={[type.caption, styles.fieldLabel]}>{strings.plateCalcInventoryQuantityLabel}</Text>
                  <StepperButton
                    label={strings.setInputStepperMinus}
                    onPress={() => handleQuantityStep(row, -1)}
                    size={size.minTouchTarget}
                  />
                  <Text style={[type.display1, tabularNums, styles.reverseCount]}>{row.quantityPerSide}</Text>
                  <StepperButton
                    label={strings.setInputStepperPlus}
                    onPress={() => handleQuantityStep(row, 1)}
                    size={size.minTouchTarget}
                  />
                </View>
              ))}
            </View>
          </ScrollView>
        )}
      </SafeAreaView>

      <NumericKeypad
        visible={targetKeypadOpen}
        label={strings.plateCalcTargetLabel}
        allowDecimal
        onConfirm={handleTargetConfirm}
        onCancel={() => setTargetKeypadOpen(false)}
      />
      <NumericKeypad
        visible={barWeightKeypadOpen}
        label={strings.plateCalcBarWeightLabel}
        allowDecimal
        onConfirm={handleSetBarWeight}
        onCancel={() => setBarWeightKeypadOpen(false)}
      />
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
    flexShrink: 1,
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
  blockedBox: {
    padding: size.listRowPadding,
    gap: 16,
  },
  blockedHeading: {
    color: color.textPrimary,
  },
  blockedBody: {
    color: color.textMuted,
  },
  content: {
    paddingHorizontal: size.listRowPadding,
    paddingBottom: 32,
  },
  tabRow: {
    flexDirection: 'row',
    marginTop: 16,
  },
  tabTouch: {
    flex: 1,
    minHeight: size.minTouchTarget,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabActive: {
    color: color.slabSecondary,
  },
  tabInactive: {
    color: color.textMuted,
  },
  section: {
    marginTop: 16,
    gap: 8,
  },
  fieldLabel: {
    color: color.textMuted,
  },
  targetValue: {
    color: color.textPrimary,
  },
  mutedText: {
    color: color.textMuted,
  },
  plateRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  plateGroup: {
    flexDirection: 'row',
    gap: 4,
  },
  plateBlock: {
    width: 48,
    height: size.warmupToggle,
    alignItems: 'center',
    justifyContent: 'center',
  },
  plateBlockLabel: {
    color: color.onSlab,
  },
  achievedText: {
    color: color.textPrimary,
  },
  deltaText: {
    color: color.slabPrimary,
  },
  reverseRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  reverseCount: {
    color: color.textPrimary,
    minWidth: 40,
    textAlign: 'center',
  },
  inventoryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  primaryTouch: {
    minHeight: size.minTouchTarget,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: color.slabPrimary,
    marginTop: 8,
  },
  primaryLabel: {
    color: color.onSlab,
  },
});
