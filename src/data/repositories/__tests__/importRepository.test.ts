import { eq } from 'drizzle-orm';

import { buildConventionQuestions, conventionQuestionsToDecisions } from '../../../domain/conventionReconciliation';
import { parseKeepExport } from '../../../domain/keepParser';
import { createTestDb } from '../../__tests__/testDb';
import { session, setEntry } from '../../schema';
import { listExercises } from '../exerciseRepository';
import { importKeepSessions } from '../importRepository';
import { listSessionExercisesBySession } from '../sessionExerciseRepository';
import { listSessions } from '../sessionRepository';
import { createUser } from '../userRepository';

// Incline dumbbell press appears four times with a real ~2x drop at 16 Aug,
// enough for detectConventionCandidates to flag it (MIN_TOTAL_SESSIONS = 4).
const KEEP_TEXT = `
1 Jun
squat - 60kg 10 8
incline dumbbell press - 45kg 8
pull up - bw 10 8

2 Jun
squat - 61kg 10 8
incline dumbbell press - 44kg 8
pull up - bw 10 8

16 Aug
squat - 62.5kg 10 8
incline dumbbell press - 22.5kg 8
pull back row machinr - 45kg 12 10 31.5kg 8 (superset)

17 Aug
squat - 63kg 10 8
incline dumbbell press - 22kg 8
pull back row machinr - 40kg 12 10 30kg 8
`;

describe('importKeepSessions', () => {
  it('writes sessions, dedupes exercises by name, and normalizes convention-flagged weights', async () => {
    const db = createTestDb();
    const user = await createUser(db, { displayName: 'Test User' });
    if (!user) throw new Error('user was not created');

    const { sessions } = parseKeepExport(KEEP_TEXT, { year: 2025 });
    const questions = buildConventionQuestions(sessions);
    const inclineQuestion = questions.find((q) => q.exerciseName === 'incline dumbbell press');
    expect(inclineQuestion?.candidate).toBeDefined();
    expect(inclineQuestion?.beforeConvention).toBe('total');
    expect(inclineQuestion?.afterConvention).toBe('per_side');

    const decisions = conventionQuestionsToDecisions(questions);
    const summary = await importKeepSessions(db, user.id, sessions, decisions);

    const expectedExerciseEntries = sessions.reduce((n, s) => n + s.exercises.length, 0);
    const expectedSets = sessions.reduce((n, s) => n + s.exercises.reduce((m, e) => m + e.sets.length, 0), 0);

    expect(summary.sessionsImported).toBe(4);
    expect(summary.exercisesImported).toBe(expectedExerciseEntries);
    expect(summary.setsImported).toBe(expectedSets);

    const exercises = await listExercises(db, user.id);
    expect(exercises).toHaveLength(4);

    const squat = exercises.find((e) => e.name === 'squat');
    expect(squat!.loadConvention).toBe('total');

    const pullUp = exercises.find((e) => e.name === 'pull up');
    expect(pullUp!.loadConvention).toBe('bodyweight');

    const inclineExercise = exercises.find((e) => e.name === 'incline dumbbell press');
    expect(inclineExercise!.loadConvention).toBe('per_side');

    const allSessions = await listSessions(db, user.id);
    expect(allSessions).toHaveLength(4);
    expect(allSessions.every((s) => s.source === 'import')).toBe(true);
    expect(allSessions.every((s) => s.rawImportText && s.rawImportText.length > 0)).toBe(true);

    const rawSessionRows = await db.select().from(session).where(eq(session.userId, user.id));
    expect(rawSessionRows).toHaveLength(4);

    const juneFirst = allSessions.find(
      (s) => new Date(s.startedAt).getMonth() === 5 && new Date(s.startedAt).getDate() === 1,
    )!;
    const juneSessionExercises = await listSessionExercisesBySession(db, user.id, juneFirst.id);
    expect(juneSessionExercises).toHaveLength(3);

    // Incline press on 1 Jun was recorded as "total" (45kg) and should be
    // halved to the locked "per_side" convention (22.5kg) once normalized.
    const juneInclineSessionExercise = juneSessionExercises.find((se) => se.exerciseId === inclineExercise!.id)!;
    const juneInclineSets = await db
      .select()
      .from(setEntry)
      .where(eq(setEntry.sessionExerciseId, juneInclineSessionExercise.id));
    expect(juneInclineSets).toHaveLength(1);
    expect(juneInclineSets[0].weightKg).toBe(22.5);

    // 16 Aug is on/after the breakpoint — recorded value is left untouched.
    const augSixteenth = allSessions.find(
      (s) => new Date(s.startedAt).getMonth() === 7 && new Date(s.startedAt).getDate() === 16,
    )!;
    const augSessionExercises = await listSessionExercisesBySession(db, user.id, augSixteenth.id);
    const augIncline = augSessionExercises.find((se) => se.exerciseId === inclineExercise!.id)!;
    const augInclineSets = await db.select().from(setEntry).where(eq(setEntry.sessionExerciseId, augIncline.id));
    expect(augInclineSets[0].weightKg).toBe(22.5);

    const pullBackRow = exercises.find((e) => e.name === 'pull back row machinr')!;
    const pullBackRowSessionExercise = augSessionExercises.find((se) => se.exerciseId === pullBackRow.id)!;
    expect(pullBackRowSessionExercise.note).toBe('superset');

    const pullBackRowSets = await db
      .select()
      .from(setEntry)
      .where(eq(setEntry.sessionExerciseId, pullBackRowSessionExercise.id))
      .orderBy(setEntry.index);
    expect(pullBackRowSets.map((s) => s.setType)).toEqual(['working', 'working', 'dropset']);
    expect(pullBackRowSets[2].parentSetId).toBe(pullBackRowSets[1].id);
  });
});
