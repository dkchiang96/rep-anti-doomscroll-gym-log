import { MUSCLE_GROUPS, resolveMuscleGroupChip } from '../muscleGroups';

describe('resolveMuscleGroupChip', () => {
  it('matches every canonical group case-insensitively', () => {
    for (const group of MUSCLE_GROUPS) {
      expect(resolveMuscleGroupChip(group.toLowerCase())).toBe(group);
      expect(resolveMuscleGroupChip(group)).toBe(group);
    }
  });

  it('falls back to Other for legacy keyword-guessed groups from the importer', () => {
    expect(resolveMuscleGroupChip('Legs')).toBe('Other');
    expect(resolveMuscleGroupChip('Arms')).toBe('Other');
    expect(resolveMuscleGroupChip('Cardio')).toBe('Other');
    expect(resolveMuscleGroupChip('Uncategorised')).toBe('Other');
  });

  it('falls back to Other for empty or unrecognised text', () => {
    expect(resolveMuscleGroupChip('')).toBe('Other');
    expect(resolveMuscleGroupChip('   ')).toBe('Other');
  });
});
