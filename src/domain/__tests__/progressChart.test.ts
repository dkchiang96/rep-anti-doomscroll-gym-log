import { buildProgressPoints } from '../progressChart';

describe('buildProgressPoints', () => {
  it('excludes warm-up sets from the top-set calculation', () => {
    const points = buildProgressPoints([
      {
        sessionId: 's1',
        startedAt: new Date('2026-01-01T12:00:00Z'),
        sets: [
          { weightKg: 100, reps: 5, setType: 'warmup' },
          { weightKg: 60, reps: 8, setType: 'working' },
        ],
      },
    ]);
    expect(points).toEqual([{ sessionId: 's1', dateMs: new Date('2026-01-01T12:00:00Z').getTime(), topWeightKg: 60, reps: 8 }]);
  });

  it('picks the heaviest set, tie-breaking on more reps', () => {
    const points = buildProgressPoints([
      {
        sessionId: 's1',
        startedAt: new Date('2026-01-01T12:00:00Z'),
        sets: [
          { weightKg: 60, reps: 5, setType: 'working' },
          { weightKg: 60, reps: 8, setType: 'dropset' },
          { weightKg: 40, reps: 12, setType: 'dropset' },
        ],
      },
    ]);
    expect(points[0]).toEqual({ sessionId: 's1', dateMs: new Date('2026-01-01T12:00:00Z').getTime(), topWeightKg: 60, reps: 8 });
  });

  it('skips a session whose only sets are warm-ups rather than producing a bogus zero point', () => {
    const points = buildProgressPoints([
      {
        sessionId: 's1',
        startedAt: new Date('2026-01-01T12:00:00Z'),
        sets: [{ weightKg: 20, reps: 10, setType: 'warmup' }],
      },
    ]);
    expect(points).toEqual([]);
  });

  it('produces a continuous series across a stored-weight convention change, with no re-derived jump', () => {
    // Mirrors the real 16 Aug incline dumbbell press history: Session 2's
    // importer already normalizes pre-breakpoint weights to the locked
    // per-dumbbell convention, so this function must trust weightKg as-is.
    const points = buildProgressPoints([
      { sessionId: 'a', startedAt: new Date('2026-06-01T12:00:00Z'), sets: [{ weightKg: 22.5, reps: 8, setType: 'working' }] },
      { sessionId: 'b', startedAt: new Date('2026-06-02T12:00:00Z'), sets: [{ weightKg: 22, reps: 8, setType: 'working' }] },
      { sessionId: 'c', startedAt: new Date('2026-08-16T12:00:00Z'), sets: [{ weightKg: 22.5, reps: 8, setType: 'working' }] },
      { sessionId: 'd', startedAt: new Date('2026-08-17T12:00:00Z'), sets: [{ weightKg: 22, reps: 8, setType: 'working' }] },
    ]);
    const weights = points.map((p) => p.topWeightKg);
    for (let i = 1; i < weights.length; i++) {
      const ratio = weights[i] / weights[i - 1];
      expect(ratio).toBeGreaterThan(0.5);
      expect(ratio).toBeLessThan(2);
    }
  });
});
