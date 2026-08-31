import { createTestDb } from '../../__tests__/testDb';
import { createExercise, recordExerciseUsage } from '../exerciseRepository';
import { createUser } from '../userRepository';

describe('recordExerciseUsage', () => {
  it('increments useCount and stamps lastUsedAt', async () => {
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
    expect(exercise.useCount).toBe(0);
    expect(exercise.lastUsedAt).toBeNull();

    const once = await recordExerciseUsage(db, user.id, exercise.id);
    expect(once?.useCount).toBe(1);
    expect(once?.lastUsedAt).toBeInstanceOf(Date);

    const twice = await recordExerciseUsage(db, user.id, exercise.id);
    expect(twice?.useCount).toBe(2);
  });

  it('returns null for an exercise that does not belong to the user', async () => {
    const db = createTestDb();
    const owner = await createUser(db, { displayName: 'Owner' });
    const other = await createUser(db, { displayName: 'Other' });
    if (!owner || !other) throw new Error('users were not created');
    const exercise = await createExercise(db, {
      userId: owner.id,
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
    if (!exercise) throw new Error('exercise was not created');

    expect(await recordExerciseUsage(db, other.id, exercise.id)).toBeNull();
  });
});
