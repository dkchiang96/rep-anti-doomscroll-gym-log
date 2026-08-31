// FR-6.4: the mandatory name-mapping review. Every exercise named in an
// imported programme is matched against the existing library by fuzzy score
// and shown with its confidence; nothing is ever auto-imported without a
// visible, overridable decision on this list.

import type { MatchableExercise, ExerciseMatch } from './fuzzyMatch';
import { matchExercises } from './fuzzyMatch';
import type { ProgrammeImportData, ProgrammeImportExercise } from './programmeSchema';

// Above this score the default decision is "accept" the best match; below
// it, the default is "create new" — the user can still override either way,
// this only decides what's pre-selected when the review screen opens.
export const AUTO_ACCEPT_THRESHOLD = 0.8;

export type MatchDecision =
  | { type: 'accept'; exerciseId: string }
  | { type: 'create' }
  | { type: 'remap'; exerciseId: string };

export interface ProgrammeMatchRow<T extends MatchableExercise> {
  /** Programme exercise name as written in the JSON, deduplicated case-insensitively. */
  name: string;
  /** One representative import entry, for muscle group / load convention defaults on create. */
  sample: ProgrammeImportExercise;
  bestMatch: ExerciseMatch<T> | null;
  decision: MatchDecision;
}

function dedupeExerciseNames(data: ProgrammeImportData): Map<string, ProgrammeImportExercise> {
  const byKey = new Map<string, ProgrammeImportExercise>();
  for (const template of data.templates) {
    for (const exercise of template.exercises) {
      const key = exercise.name.trim().toLowerCase();
      if (!byKey.has(key)) byKey.set(key, exercise);
    }
  }
  return byKey;
}

export function buildProgrammeMatchRows<T extends MatchableExercise>(
  data: ProgrammeImportData,
  library: T[],
): ProgrammeMatchRow<T>[] {
  const byKey = dedupeExerciseNames(data);
  const rows: ProgrammeMatchRow<T>[] = [];

  for (const [, sample] of byKey) {
    const matches = matchExercises(sample.name, library);
    const bestMatch = matches[0] ?? null;
    const decision: MatchDecision =
      bestMatch && bestMatch.score >= AUTO_ACCEPT_THRESHOLD
        ? { type: 'accept', exerciseId: bestMatch.exercise.id }
        : { type: 'create' };
    rows.push({ name: sample.name, sample, bestMatch, decision });
  }

  return rows.sort((a, b) => a.name.localeCompare(b.name));
}

// Exit-check metric: the fraction of programme exercises resolved to an
// existing exercise (accept or remap) without the user creating a new one.
export function autoMatchedFraction<T extends MatchableExercise>(rows: ProgrammeMatchRow<T>[]): number {
  if (rows.length === 0) return 1;
  const matched = rows.filter((r) => r.decision.type !== 'create').length;
  return matched / rows.length;
}
