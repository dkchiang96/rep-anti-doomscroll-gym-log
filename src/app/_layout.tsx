import { DarkTheme, Stack, ThemeProvider } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect, useState } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { HomeHeaderButton } from '@/components/HomeHeaderButton';
import { FontGate } from '@/components/ui';
import { DatabaseProvider } from '@/data/DatabaseProvider';
import { initDatabase, type AppInit } from '@/data/db';
import { color, fontFamily, theme, type } from '@/theme';

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const [appInit, setAppInit] = useState<AppInit | null>(null);

  useEffect(() => {
    initDatabase().then(setAppInit);
  }, []);

  // FontGate mounts immediately so font loading starts concurrently with
  // DB init above, rather than waiting for it — see R1 plan.
  return (
    <SafeAreaProvider>
      <FontGate>
        <AppShell appInit={appInit} />
      </FontGate>
    </SafeAreaProvider>
  );
}

function AppShell({ appInit }: { appInit: AppInit | null }) {
  useEffect(() => {
    if (appInit) SplashScreen.hideAsync();
  }, [appInit]);

  if (!appInit) return null;

  return (
    <ThemeProvider value={DarkTheme}>
      <StatusBar style="light" />
      <DatabaseProvider value={appInit}>
        <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: theme.color.bg } }}>
          <Stack.Screen name="index" />
          {/* No header here — DESIGN-SPEC.md §5.1/R3: the live screen owns its
              own top-bar zone and deliberately has no back button. */}
          <Stack.Screen name="session" />
          {/* D10: the compact timer bar is persistent chrome, not a normal
              pushed screen with its own header — same treatment as session. */}
          <Stack.Screen name="transition" />
          <Stack.Screen name="settings" options={secondaryScreenHeaderOptions} />
          <Stack.Screen name="programmes" options={secondaryScreenHeaderOptions} />
          <Stack.Screen name="import-programme" options={secondaryScreenHeaderOptions} />
          <Stack.Screen name="import" options={secondaryScreenHeaderOptions} />
          <Stack.Screen name="archive" options={secondaryScreenHeaderOptions} />
          <Stack.Screen name="history" options={secondaryScreenHeaderOptions} />
          <Stack.Screen name="progress" options={secondaryScreenHeaderOptions} />
          <Stack.Screen name="export" options={secondaryScreenHeaderOptions} />
          <Stack.Screen name="debug" options={secondaryScreenHeaderOptions} />
        </Stack>
      </DatabaseProvider>
    </ThemeProvider>
  );
}

// DESIGN-SPEC.md §4: every secondary screen gets a `bar`-coloured header,
// Bebas Neue title, and a back control that falls back to Home when there's
// no push history — see HomeHeaderButton. Home itself has no native header
// (§5.6.1 starts directly with slabs).
const secondaryScreenHeaderOptions = {
  headerShown: true,
  headerTitleAlign: 'center' as const,
  headerShadowVisible: false,
  headerStyle: { backgroundColor: color.bar },
  headerTitleStyle: { ...type.heading, color: color.textPrimary, fontFamily: fontFamily.display },
  headerLeft: () => <HomeHeaderButton />,
};
