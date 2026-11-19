import { useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { SetInputRow, Slab } from '@/components/ui';
import { deriveSplitLoadDisplay, type EquipmentType } from '@/domain/loadConvention';
import type { Side } from '@/domain/sidePairs';
import { strings } from '@/strings';
import { color, size, type } from '@/theme';

import { NumericKeypad } from './NumericKeypad';

// Left/right tracking for one set (src/domain/sidePairs.ts). Opened only
// from a set row's L / R button, so the logging screen itself never changes
// for the usual even-sided set. Every change is written the moment it
// happens (invariant 1) by the parent's handlers — "Back to sets" only
// closes this screen; there is nothing to save. Untouched, nothing is
// written and the set stays one shared value.

export type SideField = 'weight' | 'reps';

type SideValues = { weightKg: number; reps: number };

type SideSplitScreenProps = {
  visible: boolean;
  setLabel: string;
  left: SideValues;
  right: SideValues;
  /** True once the set is actually stored as a left/right pair. */
  isSplit: boolean;
  /** Ghost (not yet committed) values render muted, same as the logging screen. */
  confirmed: boolean;
  equipmentType: EquipmentType;
  onStep: (side: Side, field: SideField, direction: 1 | -1) => void;
  onSetValue: (side: Side, field: SideField, value: number) => void;
  onJoin: () => void;
  onClose: () => void;
};

export function SideSplitScreen({
  visible,
  setLabel,
  left,
  right,
  isSplit,
  confirmed,
  equipmentType,
  onStep,
  onSetValue,
  onJoin,
  onClose,
}: SideSplitScreenProps) {
  const [keypadTarget, setKeypadTarget] = useState<{ side: Side; field: SideField } | null>(null);
  const display = deriveSplitLoadDisplay(equipmentType, left.weightKg, right.weightKg);

  function handleKeypadConfirm(value: number) {
    const target = keypadTarget;
    setKeypadTarget(null);
    if (target) onSetValue(target.side, target.field, value);
  }

  function renderSide(side: Side, values: SideValues) {
    return (
      <SetInputRow
        setLabel={side === 'left' ? strings.sideSplitLeftLabel : strings.sideSplitRightLabel}
        weightKg={values.weightKg}
        reps={values.reps}
        confirmed={confirmed || isSplit}
        conventionLabel={display.conventionLabel}
        totalLine={display.totalLine}
        onWeightStep={(d) => onStep(side, 'weight', d)}
        onRepsStep={(d) => onStep(side, 'reps', d)}
        onTapWeight={() => setKeypadTarget({ side, field: 'weight' })}
        onTapReps={() => setKeypadTarget({ side, field: 'reps' })}
      />
    );
  }

  return (
    <Modal visible={visible} transparent={false} animationType="slide" onRequestClose={onClose}>
      <SafeAreaView style={styles.root} edges={['top', 'bottom']}>
        <View style={styles.header}>
          <Text style={[type.heading, styles.title]} numberOfLines={1}>
            {strings.sideSplitTitle(setLabel)}
          </Text>
          <Text style={[type.caption, styles.hint]}>{strings.sideSplitHint}</Text>
        </View>

        <ScrollView style={styles.list}>
          {renderSide('left', left)}
          {renderSide('right', right)}

          {isSplit ? (
            <Pressable style={styles.joinTouch} onPress={onJoin}>
              <Text style={[type.label, styles.joinLabel]}>{strings.sideSplitJoinButton}</Text>
            </Pressable>
          ) : null}
        </ScrollView>

        <Pressable style={styles.backTouch} onPress={onClose}>
          <Slab tone="primary" height={size.bottomSlab}>
            <Text style={[type.label, styles.onSlabText]}>{strings.sideSplitBackButton}</Text>
          </Slab>
        </Pressable>
      </SafeAreaView>

      <NumericKeypad
        visible={keypadTarget != null}
        label={keypadTarget?.field === 'reps' ? strings.keypadRepsLabel : strings.keypadWeightLabel}
        allowDecimal={keypadTarget?.field !== 'reps'}
        onConfirm={handleKeypadConfirm}
        onCancel={() => setKeypadTarget(null)}
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
    paddingHorizontal: 24,
    paddingVertical: 12,
    backgroundColor: color.bar,
  },
  title: {
    color: color.textPrimary,
  },
  hint: {
    color: color.textMuted,
    marginTop: 4,
  },
  list: {
    flex: 1,
  },
  joinTouch: {
    minHeight: size.minTouchTarget,
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  joinLabel: {
    color: color.slabSecondary,
  },
  backTouch: {
    width: '100%',
  },
  onSlabText: {
    color: color.onSlab,
    textAlign: 'center',
  },
});
