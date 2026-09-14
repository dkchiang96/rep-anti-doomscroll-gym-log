import { Stack, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet } from 'react-native';

import { ListRow } from '@/components/ui';
import { NumericKeypad } from '@/components/transition/NumericKeypad';
import { useDatabase } from '@/data/DatabaseProvider';
import { getUser, updateRestSettings } from '@/data/repositories/userRepository';
import { useFlashPreferenceStore } from '@/state/flashPreferenceStore';
import { strings } from '@/strings';
import { color } from '@/theme';

// DESIGN-SPEC.md §5.6/§6 screen 7 — flash interval, flash colour, and nav
// rows to Import/Export/Archive/Debug. Sound/vibration/camera-flash cue
// toggles are deliberately omitted: those columns are dead (R0 removed the
// expo-haptics/audio/camera engine that used to read them), and building
// live switches for something that changes nothing would be a half-finished
// feature — see docs/PROGRESS.md's R5 entry.
//
// Item 5 (this session's punch list): the plate inventory editor that used
// to live here is removed entirely, along with the plate calculator it fed
// (transition.tsx now opens the plain numeric keypad for every exercise,
// barbell/plate-loaded included) — user's explicit call after confirming
// this over keeping it. The plateInventory table/repository and
// src/domain/plates.ts are left in place, untouched and now unused, same
// precedent R0 set for the dead rest-cue schema columns.

export default function Settings() {
  const { db, userId } = useDatabase();
  const router = useRouter();
  const flashTone = useFlashPreferenceStore((s) => s.tone);
  const setFlashTone = useFlashPreferenceStore((s) => s.setTone);

  const [flashIntervalSeconds, setFlashIntervalSeconds] = useState<number | null>(null);
  const [intervalKeypadOpen, setIntervalKeypadOpen] = useState(false);
  const [notificationsEnabled, setNotificationsEnabled] = useState<boolean | null>(null);

  useEffect(() => {
    void getUser(db, userId).then((user) => {
      setFlashIntervalSeconds(user?.restFlashIntervalSeconds ?? 30);
      setNotificationsEnabled(user?.restNotificationEnabled ?? true);
    });
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

  function handleToggleNotifications(next: boolean) {
    setNotificationsEnabled(next);
    void updateRestSettings(db, userId, { restNotificationEnabled: next });
  }

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
      {notificationsEnabled != null ? (
        <ListRow
          variant="toggle"
          label={strings.settingsNotificationLabel}
          value={notificationsEnabled}
          onValueChange={handleToggleNotifications}
        />
      ) : null}

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
});
