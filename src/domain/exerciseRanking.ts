// FR-2.4: library ranked by frequency and recency. Frequency (useCount)
// dominates the score since it's named first in the FR and is the stabler
// signal; recency contributes a decaying boost so a just-picked exercise
// still edges out an equally-infrequent one gathering dust, without letting
// one recent tap outrank real training history.

const RECENCY_HALF_LIFE_DAYS = 14;

export interface RankableExercise {
  name: string;
  useCount: number;
  lastUsedAt: Date | null;
}

function recencyScore(lastUsedAt: Date | null, now: Date): number {
  if (!lastUsedAt) return 0;
  const daysSince = Math.max(0, (now.getTime() - lastUsedAt.getTime()) / (1000 * 60 * 60 * 24));
  return Math.pow(0.5, daysSince / RECENCY_HALF_LIFE_DAYS);
}

function rankScore(exercise: RankableExercise, now: Date): number {
  return exercise.useCount + recencyScore(exercise.lastUsedAt, now);
}

export function rankExercises<T extends RankableExercise>(exercises: T[], now: Date = new Date()): T[] {
  return [...exercises].sort((a, b) => {
    const diff = rankScore(b, now) - rankScore(a, now);
    if (diff !== 0) return diff;
    return a.name.localeCompare(b.name);
  });
}
