import { createTestDb } from '../../__tests__/testDb';
import { createExercise } from '../exerciseRepository';
import { createSession } from '../sessionRepository';
import { createSessionExercise, getSessionExerciseById } from '../sessionExerciseRepository';
import { cancelCardioLap, listSetsBySessionExercise, startCardioLap, stopCardioLap } from '../setRepository';
import { createUser } from '../userRepository';

async function setup() {
  const db = createTestDb();
  const user = await createUser(db, { displayName: 'Test User' });
  if (!user) throw new Error('user was not created');
  const exercise = await createExercise(db, {
    userId: user.id,
    name: 'Run',
    aliases: [],
    muscleGroup: 'Conditioning',
    equipmentType: 'bodyweight',
    loadConvention: 'bodyweight',
    kind: 'cardio',
    track: ['distance_m', 'time'],
    barWeightKg: null,
    defaultWeightStep: null,
    source: 'imported',
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
  return { db, userId: user.id, seId: se.id, exercise };
}

const round = { weightKg: 0, reps: 0, distanceM: 1000, calories: null };

describe('cardio lap timer', () => {
  it('stores the cardio kind and track on the exercise', async () => {
    const { exercise } = await setup();
    expect(exercise).toMatchObject({ kind: 'cardio', track: ['distance_m', 'time'] });
  });

  it('persists a running lap, then records the round with its duration on stop', async () => {
    const { db, userId, seId } = await setup();
    await startCardioLap(db, userId, seId, new Date(10_000));
    expect((await getSessionExerciseById(db, userId, seId))?.lapStartedAt?.getTime()).toBe(10_000);

    const first = await stopCardioLap(db, userId, seId, round, new Date(255_400));
    expect(first).toMatchObject({ durationSeconds: 245, distanceM: 1000, index: 0, setType: 'working' });
    expect((await getSessionExerciseById(db, userId, seId))?.lapStartedAt).toBeNull();

    await startCardioLap(db, userId, seId, new Date(300_000));
    const second = await stopCardioLap(db, userId, seId, round, new Date(552_000));
    expect(second).toMatchObject({ durationSeconds: 252, index: 1 });
    expect(await listSetsBySessionExercise(db, userId, seId)).toHaveLength(2);
  });

  it('records nothing when no lap is running, or after a cancel', async () => {
    const { db, userId, seId } = await setup();
    expect(await stopCardioLap(db, userId, seId, round)).toBeNull();
    await startCardioLap(db, userId, seId);
    await cancelCardioLap(db, userId, seId);
    expect(await stopCardioLap(db, userId, seId, round)).toBeNull();
    expect(await listSetsBySessionExercise(db, userId, seId)).toHaveLength(0);
  });

  it('defaults kind to strength for exercises created without it', async () => {
    const { db, userId } = await setup();
    const strength = await createExercise(db, {
      userId,
      name: 'Bench',
      aliases: [],
      muscleGroup: 'Chest',
      equipmentType: 'barbell',
      loadConvention: 'total',
      barWeightKg: 20,
      defaultWeightStep: null,
      source: 'user',
      lastUsedAt: null,
    });
    expect(strength).toMatchObject({ kind: 'strength', track: null });
  });
});
