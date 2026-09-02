import { forwardRef, useImperativeHandle, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { color } from '@/theme';

// DESIGN-SPEC.md §5.4 (D11) — the 30s rest-estimator cue. A 3-pulse burst,
// ~100ms on / ~100ms off, covering the whole screen including the status
// bar. Render this as a sibling of the screen root, never inside a
// ScrollView — an absolutely-positioned overlay inside a scroll view clips
// and scrolls with the content instead of covering the physical screen.

const PULSE_MS = 100;
const PULSE_COUNT = 3;

export type FlashOverlayHandle = {
  fire: () => void;
};

type FlashOverlayProps = {
  tone?: 'primary' | 'secondary';
};

export const FlashOverlay = forwardRef<FlashOverlayHandle, FlashOverlayProps>(function FlashOverlay(
  { tone = 'secondary' },
  ref,
) {
  const [visible, setVisible] = useState(false);
  const sequence = useRef(0);

  useImperativeHandle(ref, () => ({
    fire() {
      const mySequence = ++sequence.current;
      const pulse = (pulseIndex: number) => {
        if (sequence.current !== mySequence) return;
        setVisible(true);
        setTimeout(() => {
          if (sequence.current !== mySequence) return;
          setVisible(false);
          if (pulseIndex < PULSE_COUNT - 1) {
            setTimeout(() => pulse(pulseIndex + 1), PULSE_MS);
          }
        }, PULSE_MS);
      };
      pulse(0);
    },
  }));

  if (!visible) return null;

  const backgroundColor = tone === 'primary' ? color.slabPrimary : color.slabSecondary;
  return <View pointerEvents="none" style={[StyleSheet.absoluteFill, styles.overlay, { backgroundColor }]} />;
});

const styles = StyleSheet.create({
  overlay: {
    zIndex: 999,
  },
});
