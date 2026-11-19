import { useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useInstrumentationStore } from '@/state/instrumentationStore';
import { strings } from '@/strings';
import { color, size, tabularNums, type } from '@/theme';

// §5.7's "tap numeral opens a full-width keypad," rebuilt against the new
// design system: full-bleed, zero corner radius, no card/sheet chrome — a
// full-screen modal rather than the pre-rebuild's rounded bottom sheet.

const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '.', '0', '⌫'];

type NumericKeypadProps = {
  visible: boolean;
  label: string;
  allowDecimal: boolean;
  /** `raw` is the typed text, for inputs a number loses (e.g. time as min.sec: "4.50" vs "4.5"). */
  onConfirm: (value: number, raw: string) => void;
  onCancel: () => void;
};

export function NumericKeypad({ visible, label, allowDecimal, onConfirm, onCancel }: NumericKeypadProps) {
  const [buffer, setBuffer] = useState('');
  const recordTap = useInstrumentationStore((s) => s.recordTap);

  function handleKey(key: string) {
    recordTap();
    if (key === '⌫') {
      setBuffer((b) => b.slice(0, -1));
      return;
    }
    if (key === '.') {
      if (!allowDecimal || buffer.includes('.')) return;
      setBuffer((b) => (b.length === 0 ? '0.' : b + '.'));
      return;
    }
    setBuffer((b) => (b.length >= 6 ? b : b + key));
  }

  function handleDone() {
    const parsed = Number(buffer);
    if (buffer.length > 0 && Number.isFinite(parsed)) onConfirm(parsed, buffer);
    setBuffer('');
  }

  function handleCancel() {
    setBuffer('');
    onCancel();
  }

  return (
    <Modal visible={visible} transparent={false} animationType="slide" onRequestClose={handleCancel}>
      <SafeAreaView style={styles.root} edges={['top', 'bottom']}>
        <Text style={[type.caption, styles.label]}>{label}</Text>
        <Text style={[type.display1, tabularNums, styles.display]} numberOfLines={1}>
          {buffer.length > 0 ? buffer : '0'}
        </Text>

        <View style={styles.grid}>
          {KEYS.map((key) => (
            <Pressable
              key={key}
              style={[styles.key, key === '.' && !allowDecimal ? styles.keyDisabled : null]}
              disabled={key === '.' && !allowDecimal}
              onPress={() => handleKey(key)}
            >
              <Text style={[type.heading, styles.keyLabel]}>{key}</Text>
            </Pressable>
          ))}
        </View>

        <View style={styles.actions}>
          <Pressable style={styles.cancelTouch} onPress={handleCancel}>
            <Text style={[type.label, styles.cancelLabel]}>{strings.keypadCancel}</Text>
          </Pressable>
          <Pressable style={styles.doneTouch} onPress={handleDone}>
            <Text style={[type.label, styles.doneLabel]}>{strings.keypadDone}</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: color.bg,
    justifyContent: 'flex-start',
  },
  label: {
    color: color.textMuted,
    textAlign: 'center',
    marginTop: 16,
  },
  display: {
    color: color.textPrimary,
    textAlign: 'center',
    marginTop: 8,
    marginBottom: 16,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  key: {
    width: '33.333%',
    minHeight: size.stepper,
    borderWidth: size.divider,
    borderColor: color.divider,
    alignItems: 'center',
    justifyContent: 'center',
  },
  keyDisabled: {
    opacity: 0.3,
  },
  keyLabel: {
    color: color.textPrimary,
  },
  actions: {
    flexDirection: 'row',
    marginTop: 'auto',
  },
  cancelTouch: {
    flex: 1,
    minHeight: size.bottomSlab,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: color.bar,
  },
  cancelLabel: {
    color: color.textPrimary,
  },
  doneTouch: {
    flex: 1,
    minHeight: size.bottomSlab,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: color.slabPrimary,
  },
  doneLabel: {
    color: color.onSlab,
  },
});
