import { useEffect, useRef } from 'react';
import { AppState, Platform } from 'react-native';
import Constants from 'expo-constants';

import { strings } from '@/strings';

// Punch-list item 3: while the rest clock is running and you leave the app,
// a repeating local notification nudges you every restFlashIntervalSeconds
// so you don't drift into another app. Mirrors exactly when the on-screen
// flash overlay fires (see didCrossInterval in session.tsx/transition.tsx),
// just reaching you outside the app too. Local scheduling only — no push
// token, no network call (invariant 11).

export const REST_NOTIFICATION_CHANNEL_ID = 'rest-reminder';

// As of SDK 53, expo-notifications throws on Android as soon as it's
// imported inside Expo Go (push support was dropped there), which crashed
// the whole app since _layout.tsx pulls this module in at startup. Load it
// lazily and only outside Expo Go so the feature no-ops under Expo Go
// instead of taking the app down; it still works in a dev build.
const isExpoGo = Constants.appOwnership === 'expo';

function getNotifications(): typeof import('expo-notifications') | null {
  if (isExpoGo) return null;
  return require('expo-notifications');
}

// Called once at app start (src/app/_layout.tsx). A no-op off-Android.
export async function ensureRestNotificationChannel(): Promise<void> {
  if (Platform.OS !== 'android') return;
  const Notifications = getNotifications();
  if (!Notifications) return;
  await Notifications.setNotificationChannelAsync(REST_NOTIFICATION_CHANNEL_ID, {
    name: strings.restNotificationChannelName,
    importance: Notifications.AndroidImportance.DEFAULT,
  });
}

export function useRestNotifications({ enabled, intervalSeconds }: { enabled: boolean; intervalSeconds: number }) {
  const scheduledIdRef = useRef<string | null>(null);

  useEffect(() => {
    const Notifications = getNotifications();
    if (!Notifications) return;

    async function cancelScheduled() {
      const id = scheduledIdRef.current;
      if (!id) return;
      scheduledIdRef.current = null;
      await Notifications!.cancelScheduledNotificationAsync(id);
    }

    async function scheduleForBackground() {
      if (scheduledIdRef.current) return;
      // Requested lazily on first arm, same graceful-degrade pattern the
      // rest clock's camera-flash cue used: silently do nothing if denied,
      // never block the toggle itself.
      let { status } = await Notifications!.getPermissionsAsync();
      if (status !== 'granted') {
        ({ status } = await Notifications!.requestPermissionsAsync());
      }
      if (status !== 'granted') return;

      scheduledIdRef.current = await Notifications!.scheduleNotificationAsync({
        content: { title: strings.restNotificationTitle, body: strings.restNotificationBody },
        trigger: {
          type: Notifications!.SchedulableTriggerInputTypes.TIME_INTERVAL,
          seconds: Math.max(5, Math.round(intervalSeconds)),
          repeats: true,
          channelId: REST_NOTIFICATION_CHANNEL_ID,
        },
      });
    }

    if (!enabled) {
      void cancelScheduled();
      return;
    }

    function handleAppStateChange(state: string) {
      if (state === 'background') void scheduleForBackground();
      else void cancelScheduled();
    }

    const subscription = AppState.addEventListener('change', handleAppStateChange);
    return () => {
      subscription.remove();
      void cancelScheduled();
    };
  }, [enabled, intervalSeconds]);
}
