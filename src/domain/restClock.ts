// FR-4.2: target rest is a soft marker, defaulting to 60s when the exercise
// has no explicit value. Never persisted as a guess — only a display fallback.
export const DEFAULT_TARGET_REST_SECONDS = 60;

export function resolveTargetRestSeconds(targetRestSeconds: number | null): number {
  return targetRestSeconds ?? DEFAULT_TARGET_REST_SECONDS;
}

// FR-4.3: the screen flashes every `intervalMs` of rest. Diffing the floor
// of each elapsed reading (rather than testing `elapsed % interval === 0`)
// correctly counts multiple crossings if a tick lags — e.g. the app was
// backgrounded and elapsed jumps by more than one interval at once.
export function countFlashCrossings(previousElapsedMs: number, currentElapsedMs: number, intervalMs: number): number {
  if (intervalMs <= 0 || currentElapsedMs <= previousElapsedMs) return 0;
  const previousCount = Math.floor(previousElapsedMs / intervalMs);
  const currentCount = Math.floor(currentElapsedMs / intervalMs);
  return Math.max(0, currentCount - previousCount);
}
