import { Pressable, StyleSheet, Text, View } from 'react-native';

import { formatDuration, tracks, type CardioMetric } from '@/domain/cardio';
import { strings } from '@/strings';
import { color, size, tabularNums, type } from '@/theme';

import { StepperButton } from './StepperButton';

// One round of a cardio / Hyrox station on the logging screen — the cardio
// counterpart of SetInputRow. Shows only the numbers the station tracks
// (its `track` from the programme file), each as − value + with the value
// tappable for the keypad. Ghost values render muted, confirmed white, same
// as SetInputRow. Invariant 8: the load convention label shows whenever the
// station tracks a load.

export type CardioField = 'distance' | 'time' | 'reps' | 'calories' | 'load';

const FIELD_ORDER: { field: CardioField; metric: CardioMetric }[] = [
  { field: 'distance', metric: 'distance_m' },
  { field: 'time', metric: 'time' },
  { field: 'reps', metric: 'reps' },
  { field: 'calories', metric: 'calories' },
  { field: 'load', metric: 'load_kg' },
];

type CardioRoundRowProps = {
  label: string;
  track: readonly CardioMetric[];
  weightKg: number;
  reps: number;
  distanceM: number | null;
  durationSeconds: number | null;
  calories: number | null;
  confirmed: boolean;
  conventionLabel: string;
  onStep: (field: CardioField, direction: 1 | -1) => void;
  onTap: (field: CardioField) => void;
  onRemove?: () => void;
};

function fieldHeading(field: CardioField): string {
  switch (field) {
    case 'distance':
      return strings.cardioDistanceHeading;
    case 'time':
      return strings.cardioTimeHeading;
    case 'reps':
      return strings.setInputRepsHeading;
    case 'calories':
      return strings.cardioCaloriesHeading;
    case 'load':
      return strings.setInputWeightHeading;
  }
}

export function CardioRoundRow({
  label,
  track,
  weightKg,
  reps,
  distanceM,
  durationSeconds,
  calories,
  confirmed,
  conventionLabel,
  onStep,
  onTap,
  onRemove,
}: CardioRoundRowProps) {
  const valueColor = confirmed ? color.textPrimary : color.textMuted;

  function display(field: CardioField): string {
    switch (field) {
      case 'distance':
        return distanceM != null ? String(Math.round(distanceM * 100) / 100) : '—';
      case 'time':
        return durationSeconds != null ? formatDuration(durationSeconds) : '—';
      case 'reps':
        return String(reps);
      case 'calories':
        return calories != null ? String(calories) : '—';
      case 'load':
        return String(weightKg);
    }
  }

  return (
    <View style={styles.root}>
      <Text style={[type.caption, styles.muted]}>{label}</Text>
      {FIELD_ORDER.filter((f) => tracks(track, f.metric)).map(({ field }) => (
        <View key={field}>
          <Text style={[type.caption, styles.groupCaption]}>{fieldHeading(field)}</Text>
          <View style={styles.controlRow}>
            <StepperButton label={strings.setInputStepperMinus} onPress={() => onStep(field, -1)} size={size.stepper} />
            <Pressable onPress={() => onTap(field)} style={styles.valueTouch}>
              <Text style={[type.display1, tabularNums, styles.value, { color: valueColor }]} numberOfLines={1} adjustsFontSizeToFit>
                {display(field)}
              </Text>
            </Pressable>
            <StepperButton label={strings.setInputStepperPlus} onPress={() => onStep(field, 1)} size={size.stepper} />
          </View>
        </View>
      ))}
      <View style={styles.metaRow}>
        <Text style={[type.caption, styles.muted]} numberOfLines={1}>
          {tracks(track, 'load_kg') ? conventionLabel : ''}
        </Text>
        {onRemove ? (
          <Pressable onPress={onRemove} style={styles.rowActionTouch}>
            <Text style={[type.caption, styles.rowActionLabel]}>{strings.transitionRemoveSetButton}</Text>
          </Pressable>
        ) : null}
      </View>
      <View style={styles.divider} />
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    minHeight: size.setRow,
    paddingHorizontal: 24,
    paddingVertical: 8,
  },
  muted: {
    color: color.textMuted,
    flexShrink: 1,
  },
  groupCaption: {
    color: color.textMuted,
    marginTop: 10,
  },
  controlRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
    gap: 8,
  },
  valueTouch: {
    flex: 1,
    minHeight: size.minTouchTarget,
    alignItems: 'center',
    justifyContent: 'center',
  },
  value: {
    textAlign: 'center',
  },
  metaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 4,
  },
  rowActionTouch: {
    minHeight: size.minTouchTarget,
    justifyContent: 'center',
  },
  rowActionLabel: {
    color: color.slabSecondary,
  },
  divider: {
    marginTop: 8,
    height: size.divider,
    backgroundColor: color.divider,
  },
});
