import { buildConventionQuestions, conventionQuestionsToDecisions } from '../../../domain/conventionReconciliation';
import { parseKeepExport } from '../../../domain/keepParser';
import { buildProgressPoints } from '../../../domain/progressChart';
import { createTestDb } from '../../__tests__/testDb';
import { listExercises } from '../exerciseRepository';
import { importKeepSessions } from '../importRepository';
import { listSessionHistoryForExercise } from '../progressRepository';
import { createUser } from '../userRepository';

// Same fixture as importRepository.test.ts: incline dumbbell press recorded
// as "total" (45kg/44kg) before 16 Aug and "per_side" (22.5kg/22kg) from 16
// Aug on — a real ~2x convention jump. importKeepSessions normalizes the
// pre-breakpoint entries to the locked per-dumbbell convention on write, so
// the exit check ("no artificial 50% drop") is really a claim about what
// this repository + buildProgressPoints do with already-normalized data.
const KEEP_TEXT = `
1 Jun
incline dumbbell press - 45kg 8

2 Jun
incline dumbbell press - 44kg 8

16 Aug
incline dumbbell press - 22.5kg 8

17 Aug
incline dumbbell press - 22kg 8
`;

describe('listSessionHistoryForExercise + buildProgressPoints', () => {
  it('shows a continuous series across the 16 Aug convention change, with no artificial 50% drop', async () => {
    const db = createTestDb();
    const user = await createUser(db, { displayName: 'Test User' });
    if (!user) throw new Error('user was not created');

    const { sessions } = parseKeepExport(KEEP_TEXT, { year: 2025 });
    const questions = buildConventionQuestions(sessions);
    const decisions = conventionQuestionsToDecisions(questions);
    await importKeepSessions(db, user.id, sessions, decisions);

    const exercises = await listExercises(db, user.id);
    const incline = exercises.find((e) => e.name === 'incline dumbbell press');
    if (!incline) throw new Error('incline dumbbell press was not imported');
    expect(incline.loadConvention).toBe('per_side');

    const history = await listSessionHistoryForExercise(db, user.id, incline.id);
    expect(history).toHaveLength(4);
    expect(history.map((h) => h.startedAt.getTime())).toEqual([...history.map((h) => h.startedAt.getTime())].sort((a, b) => a - b));

    const points = buildProgressPoints(history);
    expect(points).toHaveLength(4);
    // All four points should sit in the normalized per-dumbbell range —
    // nothing here should still look like the raw "total" figure.
    for (const p of points) {
      expect(p.topWeightKg).toBeGreaterThanOrEqual(22);
      expect(p.topWeightKg).toBeLessThanOrEqual(22.5);
    }

    const weights = points.map((p) => p.topWeightKg);
    for (let i = 1; i < weights.length; i++) {
      const ratio = weights[i] / weights[i - 1];
      expect(ratio).toBeGreaterThan(0.5);
      expect(ratio).toBeLessThan(2);
    }
  });
});
