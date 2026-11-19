import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { NoteInput } from '@/components/ui/NoteInput';
import { RpePicker } from '@/components/ui/RpePicker';
import { SafeAreaView } from 'react-native-safe-area-context';

import { strings } from '@/strings';
import { color, size, type } from '@/theme';

// Item 2 — a blocking recap shown right before either exit route (leaving an
// exercise for the next one, or ending the workout) actually takes effect,
// so a logging mistake surfaces before it's sealed. Still meant as a single
// glance — typical session sizes fit a phone screen at caption size — but
// the end recap now also carries a session note (and sometimes an RPE
// prompt), so the content scrolls only if it would otherwise overflow.

export type RecapSection = {
  name: string;
  shorthand: string;
};

type ExitRecapModalProps = {
  visible: boolean;
  title: string;
  sections: RecapSection[];
  confirmLabel: string;
  onConfirm: () => void;
  onBack: () => void;
  /** End-of-workout recap only: the optional session note, written as you type. */
  sessionNote?: { initialValue: string; onChange: (text: string) => void };
  /** Ending from the timer screen: the current exercise's required RPE, when it has logged sets but no RPE yet. */
  rpe?: { exerciseName: string; value: number | null; missing: boolean; onChange: (rpe: number) => void };
};

export function ExitRecapModal({ visible, title, sections, confirmLabel, onConfirm, onBack, sessionNote, rpe }: ExitRecapModalProps) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onBack}>
      <View style={styles.backdrop}>
        <SafeAreaView style={styles.sheet} edges={['top', 'bottom']}>
          <ScrollView contentContainerStyle={styles.sheetContent} keyboardShouldPersistTaps="handled">
          <Text style={[type.heading, styles.title]}>{title.toUpperCase()}</Text>

          <View style={styles.sectionList}>
            {sections.length === 0 ? (
              <Text style={[type.body, styles.emptyText]}>{strings.recapEmpty}</Text>
            ) : (
              sections.map((s, i) => (
                <View key={`${s.name}-${i}`} style={styles.sectionRow}>
                  <Text style={[type.label, styles.sectionName]} numberOfLines={1}>
                    {s.name.toUpperCase()}
                  </Text>
                  <Text style={[type.caption, styles.sectionShorthand]} numberOfLines={2}>
                    {s.shorthand}
                  </Text>
                </View>
              ))
            )}
          </View>

          {rpe ? (
            <View style={styles.noteBlock}>
              <Text style={[type.label, styles.sectionName]}>{strings.recapRpeHeading(rpe.exerciseName)}</Text>
              <RpePicker value={rpe.value} onChange={rpe.onChange} missing={rpe.missing} />
            </View>
          ) : null}

          {sessionNote ? (
            <View style={styles.noteBlock}>
              <Text style={[type.caption, styles.noteHeading]}>{strings.sessionNoteHeading}</Text>
              <NoteInput
                initialValue={sessionNote.initialValue}
                placeholder={strings.sessionNotePlaceholder}
                onChange={sessionNote.onChange}
              />
            </View>
          ) : null}

          <View style={styles.actions}>
            <Pressable onPress={onBack} style={styles.backTouch}>
              <Text style={[type.label, styles.backLabel]}>{strings.recapBackButton}</Text>
            </Pressable>
            <Pressable onPress={onConfirm} style={styles.confirmTouch}>
              <Text style={[type.label, styles.confirmLabel]}>{confirmLabel}</Text>
            </Pressable>
          </View>
          </ScrollView>
        </SafeAreaView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: color.bg,
  },
  sheet: {
    flex: 1,
  },
  sheetContent: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: 24,
    paddingVertical: 16,
  },
  title: {
    color: color.textPrimary,
    marginBottom: 16,
  },
  sectionList: {
    gap: 4,
  },
  sectionRow: {
    paddingVertical: 8,
    borderBottomWidth: size.divider,
    borderBottomColor: color.divider,
  },
  sectionName: {
    color: color.textPrimary,
  },
  sectionShorthand: {
    color: color.textMuted,
    marginTop: 2,
  },
  emptyText: {
    color: color.textMuted,
  },
  noteBlock: {
    marginTop: 16,
  },
  noteHeading: {
    color: color.textMuted,
    marginBottom: 6,
  },
  actions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 24,
  },
  backTouch: {
    flex: 1,
    minHeight: size.minTouchTarget,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: color.divider,
  },
  backLabel: {
    color: color.textPrimary,
  },
  confirmTouch: {
    flex: 1,
    minHeight: size.minTouchTarget,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: color.slabPrimary,
  },
  confirmLabel: {
    color: color.onSlab,
  },
});
