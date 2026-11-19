import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { strings } from '@/strings';
import { color, size, type } from '@/theme';

// The current exercise's programme note (template_exercise.notes) on the
// live screen. Inline, not a modal (DESIGN-SPEC: no modals): it opens the
// first time you reach the exercise, you read it, tap GOT IT, and it folds
// away into the top bar's NOTE chip until you want it again. Long notes
// scroll inside the card rather than pushing the clock and transport
// controls off the screen.

type ProgrammeNoteCardProps = {
  note: string;
  onDismiss: () => void;
};

export function ProgrammeNoteCard({ note, onDismiss }: ProgrammeNoteCardProps) {
  return (
    <View style={styles.card}>
      <Text style={[type.caption, styles.heading]}>{strings.programmeNoteHeading}</Text>
      <ScrollView style={styles.body} nestedScrollEnabled>
        <Text style={[type.body, styles.text]}>{note}</Text>
      </ScrollView>
      <Pressable onPress={onDismiss} style={styles.dismissTouch}>
        <Text style={[type.label, styles.dismissLabel]}>{strings.programmeNoteDismiss}</Text>
      </Pressable>
    </View>
  );
}

type ProgrammeNoteChipProps = {
  onPress: () => void;
};

// The folded state: a small chip at the right of the top bar.
export function ProgrammeNoteChip({ onPress }: ProgrammeNoteChipProps) {
  return (
    <Pressable onPress={onPress} style={styles.chip} hitSlop={8}>
      <Text style={[type.caption, styles.chipLabel]}>{strings.programmeNoteChip}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: color.bar,
    borderLeftWidth: 4,
    borderLeftColor: color.slabSecondary,
    paddingLeft: 16,
    paddingRight: 8,
    paddingTop: 10,
  },
  heading: {
    color: color.slabSecondary,
  },
  body: {
    // Roughly six lines of body text before it scrolls.
    maxHeight: 16 * 1.5 * 6,
    marginTop: 4,
  },
  text: {
    color: color.textPrimary,
  },
  dismissTouch: {
    alignSelf: 'flex-end',
    minHeight: size.minTouchTarget,
    minWidth: size.minTouchTarget * 2,
    alignItems: 'flex-end',
    justifyContent: 'center',
    paddingHorizontal: 8,
  },
  dismissLabel: {
    color: color.slabSecondary,
  },
  chip: {
    position: 'absolute',
    right: 8,
    top: 0,
    bottom: 0,
    minWidth: size.minTouchTarget,
    paddingHorizontal: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chipLabel: {
    color: color.slabSecondary,
    borderWidth: 1,
    borderColor: color.slabSecondary,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
});
