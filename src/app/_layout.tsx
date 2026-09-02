import { DarkTheme, Stack, ThemeProvider } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect, useState } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { FontGate } from '@/components/ui';
import { DatabaseProvider } from '@/data/DatabaseProvider';
import { initDatabase, type AppInit } from '@/data/db';
import { theme } from '@/theme';

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
        <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: theme.color.bg } }} />
      </DatabaseProvider>
    </ThemeProvider>
  );
}
