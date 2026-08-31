import { createTestDb } from '../../__tests__/testDb';
import { createExercise } from '../exerciseRepository';
import { createSession } from '../sessionRepository';
import {
  createSessionExercise,
  getMostRecentSessionExerciseForExercise,
  softDeleteSessionExercise,
} from '../sessionExerciseRepository';
import { createSet, listHistoricalWeightsForExercise } from '../setRepository';
import { createUser } from '../userRepository';

async function setup() {
  const db = createTestDb();
  const user = await createUser(db, { displayName: 'Test User' });
  if (!user) throw new Error('user was not created');
  const exercise = await createExercise(db, {
    userId: user.id,
    name: 'Cable Row',
    aliases: [],
    muscleGroup: 'Back',
    equipmentType: 'cable',
    loadConvention: 'total',
    barWeightKg: null,
    defaultWeightStep: null,
    source: 'user',
    lastUsedAt: null,
  });
  if (!exercise) throw new Error('exercise was not created');
  return { db, user, exercise };
}

describe('getMostRecentSessionExerciseForExercise', () => {
  it('returns null when the exercise has never been performed', async () => {
    const { db, user, exercise } = await setup();
    const session = await createSession(db, {
      userId: user.id,
      templateId: null,
      programmeId: null,
      startedAt: new Date(),
      endedAt: null,
      note: null,
      source: 'manual',
    });
    if (!session) throw new Error('session was not created');

    expect(await getMostRecentSessionExerciseForExercise(db, user.id, exercise.id, session.id)).toBeNull();
  });

  it('picks the most recent OTHER session by training date, not weekday, and excludes the current session', async () => {
    const { db, user, exercise } = await setup();

    // 28 Jul (Tuesday), 4 Aug (Tuesday), 15 Aug (Saturday) — deliberately not
    // aligned to a weekday, per FR-3.2.
    const oldest = await createSession(db, {
      userId: user.id,
      templateId: null,
      programmeId: null,
      startedAt: new Date('2026-07-28T12:00:00Z'),
      endedAt: new Date('2026-07-28T13:00:00Z'),
      note: null,
      source: 'manual',
    });
    const middle = await createSession(db, {
      userId: user.id,
      templateId: null,
      programmeId: null,
      startedAt: new Date('2026-08-04T12:00:00Z'),
      endedAt: new Date('2026-08-04T13:00:00Z'),
      note: null,
      source: 'manual',
    });
    const current = await createSession(db, {
      userId: user.id,
      templateId: null,
      programmeId: null,
      startedAt: new Date('2026-08-15T12:00:00Z'),
      endedAt: null,
      note: null,
      source: 'manual',
    });
    if (!oldest || !middle || !current) throw new Error('sessions were not created');

    await createSessionExercise(db, {
      userId: user.id,
      sessionId: oldest.id,
      exerciseId: exercise.id,
      orderIndex: 0,
      supersetGroupId: null,
      note: null,
      skippedAt: null,
    });
    const middleSessionExercise = await createSessionExercise(db, {
      userId: user.id,
      sessionId: middle.id,
      exerciseId: exercise.id,
      orderIndex: 0,
      supersetGroupId: null,
      note: null,
      skippedAt: null,
    });
    if (!middleSessionExercise) throw new Error('session exercise was not created');

    const result = await getMostRecentSessionExerciseForExercise(db, user.id, exercise.id, current.id);
    expect(result?.id).toBe(middleSessionExercise.id);
  });

  it('ignores soft-deleted session exercises', async () => {
    const { db, user, exercise } = await setup();
    const session = await createSession(db, {
      userId: user.id,
      templateId: null,
      programmeId: null,
      startedAt: new Date('2026-08-01T12:00:00Z'),
      endedAt: new Date('2026-08-01T13:00:00Z'),
      note: null,
      source: 'manual',
    });
    const current = await createSession(db, {
      userId: user.id,
      templateId: null,
      programmeId: null,
      startedAt: new Date('2026-08-15T12:00:00Z'),
      endedAt: null,
      note: null,
      source: 'manual',
    });
    if (!session || !current) throw new Error('sessions were not created');

    const deleted = await createSessionExercise(db, {
      userId: user.id,
      sessionId: session.id,
      exerciseId: exercise.id,
      orderIndex: 0,
      supersetGroupId: null,
      note: null,
      skippedAt: null,
    });
    if (!deleted) throw new Error('session exercise was not created');
    await softDeleteSessionExercise(db, user.id, deleted.id);

    expect(await getMostRecentSessionExerciseForExercise(db, user.id, exercise.id, current.id)).toBeNull();
  });
});

describe('listHistoricalWeightsForExercise', () => {
  it('returns weights across all sessions for the exercise, excluding soft-deleted sets', async () => {
    const { db, user, exercise } = await setup();
    const session = await createSession(db, {
      userId: user.id,
      templateId: null,
      programmeId: null,
      startedAt: new Date(),
      endedAt: null,
      note: null,
      source: 'manual',
    });
    if (!session) throw new Error('session was not created');
    const sessionExercise = await createSessionExercise(db, {
      userId: user.id,
      sessionId: session.id,
      exerciseId: exercise.id,
      orderIndex: 0,
      supersetGroupId: null,
      note: null,
      skippedAt: null,
    });
    if (!sessionExercise) throw new Error('session exercise was not created');

    await createSet(db, {
      userId: user.id,
      sessionExerciseId: sessionExercise.id,
      index: 0,
      weightKg: 11.3,
      reps: 10,
      setType: 'working',
      parentSetId: null,
      restAfterSeconds: null,
      completedAt: new Date(),
    });
    await createSet(db, {
      userId: user.id,
      sessionExerciseId: sessionExercise.id,
      index: 1,
      weightKg: 18.0,
      reps: 10,
      setType: 'working',
      parentSetId: null,
      restAfterSeconds: null,
      completedAt: new Date(),
    });

    const weights = await listHistoricalWeightsForExercise(db, user.id, exercise.id);
    expect(weights.sort((a, b) => a - b)).toEqual([11.3, 18.0]);
  });
});
