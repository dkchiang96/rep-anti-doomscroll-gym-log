import { Pressable, StyleSheet, Text, View } from 'react-native';

import type { SetType } from '@/domain/ghostPrefill';
import { strings } from '@/strings';
import { theme } from '@/theme';

import { Stepper } from './Stepper';

interface SetRowProps {
  displayIndex: string;
  weightKg: number;
  reps: number;
  setType: SetType;
  isGhost: boolean;
  isDropSet: boolean;
  disabled?: boolean;
  conventionLabel: string;
  totalLine: string | null;
  weightStep: number;
  /** FR-5.7: a faint programme target shown only on the active (next-to-fill) row. */
  targetLabel?: string | null;
  onWeightChange: (newWeight: number) => void;
  onRepsChange: (newReps: number) => void;
  onToggleWarmup: () => void;
  onConfirm: () => void;
  onOpenKeypad: (field: 'weight' | 'reps') => void;
  onAddDropSet?: () => void;
}

function formatWeight(kg: number): string {
  return (Math.round(kg * 100) / 100).toString();
}

export function SetRow({
  displayIndex,
  weightKg,
  reps,
  setType,
  isGhost,
  isDropSet,
  disabled,
  conventionLabel,
  totalLine,
  weightStep,
  targetLabel,
  onWeightChange,
  onRepsChange,
  onToggleWarmup,
  onConfirm,
  onOpenKeypad,
  onAddDropSet,
}: SetRowProps) {
  const isWarmup = setType === 'warmup';

  return (
    <View style={[styles.container, isDropSet && styles.dropSetIndent]}>
      <View style={[styles.row, isGhost && styles.rowGhost]}>
        <Pressable
          style={[styles.warmupToggle, isWarmup && styles.warmupToggleActive]}
          disabled={disabled}
          onPress={onToggleWarmup}
          accessibilityLabel={strings.setWarmupToggle}>
          <Text style={[styles.warmupToggleLabel, isWarmup && styles.warmupToggleLabelActive]}>W</Text>
        </Pressable>

        <Text style={[styles.setIndex, isGhost && styles.mutedText]}>{displayIndex}</Text>

        <View style={styles.weightBlock}>
          <Stepper
            value={formatWeight(weightKg)}
            disabled={disabled}
            onStep={(dir) => onWeightChange(Math.max(0, weightKg + dir * weightStep))}
            onTapValue={() => onOpenKeypad('weight')}
          />
          <Text style={[styles.conventionLabel, isGhost && styles.mutedText]}>{conventionLabel}</Text>
          {totalLine ? <Text style={[styles.totalLine, isGhost && styles.mutedText]}>{totalLine}</Text> : null}
        </View>

        <View>
          <Stepper
            value={String(reps)}
            disabled={disabled}
            onStep={(dir) => onRepsChange(Math.max(0, reps + dir))}
            onTapValue={() => onOpenKeypad('reps')}
            unitLabel={strings.setRepsUnit}
          />
          {targetLabel ? <Text style={styles.targetLabel}>{targetLabel}</Text> : null}
        </View>

        {isGhost && !disabled ? (
          <Pressable style={styles.confirmButton} onPress={onConfirm} accessibilityLabel={strings.setConfirm}>
            <Text style={styles.confirmLabel}>✓</Text>
          </Pressable>
        ) : null}
      </View>

      {!isGhost && setType === 'working' && onAddDropSet ? (
        <Pressable style={styles.addDropSetButton} onPress={onAddDropSet}>
          <Text style={styles.addDropSetLabel}>{strings.setAddDropSet}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 4,
  },
  dropSetIndent: {
    marginLeft: 28,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: theme.color.surface,
    borderRadius: 12,
    padding: 8,
  },
  rowGhost: {
    opacity: 0.55,
  },
  warmupToggle: {
    width: 36,
    height: 36,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: theme.color.textMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  warmupToggleActive: {
    backgroundColor: theme.color.textMuted,
  },
  warmupToggleLabel: {
    color: theme.color.textMuted,
    fontWeight: '800',
  },
  warmupToggleLabelActive: {
    color: theme.color.bg,
  },
  setIndex: {
    color: theme.color.textPrimary,
    fontWeight: '700',
    width: 18,
    textAlign: 'center',
  },
  mutedText: {
    color: theme.color.textMuted,
  },
  weightBlock: {
    alignItems: 'center',
  },
  conventionLabel: {
    color: theme.color.accentSecondary,
    fontSize: 10,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  totalLine: {
    color: theme.color.textMuted,
    fontSize: 11,
  },
  targetLabel: {
    color: theme.color.textMuted,
    fontSize: 10,
    textAlign: 'center',
    opacity: 0.7,
  },
  confirmButton: {
    width: theme.minTouchTarget,
    height: theme.minTouchTarget,
    borderRadius: theme.minTouchTarget / 2,
    backgroundColor: theme.color.accentPrimary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  confirmLabel: {
    color: theme.color.bg,
    fontSize: 22,
    fontWeight: '800',
  },
  addDropSetButton: {
    alignSelf: 'flex-start',
    paddingVertical: 4,
    paddingHorizontal: 8,
  },
  addDropSetLabel: {
    color: theme.color.textMuted,
    fontSize: 12,
    textDecorationLine: 'underline',
  },
});
