import { useCallback, useRef } from 'react';
import { Pressable, StyleSheet, Text } from 'react-native';

import { useInstrumentationStore } from '@/state/instrumentationStore';
import { color, type } from '@/theme';

// Shared square stepper glyph button — DESIGN-SPEC.md §5.7's set-row steppers
// (72dp) and the live-screen sets-done stepper (56dp) are the same visual
// primitive at two sizes. No borderRadius — see §4's banned-outright list.
//
// §5.7: "Long-press: Accelerates in two stages." A short tap still fires
// once via onPress; holding past HOLD_DELAY_MS starts a repeat at
// SLOW_INTERVAL_MS, which speeds up to FAST_INTERVAL_MS after
// ACCELERATE_AFTER_MS of holding.

const HOLD_DELAY_MS = 350;
const SLOW_INTERVAL_MS = 220;
const ACCELERATE_AFTER_MS = 1200;
const FAST_INTERVAL_MS = 80;

type StepperButtonProps = {
  label: string;
  onPress: () => void;
  size: number;
  disabled?: boolean;
};

export function StepperButton({ label, onPress, size, disabled = false }: StepperButtonProps) {
  const holdTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const repeatInterval = useRef<ReturnType<typeof setInterval> | null>(null);
  const accelerateTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isRepeating = useRef(false);
  const recordTap = useInstrumentationStore((s) => s.recordTap);

  const firePress = useCallback(() => {
    recordTap();
    onPress();
  }, [onPress, recordTap]);

  const clearTimers = useCallback(() => {
    if (holdTimeout.current) clearTimeout(holdTimeout.current);
    if (repeatInterval.current) clearInterval(repeatInterval.current);
    if (accelerateTimeout.current) clearTimeout(accelerateTimeout.current);
    holdTimeout.current = null;
    repeatInterval.current = null;
    accelerateTimeout.current = null;
  }, []);

  const handlePressIn = useCallback(() => {
    if (disabled) return;
    isRepeating.current = false;
    clearTimers();
    holdTimeout.current = setTimeout(() => {
      isRepeating.current = true;
      repeatInterval.current = setInterval(firePress, SLOW_INTERVAL_MS);
      accelerateTimeout.current = setTimeout(() => {
        if (repeatInterval.current) clearInterval(repeatInterval.current);
        repeatInterval.current = setInterval(firePress, FAST_INTERVAL_MS);
      }, ACCELERATE_AFTER_MS);
    }, HOLD_DELAY_MS);
  }, [clearTimers, disabled, firePress]);

  const handlePressOut = useCallback(() => {
    clearTimers();
  }, [clearTimers]);

  const handlePress = useCallback(() => {
    if (disabled) return;
    if (!isRepeating.current) firePress();
    isRepeating.current = false;
  }, [disabled, firePress]);

  return (
    <Pressable
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      onPress={handlePress}
      disabled={disabled}
      style={[styles.stepper, { width: size, height: size }, disabled ? styles.disabled : null]}
      hitSlop={4}
    >
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
  disabled: {
    opacity: 0.4,
  },
  glyph: {
    color: color.textPrimary,
  },
});
