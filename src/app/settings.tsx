import { Stack, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { ListRow, StepperButton } from '@/components/ui';
import { NumericKeypad } from '@/components/transition/NumericKeypad';
import { useDatabase } from '@/data/DatabaseProvider';
import {
  createPlateInventory,
  seedDefaultPlateInventoryIfEmpty,
  softDeletePlateInventory,
  updatePlateInventory,
} from '@/data/repositories/plateInventoryRepository';
import { getUser, updateRestSettings } from '@/data/repositories/userRepository';
import type { plateInventory as plateInventoryTable } from '@/data/schema';
import { useFlashPreferenceStore } from '@/state/flashPreferenceStore';
import { strings } from '@/strings';
import { color, size, tabularNums, type } from '@/theme';

// DESIGN-SPEC.md §5.6/§6 screen 7 — flash interval, flash colour, plate
// inventory, and nav rows to Import/Export/Archive/Debug. Sound/vibration/
// camera-flash cue toggles are deliberately omitted: those columns are dead
// (R0 removed the expo-haptics/audio/camera engine that used to read them),
// and building live switches for something that changes nothing would be a
// half-finished feature — see docs/PROGRESS.md's R5 entry.

type PlateInventoryRow = typeof plateInventoryTable.$inferSelect;

export default function Settings() {
  const { db, userId } = useDatabase();
  const router = useRouter();
  const flashTone = useFlashPreferenceStore((s) => s.tone);
  const setFlashTone = useFlashPreferenceStore((s) => s.setTone);

  const [flashIntervalSeconds, setFlashIntervalSeconds] = useState<number | null>(null);
  const [intervalKeypadOpen, setIntervalKeypadOpen] = useState(false);
  const [inventory, setInventory] = useState<PlateInventoryRow[]>([]);
  const [newKg, setNewKg] = useState('');
  const [newColour, setNewColour] = useState('');

  useEffect(() => {
    void getUser(db, userId).then((user) => setFlashIntervalSeconds(user?.restFlashIntervalSeconds ?? 30));
    void seedDefaultPlateInventoryIfEmpty(db, userId).then(setInventory);
  }, [db, userId]);

  function handleIntervalConfirm(value: number) {
    setIntervalKeypadOpen(false);
    const seconds = Math.max(1, Math.round(value));
    setFlashIntervalSeconds(seconds);
    void updateRestSettings(db, userId, { restFlashIntervalSeconds: seconds });
  }

  function handleToggleFlashColour() {
    setFlashTone(flashTone === 'primary' ? 'secondary' : 'primary');
  }

  function handleQuantityStep(row: PlateInventoryRow, direction: 1 | -1) {
    const next = Math.max(0, row.quantityPerSide + direction);
    void updatePlateInventory(db, userId, row.id, { quantityPerSide: next }).then((updated) => {
      if (updated) setInventory((prev) => prev.map((p) => (p.id === updated.id ? updated : p)));
    });
  }

  function handleRemove(row: PlateInventoryRow) {
    void softDeletePlateInventory(db, userId, row.id).then(() => {
      setInventory((prev) => prev.filter((p) => p.id !== row.id));
    });
  }

  async function handleAddDenomination() {
    const kg = Number(newKg);
    const colour = /^#[0-9A-Fa-f]{6}$/.test(newColour.trim()) ? newColour.trim() : '#8A8A8A';
    if (!Number.isFinite(kg) || kg <= 0) return;
    const created = await createPlateInventory(db, {
      userId,
      gymLabel: 'default',
      denominationKg: kg,
      colourHex: colour,
      quantityPerSide: 0,
      isActive: true,
    });
    if (created) {
      setInventory((prev) => [...prev, created]);
      setNewKg('');
      setNewColour('');
    }
  }

  const sortedInventory = [...inventory].filter((p) => p.isActive).sort((a, b) => b.denominationKg - a.denominationKg);

  return (
    <ScrollView style={styles.root} contentContainerStyle={styles.content}>
      <Stack.Screen options={{ title: strings.settingsTitle }} />

      <ListRow
        variant="value"
        label={strings.settingsFlashIntervalLabel}
        valueLabel={flashIntervalSeconds != null ? strings.settingsFlashIntervalValue(flashIntervalSeconds) : ''}
        onPress={() => setIntervalKeypadOpen(true)}
      />
      <ListRow
        variant="value"
        label={strings.settingsFlashColourLabel}
        valueLabel={flashTone === 'primary' ? strings.settingsFlashColourYellow : strings.settingsFlashColourLime}
        onPress={handleToggleFlashColour}
      />

      <View style={styles.gap} />
      <Text style={[type.caption, styles.sectionHeading]}>{strings.settingsPlateInventoryHeading}</Text>
      {sortedInventory.map((row) => (
        <View key={row.id} style={styles.inventoryRow}>
          <View style={[styles.plateBlock, { backgroundColor: row.colourHex }]}>
            <Text style={[type.caption, styles.plateBlockLabel]}>{row.denominationKg}</Text>
          </View>
          <StepperButton label={strings.setInputStepperMinus} onPress={() => handleQuantityStep(row, -1)} size={size.minTouchTarget} />
          <Text style={[type.display1, tabularNums, styles.quantityValue]}>{row.quantityPerSide}</Text>
          <StepperButton label={strings.setInputStepperPlus} onPress={() => handleQuantityStep(row, 1)} size={size.minTouchTarget} />
          <Pressable onPress={() => handleRemove(row)} style={styles.removeTouch}>
            <Text style={[type.caption, styles.removeLabel]}>{strings.plateCalcInventoryRemoveButton}</Text>
          </Pressable>
        </View>
      ))}

      <Text style={[type.caption, styles.sectionHeading]}>{strings.plateCalcInventoryAddHeading}</Text>
      <View style={styles.addRow}>
        <TextInput
          value={newKg}
          onChangeText={setNewKg}
          placeholder={strings.plateCalcInventoryKgPlaceholder}
          placeholderTextColor={color.textMuted}
          keyboardType="decimal-pad"
          style={styles.addInput}
        />
        <TextInput
          value={newColour}
          onChangeText={setNewColour}
          placeholder={strings.plateCalcInventoryColourPlaceholder}
          placeholderTextColor={color.textMuted}
          autoCapitalize="none"
          style={styles.addInput}
        />
        <Pressable onPress={() => void handleAddDenomination()} style={styles.addTouch}>
          <Text style={[type.label, styles.addLabel]}>{strings.plateCalcInventoryAddButton}</Text>
        </Pressable>
      </View>

      <View style={styles.gap} />
      <ListRow variant="navigation" label={strings.settingsRowImport} onPress={() => router.push('/import')} />
      <ListRow variant="navigation" label={strings.settingsRowExport} onPress={() => router.push('/export')} />
      <ListRow variant="navigation" label={strings.settingsRowArchive} onPress={() => router.push('/archive')} />
      <ListRow variant="navigation" label={strings.settingsRowDebug} onPress={() => router.push('/debug')} />

      <NumericKeypad
        visible={intervalKeypadOpen}
        label={strings.settingsFlashIntervalLabel}
        allowDecimal={false}
        onConfirm={handleIntervalConfirm}
        onCancel={() => setIntervalKeypadOpen(false)}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: color.bg,
  },
  content: {
    flexGrow: 1,
    paddingBottom: 32,
  },
  gap: {
    height: 32,
  },
  sectionHeading: {
    color: color.textMuted,
    paddingHorizontal: size.listRowPadding,
    marginBottom: 8,
  },
  inventoryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: size.listRowPadding,
    minHeight: size.listRow,
  },
  plateBlock: {
    width: 48,
    height: size.warmupToggle,
    alignItems: 'center',
    justifyContent: 'center',
  },
  plateBlockLabel: {
    color: color.onSlab,
  },
  quantityValue: {
    color: color.textPrimary,
    minWidth: 40,
    textAlign: 'center',
  },
  removeTouch: {
    marginLeft: 'auto',
    minHeight: size.minTouchTarget,
    justifyContent: 'center',
  },
  removeLabel: {
    color: color.danger,
  },
  addRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: size.listRowPadding,
  },
  addInput: {
    ...type.body,
    color: color.textPrimary,
    borderWidth: 2,
    borderColor: color.divider,
    minHeight: size.minTouchTarget,
    paddingHorizontal: 12,
    flex: 1,
  },
  addTouch: {
    minHeight: size.minTouchTarget,
    paddingHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: color.slabPrimary,
  },
  addLabel: {
    color: color.onSlab,
  },
});
