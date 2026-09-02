import { useEffect, useState } from 'react';

import { updateSession } from '@/data/repositories/sessionRepository';
import type { session as sessionTable } from '@/data/schema';
import type { AppDatabase } from '@/data/types';
import { computeElapsedMs } from '@/domain/stopwatch';

// R3 — DESIGN-SPEC.md §5.1/D2/D3. Backs the live-workout stopwatch. Every
// start/pause/reset writes the new clock timestamps to the session row
// immediately (invariant 1 — no Save button, no debounce), so a force-kill
// mid-session restores to the correct elapsed time on reopen.

type Session = typeof sessionTable.$inferSelect;

type ClockFields = {
  clockStartedAt: Date | null;
  clockPausedAt: Date | null;
  clockAccumulatedPauseMs: number;
};

const TICK_MS = 250;

export function useStopwatch(db: AppDatabase, userId: string, session: Session) {
  const [clock, setClock] = useState<ClockFields>(() => ({
    clockStartedAt: session.clockStartedAt,
    clockPausedAt: session.clockPausedAt,
    clockAccumulatedPauseMs: session.clockAccumulatedPauseMs,
  }));
  // `now` is only ever written from the 250ms tick or from an event handler
  // (start/pause/reset) — never read via a direct Date.now() call during
  // render, which the React Compiler treats as an impure render (see R2's
  // PROGRESS.md entry for the same fix applied to session.tsx's original
  // placeholder). start() also writes it synchronously on resume so the
  // display doesn't show a stale pre-pause reading until the next tick.
  const [now, setNow] = useState(() => Date.now());

  const isRunning = clock.clockStartedAt !== null && clock.clockPausedAt === null;

  useEffect(() => {
    if (!isRunning) return;
    const id = setInterval(() => setNow(Date.now()), TICK_MS);
    return () => clearInterval(id);
  }, [isRunning]);

  const referenceNow = isRunning ? now : (clock.clockPausedAt?.getTime() ?? now);
  const elapsedMs = computeElapsedMs(clock.clockStartedAt?.getTime() ?? null, clock.clockAccumulatedPauseMs, referenceNow);

  const persist = (next: ClockFields) => {
    setClock(next);
    void updateSession(db, userId, session.id, next);
  };

  const start = () => {
    if (isRunning) return;
    const nowDate = new Date();
    setNow(nowDate.getTime());
    if (clock.clockStartedAt === null) {
      persist({ clockStartedAt: nowDate, clockPausedAt: null, clockAccumulatedPauseMs: 0 });
      return;
    }
    const pausedAt = clock.clockPausedAt as Date; // isRunning is false and startedAt isn't null, so pausedAt must be set.
    persist({
      ...clock,
      clockPausedAt: null,
      clockAccumulatedPauseMs: clock.clockAccumulatedPauseMs + (nowDate.getTime() - pausedAt.getTime()),
    });
  };

  const pause = () => {
    if (!isRunning) return;
    persist({ ...clock, clockPausedAt: new Date() });
  };

  const reset = () => {
    persist({ clockStartedAt: null, clockPausedAt: null, clockAccumulatedPauseMs: 0 });
  };

  return { elapsedMs, isRunning, start, pause, reset };
}
