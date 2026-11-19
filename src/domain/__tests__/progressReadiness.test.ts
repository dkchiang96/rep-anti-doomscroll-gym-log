import { isReadyToProgress, type ReadinessSession } from '../progressReadiness';

const working = (weightKg: number, reps: number) => ({ weightKg, reps, setType: 'working' as const });
const session = (...sets: ReadinessSession['sets']): ReadinessSession => ({ sets });

describe('isReadyToProgress', () => {
  it('fires when the last two sessions hit the top of the range at the same weight', () => {
    const sessions = [session(working(30, 12), working(30, 12), working(30, 12)), session(working(30, 12), working(30, 13))];
    expect(isReadyToProgress(sessions, 12)).toBe(true);
  });

  it('needs two previous sessions', () => {
    expect(isReadyToProgress([session(working(30, 12))], 12)).toBe(false);
    expect(isReadyToProgress([], 12)).toBe(false);
  });

  it('does not fire if any working set fell short in either session', () => {
    expect(isReadyToProgress([session(working(30, 12), working(30, 11)), session(working(30, 12))], 12)).toBe(false);
    expect(isReadyToProgress([session(working(30, 12)), session(working(30, 10))], 12)).toBe(false);
  });

  it('does not fire if the weight changed between sessions', () => {
    expect(isReadyToProgress([session(working(32.5, 12)), session(working(30, 12))], 12)).toBe(false);
  });

  it('does not fire if working weights differ within a session', () => {
    expect(isReadyToProgress([session(working(30, 12), working(27.5, 12)), session(working(30, 12))], 12)).toBe(false);
  });

  it('ignores warm-ups and drop sets', () => {
    const sessions = [
      session({ weightKg: 10, reps: 5, setType: 'warmup' }, working(30, 12), { weightKg: 15, reps: 6, setType: 'dropset' }),
      session(working(30, 12)),
    ];
    expect(isReadyToProgress(sessions, 12)).toBe(true);
  });

  it('does not fire for a session with no working sets', () => {
    expect(isReadyToProgress([session({ weightKg: 10, reps: 12, setType: 'warmup' }), session(working(30, 12))], 12)).toBe(false);
  });

  it('judges a split set by its weaker side', () => {
    const splitShort = session(
      { id: 'a', weightKg: 30, reps: 12, setType: 'working', side: 'left', parentSetId: null },
      { id: 'r', weightKg: 30, reps: 10, setType: 'working', side: 'right', parentSetId: 'a' },
    );
    const splitHit = session(
      { id: 'a', weightKg: 30, reps: 12, setType: 'working', side: 'left', parentSetId: null },
      { id: 'r', weightKg: 30, reps: 12, setType: 'working', side: 'right', parentSetId: 'a' },
    );
    expect(isReadyToProgress([splitShort, session(working(30, 12))], 12)).toBe(false);
    expect(isReadyToProgress([splitHit, session(working(30, 12))], 12)).toBe(true);
  });
});
