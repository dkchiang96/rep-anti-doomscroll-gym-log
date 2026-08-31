import { useCallback, useRef } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { theme } from '@/theme';

const HOLD_DELAY_MS = 350;
const FAST_INTERVAL_MS = 80;
const ACCELERATE_AFTER_MS = 1200;
const SLOW_INTERVAL_MS = 220;

interface StepperProps {
  value: string;
  onStep: (direction: 1 | -1) => void;
  onTapValue: () => void;
  unitLabel?: string;
  disabled?: boolean;
}

function useHoldRepeat(onStep: (direction: 1 | -1) => void) {
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const accelerateTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const repeatingRef = useRef(false);

  const clearAll = useCallback(() => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    if (intervalRef.current) clearInterval(intervalRef.current);
    if (accelerateTimeoutRef.current) clearTimeout(accelerateTimeoutRef.current);
    timeoutRef.current = null;
    intervalRef.current = null;
    accelerateTimeoutRef.current = null;
  }, []);

  const start = useCallback(
    (direction: 1 | -1) => {
      repeatingRef.current = false;
      clearAll();
      timeoutRef.current = setTimeout(() => {
        repeatingRef.current = true;
        intervalRef.current = setInterval(() => onStep(direction), SLOW_INTERVAL_MS);
        accelerateTimeoutRef.current = setTimeout(() => {
          if (intervalRef.current) clearInterval(intervalRef.current);
          intervalRef.current = setInterval(() => onStep(direction), FAST_INTERVAL_MS);
        }, ACCELERATE_AFTER_MS);
      }, HOLD_DELAY_MS);
    },
    [clearAll, onStep],
  );

  const stop = useCallback(() => {
    clearAll();
  }, [clearAll]);

  const tap = useCallback(
    (direction: 1 | -1) => {
      if (!repeatingRef.current) onStep(direction);
      repeatingRef.current = false;
    },
    [onStep],
  );

  return { start, stop, tap };
}

export function Stepper({ value, onStep, onTapValue, unitLabel, disabled }: StepperProps) {
  const { start, stop, tap } = useHoldRepeat(onStep);

  return (
    <View style={styles.row}>
      <Pressable
        style={[styles.button, disabled && styles.buttonDisabled]}
        disabled={disabled}
        onPressIn={() => start(-1)}
        onPressOut={stop}
        onPress={() => tap(-1)}>
        <Text style={styles.buttonLabel}>−</Text>
      </Pressable>

      <Pressable style={styles.valueBlock} disabled={disabled} onPress={onTapValue}>
        <Text style={styles.valueText}>{value}</Text>
        {unitLabel ? <Text style={styles.unitText}>{unitLabel}</Text> : null}
      </Pressable>

      <Pressable
        style={[styles.button, disabled && styles.buttonDisabled]}
        disabled={disabled}
        onPressIn={() => start(1)}
        onPressOut={stop}
        onPress={() => tap(1)}>
        <Text style={styles.buttonLabel}>+</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  button: {
    minWidth: theme.minTouchTarget,
    minHeight: theme.minTouchTarget,
    borderRadius: 12,
    backgroundColor: theme.color.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonDisabled: {
    opacity: 0.4,
  },
  buttonLabel: {
    color: theme.color.textPrimary,
    fontSize: 28,
    fontWeight: '800',
  },
  valueBlock: {
    minWidth: 96,
    alignItems: 'center',
    justifyContent: 'center',
  },
  valueText: {
    color: theme.color.textPrimary,
    fontSize: 36,
    fontWeight: '800',
    fontVariant: ['tabular-nums'],
  },
  unitText: {
    color: theme.color.textMuted,
    fontSize: 11,
    textTransform: 'uppercase',
  },
});
