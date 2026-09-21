import { and, desc, eq, gte, inArray, isNull } from 'drizzle-orm';

import { newId } from '../id';
import { session, sessionExercise, setEntry } from '../schema';
import type { AppDatabase } from '../types';

export type NewSession = Omit<
  typeof session.$inferInsert,
  'id' | 'createdAt' | 'updatedAt' | 'deletedAt' | 'syncState'
>;

export type SessionUpdate = Partial<Omit<typeof session.$inferInsert, 'id' | 'userId' | 'createdAt'>>;

export async function createSession(db: AppDatabase, input: NewSession) {
  const id = newId();
  const now = new Date();
  await db.insert(session).values({ ...input, id, createdAt: now, updatedAt: now });
  return getSessionById(db, input.userId, id);
}

export async function getSessionById(db: AppDatabase, userId: string, id: string) {
  const rows = await db
    .select()
    .from(session)
    .where(and(eq(session.id, id), eq(session.userId, userId), isNull(session.deletedAt)))
    .limit(1);
  return rows[0] ?? null;
}

const ACTIVE_SESSION_WINDOW_MS = 6 * 60 * 60 * 1000;

// FR-1.2: a session is only auto-restored on launch if it's still in
// progress and under 6 hours old. An older unended session is left alone —
// not auto-closed, just not restored into.
export async function getActiveSession(db: AppDatabase, userId: string, now: Date = new Date()) {
  const rows = await db
    .select()
    .from(session)
    .where(
      and(
        eq(session.userId, userId),
        isNull(session.endedAt),
        isNull(session.deletedAt),
        gte(session.startedAt, new Date(now.getTime() - ACTIVE_SESSION_WINDOW_MS)),
      ),
    )
    .orderBy(desc(session.startedAt))
    .limit(1);
  return rows[0] ?? null;
}

export async function listSessions(db: AppDatabase, userId: string) {
  return db
    .select()
    .from(session)
    .where(and(eq(session.userId, userId), isNull(session.deletedAt)));
}

export async function updateSession(db: AppDatabase, userId: string, id: string, patch: SessionUpdate) {
  await db
    .update(session)
    .set({ ...patch, updatedAt: new Date() })
    .where(and(eq(session.id, id), eq(session.userId, userId)));
  return getSessionById(db, userId, id);
}

export async function endSession(db: AppDatabase, userId: string, id: string, endedAt: Date = new Date()) {
  await db
    .update(session)
    .set({ endedAt, updatedAt: new Date() })
    .where(and(eq(session.id, id), eq(session.userId, userId)));
  return getSessionById(db, userId, id);
}

export async function softDeleteSession(db: AppDatabase, userId: string, id: string) {
  const now = new Date();
  await db
    .update(session)
    .set({ deletedAt: now, updatedAt: now })
    .where(and(eq(session.id, id), eq(session.userId, userId)));
}

// Deletes a finished workout: the session and, so nothing derived from it
// (weight-step inference, ghost pre-fill) can still see them, its exercises
// and sets — all soft (invariant 5). Refuses a session still in progress
// (returns false) so a running workout can't be deleted out from under the
// live screen. Sets go first and the session last, so a failure part-way
// leaves the session visible and the delete can simply be retried.
export async function softDeleteSessionCascade(db: AppDatabase, userId: string, id: string): Promise<boolean> {
  const existing = await getSessionById(db, userId, id);
  if (!existing || existing.endedAt == null) return false;

  const now = new Date();
  const exercises = await db
    .select({ id: sessionExercise.id })
    .from(sessionExercise)
    .where(and(eq(sessionExercise.sessionId, id), eq(sessionExercise.userId, userId)));
  const exerciseIds = exercises.map((e) => e.id);

  if (exerciseIds.length > 0) {
    await db
      .update(setEntry)
      .set({ deletedAt: now, updatedAt: now })
      .where(and(eq(setEntry.userId, userId), inArray(setEntry.sessionExerciseId, exerciseIds), isNull(setEntry.deletedAt)));
    await db
      .update(sessionExercise)
      .set({ deletedAt: now, updatedAt: now })
      .where(and(eq(sessionExercise.userId, userId), inArray(sessionExercise.id, exerciseIds), isNull(sessionExercise.deletedAt)));
  }
  await softDeleteSession(db, userId, id);
  return true;
}
