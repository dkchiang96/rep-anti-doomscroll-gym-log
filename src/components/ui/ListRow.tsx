import { Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';

import { color, size, type } from '@/theme';

// DESIGN-SPEC.md §5.6 — the pattern for every non-workout screen. Full-bleed
// row, label hard-left, control hard-right, 1px divider spanning the full
// screen width (not inset to the row's own content padding).

type ListRowBase = {
  label: string;
  subLabel?: string;
  disabled?: boolean;
};

type NavigationRow = ListRowBase & { variant: 'navigation'; onPress: () => void };
type ToggleRow = ListRowBase & { variant: 'toggle'; value: boolean; onValueChange: (next: boolean) => void };
type ValueRow = ListRowBase & { variant: 'value'; valueLabel: string; onPress: () => void };
type SliderRow = ListRowBase & { variant: 'slider'; sliderValue: number };

export type ListRowProps = NavigationRow | ToggleRow | ValueRow | SliderRow;

export function ListRow(props: ListRowProps) {
  const labelColor = props.disabled ? color.textMuted : color.textPrimary;
  const content = (
    <View style={styles.content}>
      <View style={styles.labels}>
        <Text style={[type.label, { color: labelColor }]}>{props.label}</Text>
        {props.subLabel ? <Text style={[type.caption, styles.subLabel]}>{props.subLabel}</Text> : null}
      </View>
      {renderControl(props)}
    </View>
  );

  if (props.variant === 'navigation' || props.variant === 'value') {
    return (
      <Pressable disabled={props.disabled} onPress={props.onPress} style={styles.root}>
        {content}
        <View style={styles.divider} />
      </Pressable>
    );
  }

  if (props.variant === 'toggle') {
    return (
      <Pressable disabled={props.disabled} onPress={() => props.onValueChange(!props.value)} style={styles.root}>
        {content}
        <View style={styles.divider} />
      </Pressable>
    );
  }

  return (
    <View style={styles.root}>
      {content}
      <View style={styles.divider} />
    </View>
  );
}

function renderControl(props: ListRowProps) {
  switch (props.variant) {
    case 'navigation':
      return <Chevron />;
    case 'value':
      return (
        <View style={styles.valueControl}>
          <Text style={[type.caption, styles.valueText]}>{props.valueLabel}</Text>
          <Chevron />
        </View>
      );
    case 'toggle':
      return <Toggle value={props.value} />;
    case 'slider':
      return <Slider value={props.sliderValue} />;
  }
}

function Chevron() {
  return (
    <Svg width={14} height={22} viewBox="0 0 14 22">
      <Path d="M2 2 L12 11 L2 20" stroke={color.textMuted} strokeWidth={2.5} fill="none" strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

function Toggle({ value }: { value: boolean }) {
  return (
    <View style={[styles.toggleTrack, { backgroundColor: value ? color.slabSecondary : color.textMuted }]}>
      <View
        style={[
          styles.toggleKnob,
          { backgroundColor: value ? color.slabSecondary : color.textPrimary },
          value ? styles.toggleKnobOn : styles.toggleKnobOff,
        ]}
      />
    </View>
  );
}

function Slider({ value }: { value: number }) {
  const clamped = Math.max(0, Math.min(1, value));
  return (
    <View style={styles.sliderTrack}>
      <View style={[styles.sliderFill, { width: `${clamped * 100}%` }]} />
      <View style={[styles.sliderKnob, { left: `${clamped * 100}%` }]} />
    </View>
  );
}

const TOGGLE_WIDTH = 44;
const TOGGLE_HEIGHT = 26;
const TOGGLE_KNOB = 22;

const styles = StyleSheet.create({
  root: {
    width: '100%',
    minHeight: size.listRow,
    justifyContent: 'center',
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: size.listRowPadding,
    minHeight: size.listRow,
  },
  labels: {
    flexShrink: 1,
  },
  subLabel: {
    color: color.textMuted,
    marginTop: 2,
  },
  divider: {
    height: size.divider,
    width: '100%',
    backgroundColor: color.divider,
  },
  valueControl: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  valueText: {
    color: color.textMuted,
  },
  toggleTrack: {
    width: TOGGLE_WIDTH,
    height: TOGGLE_HEIGHT,
    borderRadius: 0,
    justifyContent: 'center',
    paddingHorizontal: 2,
  },
  toggleKnob: {
    width: TOGGLE_KNOB,
    height: TOGGLE_KNOB,
    backgroundColor: color.textPrimary,
    position: 'absolute',
  },
  toggleKnobOff: {
    left: 2,
  },
  toggleKnobOn: {
    right: 2,
  },
  sliderTrack: {
    width: 120,
    height: 4,
    backgroundColor: color.divider,
    justifyContent: 'center',
  },
  sliderFill: {
    height: 4,
    backgroundColor: color.slabSecondary,
    position: 'absolute',
    left: 0,
  },
  sliderKnob: {
    position: 'absolute',
    width: 16,
    height: 16,
    borderRadius: 8,
    marginLeft: -8,
    backgroundColor: color.slabSecondary,
  },
});
