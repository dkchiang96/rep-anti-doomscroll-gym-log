import { Pressable, StyleSheet, Text, View } from 'react-native';

import { strings } from '@/strings';
import { color, size, tabularNums, type } from '@/theme';

import { StepperButton } from './StepperButton';

// DESIGN-SPEC.md §5.7 — the transition-screen set row. Ghost values (last
// session's) render text-muted; confirmed values render text-primary.
// Invariant 8: conventionLabel/totalLine are always visible, never optional —
// this is a data-integrity control, not decoration.

type SetInputRowProps = {
  setLabel: string;
  weightKg: number;
  reps: number;
  confirmed: boolean;
  warmup?: boolean;
  disabled?: boolean;
  /** Indents the row under its parent working set — DESIGN-SPEC.md §3.8's drop-set attachment. */
  indent?: boolean;
  conventionLabel: string;
  totalLine?: string | null;
  onWeightStep: (direction: 1 | -1) => void;
  onRepsStep: (direction: 1 | -1) => void;
  onToggleWarmup?: () => void;
  /** Tapping the numeral opens a full-width keypad (or the plate calculator) per §5.7. */
  onTapWeight?: () => void;
  onTapReps?: () => void;
  onAddDropSet?: () => void;
  onRemove?: () => void;
};

export function SetInputRow({
  setLabel,
  weightKg,
  reps,
  confirmed,
  warmup = false,
  disabled = false,
  indent = false,
  conventionLabel,
  totalLine,
  onWeightStep,
  onRepsStep,
  onToggleWarmup,
  onTapWeight,
  onTapReps,
  onAddDropSet,
  onRemove,
}: SetInputRowProps) {
  const valueColor = confirmed ? color.textPrimary : color.textMuted;

  return (
    <View style={[styles.root, indent ? styles.indent : null, disabled ? styles.disabled : null]}>
      <View style={styles.headerRow}>
        <Text style={[type.caption, styles.headerLabel]}>{setLabel}</Text>
        <Text style={[type.caption, styles.headerLabel]}>{strings.setInputWeightHeading}</Text>
        <Text style={[type.caption, styles.headerLabel]}>{strings.setInputRepsHeading}</Text>
      </View>
      <View style={styles.controlsRow}>
        <Pressable
          onPress={onToggleWarmup}
          disabled={!onToggleWarmup || disabled}
          style={[styles.warmupToggle, warmup ? styles.warmupToggleOn : null]}
        >
          <Text style={[type.label, { color: warmup ? color.onSlab : color.textPrimary }]}>
            {strings.setInputWarmupGlyph}
          </Text>
        </Pressable>

        <View style={styles.group}>
          <StepperButton
            label={strings.setInputStepperMinus}
            onPress={() => onWeightStep(-1)}
            size={size.stepper}
            disabled={disabled}
          />
          <Pressable onPress={onTapWeight} disabled={!onTapWeight || disabled} style={styles.valueTouch}>
            <Text style={[type.display1, tabularNums, styles.value, { color: valueColor }]} numberOfLines={1}>
              {weightKg}
            </Text>
          </Pressable>
          <StepperButton
            label={strings.setInputStepperPlus}
            onPress={() => onWeightStep(1)}
            size={size.stepper}
            disabled={disabled}
          />
        </View>

        <View style={styles.group}>
          <StepperButton
            label={strings.setInputStepperMinus}
            onPress={() => onRepsStep(-1)}
            size={size.stepper}
            disabled={disabled}
          />
          <Pressable onPress={onTapReps} disabled={!onTapReps || disabled} style={styles.valueTouch}>
            <Text style={[type.display1, tabularNums, styles.value, { color: valueColor }]} numberOfLines={1}>
              {reps}
            </Text>
          </Pressable>
          <StepperButton
            label={strings.setInputStepperPlus}
            onPress={() => onRepsStep(1)}
            size={size.stepper}
            disabled={disabled}
          />
        </View>
      </View>

      <View style={styles.metaRow}>
        <Text style={[type.caption, styles.conventionLabel]} numberOfLines={1}>
          {conventionLabel}
          {totalLine ? ` · ${totalLine}` : ''}
        </Text>
        <View style={styles.rowActions}>
          {onAddDropSet ? (
            <Pressable onPress={onAddDropSet} style={styles.rowActionTouch}>
              <Text style={[type.caption, styles.rowActionLabel]}>{strings.transitionAddDropSetButton}</Text>
            </Pressable>
          ) : null}
          {onRemove ? (
            <Pressable onPress={onRemove} style={styles.rowActionTouch}>
              <Text style={[type.caption, styles.rowActionLabel]}>{strings.transitionRemoveSetButton}</Text>
            </Pressable>
          ) : null}
        </View>
      </View>

      <View style={styles.divider} />
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    minHeight: size.setRow,
    paddingHorizontal: 24,
    paddingVertical: 8,
    justifyContent: 'center',
  },
  indent: {
    paddingLeft: 48,
  },
  disabled: {
    opacity: 0.5,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  headerLabel: {
    color: color.textMuted,
  },
  controlsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
    gap: 8,
  },
  warmupToggle: {
    width: size.warmupToggle,
    height: size.warmupToggle,
    borderWidth: 2,
    borderColor: color.divider,
    alignItems: 'center',
    justifyContent: 'center',
  },
  warmupToggleOn: {
    backgroundColor: color.slabSecondary,
    borderColor: color.slabSecondary,
  },
  group: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  valueTouch: {
    flex: 1,
    minHeight: size.minTouchTarget,
    alignItems: 'center',
    justifyContent: 'center',
  },
  value: {
    textAlign: 'center',
  },
  metaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 4,
  },
  conventionLabel: {
    color: color.textMuted,
    flexShrink: 1,
  },
  rowActions: {
    flexDirection: 'row',
    gap: 16,
  },
  rowActionTouch: {
    minHeight: size.minTouchTarget,
    justifyContent: 'center',
  },
  rowActionLabel: {
    color: color.slabSecondary,
  },
  divider: {
    marginTop: 8,
    height: size.divider,
    backgroundColor: color.divider,
  },
});
