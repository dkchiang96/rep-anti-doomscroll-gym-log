import { formatSessionExerciseShorthand } from '../keepShorthand';

describe('formatSessionExerciseShorthand', () => {
  it('reconstructs a working-set-plus-drop-sets line, matching the original Keep grammar', () => {
    // Same fixture line as keepParser.test.ts's "parses working sets plus drop sets" case.
    const result = formatSessionExerciseShorthand(
      [
        { weightKg: 22.5, reps: 10, setType: 'working' },
        { weightKg: 22.5, reps: 8, setType: 'working' },
        { weightKg: 22.5, reps: 7, setType: 'working' },
        { weightKg: 22.5, reps: 5, setType: 'working' },
        { weightKg: 12.5, reps: 10, setType: 'dropset' },
        { weightKg: 7.5, reps: 10, setType: 'dropset' },
      ],
      false,
    );
    expect(result).toBe('22.5kg 10 8 7 5 12.5kg 10 7.5kg 10');
  });

  it('reconstructs a bodyweight line', () => {
    const result = formatSessionExerciseShorthand(
      [
        { weightKg: 0, reps: 10, setType: 'working' },
        { weightKg: 0, reps: 10, setType: 'working' },
        { weightKg: 0, reps: 8, setType: 'working' },
        { weightKg: 0, reps: 6, setType: 'working' },
      ],
      true,
    );
    expect(result).toBe('bw 10 10 8 6');
  });

  it('excludes warm-up sets', () => {
    const result = formatSessionExerciseShorthand(
      [
        { weightKg: 20, reps: 12, setType: 'warmup' },
        { weightKg: 60, reps: 8, setType: 'working' },
        { weightKg: 60, reps: 7, setType: 'working' },
      ],
      false,
    );
    expect(result).toBe('60kg 8 7');
  });
});
