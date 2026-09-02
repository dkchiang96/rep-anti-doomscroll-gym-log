import { Pressable, StyleSheet, Text, View } from 'react-native';

import { strings } from '@/strings';
import { color, size, tabularNums, type } from '@/theme';

import { StepperButton } from './StepperButton';

// DESIGN-SPEC.md §5.7 — the transition-screen set row. Ghost values (last
// session's) render text-muted; confirmed values render text-primary.

type SetInputRowProps = {
  setLabel: string;
  weightKg: number;
  reps: number;
  confirmed: boolean;
  warmup?: boolean;
  onWeightStep: (direction: 1 | -1) => void;
  onRepsStep: (direction: 1 | -1) => void;
  onToggleWarmup?: () => void;
};

export function SetInputRow({
  setLabel,
  weightKg,
  reps,
  confirmed,
  warmup = false,
  onWeightStep,
  onRepsStep,
  onToggleWarmup,
}: SetInputRowProps) {
  const valueColor = confirmed ? color.textPrimary : color.textMuted;

  return (
    <View style={styles.root}>
      <View style={styles.headerRow}>
        <Text style={[type.caption, styles.headerLabel]}>{setLabel}</Text>
        <Text style={[type.caption, styles.headerLabel]}>{strings.setInputWeightHeading}</Text>
        <Text style={[type.caption, styles.headerLabel]}>{strings.setInputRepsHeading}</Text>
      </View>
      <View style={styles.controlsRow}>
        <Pressable
          onPress={onToggleWarmup}
          disabled={!onToggleWarmup}
          style={[styles.warmupToggle, warmup ? styles.warmupToggleOn : null]}
        >
          <Text style={[type.label, { color: warmup ? color.onSlab : color.textPrimary }]}>
            {strings.setInputWarmupGlyph}
          </Text>
        </Pressable>

        <View style={styles.group}>
          <StepperButton label={strings.setInputStepperMinus} onPress={() => onWeightStep(-1)} size={size.stepper} />
          <Text style={[type.display1, tabularNums, styles.value, { color: valueColor }]} numberOfLines={1}>
            {weightKg}
          </Text>
          <StepperButton label={strings.setInputStepperPlus} onPress={() => onWeightStep(1)} size={size.stepper} />
        </View>

        <View style={styles.group}>
          <StepperButton label={strings.setInputStepperMinus} onPress={() => onRepsStep(-1)} size={size.stepper} />
          <Text style={[type.display1, tabularNums, styles.value, { color: valueColor }]} numberOfLines={1}>
            {reps}
          </Text>
          <StepperButton label={strings.setInputStepperPlus} onPress={() => onRepsStep(1)} size={size.stepper} />
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
  value: {
    flex: 1,
    textAlign: 'center',
  },
  divider: {
    marginTop: 8,
    height: size.divider,
    backgroundColor: color.divider,
  },
});
