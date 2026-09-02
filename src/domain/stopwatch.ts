// R3 — DESIGN-SPEC.md §5.1/§5.4. Pure timing math for the live-workout
// stopwatch. Elapsed time is always derived from timestamps (start time +
// accumulated pause), never accumulated by a running tick counter, so it is
// correct after the app is backgrounded or killed and reopened.

// `now` should be the current time while the clock is running, or the frozen
// `clockPausedAt` timestamp while paused — the caller decides which, this
// function just does the arithmetic. `startedAt === null` means the clock has
// never been started this session.
export function computeElapsedMs(startedAt: number | null, accumulatedPauseMs: number, now: number): number {
  if (startedAt === null) return 0;
  return Math.max(0, now - startedAt - accumulatedPauseMs);
}

// True if elapsed time has crossed one more `intervalMs` boundary between two
// readings. Comparing floor(elapsed / interval) rather than watching for an
// exact multiple means a reading taken late (e.g. the first tick after the
// app resumes from the background) still reports the crossing instead of
// silently skipping it because the exact boundary moment was never sampled.
export function didCrossInterval(previousElapsedMs: number, nextElapsedMs: number, intervalMs: number): boolean {
  return Math.floor(nextElapsedMs / intervalMs) > Math.floor(previousElapsedMs / intervalMs);
}
