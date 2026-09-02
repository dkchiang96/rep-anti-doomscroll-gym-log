import { useEffect } from 'react';
import { create } from 'zustand';

import { updateSession } from '@/data/repositories/sessionRepository';
import type { AppDatabase } from '@/data/types';
import { computeElapsedMs } from '@/domain/stopwatch';

// R4 — DESIGN-SPEC.md D10: "The clock never stops or disappears when
// logging... it is not a separate screen — it is persistent chrome." A
// per-screen hook (R3's useStopwatch) can't satisfy that once there are two
// screens (session.tsx, transition.tsx) that both display and control the
// same running clock: each hook instance would tick independently against
// its own local `now` state. Lifting the clock into a module-level Zustand
// store means there is exactly one instance regardless of which screen (or
// both) is mounted — navigating between them never remounts it.

type ClockFields = {
  clockStartedAt: Date | null;
  clockPausedAt: Date | null;
  clockAccumulatedPauseMs: number;
};

type StopwatchStoreState = {
  db: AppDatabase | null;
  userId: string | null;
  sessionId: string | null;
  clock: ClockFields;
  now: number;
  attach: (db: AppDatabase, userId: string, session: { id: string } & ClockFields) => void;
  start: () => void;
  pause: () => void;
  reset: () => void;
};

export const useStopwatchStore = create<StopwatchStoreState>((set, get) => ({
  db: null,
  userId: null,
  sessionId: null,
  clock: { clockStartedAt: null, clockPausedAt: null, clockAccumulatedPauseMs: 0 },
  now: Date.now(),

  attach(db, userId, session) {
    // Already attached to this session — do nothing, so a screen that
    // re-runs this on every render (or a second screen attaching to the
    // same session) never resets the running clock.
    if (get().sessionId === session.id) return;
    set({
      db,
      userId,
      sessionId: session.id,
      clock: {
        clockStartedAt: session.clockStartedAt,
        clockPausedAt: session.clockPausedAt,
        clockAccumulatedPauseMs: session.clockAccumulatedPauseMs,
      },
      now: Date.now(),
    });
  },

  start() {
    const { db, userId, sessionId, clock } = get();
    if (!db || !userId || !sessionId) return;
    if (clock.clockStartedAt !== null && clock.clockPausedAt === null) return; // already running
    const nowDate = new Date();
    const next: ClockFields =
      clock.clockStartedAt === null
        ? { clockStartedAt: nowDate, clockPausedAt: null, clockAccumulatedPauseMs: 0 }
        : {
            ...clock,
            clockPausedAt: null,
            clockAccumulatedPauseMs:
              clock.clockAccumulatedPauseMs + (nowDate.getTime() - (clock.clockPausedAt as Date).getTime()),
          };
    set({ clock: next, now: nowDate.getTime() });
    void updateSession(db, userId, sessionId, next);
  },

  pause() {
    const { db, userId, sessionId, clock } = get();
    if (!db || !userId || !sessionId) return;
    if (clock.clockStartedAt === null || clock.clockPausedAt !== null) return;
    const next = { ...clock, clockPausedAt: new Date() };
    set({ clock: next });
    void updateSession(db, userId, sessionId, next);
  },

  reset() {
    const { db, userId, sessionId } = get();
    if (!db || !userId || !sessionId) return;
    const next: ClockFields = { clockStartedAt: null, clockPausedAt: null, clockAccumulatedPauseMs: 0 };
    set({ clock: next });
    void updateSession(db, userId, sessionId, next);
  },
}));

const TICK_MS = 250;

// A single ticker for the app's lifetime, not tied to any screen's mount —
// that's the whole point of this store existing. A no-op read every 250ms
// when nothing is running is negligible cost.
setInterval(() => {
  const { clock } = useStopwatchStore.getState();
  const isRunning = clock.clockStartedAt !== null && clock.clockPausedAt === null;
  if (isRunning) useStopwatchStore.setState({ now: Date.now() });
}, TICK_MS);

/** Call once per screen that displays the clock; idempotent per session id. */
export function useAttachStopwatch(db: AppDatabase, userId: string, session: { id: string } & ClockFields) {
  const attach = useStopwatchStore((s) => s.attach);
  useEffect(() => {
    attach(db, userId, session);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [attach, db, userId, session.id, session.clockStartedAt, session.clockPausedAt, session.clockAccumulatedPauseMs]);
}

export function useStopwatch() {
  const clock = useStopwatchStore((s) => s.clock);
  const now = useStopwatchStore((s) => s.now);
  const start = useStopwatchStore((s) => s.start);
  const pause = useStopwatchStore((s) => s.pause);
  const reset = useStopwatchStore((s) => s.reset);

  const isRunning = clock.clockStartedAt !== null && clock.clockPausedAt === null;
  const referenceNow = isRunning ? now : (clock.clockPausedAt?.getTime() ?? now);
  const elapsedMs = computeElapsedMs(clock.clockStartedAt?.getTime() ?? null, clock.clockAccumulatedPauseMs, referenceNow);

  return { elapsedMs, isRunning, start, pause, reset };
}
