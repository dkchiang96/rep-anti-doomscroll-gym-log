import { useRouter } from 'expo-router';
import { Pressable, StyleSheet, Text } from 'react-native';

import { strings } from '@/strings';
import { theme } from '@/theme';

// Header is shorter than theme.minTouchTarget; hitSlop pads the tappable
// area back up to the 56dp invariant without inflating the visible button.
const HIT_SLOP = 12;

export function HomeHeaderButton() {
  const router = useRouter();

  return (
    <Pressable
      hitSlop={HIT_SLOP}
      onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))}
      style={styles.button}>
      <Text style={styles.label}>{strings.navHomeButton}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    paddingHorizontal: 4,
  },
  label: {
    color: theme.color.accentPrimary,
    fontSize: 15,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
});
