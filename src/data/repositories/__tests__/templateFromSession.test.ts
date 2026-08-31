import { createTestDb } from '../../__tests__/testDb';
import { createExercise } from '../exerciseRepository';
import { createSession } from '../sessionRepository';
import { createSessionExercise } from '../sessionExerciseRepository';
import { createSet } from '../setRepository';
import { createTemplateFromSession } from '../templateFromSessionRepository';
import { listTemplateExercisesByTemplate } from '../templateExerciseRepository';
import { createUser } from '../userRepository';

async function setup() {
  const db = createTestDb();
  const user = await createUser(db, { displayName: 'Test User' });
  if (!user) throw new Error('user was not created');
  const bench = await createExercise(db, {
    userId: user.id,
    name: 'Bench Press',
    aliases: [],
    muscleGroup: 'Chest',
    equipmentType: 'barbell',
    loadConvention: 'total',
    barWeightKg: 20,
    defaultWeightStep: null,
    source: 'user',
    lastUsedAt: null,
  });
  const row = await createExercise(db, {
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
  if (!bench || !row) throw new Error('exercises were not created');

  const session = await createSession(db, {
    userId: user.id,
    templateId: null,
    programmeId: null,
    startedAt: new Date(),
    endedAt: new Date(),
    note: null,
    source: 'manual',
  });
  if (!session) throw new Error('session was not created');

  return { db, user, bench, row, session };
}

describe('createTemplateFromSession', () => {
  it('derives target sets/reps from the working sets actually logged', async () => {
    const { db, user, bench, session } = await setup();
    const se = await createSessionExercise(db, {
      userId: user.id,
      sessionId: session.id,
      exerciseId: bench.id,
      orderIndex: 0,
      supersetGroupId: null,
      note: null,
      skippedAt: null,
    });
    if (!se) throw new Error('session exercise was not created');

    for (const [i, reps] of [10, 8, 6].entries()) {
      await createSet(db, {
        userId: user.id,
        sessionExerciseId: se.id,
        index: i,
        weightKg: 60,
        reps,
        setType: 'working',
        parentSetId: null,
        restAfterSeconds: null,
        completedAt: new Date(),
      });
    }
    // A warm-up set should not count toward the derived target.
    await createSet(db, {
      userId: user.id,
      sessionExerciseId: se.id,
      index: 3,
      weightKg: 20,
      reps: 15,
      setType: 'warmup',
      parentSetId: null,
      restAfterSeconds: null,
      completedAt: new Date(),
    });

    const template = await createTemplateFromSession(db, user.id, session.id, 'Push Day', null, 0);
    expect(template).not.toBeNull();

    const exercises = await listTemplateExercisesByTemplate(db, user.id, template!.id);
    expect(exercises).toHaveLength(1);
    expect(exercises[0].targetSets).toBe(3);
    expect(exercises[0].targetRepsMin).toBe(6);
    expect(exercises[0].targetRepsMax).toBe(10);
  });

  it('excludes skipped exercises and preserves order plus superset grouping', async () => {
    const { db, user, bench, row, session } = await setup();
    const skipped = await createExercise(db, {
      userId: user.id,
      name: 'Face Pull',
      aliases: [],
      muscleGroup: 'Shoulders',
      equipmentType: 'cable',
      loadConvention: 'total',
      barWeightKg: null,
      defaultWeightStep: null,
      source: 'user',
      lastUsedAt: null,
    });
    if (!skipped) throw new Error('exercise was not created');

    const seBench = await createSessionExercise(db, {
      userId: user.id,
      sessionId: session.id,
      exerciseId: bench.id,
      orderIndex: 0,
      supersetGroupId: 'group-1',
      note: null,
      skippedAt: null,
    });
    const seRow = await createSessionExercise(db, {
      userId: user.id,
      sessionId: session.id,
      exerciseId: row.id,
      orderIndex: 1,
      supersetGroupId: 'group-1',
      note: null,
      skippedAt: null,
    });
    await createSessionExercise(db, {
      userId: user.id,
      sessionId: session.id,
      exerciseId: skipped.id,
      orderIndex: 2,
      supersetGroupId: null,
      note: null,
      skippedAt: new Date(),
    });
    if (!seBench || !seRow) throw new Error('session exercises were not created');

    await createSet(db, {
      userId: user.id,
      sessionExerciseId: seBench.id,
      index: 0,
      weightKg: 60,
      reps: 8,
      setType: 'working',
      parentSetId: null,
      restAfterSeconds: null,
      completedAt: new Date(),
    });
    await createSet(db, {
      userId: user.id,
      sessionExerciseId: seRow.id,
      index: 0,
      weightKg: 40,
      reps: 12,
      setType: 'working',
      parentSetId: null,
      restAfterSeconds: null,
      completedAt: new Date(),
    });

    const template = await createTemplateFromSession(db, user.id, session.id, 'Pull Day', null, 0);
    const exercises = await listTemplateExercisesByTemplate(db, user.id, template!.id);

    expect(exercises).toHaveLength(2); // Face Pull (skipped) excluded
    const ordered = [...exercises].sort((a, b) => a.orderIndex - b.orderIndex);
    expect(ordered[0].exerciseId).toBe(bench.id);
    expect(ordered[1].exerciseId).toBe(row.id);
    expect(ordered[0].supersetGroupId).toBe('group-1');
    expect(ordered[1].supersetGroupId).toBe('group-1');
  });

  it('returns null when the session has no non-skipped exercises', async () => {
    const { db, user, session } = await setup();
    const template = await createTemplateFromSession(db, user.id, session.id, 'Empty', null, 0);
    expect(template).toBeNull();
  });
});
