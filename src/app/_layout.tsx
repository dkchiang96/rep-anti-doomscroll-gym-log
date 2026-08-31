import { DarkTheme, Stack, ThemeProvider } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect, useState } from 'react';

import { HomeHeaderButton } from '@/components/HomeHeaderButton';
import { DatabaseProvider } from '@/data/DatabaseProvider';
import { initDatabase, type AppInit } from '@/data/db';
import { strings } from '@/strings';
import { theme } from '@/theme';

const secondaryScreenHeaderOptions = {
  headerShown: true,
  headerStyle: { backgroundColor: theme.color.bg },
  headerTintColor: theme.color.textPrimary,
  headerLeft: () => <HomeHeaderButton />,
} as const;

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
            options={{ ...secondaryScreenHeaderOptions, title: strings.importTitle }}
          />
          <Stack.Screen
            name="programmes"
            options={{ ...secondaryScreenHeaderOptions, title: strings.programmesTitle }}
          />
          <Stack.Screen
            name="import-programme"
            options={{ ...secondaryScreenHeaderOptions, title: strings.programmeImportTitle }}
          />
          <Stack.Screen
            name="progress"
            options={{ ...secondaryScreenHeaderOptions, title: strings.progressTitle }}
          />
          <Stack.Screen
            name="archive"
            options={{ ...secondaryScreenHeaderOptions, title: strings.archiveTitle }}
          />
          <Stack.Screen
            name="export"
            options={{ ...secondaryScreenHeaderOptions, title: strings.exportTitle }}
          />
          <Stack.Screen
            name="debug"
            options={{ ...secondaryScreenHeaderOptions, title: strings.debugTitle }}
          />
        </Stack>
      </DatabaseProvider>
    </ThemeProvider>
  );
}
