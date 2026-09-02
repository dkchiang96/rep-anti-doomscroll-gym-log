import type { ReactNode } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { color } from '@/theme';

// DESIGN-SPEC.md §4 — the core primitive. Full-bleed horizontal band:
// zero horizontal margin/padding, zero corner radius, solid tone fill.
// Height is either a flex ratio (stacks against sibling Slabs) or a fixed dp value.

type SlabProps = {
  tone: 'primary' | 'secondary';
  flex?: number;
  height?: number;
  children?: ReactNode;
  /** Vertical padding / content alignment only — never horizontal spacing. */
  style?: StyleProp<ViewStyle>;
};

export function Slab({ tone, flex, height, children, style }: SlabProps) {
  const backgroundColor = tone === 'primary' ? color.slabPrimary : color.slabSecondary;
  return (
    <View style={[styles.root, { backgroundColor }, flex != null ? { flex } : null, height != null ? { height } : null, style]}>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    width: '100%',
    borderRadius: 0,
    marginHorizontal: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
