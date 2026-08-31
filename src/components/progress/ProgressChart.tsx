import { StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import Svg, { Circle, Polyline } from 'react-native-svg';

import type { ProgressPoint } from '@/domain/progressChart';
import { strings } from '@/strings';
import { theme } from '@/theme';

const CHART_HEIGHT = 200;
const PADDING = 16;
const HORIZONTAL_MARGIN = 20;

interface Scaled {
  x: number;
  y: number;
}

function scaleAxis(values: number[], span: number, padding: number): (v: number) => number {
  const min = Math.min(...values);
  const max = Math.max(...values);
  if (min === max) {
    // A flat series still needs a usable scale — centre it rather than
    // collapsing every point onto the same pixel.
    return () => padding + span / 2;
  }
  return (v: number) => padding + span - ((v - min) / (max - min)) * span;
}

function scalePoints(points: ProgressPoint[], key: 'topWeightKg' | 'reps', width: number, height: number): Scaled[] {
  const plotWidth = width - 2 * PADDING;
  const plotHeight = height - 2 * PADDING;

  const dates = points.map((p) => p.dateMs);
  const minDate = Math.min(...dates);
  const maxDate = Math.max(...dates);
  const xFor = (dateMs: number) => {
    if (minDate === maxDate) return PADDING + plotWidth / 2;
    return PADDING + ((dateMs - minDate) / (maxDate - minDate)) * plotWidth;
  };

  const yFor = scaleAxis(
    points.map((p) => p[key]),
    plotHeight,
    PADDING,
  );

  return points.map((p) => ({ x: xFor(p.dateMs), y: yFor(p[key]) }));
}

function toPolylinePoints(scaled: Scaled[]): string {
  return scaled.map((s) => `${s.x},${s.y}`).join(' ');
}

interface ProgressChartProps {
  points: ProgressPoint[];
}

export function ProgressChart({ points }: ProgressChartProps) {
  const { width: windowWidth } = useWindowDimensions();
  const width = windowWidth - HORIZONTAL_MARGIN * 2;

  const weightScaled = scalePoints(points, 'topWeightKg', width, CHART_HEIGHT);
  const repsScaled = scalePoints(points, 'reps', width, CHART_HEIGHT);

  return (
    <View>
      <Svg width={width} height={CHART_HEIGHT}>
        <Polyline points={toPolylinePoints(repsScaled)} fill="none" stroke={theme.color.accentSecondary} strokeWidth={2} />
        {repsScaled.map((s, i) => (
          <Circle key={`reps-${i}`} cx={s.x} cy={s.y} r={3} fill={theme.color.accentSecondary} />
        ))}

        <Polyline points={toPolylinePoints(weightScaled)} fill="none" stroke={theme.color.accentPrimary} strokeWidth={3} />
        {weightScaled.map((s, i) => (
          <Circle key={`weight-${i}`} cx={s.x} cy={s.y} r={4} fill={theme.color.accentPrimary} />
        ))}
      </Svg>

      <View style={styles.legendRow}>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: theme.color.accentPrimary }]} />
          <Text style={styles.legendLabel}>{strings.progressWeightLegend}</Text>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: theme.color.accentSecondary }]} />
          <Text style={styles.legendLabel}>{strings.progressRepsLegend}</Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  legendRow: {
    flexDirection: 'row',
    gap: 16,
    marginTop: 8,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  legendDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  legendLabel: {
    color: theme.color.textMuted,
    fontSize: 12,
    textTransform: 'uppercase',
  },
});
