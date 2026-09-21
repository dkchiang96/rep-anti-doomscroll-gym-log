import { MUSCLE_GROUPS, resolveMuscleGroupChip } from '../muscleGroups';

describe('resolveMuscleGroupChip', () => {
  it('matches every canonical group case-insensitively', () => {
    for (const group of MUSCLE_GROUPS) {
      expect(resolveMuscleGroupChip(group.toLowerCase())).toBe(group);
      expect(resolveMuscleGroupChip(group)).toBe(group);
    }
  });

  it('includes separate Forearms and Neck groups', () => {
    expect(MUSCLE_GROUPS).toContain('Forearms');
    expect(MUSCLE_GROUPS).toContain('Neck');
    expect(resolveMuscleGroupChip('forearms')).toBe('Forearms');
    expect(resolveMuscleGroupChip('NECK')).toBe('Neck');
  });

  it('maps the four legacy per-leg-muscle names onto the combined Legs chip', () => {
    expect(resolveMuscleGroupChip('Quads')).toBe('Legs');
    expect(resolveMuscleGroupChip('hamstrings')).toBe('Legs');
    expect(resolveMuscleGroupChip('Glutes')).toBe('Legs');
    expect(resolveMuscleGroupChip('CALVES')).toBe('Legs');
  });

  it('resolves the importer\'s own "Legs" guess onto the same combined chip', () => {
    expect(resolveMuscleGroupChip('Legs')).toBe('Legs');
  });

  it('falls back to Other for legacy keyword-guessed groups from the importer', () => {
    expect(resolveMuscleGroupChip('Arms')).toBe('Other');
    expect(resolveMuscleGroupChip('Cardio')).toBe('Other');
    expect(resolveMuscleGroupChip('Uncategorised')).toBe('Other');
  });

  it('falls back to Other for empty or unrecognised text', () => {
    expect(resolveMuscleGroupChip('')).toBe('Other');
    expect(resolveMuscleGroupChip('   ')).toBe('Other');
  });
});
