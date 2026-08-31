import { and, eq, isNull } from 'drizzle-orm';

import { newId } from '../id';
import { setEntry } from '../schema';
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
