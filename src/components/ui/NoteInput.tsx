import { useState } from 'react';
import { StyleSheet, TextInput } from 'react-native';

import { color, fontFamily, size } from '@/theme';

// Optional free-text note (per exercise on the logging screen, per session
// on the end-of-workout recap). No Save button (invariant 1): the parent's
// onChange writes to SQLite on every edit. The text is held locally so a
// write's round-trip never moves the cursor or drops a keystroke; the
// initial value seeds it once per mount.

type NoteInputProps = {
  initialValue: string;
  placeholder: string;
  onChange: (text: string) => void;
};

export function NoteInput({ initialValue, placeholder, onChange }: NoteInputProps) {
  const [text, setText] = useState(initialValue);

  return (
    <TextInput
      style={styles.input}
      value={text}
      onChangeText={(t) => {
        setText(t);
        onChange(t);
      }}
      placeholder={placeholder}
      placeholderTextColor={color.textMuted}
      multiline
      textAlignVertical="top"
      autoCapitalize="sentences"
    />
  );
}

const styles = StyleSheet.create({
  input: {
    minHeight: size.minTouchTarget * 1.5,
    borderWidth: 2,
    borderColor: color.divider,
    color: color.textPrimary,
    fontFamily: fontFamily.body,
    fontSize: 16,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
});
