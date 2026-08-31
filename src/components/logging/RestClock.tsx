import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { formatElapsed } from '@/domain/duration';
import { strings } from '@/strings';
import { theme } from '@/theme';

import { Stepper } from './Stepper';
import type { RestSettings } from './useRestClock';

const MIN_INTERVAL_SECONDS = 5;

interface RestClockProps {
  elapsedMs: number;
  targetSeconds: number;
  running: boolean;
  settings: RestSettings;
  onSettingsChange: (patch: Partial<RestSettings>) => void;
}

export function RestClock({ elapsedMs, targetSeconds, running, settings, onSettingsChange }: RestClockProps) {
  const [settingsOpen, setSettingsOpen] = useState(false);
  const pastTarget = running && elapsedMs >= targetSeconds * 1000;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.label}>{strings.restClockLabel}</Text>
        <Pressable style={styles.settingsButton} onPress={() => setSettingsOpen((v) => !v)}>
          <Text style={styles.settingsButtonLabel}>{strings.restClockSettingsToggle}</Text>
        </Pressable>
      </View>

      <Text style={[styles.value, pastTarget && styles.valuePastTarget]}>{formatElapsed(elapsedMs)}</Text>
      <Text style={styles.target}>{strings.restClockTargetLabel(targetSeconds)}</Text>

      {settingsOpen ? (
        <View style={styles.settingsPanel}>
          <Text style={styles.settingsHeading}>{strings.restClockSettingsHeading}</Text>

          <View style={styles.settingsRow}>
            <Text style={styles.settingsRowLabel}>{strings.restClockIntervalLabel}</Text>
            <Stepper
              value={String(settings.flashIntervalSeconds)}
              unitLabel={strings.restClockIntervalUnit}
              onStep={(direction) =>
                onSettingsChange({
                  flashIntervalSeconds: Math.max(
                    MIN_INTERVAL_SECONDS,
                    settings.flashIntervalSeconds + direction * 5,
                  ),
                })
              }
              onTapValue={() => {}}
            />
          </View>

          <SettingsToggle
            label={strings.restClockSoundLabel}
            value={settings.soundEnabled}
            onToggle={() => onSettingsChange({ soundEnabled: !settings.soundEnabled })}
          />
          <SettingsToggle
            label={strings.restClockVibrationLabel}
            value={settings.vibrationEnabled}
            onToggle={() => onSettingsChange({ vibrationEnabled: !settings.vibrationEnabled })}
          />
          <SettingsToggle
            label={strings.restClockCameraFlashLabel}
            value={settings.cameraFlashEnabled}
            onToggle={() => onSettingsChange({ cameraFlashEnabled: !settings.cameraFlashEnabled })}
          />

          <Pressable style={styles.settingsDoneButton} onPress={() => setSettingsOpen(false)}>
            <Text style={styles.settingsDoneLabel}>{strings.restClockSettingsDone}</Text>
          </Pressable>
        </View>
      ) : null}
    </View>
  );
}

function SettingsToggle({ label, value, onToggle }: { label: string; value: boolean; onToggle: () => void }) {
  return (
    <Pressable style={styles.settingsRow} onPress={onToggle}>
      <Text style={styles.settingsRowLabel}>{label}</Text>
      <View style={[styles.toggle, value && styles.toggleOn]}>
        <Text style={styles.toggleLabel}>{value ? 'ON' : 'OFF'}</Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    gap: 2,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  label: {
    color: theme.color.textMuted,
    fontSize: 14,
    textTransform: 'uppercase',
  },
  settingsButton: {
    minWidth: 32,
    minHeight: 32,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  settingsButtonLabel: {
    color: theme.color.textMuted,
    fontSize: 16,
  },
  value: {
    color: theme.color.accentSecondary,
    fontSize: 56,
    fontWeight: '800',
    fontVariant: ['tabular-nums'],
  },
  valuePastTarget: {
    color: theme.color.accentPrimary,
  },
  target: {
    color: theme.color.textMuted,
    fontSize: 13,
    textTransform: 'uppercase',
  },
  settingsPanel: {
    marginTop: 10,
    width: '100%',
    backgroundColor: theme.color.surface,
    borderRadius: 12,
    padding: 12,
    gap: 10,
  },
  settingsHeading: {
    color: theme.color.textMuted,
    fontSize: 12,
    textTransform: 'uppercase',
  },
  settingsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  settingsRowLabel: {
    color: theme.color.textPrimary,
    fontSize: 15,
  },
  toggle: {
    minWidth: 56,
    minHeight: 36,
    borderRadius: 8,
    backgroundColor: theme.color.bg,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 10,
  },
  toggleOn: {
    backgroundColor: theme.color.accentSecondary,
  },
  toggleLabel: {
    color: theme.color.textPrimary,
    fontSize: 12,
    fontWeight: '700',
  },
  settingsDoneButton: {
    minHeight: theme.minTouchTarget,
    borderRadius: 10,
    backgroundColor: theme.color.bg,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 4,
  },
  settingsDoneLabel: {
    color: theme.color.textPrimary,
    fontSize: 14,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
});
