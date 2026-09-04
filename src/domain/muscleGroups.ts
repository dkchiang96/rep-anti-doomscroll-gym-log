// FR-2.1: chips are always this fixed set, never an undifferentiated list.
// Exercise.muscleGroup itself stays free text (not the invariant-8 locked
// field) — this is a display/filter mapping only, nothing gets rewritten in
// the database. Imported exercises whose muscleGroup was keyword-guessed
// into a coarser bucket ("Arms", "Cardio", "Uncategorised") don't match any
// of the names below and fall into the catch-all so they stay browsable
// rather than silently vanishing from the chip row.
//
// Quads/Hamstrings/Glutes/Calves were previously four separate chips;
// user's explicit call to combine them into one "Legs" chip. Legacy stored
// data using any of those four names (or the importer's own "Legs" guess)
// still resolves into the "Legs" chip via LEGACY_ALIASES below — nothing
// gets rewritten in the database, only the display mapping changes.
export const MUSCLE_GROUPS = ['Chest', 'Back', 'Shoulders', 'Biceps', 'Triceps', 'Legs', 'Core'] as const;

export type MuscleGroupChip = (typeof MUSCLE_GROUPS)[number] | 'Other';

export const OTHER_MUSCLE_GROUP_CHIP = 'Other' as const;

const LEGACY_ALIASES: Record<string, MuscleGroupChip> = {
  quads: 'Legs',
  hamstrings: 'Legs',
  glutes: 'Legs',
  calves: 'Legs',
};

export function resolveMuscleGroupChip(muscleGroup: string): MuscleGroupChip {
  const normalized = muscleGroup.trim().toLowerCase();
  const match = MUSCLE_GROUPS.find((g) => g.toLowerCase() === normalized);
  if (match) return match;
  return LEGACY_ALIASES[normalized] ?? OTHER_MUSCLE_GROUP_CHIP;
}
