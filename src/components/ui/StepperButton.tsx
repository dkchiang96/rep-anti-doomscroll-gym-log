import { Pressable, StyleSheet, Text } from 'react-native';

import { color, type } from '@/theme';

// Shared square stepper glyph button — DESIGN-SPEC.md §5.7's set-row steppers
// (72dp) and the live-screen sets-done stepper (56dp) are the same visual
// primitive at two sizes. No borderRadius — see §4's banned-outright list.

type StepperButtonProps = {
  label: string;
  onPress: () => void;
  size: number;
};

export function StepperButton({ label, onPress, size }: StepperButtonProps) {
  return (
    <Pressable onPress={onPress} style={[styles.stepper, { width: size, height: size }]} hitSlop={4}>
      <Text style={[type.heading, styles.glyph]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  stepper: {
    borderWidth: 2,
    borderColor: color.divider,
    alignItems: 'center',
    justifyContent: 'center',
  },
  glyph: {
    color: color.textPrimary,
  },
});
