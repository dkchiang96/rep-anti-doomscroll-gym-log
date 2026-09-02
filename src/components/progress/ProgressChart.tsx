import { useState } from 'react';
import { StyleSheet, Text, View, type LayoutChangeEvent } from 'react-native';
import Svg, { Circle, Polyline } from 'react-native-svg';

import type { ProgressPoint } from '@/domain/progressChart';
import { strings } from '@/strings';
import { color, type } from '@/theme';

// DESIGN-SPEC.md §6 (Progress half of screen 6): top-working-set weight and
// reps over time, on a shared time axis, independently scaled on y since kg
// and rep-count are different units. Weight in slab-primary, reps in
// slab-secondary — the one place accent colour is a foreground (§2 rule 2),
// because a line has no fill area. Degenerate cases (a single point, or every
// value identical) are centred rather than divided by zero.

const CHART_HEIGHT = 220;
const PADDING = 16;
const POINT_RADIUS = 4;

type Point = { x: number; y: number };

export function ProgressChart({ points }: { points: ProgressPoint[] }) {
  const [width, setWidth] = useState(0);

  function handleLayout(e: LayoutChangeEvent) {
    setWidth(e.nativeEvent.layout.width);
  }

  const weightSeries = buildSeries(points, width, (p) => p.topWeightKg);
  const repsSeries = buildSeries(points, width, (p) => p.reps);

  return (
    <View>
      <View style={styles.legendRow}>
        <LegendDot tone={color.slabPrimary} label={strings.progressWeightLegend} />
        <LegendDot tone={color.slabSecondary} label={strings.progressRepsLegend} />
      </View>
      <View style={styles.chartBox} onLayout={handleLayout}>
        {width > 0 ? (
          <Svg width={width} height={CHART_HEIGHT}>
            {weightSeries.length > 1 ? (
              <Polyline
                points={weightSeries.map((p) => `${p.x},${p.y}`).join(' ')}
                fill="none"
                stroke={color.slabPrimary}
                strokeWidth={2}
              />
            ) : null}
            {repsSeries.length > 1 ? (
              <Polyline
                points={repsSeries.map((p) => `${p.x},${p.y}`).join(' ')}
                fill="none"
                stroke={color.slabSecondary}
                strokeWidth={2}
              />
            ) : null}
            {weightSeries.map((p, i) => (
              <Circle key={`w-${i}`} cx={p.x} cy={p.y} r={POINT_RADIUS} fill={color.slabPrimary} />
            ))}
            {repsSeries.map((p, i) => (
              <Circle key={`r-${i}`} cx={p.x} cy={p.y} r={POINT_RADIUS} fill={color.slabSecondary} />
            ))}
          </Svg>
        ) : null}
      </View>
    </View>
  );
}

function buildSeries(points: ProgressPoint[], width: number, valueOf: (p: ProgressPoint) => number): Point[] {
  if (width <= 0 || points.length === 0) return [];
  const innerWidth = Math.max(1, width - PADDING * 2);
  const innerHeight = CHART_HEIGHT - PADDING * 2;

  const dates = points.map((p) => p.dateMs);
  const minDate = Math.min(...dates);
  const maxDate = Math.max(...dates);
  const dateSpan = maxDate - minDate;

  const values = points.map(valueOf);
  const minValue = Math.min(...values);
  const maxValue = Math.max(...values);
  const valueSpan = maxValue - minValue;

  return points.map((p, i) => {
    const x =
      points.length === 1 || dateSpan === 0
        ? PADDING + innerWidth * (points.length === 1 ? 0.5 : i / (points.length - 1))
        : PADDING + ((p.dateMs - minDate) / dateSpan) * innerWidth;
    const value = valueOf(p);
    const y = valueSpan === 0 ? PADDING + innerHeight / 2 : PADDING + innerHeight - ((value - minValue) / valueSpan) * innerHeight;
    return { x, y };
  });
}

function LegendDot({ tone, label }: { tone: string; label: string }) {
  return (
    <View style={styles.legendItem}>
      <View style={[styles.legendSwatch, { backgroundColor: tone }]} />
      <Text style={[type.caption, styles.legendLabel]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  legendRow: {
    flexDirection: 'row',
    gap: 24,
    paddingHorizontal: 24,
    paddingBottom: 8,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  legendSwatch: {
    width: 12,
    height: 12,
  },
  legendLabel: {
    color: color.textMuted,
  },
  chartBox: {
    width: '100%',
    height: CHART_HEIGHT,
  },
});
