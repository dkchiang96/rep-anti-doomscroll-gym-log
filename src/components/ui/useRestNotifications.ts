import { useEffect } from 'react';
import { AppState, Platform } from 'react-native';
import Constants from 'expo-constants';

import { upcomingIntervalBoundaries } from '@/domain/stopwatch';
import { useStopwatchStore } from '@/state/stopwatchStore';
import { strings } from '@/strings';

// While the rest clock is running and you leave the app, local notifications
// nudge you at the same elapsed-time boundaries the on-screen flash fires at
// (see didCrossInterval in session.tsx/transition.tsx), so you don't drift
// into another app. Local scheduling only — no push token, no network call
// (invariant 11).
//
// Deliberately a finite batch of one-shot notifications, never an open-ended
// repeating one: the OS keeps delivering scheduled notifications after the
// app is swiped away, so the worst case has to be bounded. Everything is
// cancelled on foreground, pause/reset/end, toggle-off and next app launch.

export const REST_NOTIFICATION_CHANNEL_ID = 'rest-reminder';

// How far ahead of leaving the app reminders are scheduled. Covers a long
// rest; caps the stray buzzes if the app is killed while backgrounded.
const HORIZON_MS = 10 * 60 * 1000;

// As of SDK 53, expo-notifications throws on Android as soon as it's
// imported inside Expo Go (push support was dropped there), which crashed
// the whole app since _layout.tsx pulls this module in at startup. Load it
// lazily and only outside Expo Go so the feature no-ops under Expo Go
// instead of taking the app down; it still works in a dev build.
const isExpoGo = Constants.appOwnership === 'expo';

function getNotifications(): typeof import('expo-notifications') | null {
  if (isExpoGo) return null;
  // Lazy require is deliberate: a static import crashes Expo Go at startup.
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  return require('expo-notifications');
}

// Every arm/disarm goes through one module-level queue, so calls run in the
// order they were made even though each awaits the OS. Without this, a
// foreground cancel could run before an in-flight schedule finished and leave
// that batch orphaned; and two mounted screens (session sits under
// transition in the stack) could each schedule their own duplicate batch.
let queue: Promise<void> = Promise.resolve();
function enqueue(task: () => Promise<void>): Promise<void> {
  queue = queue.then(task).catch(() => {
    // A notification failure must never surface into the workout screens.
  });
  return queue;
}

async function cancelAll(): Promise<void> {
  const Notifications = getNotifications();
  if (!Notifications) return;
  // The app has no other scheduled notifications, so clearing all is exact.
  await Notifications.cancelAllScheduledNotificationsAsync();
}

async function scheduleBatch(intervalMs: number): Promise<void> {
  const Notifications = getNotifications();
  if (!Notifications) return;
  const { clock } = useStopwatchStore.getState();
  // Only a clock that is running right now warrants reminders.
  if (clock.clockStartedAt === null || clock.clockPausedAt !== null) return;

  // Requested lazily on first arm: silently do nothing if denied, never
  // block the toggle itself.
  let { status } = await Notifications.getPermissionsAsync();
  if (status !== 'granted') {
    ({ status } = await Notifications.requestPermissionsAsync());
  }
  if (status !== 'granted') return;

  await Notifications.cancelAllScheduledNotificationsAsync();
  const times = upcomingIntervalBoundaries(
    clock.clockStartedAt.getTime(),
    clock.clockAccumulatedPauseMs,
    Date.now(),
    intervalMs,
    HORIZON_MS,
  );
  for (const at of times) {
    await Notifications.scheduleNotificationAsync({
      content: { title: strings.restNotificationTitle, body: strings.restNotificationBody },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DATE,
        date: new Date(at),
        channelId: REST_NOTIFICATION_CHANNEL_ID,
      },
    });
  }
}

// Called once at app start (src/app/_layout.tsx). Also clears anything a
// previous run left scheduled (e.g. the app was killed while backgrounded).
export async function ensureRestNotificationChannel(): Promise<void> {
  const Notifications = getNotifications();
  if (!Notifications) return;
  await enqueue(cancelAll);
  if (Platform.OS !== 'android') return;
  await Notifications.setNotificationChannelAsync(REST_NOTIFICATION_CHANNEL_ID, {
    name: strings.restNotificationChannelName,
    importance: Notifications.AndroidImportance.DEFAULT,
  });
}

// Explicit disarm for flows that end the clock's relevance outright (ending
// the session), rather than relying on a screen unmounting.
export function cancelRestNotifications(): Promise<void> {
  return enqueue(cancelAll);
}

export function useRestNotifications({ enabled, intervalSeconds }: { enabled: boolean; intervalSeconds: number }) {
  useEffect(() => {
    if (isExpoGo) return;

    if (!enabled) {
      void enqueue(cancelAll);
      return;
    }

    const intervalMs = Math.max(5, Math.round(intervalSeconds)) * 1000;
    function handleAppStateChange(state: string) {
      if (state === 'background') void enqueue(() => scheduleBatch(intervalMs));
      else if (state === 'active') void enqueue(cancelAll);
    }

    const subscription = AppState.addEventListener('change', handleAppStateChange);
    return () => {
      subscription.remove();
      void enqueue(cancelAll);
    };
  }, [enabled, intervalSeconds]);
}
