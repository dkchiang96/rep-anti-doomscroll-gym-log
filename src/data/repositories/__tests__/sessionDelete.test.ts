import { createTestDb } from '../../__tests__/testDb';
import { createExercise } from '../exerciseRepository';
import { getSessionDetail, listSessionSummaries } from '../historyRepository';
import { listSessionHistoryForExercise } from '../progressRepository';
import { createProgramme, archiveProgramme, getActiveProgramme, listProgrammes } from '../programmeRepository';
import { createSession, getSessionById, softDeleteSessionCascade } from '../sessionRepository';
import { createSessionExercise, listSessionExercisesBySession } from '../sessionExerciseRepository';
import { createSet, listHistoricalWeightsForExercise, listSetsBySessionExercise } from '../setRepository';
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

async function logSession(
  { db, user, exercise }: Awaited<ReturnType<typeof setup>>,
  startedAt: Date,
  endedAt: Date | null,
  weightKg: number,
) {
  const session = await createSession(db, {
    userId: user.id,
    templateId: null,
    programmeId: null,
    startedAt,
    endedAt,
    note: null,
    source: 'manual',
  });
  if (!session) throw new Error('session was not created');
  const se = await createSessionExercise(db, { userId: user.id, sessionId: session.id, exerciseId: exercise.id, orderIndex: 0 });
  if (!se) throw new Error('session exercise was not created');
  await createSet(db, {
    userId: user.id,
    sessionExerciseId: se.id,
    index: 0,
    weightKg,
    reps: 10,
    setType: 'working',
    parentSetId: null,
    restAfterSeconds: null,
    completedAt: startedAt,
  });
  return { session, se };
}

describe('softDeleteSessionCascade', () => {
  it('soft-deletes a finished session, its exercises and its sets, and hides it everywhere', async () => {
    const ctx = await setup();
    const { db, user, exercise } = ctx;
    const keep = await logSession(ctx, new Date('2026-08-01T10:00:00Z'), new Date('2026-08-01T11:00:00Z'), 40);
    const wrong = await logSession(ctx, new Date('2026-08-08T10:00:00Z'), new Date('2026-08-08T11:00:00Z'), 400);

    expect(await softDeleteSessionCascade(db, user.id, wrong.session.id)).toBe(true);

    expect(await getSessionById(db, user.id, wrong.session.id)).toBeNull();
    expect(await listSessionExercisesBySession(db, user.id, wrong.session.id)).toEqual([]);
    expect(await listSetsBySessionExercise(db, user.id, wrong.se.id)).toEqual([]);

    const history = await listSessionHistoryForExercise(db, user.id, exercise.id);
    expect(history.map((h) => h.sessionId)).toEqual([keep.session.id]);
    expect((await listSessionSummaries(db, user.id)).map((s) => s.id)).toEqual([keep.session.id]);
    expect(await listHistoricalWeightsForExercise(db, user.id, exercise.id)).toEqual([40]);
    expect(await getSessionDetail(db, user.id, wrong.session.id)).toEqual([]);

    // The other workout is untouched.
    expect(await listSetsBySessionExercise(db, user.id, keep.se.id)).toHaveLength(1);
  });

  it('refuses a session that is still in progress', async () => {
    const ctx = await setup();
    const running = await logSession(ctx, new Date(), null, 50);

    expect(await softDeleteSessionCascade(ctx.db, ctx.user.id, running.session.id)).toBe(false);
    expect(await getSessionById(ctx.db, ctx.user.id, running.session.id)).not.toBeNull();
    expect(await listSetsBySessionExercise(ctx.db, ctx.user.id, running.se.id)).toHaveLength(1);
  });

  it("is scoped by user: another user's session id is refused and untouched", async () => {
    const ctx = await setup();
    const other = await createUser(ctx.db, { displayName: 'Other User' });
    if (!other) throw new Error('user was not created');
    const mine = await logSession(ctx, new Date('2026-08-01T10:00:00Z'), new Date('2026-08-01T11:00:00Z'), 40);

    expect(await softDeleteSessionCascade(ctx.db, other.id, mine.session.id)).toBe(false);
    expect(await getSessionById(ctx.db, ctx.user.id, mine.session.id)).not.toBeNull();
    expect(await listSetsBySessionExercise(ctx.db, ctx.user.id, mine.se.id)).toHaveLength(1);
  });
});

describe('archiving the active programme', () => {
  it('clears the active flag, so getActiveProgramme no longer returns it', async () => {
    const { db, user } = await setup();
    const programme = await createProgramme(db, { userId: user.id, name: 'Old cycle', notes: null, isActive: true, source: 'manual' });
    if (!programme) throw new Error('programme was not created');
    expect((await getActiveProgramme(db, user.id))?.id).toBe(programme.id);

    await archiveProgramme(db, user.id, programme.id);

    expect(await getActiveProgramme(db, user.id)).toBeNull();
    const found = (await listProgrammes(db, user.id)).find((p) => p.id === programme.id);
    expect(found?.isActive).toBe(false);
    expect(found?.isArchived).toBe(true);
  });

  it('ignores an archived programme even if its active flag was somehow left set', async () => {
    const { db, user } = await setup();
    await createProgramme(db, { userId: user.id, name: 'Stale', notes: null, isActive: true, isArchived: true, source: 'manual' });

    expect(await getActiveProgramme(db, user.id)).toBeNull();
  });
});
