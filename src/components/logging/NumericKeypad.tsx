import { useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';

import { useInstrumentationStore } from '@/state/instrumentationStore';
import { strings } from '@/strings';
import { theme } from '@/theme';

interface NumericKeypadProps {
  visible: boolean;
  label: string;
  allowDecimal: boolean;
  onConfirm: (value: number) => void;
  onCancel: () => void;
}

const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '.', '0', '⌫'];

export function NumericKeypad({ visible, label, allowDecimal, onConfirm, onCancel }: NumericKeypadProps) {
  const [buffer, setBuffer] = useState('');

  function handleKey(key: string) {
    useInstrumentationStore.getState().recordTap();
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
    if (buffer.length > 0 && Number.isFinite(parsed)) onConfirm(parsed);
    setBuffer('');
  }

  function handleCancel() {
    setBuffer('');
    onCancel();
  }

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={handleCancel}>
      <View style={styles.backdrop}>
        <View style={styles.sheet}>
          <Text style={styles.label}>{label}</Text>
          <Text style={styles.display}>{buffer.length > 0 ? buffer : '0'}</Text>

          <View style={styles.grid}>
            {KEYS.map((key) => (
              <Pressable
                key={key}
                style={[styles.key, key === '.' && !allowDecimal && styles.keyDisabled]}
                disabled={key === '.' && !allowDecimal}
                onPress={() => handleKey(key)}>
                <Text style={styles.keyLabel}>{key}</Text>
              </Pressable>
            ))}
          </View>

          <View style={styles.actions}>
            <Pressable style={styles.cancelButton} onPress={handleCancel}>
              <Text style={styles.cancelLabel}>{strings.keypadCancel}</Text>
            </Pressable>
            <Pressable style={styles.doneButton} onPress={handleDone}>
              <Text style={styles.doneLabel}>{strings.keypadDone}</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: theme.color.surface,
    padding: 20,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    gap: 12,
  },
  label: {
    color: theme.color.textMuted,
    fontSize: 13,
    textTransform: 'uppercase',
    textAlign: 'center',
  },
  display: {
    color: theme.color.accentPrimary,
    fontSize: 48,
    fontWeight: '800',
    textAlign: 'center',
    fontVariant: ['tabular-nums'],
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    justifyContent: 'center',
  },
  key: {
    width: '30%',
    minHeight: theme.minTouchTarget,
    borderRadius: 12,
    backgroundColor: theme.color.bg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  keyDisabled: {
    opacity: 0.3,
  },
  keyLabel: {
    color: theme.color.textPrimary,
    fontSize: 22,
    fontWeight: '700',
  },
  actions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 4,
  },
  cancelButton: {
    flex: 1,
    minHeight: theme.minTouchTarget,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: theme.color.textMuted,
  },
  cancelLabel: {
    color: theme.color.textMuted,
    fontSize: 16,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  doneButton: {
    flex: 1,
    minHeight: theme.minTouchTarget,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.color.accentPrimary,
  },
  doneLabel: {
    color: theme.color.bg,
    fontSize: 16,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
});
