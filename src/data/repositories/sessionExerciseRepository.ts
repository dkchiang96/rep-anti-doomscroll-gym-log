import { and, desc, eq, isNull, ne } from 'drizzle-orm';

import { newId } from '../id';
import { session, sessionExercise } from '../schema';
import type { AppDatabase } from '../types';

export type NewSessionExercise = Omit<
  typeof sessionExercise.$inferInsert,
  'id' | 'createdAt' | 'updatedAt' | 'deletedAt' | 'syncState'
>;

export type SessionExerciseUpdate = Partial<
  Omit<typeof sessionExercise.$inferInsert, 'id' | 'userId' | 'sessionId' | 'createdAt'>
>;

export async function createSessionExercise(db: AppDatabase, input: NewSessionExercise) {
  const id = newId();
  const now = new Date();
  await db.insert(sessionExercise).values({ ...input, id, createdAt: now, updatedAt: now });
  return getSessionExerciseById(db, input.userId, id);
}

export async function getSessionExerciseById(db: AppDatabase, userId: string, id: string) {
  const rows = await db
    .select()
    .from(sessionExercise)
    .where(
      and(eq(sessionExercise.id, id), eq(sessionExercise.userId, userId), isNull(sessionExercise.deletedAt)),
    )
    .limit(1);
  return rows[0] ?? null;
}

export async function listSessionExercisesBySession(db: AppDatabase, userId: string, sessionId: string) {
  return db
    .select()
    .from(sessionExercise)
    .where(
      and(
        eq(sessionExercise.sessionId, sessionId),
        eq(sessionExercise.userId, userId),
        isNull(sessionExercise.deletedAt),
      ),
    );
}

export async function updateSessionExercise(
  db: AppDatabase,
  userId: string,
  id: string,
  patch: SessionExerciseUpdate,
) {
  await db
    .update(sessionExercise)
    .set({ ...patch, updatedAt: new Date() })
    .where(and(eq(sessionExercise.id, id), eq(sessionExercise.userId, userId)));
  return getSessionExerciseById(db, userId, id);
}

// FR-3.2: "last session" is the most recent OTHER session that performed
// this exercise, by actual training date — never the same calendar weekday.
export async function getMostRecentSessionExerciseForExercise(
  db: AppDatabase,
  userId: string,
  exerciseId: string,
  excludeSessionId: string,
) {
  const rows = await db
    .select({ sessionExercise })
    .from(sessionExercise)
    .innerJoin(session, eq(session.id, sessionExercise.sessionId))
    .where(
      and(
        eq(sessionExercise.userId, userId),
        eq(sessionExercise.exerciseId, exerciseId),
        ne(sessionExercise.sessionId, excludeSessionId),
        isNull(sessionExercise.deletedAt),
        isNull(session.deletedAt),
      ),
    )
    .orderBy(desc(session.startedAt))
    .limit(1);
  return rows[0]?.sessionExercise ?? null;
}

export async function softDeleteSessionExercise(db: AppDatabase, userId: string, id: string) {
  const now = new Date();
  await db
    .update(sessionExercise)
    .set({ deletedAt: now, updatedAt: now })
    .where(and(eq(sessionExercise.id, id), eq(sessionExercise.userId, userId)));
}
