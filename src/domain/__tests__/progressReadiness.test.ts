import { progressAdvice, type ReadinessSession } from '../progressReadiness';

const working = (weightKg: number, reps: number) => ({ weightKg, reps, setType: 'working' as const });
const session = (rpe: number | null, ...sets: ReadinessSession['sets']): ReadinessSession => ({ sets, rpe });

describe('progressAdvice — RPE rules', () => {
  it('says add load after one session at the top of the range at RPE ≤ 7', () => {
    expect(progressAdvice([session(7, working(30, 12), working(30, 12))], 12)).toBe('add_load_easy');
    expect(progressAdvice([session(5, working(30, 12))], 12)).toBe('add_load_easy');
  });

  it('needs a second top-of-range session at the same weight when RPE is 8', () => {
    expect(progressAdvice([session(8, working(30, 12))], 12)).toBeNull();
    expect(progressAdvice([session(8, working(30, 12)), session(8, working(30, 12))], 12)).toBe('add_load_twice');
    expect(progressAdvice([session(8, working(30, 12)), session(8, working(27.5, 12))], 12)).toBeNull();
  });

  it('never fires at RPE 9–10, even at the top of the range', () => {
    expect(progressAdvice([session(9, working(30, 12)), session(7, working(30, 12))], 12)).toBeNull();
    expect(progressAdvice([session(10, working(30, 8))], 12)).toBeNull();
  });

  it('says push for reps below the top of the range at RPE ≤ 6', () => {
    expect(progressAdvice([session(6, working(30, 10))], 12)).toBe('push_reps');
    expect(progressAdvice([session(7, working(30, 10))], 12)).toBeNull();
  });

  it('does not suggest pushing reps for a session with no working sets', () => {
    expect(progressAdvice([session(5, { weightKg: 10, reps: 5, setType: 'warmup' })], 12)).toBeNull();
  });

  it('returns nothing with no history', () => {
    expect(progressAdvice([], 12)).toBeNull();
  });
});

describe('progressAdvice — sessions without RPE (logged before RPE existed)', () => {
  it('falls back to the two-session rule', () => {
    expect(progressAdvice([session(null, working(30, 12), working(30, 13)), session(null, working(30, 12))], 12)).toBe('add_load_twice');
    expect(progressAdvice([session(null, working(30, 12))], 12)).toBeNull();
  });

  it('does not fire if any working set fell short, or weights differ', () => {
    expect(progressAdvice([session(null, working(30, 12), working(30, 11)), session(null, working(30, 12))], 12)).toBeNull();
    expect(progressAdvice([session(null, working(30, 12), working(27.5, 12)), session(null, working(30, 12))], 12)).toBeNull();
    expect(progressAdvice([session(null, working(32.5, 12)), session(null, working(30, 12))], 12)).toBeNull();
  });

  it('never suggests pushing reps without an RPE', () => {
    expect(progressAdvice([session(null, working(30, 8))], 12)).toBeNull();
  });
});

describe('progressAdvice — what counts as a working set', () => {
  it('ignores warm-ups and drop sets', () => {
    const latest = session(6, { weightKg: 10, reps: 5, setType: 'warmup' }, working(30, 12), { weightKg: 15, reps: 6, setType: 'dropset' });
    expect(progressAdvice([latest], 12)).toBe('add_load_easy');
  });

  it('judges a split set by its weaker side', () => {
    const split = (rightReps: number) =>
      session(
        7,
        { id: 'a', weightKg: 30, reps: 12, setType: 'working', side: 'left', parentSetId: null },
        { id: 'r', weightKg: 30, reps: rightReps, setType: 'working', side: 'right', parentSetId: 'a' },
      );
    expect(progressAdvice([split(10)], 12)).toBeNull();
    expect(progressAdvice([split(12)], 12)).toBe('add_load_easy');
  });
});
