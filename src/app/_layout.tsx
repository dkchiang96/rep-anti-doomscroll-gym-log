import { DarkTheme, DefaultTheme, ThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect, useState } from 'react';
import { useColorScheme } from 'react-native';

import { AnimatedSplashOverlay } from '@/components/animated-icon';
import AppTabs from '@/components/app-tabs';
import { initDatabase, type AppInit } from '@/data/db';
import { DatabaseProvider } from '@/data/DatabaseProvider';

SplashScreen.preventAutoHideAsync();

export default function TabLayout() {
  const colorScheme = useColorScheme();
  const [appInit, setAppInit] = useState<AppInit | null>(null);

  useEffect(() => {
    initDatabase().then(setAppInit);
  }, []);

  return (
    <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      <AnimatedSplashOverlay />
      {appInit ? (
        <DatabaseProvider value={appInit}>
          <AppTabs />
        </DatabaseProvider>
      ) : null}
    </ThemeProvider>
  );
}
