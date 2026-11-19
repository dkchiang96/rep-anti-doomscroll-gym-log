import { Pressable, StyleSheet, Text, View } from 'react-native';

import { formatDuration } from '@/domain/cardio';
import { useInstrumentationStore } from '@/state/instrumentationStore';
import { strings } from '@/strings';
import { color, size, tabularNums, type } from '@/theme';

// Cardio lap timer control for the live screen (replaces the sets-done
// tally for a cardio station that tracks time). Tap to start a round's lap,
// tap again to stop and record it. Long-press while running discards a lap
// started by mistake, the same long-press-to-undo gesture the sets-done
// tally uses.

type LapButtonProps = {
  running: boolean;
  lapElapsedSeconds: number;
  roundsDone: number;
  targetRounds: number | null;
  onStart: () => void;
  onStop: () => void;
  onCancel: () => void;
};

export function LapButton({ running, lapElapsedSeconds, roundsDone, targetRounds, onStart, onStop, onCancel }: LapButtonProps) {
  const recordTap = useInstrumentationStore((s) => s.recordTap);

  return (
    <View style={styles.wrap}>
      <Pressable
        onPress={() => {
          recordTap();
          if (running) onStop();
          else onStart();
        }}
        onLongPress={running ? onCancel : undefined}
        delayLongPress={600}
        style={[styles.button, running ? styles.buttonRunning : null]}
      >
        <Text style={[type.label, { color: running ? color.onSlab : color.textPrimary }]}>
          {running ? strings.lapStopLabel : strings.lapStartLabel}
        </Text>
        <Text style={[type.display1, tabularNums, { color: running ? color.onSlab : color.textPrimary }]} numberOfLines={1} adjustsFontSizeToFit>
          {formatDuration(running ? lapElapsedSeconds : 0)}
        </Text>
      </Pressable>
      <Text style={[type.caption, styles.rounds]}>{strings.lapRoundsLabel(roundsDone, targetRounds)}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignItems: 'center',
  },
  button: {
    width: size.transportLarge * 1.3,
    minHeight: size.transportLarge,
    borderWidth: 2,
    borderColor: color.slabSecondary,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 8,
  },
  buttonRunning: {
    backgroundColor: color.slabSecondary,
  },
  rounds: {
    color: color.textMuted,
    marginTop: 6,
  },
});
