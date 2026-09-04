import { autoMatchedFraction, buildProgrammeMatchRows } from '../programmeMatching';
import type { ProgrammeImportData } from '../programmeSchema';

const LIBRARY = [
  { id: '1', name: 'Incline Dumbbell Press', aliases: [] },
  { id: '2', name: 'Cable Lateral Raise', aliases: [] },
  { id: '3', name: 'Chest Supported Row', aliases: ['t bar row'] },
];

const DATA: ProgrammeImportData = {
  name: 'One Month. One Focus. — June',
  notes: null,
  templates: [
    {
      name: 'PUSH + ABS',
      dayHint: 'Tuesday',
      exercises: [
        {
          name: 'Incline Dumbbell Press',
          muscleGroup: 'Chest',
          loadConvention: 'per_side',
          targetSets: 4,
          targetRepsMin: 6,
          targetRepsMax: 10,
          supersetGroup: null,
          notes: '',
        },
        {
          name: 'Cable Lateral Rais', // typo — still a close fuzzy match
          muscleGroup: 'Shoulders',
          loadConvention: 'per_side',
          targetSets: 4,
          targetRepsMin: 12,
          targetRepsMax: 20,
          supersetGroup: null,
          notes: '',
        },
        {
          name: 'Bulgarian Split Squat', // nothing close in the library
          muscleGroup: 'Legs',
          loadConvention: 'per_side',
          targetSets: 3,
          targetRepsMin: 8,
          targetRepsMax: 12,
          supersetGroup: null,
          notes: '',
        },
      ],
    },
    {
      name: 'PULL',
      dayHint: null,
      exercises: [
        {
          // Same exercise repeated across templates — deduped to one row.
          name: 'Incline Dumbbell Press',
          muscleGroup: 'Chest',
          loadConvention: 'per_side',
          targetSets: 3,
          targetRepsMin: 8,
          targetRepsMax: 12,
          supersetGroup: null,
          notes: '',
        },
      ],
    },
  ],
};

describe('buildProgrammeMatchRows', () => {
  it('dedupes an exercise repeated across templates into a single row', () => {
    const rows = buildProgrammeMatchRows(DATA, LIBRARY);
    expect(rows.filter((r) => r.name === 'Incline Dumbbell Press')).toHaveLength(1);
  });

  it('defaults to accept for a high-confidence match', () => {
    const rows = buildProgrammeMatchRows(DATA, LIBRARY);
    const row = rows.find((r) => r.name === 'Incline Dumbbell Press')!;
    expect(row.decision).toEqual({ type: 'accept', exerciseId: '1' });
  });

  it('defaults to accept for a close-typo match above threshold', () => {
    const rows = buildProgrammeMatchRows(DATA, LIBRARY);
    const row = rows.find((r) => r.name === 'Cable Lateral Rais')!;
    expect(row.decision).toEqual({ type: 'accept', exerciseId: '2' });
  });

  it('defaults to create for an exercise with no close match, never a silent guess', () => {
    const rows = buildProgrammeMatchRows(DATA, LIBRARY);
    const row = rows.find((r) => r.name === 'Bulgarian Split Squat')!;
    expect(row.decision).toEqual({ type: 'create' });
    expect(row.bestMatch).toBeNull();
  });

  it('carries the sample exercise data for create-flow defaults', () => {
    const rows = buildProgrammeMatchRows(DATA, LIBRARY);
    const row = rows.find((r) => r.name === 'Bulgarian Split Squat')!;
    expect(row.sample.muscleGroup).toBe('Legs');
    expect(row.sample.loadConvention).toBe('per_side');
  });
});

describe('autoMatchedFraction', () => {
  it('computes the fraction resolved to an existing exercise by default', () => {
    const rows = buildProgrammeMatchRows(DATA, LIBRARY);
    // 3 unique exercises: 2 matched (accept), 1 create.
    expect(autoMatchedFraction(rows)).toBeCloseTo(2 / 3);
  });

  it('is 1 for an empty row set', () => {
    expect(autoMatchedFraction([])).toBe(1);
  });
});
