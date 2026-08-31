function pad2(n: number): string {
  return n.toString().padStart(2, '0');
}

// FR-4.7: session elapsed timer. Always MM:SS, growing an H: prefix once an
// hour has passed rather than padding hours or ever showing decimals.
export function formatElapsed(elapsedMs: number): string {
  const totalSeconds = Math.max(0, Math.floor(elapsedMs / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (hours > 0) {
    return `${hours}:${pad2(minutes)}:${pad2(seconds)}`;
  }
  return `${pad2(minutes)}:${pad2(seconds)}`;
}
