import { useEffect, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Path } from 'react-native-svg';

import {
  Clock,
  FlashOverlay,
  ListRow,
  SetInputRow,
  Slab,
  StepperButton,
  TransportButton,
  TransportResetButton,
} from '@/components/ui';
import type { FlashOverlayHandle } from '@/components/ui';
import { strings } from '@/strings';
import { color, liveZoneFlex, size, tabularNums, type } from '@/theme';

// R1 throwaway. Proves the design system on one screen before any real
// screen is built — see docs/DESIGN-SPEC.md §7 and docs/REBUILD-SESSIONS.md
// R1. Deleted once the gate passes and R2 builds the real Home screen.

const FIXED_ELAPSED_MS = (12 * 60 + 47) * 1000; // 12:47, per the brief
const FAST_FORWARD_START_MS = (59 * 60 + 50) * 1000; // 59:50
const FAST_FORWARD_END_MS = (60 * 60 + 10) * 1000; // 60:10

export default function Showcase() {
  const insets = useSafeAreaInsets();
  const { height: windowHeight } = useWindowDimensions();
  const flashRef = useRef<FlashOverlayHandle>(null);

  const [elapsedMs, setElapsedMs] = useState(FIXED_ELAPSED_MS);
  const [fastForwarding, setFastForwarding] = useState(false);

  useEffect(() => {
    if (!fastForwarding) return;
    const id = setInterval(() => {
      setElapsedMs((prev) => {
        const next = prev + 1000;
        if (next >= FAST_FORWARD_END_MS) {
          clearInterval(id);
          setFastForwarding(false);
          return FIXED_ELAPSED_MS;
        }
        return next;
      });
    }, 100);
    return () => clearInterval(id);
  }, [fastForwarding]);

  const [setsDone, setSetsDone] = useState(3);
  const [toggleOn, setToggleOn] = useState(true);
  const [confirmedWeight, setConfirmedWeight] = useState(22.5);
  const [confirmedReps, setConfirmedReps] = useState(10);
  const [ghostWeight, setGhostWeight] = useState(20);
  const [ghostReps, setGhostReps] = useState(10);
  const [ghostConfirmed, setGhostConfirmed] = useState(false);
  const [warmup, setWarmup] = useState(false);

  const zoneAvailable = windowHeight - insets.top - insets.bottom - size.topBar - size.bottomSlab;
  const flexTotal = liveZoneFlex.yellow + liveZoneFlex.lime + liveZoneFlex.canvas;
  const yellowHeight = (zoneAvailable * liveZoneFlex.yellow) / flexTotal;
  const limeHeight = (zoneAvailable * liveZoneFlex.lime) / flexTotal;
  const canvasHeight = (zoneAvailable * liveZoneFlex.canvas) / flexTotal;

  return (
    <View style={styles.root}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={[styles.topBar, { paddingTop: insets.top }]}>
          <Svg width={14} height={22} viewBox="0 0 14 22" style={styles.backChevron}>
            <Path d="M12 2 L2 11 L12 20" stroke={color.textPrimary} strokeWidth={2.5} fill="none" strokeLinecap="round" strokeLinejoin="round" />
          </Svg>
          <Text style={[type.heading, styles.topBarTitle]}>{strings.showcaseTopBarTitle}</Text>
        </View>

        <Slab tone="primary" height={yellowHeight}>
          <Text style={[type.display2, styles.onSlabText]}>{strings.showcaseExerciseName}</Text>
          <Clock elapsedMs={elapsedMs} />
        </Slab>

        <Slab tone="secondary" height={limeHeight}>
          <Text style={[type.label, styles.onSlabText]}>{strings.showcaseTargetHeading}</Text>
          <Text style={[type.display1, styles.onSlabText]}>{strings.showcaseTargetValue}</Text>
        </Slab>

        <View style={[styles.canvas, { height: canvasHeight }]}>
          <View style={styles.setsDoneGroup}>
            <StepperButton
              label={strings.setInputStepperMinus}
              onPress={() => setSetsDone((n) => Math.max(0, n - 1))}
              size={size.minTouchTarget}
            />
            <View style={styles.canvasColumn}>
              <Text style={[type.display1, tabularNums, styles.canvasNumeral]}>{setsDone}</Text>
              <Text style={[type.caption, styles.canvasCaption]}>{strings.showcaseSetsDoneLabel}</Text>
            </View>
            <StepperButton
              label={strings.setInputStepperPlus}
              onPress={() => setSetsDone((n) => n + 1)}
              size={size.minTouchTarget}
            />
          </View>
          <View style={styles.transportGroup}>
            <TransportResetButton onLongPress={() => setElapsedMs(0)} />
            <TransportButton state="start" onPress={() => {}} label={strings.showcaseTransportStartLabel} />
          </View>
        </View>

        <Slab tone="primary" height={size.bottomSlab}>
          <Text style={[type.label, styles.onSlabText]}>{strings.showcaseNextExerciseLabel}</Text>
        </Slab>

        <View style={styles.demoSection}>
          <Pressable style={styles.demoButton} onPress={() => flashRef.current?.fire()}>
            <Text style={[type.label, styles.demoButtonText]}>{strings.showcaseFlashTriggerLabel}</Text>
          </Pressable>

          <Pressable
            style={styles.demoButton}
            disabled={fastForwarding}
            onPress={() => {
              setElapsedMs(FAST_FORWARD_START_MS);
              setFastForwarding(true);
            }}
          >
            <Text style={[type.label, styles.demoButtonText]}>{strings.showcaseFastForwardLabel}</Text>
          </Pressable>

          <SetInputRow
            setLabel={strings.showcaseSetInputConfirmedLabel}
            weightKg={confirmedWeight}
            reps={confirmedReps}
            confirmed
            warmup={warmup}
            onToggleWarmup={() => setWarmup((w) => !w)}
            onWeightStep={(d) => setConfirmedWeight((w) => Math.max(0, w + d * 2.5))}
            onRepsStep={(d) => setConfirmedReps((r) => Math.max(0, r + d))}
          />
          <SetInputRow
            setLabel={strings.showcaseSetInputGhostLabel}
            weightKg={ghostWeight}
            reps={ghostReps}
            confirmed={ghostConfirmed}
            onWeightStep={(d) => {
              setGhostConfirmed(true);
              setGhostWeight((w) => Math.max(0, w + d * 2.5));
            }}
            onRepsStep={(d) => {
              setGhostConfirmed(true);
              setGhostReps((r) => Math.max(0, r + d));
            }}
          />

          <ListRow variant="navigation" label={strings.showcaseListRowNavLabel} onPress={() => {}} />
          <ListRow variant="toggle" label={strings.showcaseListRowToggleLabel} value={toggleOn} onValueChange={setToggleOn} />
          <ListRow
            variant="value"
            label={strings.showcaseListRowValueLabel}
            valueLabel={strings.showcaseListRowValueValue}
            onPress={() => {}}
          />
        </View>
      </ScrollView>

      <FlashOverlay ref={flashRef} />
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: color.bg,
  },
  scrollContent: {
    flexGrow: 1,
  },
  topBar: {
    height: size.topBar,
    backgroundColor: color.bar,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
  backChevron: {
    position: 'absolute',
    left: 16,
  },
  topBarTitle: {
    color: color.textPrimary,
  },
  onSlabText: {
    color: color.onSlab,
    textAlign: 'center',
  },
  canvas: {
    width: '100%',
    backgroundColor: color.bg,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-evenly',
  },
  setsDoneGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  canvasColumn: {
    alignItems: 'center',
    minWidth: 56,
  },
  canvasNumeral: {
    color: color.textPrimary,
  },
  canvasCaption: {
    color: color.textMuted,
  },
  transportGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  demoSection: {
    marginTop: 24,
    paddingBottom: 24,
  },
  demoButton: {
    minHeight: size.minTouchTarget,
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  demoButtonText: {
    color: color.slabSecondary,
  },
});
