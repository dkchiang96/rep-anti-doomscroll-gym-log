// FR-7.3: the progress table lists past sessions "in the same shorthand as
// the Keep notes" — this is keepParser.ts's grammar run in reverse. Sets must
// already be sorted by their stored `index`. Warm-ups are excluded, same as
// the chart (buildProgressPoints in progressChart.ts) — a shorthand line
// mixing in reps the user explicitly marked as not-working-sets would
// misrepresent what was actually worked that session.
//
// A left/right split set (sidePairs.ts) is one set showing both sides:
// "20kg 10/8" when the weights match, "20/17.5kg 10" when only the weights
// differ, "20/17.5kg 10/8" when both do — left first.

import { formatCardioShorthand, type CardioMetric, type CardioRound, type ExerciseKind } from './cardio';
import { pairSides, type SideTaggable } from './sidePairs';

export interface ShorthandSet extends SideTaggable {
  setType: 'working' | 'warmup' | 'dropset' | 'failure';
}

// One logged exercise's line, whichever kind it is: cardio stations use
// the round shorthand (src/domain/cardio.ts), strength the Keep grammar.
export function formatLoggedExercise(
  sets: (ShorthandSet & Omit<CardioRound, 'setType'>)[],
  exercise: { kind?: ExerciseKind; track?: CardioMetric[] | null; isBodyweight: boolean },
): string {
  if (exercise.kind === 'cardio') return formatCardioShorthand(sets, exercise.track ?? []);
  return formatSessionExerciseShorthand(sets, exercise.isBodyweight);
}

export function formatSessionExerciseShorthand(sets: ShorthandSet[], isBodyweight: boolean): string {
  const groups: { label: string; reps: string[] }[] = [];

  for (const { set: s, right } of pairSides(sets)) {
    if (s.setType === 'warmup') continue;
    let label: string;
    let reps: string;
    if (isBodyweight) {
      label = 'bw';
      reps = right && right.reps !== s.reps ? `${s.reps}/${right.reps}` : String(s.reps);
    } else if (right) {
      label = right.weightKg === s.weightKg ? `${s.weightKg}kg` : `${s.weightKg}/${right.weightKg}kg`;
      // Same weight and reps on both sides reads exactly like an unsplit
      // set, which is what it effectively was.
      reps = right.reps === s.reps ? String(s.reps) : `${s.reps}/${right.reps}`;
    } else {
      label = `${s.weightKg}kg`;
      reps = String(s.reps);
    }
    const last = groups[groups.length - 1];
    if (last && last.label === label) {
      last.reps.push(reps);
    } else {
      groups.push({ label, reps: [reps] });
    }
  }

  return groups.map((g) => `${g.label} ${g.reps.join(' ')}`).join(' ');
}
