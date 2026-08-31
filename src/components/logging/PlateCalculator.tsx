import { useMemo, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { updateExercise } from '@/data/repositories/exerciseRepository';
import {
  createPlateInventory,
  softDeletePlateInventory,
  updatePlateInventory,
} from '@/data/repositories/plateInventoryRepository';
import type { plateInventory } from '@/data/schema';
import type { AppDatabase } from '@/data/types';
import { calculatePlatesForTarget, calculateTotalFromPlates, type PlateConvention } from '@/domain/plates';
import { strings } from '@/strings';
import { theme } from '@/theme';

import { NumericKeypad } from './NumericKeypad';
import { Stepper } from './Stepper';

type PlateInventoryRow = typeof plateInventory.$inferSelect;

interface PlateCalculatorProps {
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
}

type Mode = 'forward' | 'reverse';

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
  const [inventoryEditorOpen, setInventoryEditorOpen] = useState(false);
  const [newDenomKg, setNewDenomKg] = useState('');
  const [newDenomColour, setNewDenomColour] = useState('');

  const activeInventory = useMemo(
    () =>
      inventory
        .filter((p) => p.isActive)
        .map((p) => ({ denominationKg: p.denominationKg, colourHex: p.colourHex, quantityPerSide: p.quantityPerSide })),
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
    setInventoryEditorOpen(false);
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

  function handleRemoveDenomination(row: PlateInventoryRow) {
    void softDeletePlateInventory(db, userId, row.id).then(() => {
      onInventoryChanged(inventory.filter((p) => p.id !== row.id));
    });
  }

  function handleAddDenomination() {
    const kg = Number(newDenomKg);
    const colour = newDenomColour.trim();
    if (!Number.isFinite(kg) || kg <= 0 || colour.length === 0) return;
    void createPlateInventory(db, {
      userId,
      gymLabel: 'default',
      denominationKg: kg,
      colourHex: colour,
      quantityPerSide: 0,
      isActive: true,
    }).then((created) => {
      if (created) {
        onInventoryChanged([...inventory, created]);
        setNewDenomKg('');
        setNewDenomColour('');
      }
    });
  }

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={handleClose}>
      <View style={styles.backdrop}>
        <View style={styles.sheet}>
          <ScrollView>
            <View style={styles.headerRow}>
              <Text style={styles.title}>{exerciseName}</Text>
              <Pressable onPress={handleClose}>
                <Text style={styles.closeLabel}>{strings.plateCalcClose}</Text>
              </Pressable>
            </View>

            {barWeightKg == null ? (
              <View style={styles.blockedBox}>
                <Text style={styles.blockedHeading}>{strings.plateCalcBarWeightRequiredHeading}</Text>
                <Text style={styles.blockedBody}>{strings.plateCalcBarWeightRequiredBody}</Text>
                <Pressable style={styles.primaryButton} onPress={() => setBarWeightKeypadOpen(true)}>
                  <Text style={styles.primaryButtonLabel}>{strings.plateCalcSetBarWeightButton}</Text>
                </Pressable>
              </View>
            ) : (
              <>
                <View style={styles.tabRow}>
                  <Pressable
                    style={[styles.tab, mode === 'forward' && styles.tabActive]}
                    onPress={() => setMode('forward')}>
                    <Text style={[styles.tabLabel, mode === 'forward' && styles.tabLabelActive]}>
                      {strings.plateCalcForwardTab}
                    </Text>
                  </Pressable>
                  <Pressable
                    style={[styles.tab, mode === 'reverse' && styles.tabActive]}
                    onPress={() => setMode('reverse')}>
                    <Text style={[styles.tabLabel, mode === 'reverse' && styles.tabLabelActive]}>
                      {strings.plateCalcReverseTab}
                    </Text>
                  </Pressable>
                </View>

                {mode === 'forward' && forwardResult ? (
                  <View style={styles.section}>
                    <Text style={styles.fieldLabel}>{strings.plateCalcTargetLabel}</Text>
                    <Pressable onPress={() => setTargetKeypadOpen(true)}>
                      <Text style={styles.targetValue}>{target}</Text>
                    </Pressable>

                    <Text style={styles.fieldLabel}>{strings.plateCalcPerSideHeading}</Text>
                    {forwardResult.platesPerSide.length === 0 ? (
                      <Text style={styles.mutedText}>{strings.plateCalcNoPlatesConfigured}</Text>
                    ) : (
                      <View style={styles.chipRow}>
                        {forwardResult.platesPerSide.map((p) => (
                          <View key={p.denominationKg} style={styles.plateChipGroup}>
                            {Array.from({ length: p.count }).map((_, i) => (
                              <View
                                key={i}
                                style={[styles.plateChip, { backgroundColor: p.colourHex }]}
                                accessibilityLabel={`${p.denominationKg}kg`}>
                                <Text style={styles.plateChipLabel}>{p.denominationKg}</Text>
                              </View>
                            ))}
                          </View>
                        ))}
                      </View>
                    )}

                    <Text style={styles.achievedText}>{strings.plateCalcAchievedLabel(forwardResult.achievedTotalKg)}</Text>
                    {forwardResult.deltaKg !== 0 ? (
                      <Text style={styles.deltaText}>{strings.plateCalcDeltaLabel(forwardResult.deltaKg)}</Text>
                    ) : null}

                    <Pressable
                      style={styles.primaryButton}
                      onPress={() => handleApply(forwardResult.achievedTotalKg)}>
                      <Text style={styles.primaryButtonLabel}>{strings.plateCalcApplyButton}</Text>
                    </Pressable>
                  </View>
                ) : null}

                {mode === 'reverse' ? (
                  <View style={styles.section}>
                    <View style={styles.chipRow}>
                      {inventory
                        .filter((p) => p.isActive)
                        .sort((a, b) => b.denominationKg - a.denominationKg)
                        .map((row) => (
                          <View key={row.id} style={styles.reverseRow}>
                            <View style={[styles.plateChip, { backgroundColor: row.colourHex }]}>
                              <Text style={styles.plateChipLabel}>{row.denominationKg}</Text>
                            </View>
                            <Stepper
                              value={String(reverseCounts[row.id] ?? 0)}
                              onStep={(dir) => handleReverseStep(row, dir)}
                              onTapValue={() => {}}
                            />
                          </View>
                        ))}
                    </View>

                    <Text style={styles.fieldLabel}>{strings.plateCalcReverseTotalLabel}</Text>
                    <Text style={styles.achievedText}>{reverseTotal ?? 0} kg</Text>

                    <Pressable style={styles.primaryButton} onPress={() => handleApply(reverseTotal ?? 0)}>
                      <Text style={styles.primaryButtonLabel}>{strings.plateCalcApplyButton}</Text>
                    </Pressable>
                  </View>
                ) : null}

                <Pressable style={styles.inventoryToggle} onPress={() => setInventoryEditorOpen((v) => !v)}>
                  <Text style={styles.inventoryToggleLabel}>{strings.plateCalcInventoryToggle}</Text>
                </Pressable>

                {inventoryEditorOpen ? (
                  <View style={styles.section}>
                    {inventory
                      .sort((a, b) => b.denominationKg - a.denominationKg)
                      .map((row) => (
                        <View key={row.id} style={styles.inventoryRow}>
                          <View style={[styles.plateChip, { backgroundColor: row.colourHex }]}>
                            <Text style={styles.plateChipLabel}>{row.denominationKg}</Text>
                          </View>
                          <Text style={styles.fieldLabel}>{strings.plateCalcInventoryQuantityLabel}</Text>
                          <Stepper
                            value={String(row.quantityPerSide)}
                            onStep={(dir) => handleQuantityStep(row, dir)}
                            onTapValue={() => {}}
                          />
                          <Pressable onPress={() => handleRemoveDenomination(row)}>
                            <Text style={styles.removeLabel}>{strings.plateCalcInventoryRemoveButton}</Text>
                          </Pressable>
                        </View>
                      ))}

                    <Text style={styles.fieldLabel}>{strings.plateCalcInventoryAddHeading}</Text>
                    <View style={styles.addRow}>
                      <TextInput
                        style={styles.addInput}
                        placeholder={strings.plateCalcInventoryKgPlaceholder}
                        placeholderTextColor={theme.color.textMuted}
                        keyboardType="decimal-pad"
                        value={newDenomKg}
                        onChangeText={setNewDenomKg}
                      />
                      <TextInput
                        style={styles.addInput}
                        placeholder={strings.plateCalcInventoryColourPlaceholder}
                        placeholderTextColor={theme.color.textMuted}
                        value={newDenomColour}
                        onChangeText={setNewDenomColour}
                      />
                      <Pressable style={styles.smallButton} onPress={handleAddDenomination}>
                        <Text style={styles.smallButtonLabel}>{strings.plateCalcInventoryAddButton}</Text>
                      </Pressable>
                    </View>
                  </View>
                ) : null}
              </>
            )}
          </ScrollView>
        </View>
      </View>

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
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'flex-end',
  },
  sheet: {
    maxHeight: '85%',
    backgroundColor: theme.color.surface,
    padding: 20,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    gap: 12,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  title: {
    color: theme.color.textPrimary,
    fontSize: 18,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
  closeLabel: {
    color: theme.color.textMuted,
    fontSize: 14,
  },
  blockedBox: {
    gap: 10,
    paddingVertical: 12,
  },
  blockedHeading: {
    color: theme.color.accentPrimary,
    fontSize: 15,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
  blockedBody: {
    color: theme.color.textMuted,
    fontSize: 14,
  },
  tabRow: {
    flexDirection: 'row',
    gap: 8,
  },
  tab: {
    flex: 1,
    minHeight: 44,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: theme.color.textMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabActive: {
    backgroundColor: theme.color.accentPrimary,
    borderColor: theme.color.accentPrimary,
  },
  tabLabel: {
    color: theme.color.textMuted,
    fontSize: 13,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  tabLabelActive: {
    color: theme.color.bg,
  },
  section: {
    gap: 10,
    paddingVertical: 8,
  },
  fieldLabel: {
    color: theme.color.textMuted,
    fontSize: 11,
    textTransform: 'uppercase',
  },
  targetValue: {
    color: theme.color.accentPrimary,
    fontSize: 40,
    fontWeight: '800',
    fontVariant: ['tabular-nums'],
  },
  mutedText: {
    color: theme.color.textMuted,
    fontSize: 14,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  plateChipGroup: {
    flexDirection: 'row',
    gap: 4,
  },
  plateChip: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: theme.color.textMuted,
  },
  plateChipLabel: {
    color: theme.color.bg,
    fontSize: 11,
    fontWeight: '800',
  },
  achievedText: {
    color: theme.color.accentSecondary,
    fontSize: 22,
    fontWeight: '800',
  },
  deltaText: {
    color: theme.color.accentPrimary,
    fontSize: 13,
    fontWeight: '700',
  },
  reverseRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  inventoryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  removeLabel: {
    color: theme.color.textMuted,
    fontSize: 12,
    textDecorationLine: 'underline',
  },
  addRow: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
  },
  addInput: {
    flex: 1,
    minHeight: 44,
    borderRadius: 8,
    backgroundColor: theme.color.bg,
    color: theme.color.textPrimary,
    paddingHorizontal: 10,
    fontSize: 14,
  },
  smallButton: {
    minHeight: 44,
    borderRadius: 8,
    backgroundColor: theme.color.accentPrimary,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 14,
  },
  smallButtonLabel: {
    color: theme.color.bg,
    fontSize: 13,
    fontWeight: '800',
  },
  inventoryToggle: {
    minHeight: 40,
    justifyContent: 'center',
  },
  inventoryToggleLabel: {
    color: theme.color.textMuted,
    fontSize: 13,
    textDecorationLine: 'underline',
  },
  primaryButton: {
    minHeight: theme.minTouchTarget,
    borderRadius: 12,
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
});
