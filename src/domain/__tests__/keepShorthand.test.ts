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

describe('formatSessionExerciseShorthand — left/right split sets', () => {
  const left = (id: string, weightKg: number, reps: number) => ({ id, weightKg, reps, setType: 'working' as const, side: 'left' as const, parentSetId: null });
  const right = (parent: string, weightKg: number, reps: number) => ({ id: `${parent}-r`, weightKg, reps, setType: 'working' as const, side: 'right' as const, parentSetId: parent });

  it('shows differing reps as left/right within the same weight group, counting the pair once', () => {
    const result = formatSessionExerciseShorthand(
      [{ id: 'a', weightKg: 20, reps: 10, setType: 'working' }, left('b', 20, 10), { id: 'c', weightKg: 20, reps: 9, setType: 'working' }, right('b', 20, 8)],
      false,
    );
    expect(result).toBe('20kg 10 10/8 9');
  });

  it('shows differing weights as a left/right weight label', () => {
    expect(formatSessionExerciseShorthand([left('a', 20, 10), right('a', 17.5, 10)], false)).toBe('20/17.5kg 10');
    expect(formatSessionExerciseShorthand([left('a', 20, 10), right('a', 17.5, 8)], false)).toBe('20/17.5kg 10/8');
  });

  it('reads an even split exactly like an unsplit set', () => {
    expect(formatSessionExerciseShorthand([left('a', 20, 10), right('a', 20, 10)], false)).toBe('20kg 10');
  });
});
