import { and, eq, isNull } from 'drizzle-orm';

import { lapDurationSeconds } from '../../domain/cardio';
import { newId } from '../id';
import { sessionExercise, setEntry } from '../schema';
import type { AppDatabase } from '../types';

export type NewSet = Omit<
  typeof setEntry.$inferInsert,
  'id' | 'createdAt' | 'updatedAt' | 'deletedAt' | 'syncState'
>;

export type SetUpdate = Partial<
  Omit<typeof setEntry.$inferInsert, 'id' | 'userId' | 'sessionExerciseId' | 'createdAt'>
>;

export async function createSet(db: AppDatabase, input: NewSet) {
  const id = newId();
  const now = new Date();
  await db.insert(setEntry).values({ ...input, id, createdAt: now, updatedAt: now });
  return getSetById(db, input.userId, id);
}

export async function getSetById(db: AppDatabase, userId: string, id: string) {
  const rows = await db
    .select()
    .from(setEntry)
    .where(and(eq(setEntry.id, id), eq(setEntry.userId, userId), isNull(setEntry.deletedAt)))
    .limit(1);
  return rows[0] ?? null;
}

export async function listSetsBySessionExercise(db: AppDatabase, userId: string, sessionExerciseId: string) {
  return db
    .select()
    .from(setEntry)
    .where(
      and(
        eq(setEntry.sessionExerciseId, sessionExerciseId),
        eq(setEntry.userId, userId),
        isNull(setEntry.deletedAt),
      ),
    );
}

// FR-3.4: raw material for inferring a per-exercise weight step (e.g. a
// cable stack's ladder) from history when the exercise has no explicit
// default step set.
export async function listHistoricalWeightsForExercise(db: AppDatabase, userId: string, exerciseId: string) {
  const rows = await db
    .select({ weightKg: setEntry.weightKg })
    .from(setEntry)
    .innerJoin(sessionExercise, eq(sessionExercise.id, setEntry.sessionExerciseId))
    .where(
      and(
        eq(setEntry.userId, userId),
        eq(sessionExercise.exerciseId, exerciseId),
        isNull(setEntry.deletedAt),
        isNull(sessionExercise.deletedAt),
      ),
    );
  return rows.map((r) => r.weightKg);
}

export async function updateSet(db: AppDatabase, userId: string, id: string, patch: SetUpdate) {
  await db
    .update(setEntry)
    .set({ ...patch, updatedAt: new Date() })
    .where(and(eq(setEntry.id, id), eq(setEntry.userId, userId)));
  return getSetById(db, userId, id);
}

export async function softDeleteSet(db: AppDatabase, userId: string, id: string) {
  const now = new Date();
  await db
    .update(setEntry)
    .set({ deletedAt: now, updatedAt: now })
    .where(and(eq(setEntry.id, id), eq(setEntry.userId, userId)));
}

// Left/right tracking (src/domain/sidePairs.ts). Splitting tags the set
// 'left' and appends a 'right' row after every other set in the exercise
// (index = current max + 1, so no existing row is reindexed), linked back
// via parentSetId — the same attachment drop sets use. Both writes happen
// the moment the user first changes a side (invariant 1).
export async function splitSetIntoSides(
  db: AppDatabase,
  userId: string,
  leftSetId: string,
  rightValues: { weightKg: number; reps: number },
  leftPatch: { weightKg?: number; reps?: number } = {},
) {
  const left = await getSetById(db, userId, leftSetId);
  if (!left) return null;
  const siblings = await listSetsBySessionExercise(db, userId, left.sessionExerciseId);
  const nextIndex = siblings.reduce((max, s) => Math.max(max, s.index), -1) + 1;
  const updatedLeft = await updateSet(db, userId, left.id, { ...leftPatch, side: 'left' });
  const right = await createSet(db, {
    userId,
    sessionExerciseId: left.sessionExerciseId,
    index: nextIndex,
    weightKg: rightValues.weightKg,
    reps: rightValues.reps,
    setType: left.setType,
    parentSetId: left.id,
    side: 'right',
    restAfterSeconds: null,
    completedAt: new Date(),
  });
  if (!updatedLeft || !right) return null;
  return { left: updatedLeft, right };
}

// "Make even again": the left row goes back to one shared value (side =
// null, keeping its own numbers) and the right row is soft-deleted
// (invariant 5 — never hard-deleted).
export async function joinSides(db: AppDatabase, userId: string, leftSetId: string, rightSetId: string) {
  await softDeleteSet(db, userId, rightSetId);
  return updateSet(db, userId, leftSetId, { side: null });
}

// ── Cardio lap timer (src/domain/cardio.ts) ─────────────────────────────
// The running lap's start is stored on the session_exercise row, not held
// in memory, so a lap survives the app being killed. Stopping writes the
// round as an ordinary set row (appended, next free index) with its
// duration, pre-filled with the station's per-round target values — all
// editable on the logging screen afterwards.

async function getLiveSessionExercise(db: AppDatabase, userId: string, sessionExerciseId: string) {
  const rows = await db
    .select()
    .from(sessionExercise)
    .where(and(eq(sessionExercise.id, sessionExerciseId), eq(sessionExercise.userId, userId), isNull(sessionExercise.deletedAt)))
    .limit(1);
  return rows[0] ?? null;
}

export async function startCardioLap(db: AppDatabase, userId: string, sessionExerciseId: string, startedAt: Date = new Date()) {
  await db
    .update(sessionExercise)
    .set({ lapStartedAt: startedAt, updatedAt: new Date() })
    .where(and(eq(sessionExercise.id, sessionExerciseId), eq(sessionExercise.userId, userId)));
}

// Discards a lap started by mistake — nothing was recorded for it.
export async function cancelCardioLap(db: AppDatabase, userId: string, sessionExerciseId: string) {
  await db
    .update(sessionExercise)
    .set({ lapStartedAt: null, updatedAt: new Date() })
    .where(and(eq(sessionExercise.id, sessionExerciseId), eq(sessionExercise.userId, userId)));
}

export async function stopCardioLap(
  db: AppDatabase,
  userId: string,
  sessionExerciseId: string,
  round: { weightKg: number; reps: number; distanceM: number | null; calories: number | null },
  stoppedAt: Date = new Date(),
) {
  const se = await getLiveSessionExercise(db, userId, sessionExerciseId);
  if (!se?.lapStartedAt) return null;
  const siblings = await listSetsBySessionExercise(db, userId, sessionExerciseId);
  const index = siblings.reduce((max, s) => Math.max(max, s.index), -1) + 1;
  const created = await createSet(db, {
    userId,
    sessionExerciseId,
    index,
    weightKg: round.weightKg,
    reps: round.reps,
    distanceM: round.distanceM,
    calories: round.calories,
    durationSeconds: lapDurationSeconds(se.lapStartedAt.getTime(), stoppedAt.getTime()),
    setType: 'working',
    parentSetId: null,
    restAfterSeconds: null,
    completedAt: stoppedAt,
  });
  await cancelCardioLap(db, userId, sessionExerciseId);
  return created;
}
