import { Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Path, Rect } from 'react-native-svg';

import { color, size, type } from '@/theme';

// DESIGN-SPEC.md §5.3 — the one place borderRadius is permitted (D12: Timer
// Plus uses a circular transport, and Timer Plus is the tiebreaker).

type TransportButtonProps = {
  state: 'start' | 'pause';
  variant?: 'large' | 'small';
  label?: string;
  onPress: () => void;
};

export function TransportButton({ state, variant = 'large', label, onPress }: TransportButtonProps) {
  const diameter = variant === 'large' ? size.transportLarge : size.transportSmall;
  const iconSize = diameter * 0.4;

  return (
    <View style={styles.wrap}>
      <Pressable
        onPress={onPress}
        hitSlop={8}
        style={({ pressed }) => [
          styles.circle,
          { width: diameter, height: diameter, borderRadius: diameter / 2, opacity: pressed ? 0.85 : 1 },
        ]}
      >
        <Svg width={iconSize} height={iconSize} viewBox="0 0 24 24">
          {state === 'start' ? (
            <Path d="M7 4 L20 12 L7 20 Z" fill={color.onSlab} />
          ) : (
            <>
              <Rect x="5" y="4" width="5" height="16" fill={color.onSlab} />
              <Rect x="14" y="4" width="5" height="16" fill={color.onSlab} />
            </>
          )}
        </Svg>
      </Pressable>
      {label && variant === 'large' ? <Text style={[type.label, styles.label]}>{label}</Text> : null}
    </View>
  );
}

type ResetButtonProps = {
  onLongPress: () => void;
};

// A stray tap must not wipe the clock — long-press only, per §5.3.
export function TransportResetButton({ onLongPress }: ResetButtonProps) {
  return (
    <Pressable onLongPress={onLongPress} delayLongPress={600} hitSlop={8} style={styles.resetCircle}>
      <Svg width={20} height={20} viewBox="0 0 24 24">
        <Path
          d="M20 12a8 8 0 1 1-2.34-5.66"
          stroke={color.divider}
          strokeWidth={2.5}
          fill="none"
          strokeLinecap="round"
        />
        <Path d="M20 4v5h-5" stroke={color.divider} strokeWidth={2.5} fill="none" strokeLinecap="round" strokeLinejoin="round" />
      </Svg>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignItems: 'center',
  },
  circle: {
    backgroundColor: color.slabPrimary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    color: color.slabPrimary,
    marginTop: 8,
  },
  resetCircle: {
    width: size.transportSmall,
    height: size.transportSmall,
    borderRadius: size.transportSmall / 2,
    borderWidth: 2,
    borderColor: color.divider,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
