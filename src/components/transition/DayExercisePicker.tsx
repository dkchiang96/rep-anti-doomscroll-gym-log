import { useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import type { exercise as exerciseTable } from '@/data/schema';
import { strings } from '@/strings';
import { color, size, type } from '@/theme';

// Replaces the transition screen's old "jump straight to the full library"
// flow for a templated session: SELECT NEXT EXERCISE now first
// offers today's programme day, in the sequence the programme specifies,
// with exercises already logged this session greyed out and untappable.
//
// Item 5: the footer offers two explicit routes rather than one "add
// instead" catch-all — SUBSTITUTE AN EXERCISE first asks which of today's
// exercises is being replaced (so the replacement can inherit its target),
// ADD EXTRA EXERCISE skips straight to the full library with no target, same
// as the old behaviour. A substituted exercise stays visible, dimmed with a
// badge, and still tappable — the machine might free up.

type Exercise = typeof exerciseTable.$inferSelect;

export type DayExerciseItem = {
  templateExerciseId: string;
  exercise: Exercise;
  done: boolean;
  substituted: boolean;
  targetSets: number;
  targetRepsMin: number;
  targetRepsMax: number;
};

type PickerMode = 'select' | 'substitute';

type DayExercisePickerProps = {
  visible: boolean;
  items: DayExerciseItem[];
  onSelect: (exercise: Exercise) => void;
  onNominateSubstitute: (item: DayExerciseItem) => void;
  onAddExtra: () => void;
  onWarmDown: () => void;
  onClose: () => void;
};

export function DayExercisePicker({ visible, items, onSelect, onNominateSubstitute, onAddExtra, onWarmDown, onClose }: DayExercisePickerProps) {
  const [mode, setMode] = useState<PickerMode>('select');
  // Reset to the top-level footer every time the sheet opens — done during
  // render (React's documented "adjusting state when a prop changes"
  // pattern) rather than an effect, since it's a synchronous, purely local
  // reset with nothing to await.
  const [wasVisible, setWasVisible] = useState(visible);
  if (visible !== wasVisible) {
    setWasVisible(visible);
    if (visible) setMode('select');
  }

  function handleRowPress(item: DayExerciseItem) {
    if (mode === 'substitute') onNominateSubstitute(item);
    else onSelect(item.exercise);
  }

  return (
    <Modal visible={visible} transparent={false} animationType="slide" onRequestClose={onClose}>
      <SafeAreaView style={styles.root} edges={['top', 'bottom']}>
        <View style={styles.header}>
          <Text style={[type.heading, styles.headerTitle]}>{mode === 'substitute' ? strings.dayPickerSubstituteTitle : strings.dayPickerTitle}</Text>
          <Pressable onPress={mode === 'substitute' ? () => setMode('select') : onClose} style={styles.closeTouch}>
            <Text style={[type.label, styles.closeLabel]}>
              {mode === 'substitute' ? strings.dayPickerCancelButton : strings.addExerciseClose}
            </Text>
          </Pressable>
        </View>

        <ScrollView style={styles.list} contentContainerStyle={styles.listContent}>
          {items.length === 0 ? <Text style={[type.body, styles.emptyText]}>{strings.dayPickerEmpty}</Text> : null}
          {items.map((item, i) => (
            <Pressable
              key={item.templateExerciseId}
              disabled={item.done}
              onPress={() => handleRowPress(item)}
              style={[styles.row, item.done ? styles.rowDone : null]}
            >
              <Text style={[type.caption, styles.rowIndex]}>{i + 1}</Text>
              <Text
                style={[type.label, styles.rowLabel, item.done || item.substituted ? styles.rowLabelDone : null]}
                numberOfLines={1}
              >
                {item.exercise.name.toUpperCase()}
              </Text>
              {item.done ? <Text style={[type.caption, styles.doneBadge]}>{strings.dayPickerDoneBadge}</Text> : null}
              {!item.done && item.substituted ? (
                <Text style={[type.caption, styles.substitutedBadge]}>{strings.dayPickerSubstitutedBadge}</Text>
              ) : null}
              <View style={styles.divider} />
            </Pressable>
          ))}
        </ScrollView>

        {mode === 'select' ? (
          <View>
            <View style={styles.footer}>
              <Pressable onPress={() => setMode('substitute')} style={styles.footerTouch}>
                <Text style={[type.label, styles.footerLabel]}>{strings.dayPickerSubstituteButton}</Text>
              </Pressable>
              <Pressable onPress={onAddExtra} style={styles.footerTouch}>
                <Text style={[type.label, styles.footerLabel]}>{strings.dayPickerAddExtraButton}</Text>
              </Pressable>
            </View>
            <Pressable onPress={onWarmDown} style={styles.footerTouch}>
              <Text style={[type.label, styles.footerLabel]}>{strings.dayPickerWarmDownButton}</Text>
            </Pressable>
          </View>
        ) : null}
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
    flexShrink: 1,
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
  substitutedBadge: {
    color: color.textMuted,
  },
  divider: {
    position: 'absolute',
    left: size.listRowPadding,
    right: size.listRowPadding,
    bottom: 0,
    height: size.divider,
    backgroundColor: color.divider,
  },
  footer: {
    flexDirection: 'row',
  },
  footerTouch: {
    flexGrow: 1,
    flexBasis: 0,
    minHeight: size.minTouchTarget,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: size.listRowPadding,
    paddingVertical: 12,
  },
  footerLabel: {
    color: color.slabSecondary,
    textAlign: 'center',
  },
});
