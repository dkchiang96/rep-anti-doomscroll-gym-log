// FR-2.1: chips are always this fixed set, never an undifferentiated list.
// Exercise.muscleGroup itself stays free text (not the invariant-8 locked
// field) — this is a display/filter mapping only, nothing gets rewritten in
// the database. Imported exercises whose muscleGroup was keyword-guessed
// into a coarser bucket ("Legs", "Arms", "Cardio", "Uncategorised") don't
// match any of the 10 names below and fall into the catch-all so they stay
// browsable rather than silently vanishing from the chip row.
export const MUSCLE_GROUPS = [
  'Chest',
  'Back',
  'Shoulders',
  'Biceps',
  'Triceps',
  'Quads',
  'Hamstrings',
  'Glutes',
  'Calves',
  'Core',
] as const;

export type MuscleGroupChip = (typeof MUSCLE_GROUPS)[number] | 'Other';

export const OTHER_MUSCLE_GROUP_CHIP = 'Other' as const;

export function resolveMuscleGroupChip(muscleGroup: string): MuscleGroupChip {
  const normalized = muscleGroup.trim().toLowerCase();
  const match = MUSCLE_GROUPS.find((g) => g.toLowerCase() === normalized);
  return match ?? OTHER_MUSCLE_GROUP_CHIP;
}
