import { createTestDb } from '../../__tests__/testDb';
import { createExercise } from '../exerciseRepository';
import { createSession } from '../sessionRepository';
import { createSessionExercise } from '../sessionExerciseRepository';
import { createSet, joinSides, listSetsBySessionExercise, splitSetIntoSides } from '../setRepository';
import { createUser } from '../userRepository';

async function setup() {
  const db = createTestDb();
  const user = await createUser(db, { displayName: 'Test User' });
  if (!user) throw new Error('user was not created');
  const exercise = await createExercise(db, {
    userId: user.id,
    name: 'Single-arm Cable Row',
    aliases: [],
    muscleGroup: 'Back',
    equipmentType: 'cable',
    loadConvention: 'per_side',
    barWeightKg: null,
    defaultWeightStep: null,
    source: 'user',
    lastUsedAt: null,
  });
  if (!exercise) throw new Error('exercise was not created');
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
  const se = await createSessionExercise(db, { userId: user.id, sessionId: session.id, exerciseId: exercise.id, orderIndex: 0 });
  if (!se) throw new Error('session exercise was not created');
  const makeSet = (index: number) =>
    createSet(db, {
      userId: user.id,
      sessionExerciseId: se.id,
      index,
      weightKg: 20,
      reps: 10,
      setType: 'working',
      parentSetId: null,
      restAfterSeconds: null,
      completedAt: new Date(),
    });
  return { db, userId: user.id, seId: se.id, makeSet };
}

describe('splitSetIntoSides / joinSides', () => {
  it('existing sets default to side = null', async () => {
    const { makeSet } = await setup();
    const set = await makeSet(0);
    expect(set?.side).toBeNull();
  });

  it('tags the set left and appends a linked right row after every other set', async () => {
    const { db, userId, seId, makeSet } = await setup();
    const first = await makeSet(0);
    await makeSet(1);
    const result = await splitSetIntoSides(db, userId, first!.id, { weightKg: 17.5, reps: 8 }, { reps: 11 });
    expect(result?.left).toMatchObject({ id: first!.id, side: 'left', weightKg: 20, reps: 11, index: 0 });
    expect(result?.right).toMatchObject({ side: 'right', parentSetId: first!.id, weightKg: 17.5, reps: 8, index: 2, setType: 'working' });
    const all = await listSetsBySessionExercise(db, userId, seId);
    expect(all.map((s) => s.index).sort()).toEqual([0, 1, 2]);
  });

  it('joining soft-deletes the right row and returns the left to a shared value', async () => {
    const { db, userId, seId, makeSet } = await setup();
    const first = await makeSet(0);
    const result = await splitSetIntoSides(db, userId, first!.id, { weightKg: 17.5, reps: 8 });
    const joined = await joinSides(db, userId, result!.left.id, result!.right.id);
    expect(joined).toMatchObject({ id: first!.id, side: null, weightKg: 20, reps: 10 });
    const all = await listSetsBySessionExercise(db, userId, seId);
    expect(all).toHaveLength(1);
  });
});
