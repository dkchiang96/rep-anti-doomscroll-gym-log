import { useRouter } from 'expo-router';
import { Pressable, StyleSheet } from 'react-native';
import Svg, { Path } from 'react-native-svg';

import { color, size } from '@/theme';

// DESIGN-SPEC.md §8 known defect: the old "HOME" yellow-text header button is
// gone — a standard back chevron instead, falling back to Home when there's
// no push history to go back to (a stale deep link, a screen left as the
// first stack entry, etc). Every secondary screen uses this as its
// `headerLeft`, per §4's "back/home affordance left" rule.

const HIT_SLOP = 12;
const CHEVRON_WIDTH = 14;
const CHEVRON_HEIGHT = 22;

export function HomeHeaderButton() {
  const router = useRouter();

  return (
    <Pressable
      hitSlop={HIT_SLOP}
      onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))}
      style={styles.button}
    >
      <Svg width={CHEVRON_WIDTH} height={CHEVRON_HEIGHT} viewBox="0 0 14 22">
        <Path
          d="M12 2 L2 11 L12 20"
          stroke={color.textPrimary}
          strokeWidth={2.5}
          fill="none"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </Svg>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    minWidth: size.minTouchTarget,
    minHeight: size.minTouchTarget,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
