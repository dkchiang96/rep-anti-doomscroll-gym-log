import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import type { exercise as exerciseTable } from '@/data/schema';
import { strings } from '@/strings';
import { color, size, type } from '@/theme';

// Replaces the transition screen's old "jump straight to the full library"
// flow for a templated session: SELECT NEXT EXERCISE now first
// offers today's programme day, in the sequence the programme specifies,
// with exercises already logged this session greyed out and untappable.
// The usual full-library ExercisePicker is still one tap away via the
// footer button, for the "machine's occupied, substitute something else"
// case the user explicitly called out — it isn't hidden or removed.

type Exercise = typeof exerciseTable.$inferSelect;

export type DayExerciseItem = {
  templateExerciseId: string;
  exercise: Exercise;
  done: boolean;
};

type DayExercisePickerProps = {
  visible: boolean;
  items: DayExerciseItem[];
  onSelect: (exercise: Exercise) => void;
  onAddInstead: () => void;
  onClose: () => void;
};

export function DayExercisePicker({ visible, items, onSelect, onAddInstead, onClose }: DayExercisePickerProps) {
  return (
    <Modal visible={visible} transparent={false} animationType="slide" onRequestClose={onClose}>
      <SafeAreaView style={styles.root} edges={['top', 'bottom']}>
        <View style={styles.header}>
          <Text style={[type.heading, styles.headerTitle]}>{strings.dayPickerTitle}</Text>
          <Pressable onPress={onClose} style={styles.closeTouch}>
            <Text style={[type.label, styles.closeLabel]}>{strings.addExerciseClose}</Text>
          </Pressable>
        </View>

        <ScrollView style={styles.list} contentContainerStyle={styles.listContent}>
          {items.length === 0 ? <Text style={[type.body, styles.emptyText]}>{strings.dayPickerEmpty}</Text> : null}
          {items.map((item, i) => (
            <Pressable
              key={item.templateExerciseId}
              disabled={item.done}
              onPress={() => onSelect(item.exercise)}
              style={[styles.row, item.done ? styles.rowDone : null]}
            >
              <Text style={[type.caption, styles.rowIndex]}>{i + 1}</Text>
              <Text style={[type.label, styles.rowLabel, item.done ? styles.rowLabelDone : null]} numberOfLines={1}>
                {item.exercise.name.toUpperCase()}
              </Text>
              {item.done ? <Text style={[type.caption, styles.doneBadge]}>{strings.dayPickerDoneBadge}</Text> : null}
              <View style={styles.divider} />
            </Pressable>
          ))}
        </ScrollView>

        <Pressable onPress={onAddInstead} style={styles.addInsteadTouch}>
          <Text style={[type.label, styles.addInsteadLabel]}>{strings.dayPickerAddInsteadButton}</Text>
        </Pressable>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: color.bg,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    height: size.topBar,
    paddingHorizontal: size.listRowPadding,
    backgroundColor: color.bar,
  },
  headerTitle: {
    color: color.textPrimary,
  },
  closeTouch: {
    minHeight: size.minTouchTarget,
    minWidth: size.minTouchTarget,
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeLabel: {
    color: color.slabSecondary,
  },
  list: {
    flex: 1,
  },
  listContent: {
    paddingBottom: 16,
  },
  emptyText: {
    color: color.textMuted,
    paddingHorizontal: size.listRowPadding,
    paddingVertical: 12,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    minHeight: size.listRow,
    paddingHorizontal: size.listRowPadding,
  },
  rowDone: {
    opacity: 0.4,
  },
  rowIndex: {
    color: color.textMuted,
    width: 20,
  },
  rowLabel: {
    color: color.textPrimary,
    flex: 1,
  },
  rowLabelDone: {
    color: color.textMuted,
  },
  doneBadge: {
    color: color.slabSecondary,
  },
  divider: {
    position: 'absolute',
    left: size.listRowPadding,
    right: size.listRowPadding,
    bottom: 0,
    height: size.divider,
    backgroundColor: color.divider,
  },
  addInsteadTouch: {
    minHeight: size.minTouchTarget,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: size.listRowPadding,
    paddingVertical: 12,
  },
  addInsteadLabel: {
    color: color.slabSecondary,
  },
});
