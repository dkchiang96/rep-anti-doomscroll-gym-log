import { DarkTheme, Stack, ThemeProvider } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect, useState } from 'react';

import { DatabaseProvider } from '@/data/DatabaseProvider';
import { initDatabase, type AppInit } from '@/data/db';
import { strings } from '@/strings';
import { theme } from '@/theme';

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const [appInit, setAppInit] = useState<AppInit | null>(null);

  useEffect(() => {
    initDatabase().then((init) => {
      setAppInit(init);
      SplashScreen.hideAsync();
    });
  }, []);

  if (!appInit) return null;

  return (
    <ThemeProvider value={DarkTheme}>
      <StatusBar style="light" />
      <DatabaseProvider value={appInit}>
        <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: theme.color.bg } }}>
          <Stack.Screen
            name="import"
            options={{
              headerShown: true,
              title: strings.importTitle,
              headerStyle: { backgroundColor: theme.color.bg },
              headerTintColor: theme.color.textPrimary,
            }}
          />
          <Stack.Screen
            name="programmes"
            options={{
              headerShown: true,
              title: strings.programmesTitle,
              headerStyle: { backgroundColor: theme.color.bg },
              headerTintColor: theme.color.textPrimary,
            }}
          />
          <Stack.Screen
            name="import-programme"
            options={{
              headerShown: true,
              title: strings.programmeImportTitle,
              headerStyle: { backgroundColor: theme.color.bg },
              headerTintColor: theme.color.textPrimary,
            }}
          />
        </Stack>
      </DatabaseProvider>
    </ThemeProvider>
  );
}
