// FR-2.2: search must resolve typos like "pull back row machinr" against the
// stored name/aliases. Token-level edit-distance similarity, not a bundled
// fuzzy-search dependency — the library is small (~25 exercises) and this
// keeps the whole thing a pure, tested function per CLAUDE.md.

export interface MatchableExercise {
  id: string;
  name: string;
  aliases: string[];
}

const MATCH_THRESHOLD = 0.55;

function normalize(s: string): string {
  return s.trim().toLowerCase().replace(/\s+/g, ' ');
}

function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;

  let prevRow = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    const row = [i];
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      row.push(Math.min(row[j - 1] + 1, prevRow[j] + 1, prevRow[j - 1] + cost));
    }
    prevRow = row;
  }
  return prevRow[b.length];
}

function tokenSimilarity(a: string, b: string): number {
  if (a.length === 0 && b.length === 0) return 1;
  return 1 - levenshtein(a, b) / Math.max(a.length, b.length);
}

function scoreAgainst(query: string, candidate: string): number {
  const q = normalize(query);
  const c = normalize(candidate);
  if (q.length === 0 || c.length === 0) return 0;

  if (c.includes(q)) {
    return 0.7 + 0.3 * (q.length / c.length);
  }

  const qTokens = q.split(' ');
  const cTokens = c.split(' ');
  const total = qTokens.reduce((sum, qt) => {
    const best = cTokens.reduce((max, ct) => Math.max(max, tokenSimilarity(qt, ct)), 0);
    return sum + best;
  }, 0);
  return total / qTokens.length;
}

export interface ExerciseMatch<T extends MatchableExercise> {
  exercise: T;
  score: number;
}

export function matchExercises<T extends MatchableExercise>(query: string, exercises: T[]): ExerciseMatch<T>[] {
  const q = normalize(query);
  if (q.length === 0) return [];

  const matches: ExerciseMatch<T>[] = [];
  for (const exercise of exercises) {
    const candidates = [exercise.name, ...exercise.aliases];
    const score = candidates.reduce((max, c) => Math.max(max, scoreAgainst(q, c)), 0);
    if (score >= MATCH_THRESHOLD) matches.push({ exercise, score });
  }

  return matches.sort((a, b) => b.score - a.score);
}
