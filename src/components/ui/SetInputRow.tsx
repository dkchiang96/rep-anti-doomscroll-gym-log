import { Pressable, StyleSheet, Text, View } from 'react-native';

import { strings } from '@/strings';
import { color, size, tabularNums, type } from '@/theme';

import { StepperButton } from './StepperButton';

// DESIGN-SPEC.md §5.7 — the transition-screen set row. Ghost values (last
// session's) render text-muted; confirmed values render text-primary.
// Invariant 8: conventionLabel/totalLine are always visible, never optional —
// this is a data-integrity control, not decoration.

type SetInputRowProps = {
  setLabel: string;
  weightKg: number;
  reps: number;
  confirmed: boolean;
  warmup?: boolean;
  disabled?: boolean;
  /** Indents the row under its parent working set — DESIGN-SPEC.md §3.8's drop-set attachment. */
  indent?: boolean;
  conventionLabel: string;
  totalLine?: string | null;
  /** Item 6: exercise uses the bodyweight convention — shows the BW toggle under W. */
  bodyweightRelevant?: boolean;
  onWeightStep: (direction: 1 | -1) => void;
  onRepsStep: (direction: 1 | -1) => void;
  onToggleWarmup?: () => void;
  /** Zeroes this row's weight (pure bodyweight, no added weight). Highlight is derived from weightKg === 0, not separate state. */
  onSetBodyweight?: () => void;
  /** Tapping the numeral opens a full-width keypad (or the plate calculator) per §5.7. */
  onTapWeight?: () => void;
  onTapReps?: () => void;
  onAddDropSet?: () => void;
  onRemove?: () => void;
  /** Left/right tracking: shows the L / R button, which opens the split screen. */
  onOpenSplit?: () => void;
  /** Set when this set is split into left/right — the row then shows a read-only summary instead of steppers. */
  split?: { leftKg: number; leftReps: number; rightKg: number; rightReps: number } | null;
};

export function SetInputRow({
  setLabel,
  weightKg,
  reps,
  confirmed,
  warmup = false,
  disabled = false,
  indent = false,
  conventionLabel,
  totalLine,
  bodyweightRelevant = false,
  onWeightStep,
  onRepsStep,
  onToggleWarmup,
  onSetBodyweight,
  onTapWeight,
  onTapReps,
  onAddDropSet,
  onRemove,
  onOpenSplit,
  split = null,
}: SetInputRowProps) {
  const valueColor = confirmed ? color.textPrimary : color.textMuted;
  const bodyweightOn = bodyweightRelevant && weightKg === 0;

  return (
    <View style={[styles.root, indent ? styles.indent : null, disabled ? styles.disabled : null]}>
      <View style={styles.headerRow}>
        <Text style={[type.caption, styles.headerLabel]}>{setLabel}</Text>
        {onOpenSplit ? (
          <Pressable
            onPress={onOpenSplit}
            disabled={disabled}
            style={[styles.splitToggle, split ? styles.splitToggleOn : null]}
          >
            <Text style={[type.caption, { color: split ? color.onSlab : color.textPrimary }]}>
              {strings.setInputSplitButton}
            </Text>
          </Pressable>
        ) : null}
      </View>

      {split ? (
        // A left/right split set: one read-only summary line, edited only on
        // the split screen, so the everyday row stays exactly as it was.
        <Pressable onPress={onOpenSplit} disabled={!onOpenSplit || disabled} style={styles.splitSummaryTouch}>
          <Text
            style={[type.heading, tabularNums, { color: valueColor }]}
            numberOfLines={1}
            adjustsFontSizeToFit
            minimumFontScale={0.7}
          >
            {strings.setInputSplitSummary(split.leftKg, split.leftReps, split.rightKg, split.rightReps)}
          </Text>
          <Text style={[type.caption, styles.headerLabel]}>{strings.setInputSplitEditHint}</Text>
        </Pressable>
      ) : (
        <>

      {/* Weight and reps controls stack vertically, each getting the row's
          full width — DESIGN-SPEC §5.7's side-by-side mock doesn't leave
          room for two 72dp stepper pairs plus a 64pt numeral on a real
          phone width; on-device testing showed the numerals squeezed to
          near-zero width and effectively invisible. */}
      <Text style={[type.caption, styles.groupCaption]}>{strings.setInputWeightHeading}</Text>
      <View style={styles.controlRow}>
        {/* Item: BW zeroes the weight field, so it sits on the weight row —
            W (warm-up) moved to the reps row below, since it marks the whole
            set rather than the weight specifically. */}
        {bodyweightRelevant ? (
          <Pressable
            onPress={onSetBodyweight}
            disabled={!onSetBodyweight || disabled}
            style={[styles.warmupToggle, bodyweightOn ? styles.warmupToggleOn : null]}
          >
            <Text style={[type.caption, { color: bodyweightOn ? color.onSlab : color.textPrimary }]}>
              {strings.setInputBodyweightGlyph}
            </Text>
          </Pressable>
        ) : (
          <View style={styles.warmupSpacer} />
        )}
        <StepperButton
          label={strings.setInputStepperMinus}
          onPress={() => onWeightStep(-1)}
          size={size.stepper}
          disabled={disabled}
        />
        <Pressable onPress={onTapWeight} disabled={!onTapWeight || disabled} style={styles.valueTouch}>
          <Text style={[type.display1, tabularNums, styles.value, { color: valueColor }]} numberOfLines={1}>
            {weightKg}
          </Text>
        </Pressable>
        <StepperButton
          label={strings.setInputStepperPlus}
          onPress={() => onWeightStep(1)}
          size={size.stepper}
          disabled={disabled}
        />
      </View>

      <Text style={[type.caption, styles.groupCaption]}>{strings.setInputRepsHeading}</Text>
      <View style={styles.controlRow}>
        <Pressable
          onPress={onToggleWarmup}
          disabled={!onToggleWarmup || disabled}
          style={[styles.warmupToggle, warmup ? styles.warmupToggleOn : null]}
        >
          <Text style={[type.label, { color: warmup ? color.onSlab : color.textPrimary }]}>
            {strings.setInputWarmupGlyph}
          </Text>
        </Pressable>
        <StepperButton
          label={strings.setInputStepperMinus}
          onPress={() => onRepsStep(-1)}
          size={size.stepper}
          disabled={disabled}
        />
        <Pressable onPress={onTapReps} disabled={!onTapReps || disabled} style={styles.valueTouch}>
          <Text style={[type.display1, tabularNums, styles.value, { color: valueColor }]} numberOfLines={1}>
            {reps}
          </Text>
        </Pressable>
        <StepperButton
          label={strings.setInputStepperPlus}
          onPress={() => onRepsStep(1)}
          size={size.stepper}
          disabled={disabled}
        />
      </View>
        </>
      )}

      <View style={styles.metaRow}>
        <Text style={[type.caption, styles.conventionLabel]} numberOfLines={1}>
          {conventionLabel}
          {totalLine ? ` · ${totalLine}` : ''}
        </Text>
        <View style={styles.rowActions}>
          {onAddDropSet ? (
            <Pressable onPress={onAddDropSet} style={styles.rowActionTouch}>
              <Text style={[type.caption, styles.rowActionLabel]}>{strings.transitionAddDropSetButton}</Text>
            </Pressable>
          ) : null}
          {onRemove ? (
            <Pressable onPress={onRemove} style={styles.rowActionTouch}>
              <Text style={[type.caption, styles.rowActionLabel]}>{strings.transitionRemoveSetButton}</Text>
            </Pressable>
          ) : null}
        </View>
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
    justifyContent: 'center',
  },
  indent: {
    paddingLeft: 48,
  },
  disabled: {
    opacity: 0.5,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  headerLabel: {
    color: color.textMuted,
  },
  splitToggle: {
    minWidth: size.minTouchTarget,
    minHeight: size.minTouchTarget,
    paddingHorizontal: 8,
    borderWidth: 2,
    borderColor: color.divider,
    alignItems: 'center',
    justifyContent: 'center',
  },
  splitToggleOn: {
    backgroundColor: color.slabSecondary,
    borderColor: color.slabSecondary,
  },
  splitSummaryTouch: {
    minHeight: size.minTouchTarget * 2,
    justifyContent: 'center',
    marginTop: 4,
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
  warmupToggle: {
    width: size.warmupToggle,
    height: size.warmupToggle,
    borderWidth: 2,
    borderColor: color.divider,
    alignItems: 'center',
    justifyContent: 'center',
  },
  warmupToggleOn: {
    backgroundColor: color.slabSecondary,
    borderColor: color.slabSecondary,
  },
  warmupSpacer: {
    width: size.warmupToggle,
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
  conventionLabel: {
    color: color.textMuted,
    flexShrink: 1,
  },
  rowActions: {
    flexDirection: 'row',
    gap: 16,
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
