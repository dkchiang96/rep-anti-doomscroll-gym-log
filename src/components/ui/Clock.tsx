import { StyleSheet, Text, useWindowDimensions } from 'react-native';

import { formatClock } from '@/domain/clockFormat';
import { color, fontFamily, tabularNums, type } from '@/theme';

import { useClockMetrics } from './FontGate';

// DESIGN-SPEC.md §5.1 — the hero stopwatch. Self-calibrating: font size is
// derived from a one-time measured digit/colon width (FontGate's clock
// metrics probe), not a hardcoded point size, so it stays correct if the
// display face is ever swapped.
//
// Below 100 minutes the string is always 5 characters (MM:SS) and targets
// ~95% of viewport width. At the 100-minute boundary the string grows to 6
// characters; rather than shrink every session's clock by ~13% to reserve
// permanent headroom for a boundary almost no session reaches, a single
// step-down to a slightly smaller target-width fraction engages there and
// never again. Width is recomputed per digit count, so it cannot resize or
// jitter within a single digit-count regime (e.g. crossing 60:00).

type ClockProps = {
  elapsedMs: number;
  variant?: 'hero' | 'compact';
};

export function Clock({ elapsedMs, variant = 'hero' }: ClockProps) {
  const { width } = useWindowDimensions();
  const metrics = useClockMetrics();
  const text = formatClock(elapsedMs);

  if (variant === 'compact') {
    return (
      <Text style={[type.display1, tabularNums, styles.compact]} numberOfLines={1}>
        {text}
      </Text>
    );
  }

  const digitCount = text.length - 1; // total chars minus the one colon
  const targetFraction = digitCount <= 4 ? 0.95 : 0.9;
  const targetWidth = width * targetFraction;
  const unitWidth = metrics.digitWidthPerUnit * digitCount + metrics.colonWidthPerUnit;
  const fontSize = targetWidth / unitWidth;

  return (
    <Text
      style={[tabularNums, styles.hero, { fontFamily: fontFamily.display, fontSize, lineHeight: fontSize * 0.85 }]}
      numberOfLines={1}
      adjustsFontSizeToFit={false}
    >
      {text}
    </Text>
  );
}

const styles = StyleSheet.create({
  hero: {
    color: color.onSlab,
    textAlign: 'center',
  },
  compact: {
    color: color.onSlab,
    textAlign: 'center',
  },
});
