import { Pressable, StyleSheet, Text, View } from 'react-native';

import { useInstrumentationStore } from '@/state/instrumentationStore';
import { strings } from '@/strings';
import { color, size, tabularNums, type } from '@/theme';

// RPE 1–10 for one exercise in one session. Required before leaving the
// exercise (the logging screen blocks NEXT EXERCISE / END until it's set);
// feeds src/domain/progressReadiness.ts. Two rows of five so each button
// keeps the 56dp minimum touch target on a phone width.

const VALUES = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

type RpePickerProps = {
  value: number | null;
  onChange: (rpe: number) => void;
  /** Highlights the heading when the user tried to leave without an RPE. */
  missing?: boolean;
};

export function RpePicker({ value, onChange, missing = false }: RpePickerProps) {
  const recordTap = useInstrumentationStore((s) => s.recordTap);

  return (
    <View>
      <Text style={[type.caption, missing ? styles.headingMissing : styles.heading]}>
        {missing ? strings.rpeRequiredPrompt : strings.rpeHeading}
      </Text>
      <View style={styles.grid}>
        {VALUES.map((v) => {
          const selected = v === value;
          return (
            <Pressable
              key={v}
              onPress={() => {
                recordTap();
                onChange(v);
              }}
              style={[styles.button, selected ? styles.buttonOn : null]}
            >
              <Text style={[type.heading, tabularNums, { color: selected ? color.onSlab : color.textPrimary }]}>{v}</Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  heading: {
    color: color.textMuted,
    marginBottom: 6,
  },
  headingMissing: {
    color: color.danger,
    marginBottom: 6,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  button: {
    // Five per row: (100% − 4 gaps) / 5.
    flexBasis: '18%',
    flexGrow: 1,
    minHeight: size.minTouchTarget,
    borderWidth: 2,
    borderColor: color.divider,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonOn: {
    backgroundColor: color.slabSecondary,
    borderColor: color.slabSecondary,
  },
});
