import { useState } from 'react';
import { StyleSheet, Text, View, type LayoutChangeEvent } from 'react-native';
import Svg, { Circle, Polyline } from 'react-native-svg';

import type { ProgressPoint } from '@/domain/progressChart';
import { color, type } from '@/theme';

// DESIGN-SPEC.md §6 (Progress half of screen 6): top-working-set weight over
// time. Both axes self-adjust to the data's actual range — the x-axis spans
// the earliest to latest session in `points` (not a fixed calendar window),
// and the y-axis spans the min/max top weight. Degenerate cases (a single
// point, or every value identical) are centred rather than divided by zero.

const CHART_HEIGHT = 240;
const PADDING_TOP = 16;
const PADDING_BOTTOM = 28;
const PADDING_LEFT = 8;
const PADDING_RIGHT = 8;
const POINT_RADIUS = 4;

type Point = { x: number; y: number };

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function formatAxisDate(ms: number): string {
  const d = new Date(ms);
  return `${d.getDate()} ${MONTHS[d.getMonth()]}`;
}

export function ProgressChart({ points }: { points: ProgressPoint[] }) {
  const [width, setWidth] = useState(0);

  function handleLayout(e: LayoutChangeEvent) {
    setWidth(e.nativeEvent.layout.width);
  }

  const dates = points.map((p) => p.dateMs);
  const domainStart = dates.length > 0 ? Math.min(...dates) : 0;
  const domainEnd = dates.length > 0 ? Math.max(...dates) : 0;

  const weightSeries = buildSeries(points, width, domainStart, domainEnd);

  const weightValues = points.map((p) => p.topWeightKg);
  const weightMin = weightValues.length > 0 ? Math.min(...weightValues) : 0;
  const weightMax = weightValues.length > 0 ? Math.max(...weightValues) : 0;

  return (
    <View>
      <View style={styles.plotRow}>
        <View style={styles.yAxisColumn}>
          <Text style={[type.caption, styles.axisLabelPrimary]}>{weightMax}</Text>
          <Text style={[type.caption, styles.axisLabelPrimary]}>{weightMin}</Text>
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
              {weightSeries.map((p, i) => (
                <Circle key={`w-${i}`} cx={p.x} cy={p.y} r={POINT_RADIUS} fill={color.slabPrimary} />
              ))}
            </Svg>
          ) : null}
        </View>
      </View>

      <View style={styles.xAxisRow}>
        <Text style={[type.caption, styles.xAxisLabel]}>{formatAxisDate(domainStart)}</Text>
        <Text style={[type.caption, styles.xAxisLabel]}>{formatAxisDate((domainStart + domainEnd) / 2)}</Text>
        <Text style={[type.caption, styles.xAxisLabel]}>{formatAxisDate(domainEnd)}</Text>
      </View>
    </View>
  );
}

function buildSeries(points: ProgressPoint[], width: number, domainStart: number, domainEnd: number): Point[] {
  if (width <= 0 || points.length === 0) return [];
  const innerWidth = Math.max(1, width - PADDING_LEFT - PADDING_RIGHT);
  const innerHeight = CHART_HEIGHT - PADDING_TOP - PADDING_BOTTOM;
  const domainSpan = Math.max(1, domainEnd - domainStart);

  const values = points.map((p) => p.topWeightKg);
  const minValue = Math.min(...values);
  const maxValue = Math.max(...values);
  const valueSpan = maxValue - minValue;

  return points.map((p) => {
    const x = PADDING_LEFT + ((p.dateMs - domainStart) / domainSpan) * innerWidth;
    const y =
      valueSpan === 0
        ? PADDING_TOP + innerHeight / 2
        : PADDING_TOP + innerHeight - ((p.topWeightKg - minValue) / valueSpan) * innerHeight;
    return { x, y };
  });
}

const styles = StyleSheet.create({
  plotRow: {
    flexDirection: 'row',
    alignItems: 'stretch',
    paddingHorizontal: 24,
    gap: 8,
  },
  yAxisColumn: {
    justifyContent: 'space-between',
    paddingVertical: PADDING_TOP,
    paddingBottom: PADDING_BOTTOM,
  },
  axisLabelPrimary: {
    color: color.slabPrimary,
  },
  chartBox: {
    flex: 1,
    height: CHART_HEIGHT,
  },
  xAxisRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 24,
    marginTop: 4,
  },
  xAxisLabel: {
    color: color.textMuted,
  },
});
