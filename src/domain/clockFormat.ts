function pad2(n: number): string {
  return n.toString().padStart(2, '0');
}

// The live-workout stopwatch (DESIGN-SPEC.md §5.1): minutes run past 60
// rather than rolling into an hour digit, so the clock's width never
// changes shape at the hour boundary. This differs from
// src/domain/duration.ts#formatElapsed (used for session-duration display
// elsewhere), which intentionally does add an H: prefix past an hour.
export function formatClock(elapsedMs: number): string {
  const totalSeconds = Math.max(0, Math.floor(elapsedMs / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${pad2(minutes)}:${pad2(seconds)}`;
}
