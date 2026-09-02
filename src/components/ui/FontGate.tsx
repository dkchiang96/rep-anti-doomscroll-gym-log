import { BebasNeue_400Regular } from '@expo-google-fonts/bebas-neue';
import { Inter_400Regular, Inter_600SemiBold } from '@expo-google-fonts/inter';
import { useFonts } from 'expo-font';
import * as SplashScreen from 'expo-splash-screen';
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { strings } from '@/strings';
import { color, fontFamily, tabularNums } from '@/theme';

// F1 fix: the previous build fell back to the system font with no error
// when Bebas Neue failed to load. This gate never renders app content
// without a confirmed font load, and surfaces failure visibly instead of
// silently substituting the system sans.

type ClockMetrics = {
  /** Rendered width of a single tabular digit, per 1pt of font size. */
  digitWidthPerUnit: number;
  /** Rendered width of ":", per 1pt of font size. */
  colonWidthPerUnit: number;
};

const ClockMetricsContext = createContext<ClockMetrics | null>(null);

export function useClockMetrics(): ClockMetrics {
  const ctx = useContext(ClockMetricsContext);
  if (!ctx) throw new Error('useClockMetrics must be used within FontGate');
  return ctx;
}

const PROBE_FONT_SIZE = 200;

export function FontGate({ children }: { children: ReactNode }) {
  const [fontsLoaded, fontError] = useFonts({
    [fontFamily.display]: BebasNeue_400Regular,
    [fontFamily.body]: Inter_400Regular,
    [fontFamily.bodySemiBold]: Inter_600SemiBold,
  });

  const [digitWidth, setDigitWidth] = useState<number | null>(null);
  const [colonWidth, setColonWidth] = useState<number | null>(null);
  const metrics: ClockMetrics | null =
    digitWidth != null && colonWidth != null
      ? { digitWidthPerUnit: digitWidth / PROBE_FONT_SIZE, colonWidthPerUnit: colonWidth / PROBE_FONT_SIZE }
      : null;

  useEffect(() => {
    if (!fontError) return;
    console.error('[FontGate] font load failed', fontError);
    // AppShell (which normally hides the splash once the DB is ready) never
    // mounts on this path, so the error would otherwise stay hidden behind
    // the native splash screen forever.
    SplashScreen.hideAsync();
  }, [fontError]);

  if (fontError) {
    return (
      <View style={styles.errorRoot}>
        <Text style={styles.errorText}>{strings.fontGateError}</Text>
      </View>
    );
  }

  if (!fontsLoaded) return null;

  if (!metrics) {
    return (
      <>
        <Text
          style={[styles.probe, tabularNums, { fontFamily: fontFamily.display, fontSize: PROBE_FONT_SIZE }]}
          onLayout={(e) => setDigitWidth(e.nativeEvent.layout.width)}
        >
          0
        </Text>
        <Text
          style={[styles.probe, tabularNums, { fontFamily: fontFamily.display, fontSize: PROBE_FONT_SIZE }]}
          onLayout={(e) => setColonWidth(e.nativeEvent.layout.width)}
        >
          :
        </Text>
      </>
    );
  }

  return <ClockMetricsContext.Provider value={metrics}>{children}</ClockMetricsContext.Provider>;
}

const styles = StyleSheet.create({
  errorRoot: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: color.danger,
    paddingHorizontal: 24,
  },
  errorText: {
    color: color.onSlab,
    fontFamily: fontFamily.body,
    fontSize: 16,
    textAlign: 'center',
  },
  probe: {
    position: 'absolute',
    opacity: 0,
    left: -9999,
    top: -9999,
  },
});
