// FR-7.3: the progress table lists past sessions "in the same shorthand as
// the Keep notes" — this is keepParser.ts's grammar run in reverse. Sets must
// already be sorted by their stored `index`. Warm-ups are excluded, same as
// the chart (buildProgressPoints in progressChart.ts) — a shorthand line
// mixing in reps the user explicitly marked as not-working-sets would
// misrepresent what was actually worked that session.

export interface ShorthandSet {
  weightKg: number;
  reps: number;
  setType: 'working' | 'warmup' | 'dropset' | 'failure';
}

export function formatSessionExerciseShorthand(sets: ShorthandSet[], isBodyweight: boolean): string {
  const groups: { label: string; reps: number[] }[] = [];

  for (const s of sets) {
    if (s.setType === 'warmup') continue;
    const label = isBodyweight ? 'bw' : `${s.weightKg}kg`;
    const last = groups[groups.length - 1];
    if (last && last.label === label) {
      last.reps.push(s.reps);
    } else {
      groups.push({ label, reps: [s.reps] });
    }
  }

  return groups.map((g) => `${g.label} ${g.reps.join(' ')}`).join(' ');
}
