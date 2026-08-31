import { and, eq, isNull } from 'drizzle-orm';

import { newId } from '../id';
import { exercise } from '../schema';
import type { AppDatabase } from '../types';

export type NewExercise = Omit<
  typeof exercise.$inferInsert,
  'id' | 'createdAt' | 'updatedAt' | 'deletedAt' | 'syncState'
>;

export type ExerciseUpdate = Partial<Omit<typeof exercise.$inferInsert, 'id' | 'userId' | 'createdAt'>>;

export async function createExercise(db: AppDatabase, input: NewExercise) {
  const id = newId();
  const now = new Date();
  await db.insert(exercise).values({ ...input, id, createdAt: now, updatedAt: now });
  return getExerciseById(db, input.userId, id);
}

export async function getExerciseById(db: AppDatabase, userId: string, id: string) {
  const rows = await db
    .select()
    .from(exercise)
    .where(and(eq(exercise.id, id), eq(exercise.userId, userId), isNull(exercise.deletedAt)))
    .limit(1);
  return rows[0] ?? null;
}

export async function listExercises(db: AppDatabase, userId: string) {
  return db
    .select()
    .from(exercise)
    .where(and(eq(exercise.userId, userId), isNull(exercise.deletedAt)));
}

export async function updateExercise(db: AppDatabase, userId: string, id: string, patch: ExerciseUpdate) {
  await db
    .update(exercise)
    .set({ ...patch, updatedAt: new Date() })
    .where(and(eq(exercise.id, id), eq(exercise.userId, userId)));
  return getExerciseById(db, userId, id);
}

export async function softDeleteExercise(db: AppDatabase, userId: string, id: string) {
  const now = new Date();
  await db
    .update(exercise)
    .set({ deletedAt: now, updatedAt: now })
    .where(and(eq(exercise.id, id), eq(exercise.userId, userId)));
}

// FR-2.4: feeds the picker's frequency/recency ranking. Called whenever an
// exercise is picked into a session, not on every set within it.
export async function recordExerciseUsage(db: AppDatabase, userId: string, id: string) {
  const current = await getExerciseById(db, userId, id);
  if (!current) return null;
  const now = new Date();
  await db
    .update(exercise)
    .set({ useCount: current.useCount + 1, lastUsedAt: now, updatedAt: now })
    .where(and(eq(exercise.id, id), eq(exercise.userId, userId)));
  return getExerciseById(db, userId, id);
}
