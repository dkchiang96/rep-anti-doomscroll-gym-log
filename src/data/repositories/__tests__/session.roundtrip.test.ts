import { eq } from 'drizzle-orm';

import { createTestDb } from '../../__tests__/testDb';
import { setEntry } from '../../schema';
import { createExercise } from '../exerciseRepository';
import { createSession } from '../sessionRepository';
import { createSessionExercise, listSessionExercisesBySession } from '../sessionExerciseRepository';
import { createSet, listSetsBySessionExercise, softDeleteSet } from '../setRepository';
import { createUser } from '../userRepository';

describe('session round trip', () => {
  it('creates a session with two exercises and five sets, reads them back, and soft-deletes one set', async () => {
    const db = createTestDb();

    const user = await createUser(db, { displayName: 'Test User' });
    if (!user) throw new Error('user was not created');

    const squat = await createExercise(db, {
      userId: user.id,
      name: 'Squat',
      aliases: [],
      muscleGroup: 'Quads',
      equipmentType: 'barbell',
      loadConvention: 'total',
      barWeightKg: 20,
      defaultWeightStep: null,
      source: 'user',
      lastUsedAt: null,
    });
    const benchPress = await createExercise(db, {
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
    if (!squat || !benchPress) throw new Error('exercises were not created');

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

    const squatSessionExercise = await createSessionExercise(db, {
      userId: user.id,
      sessionId: session.id,
      exerciseId: squat.id,
      orderIndex: 0,
      supersetGroupId: null,
      note: null,
    });
    const benchSessionExercise = await createSessionExercise(db, {
      userId: user.id,
      sessionId: session.id,
      exerciseId: benchPress.id,
      orderIndex: 1,
      supersetGroupId: null,
      note: null,
    });
    if (!squatSessionExercise || !benchSessionExercise) {
      throw new Error('session exercises were not created');
    }

    const sessionExercises = await listSessionExercisesBySession(db, user.id, session.id);
    expect(sessionExercises).toHaveLength(2);

    const squatSets = await Promise.all(
      [0, 1, 2].map((index) =>
        createSet(db, {
          userId: user.id,
          sessionExerciseId: squatSessionExercise.id,
          index,
          weightKg: 100,
          reps: 5,
          setType: 'working',
          parentSetId: null,
          restAfterSeconds: null,
          completedAt: new Date(),
        }),
      ),
    );
    const benchSets = await Promise.all(
      [0, 1].map((index) =>
        createSet(db, {
          userId: user.id,
          sessionExerciseId: benchSessionExercise.id,
          index,
          weightKg: 60,
          reps: 8,
          setType: 'working',
          parentSetId: null,
          restAfterSeconds: null,
          completedAt: new Date(),
        }),
      ),
    );
    const allSets = [...squatSets, ...benchSets];
    expect(allSets).toHaveLength(5);
    expect(allSets.every((set) => set !== null)).toBe(true);

    const squatSetsBeforeDelete = await listSetsBySessionExercise(db, user.id, squatSessionExercise.id);
    expect(squatSetsBeforeDelete).toHaveLength(3);

    const setToDelete = squatSetsBeforeDelete[0];
    await softDeleteSet(db, user.id, setToDelete.id);

    const squatSetsAfterDelete = await listSetsBySessionExercise(db, user.id, squatSessionExercise.id);
    expect(squatSetsAfterDelete).toHaveLength(2);
    expect(squatSetsAfterDelete.find((set) => set.id === setToDelete.id)).toBeUndefined();

    const rawRows = await db.select().from(setEntry).where(eq(setEntry.sessionExerciseId, squatSessionExercise.id));
    expect(rawRows).toHaveLength(3);
    const rawDeletedRow = rawRows.find((row) => row.id === setToDelete.id);
    expect(rawDeletedRow).toBeDefined();
    expect(rawDeletedRow?.deletedAt).not.toBeNull();
  });
});
