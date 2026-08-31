import { and, eq, isNull } from 'drizzle-orm';

import { newId } from '../id';
import { templateExercise } from '../schema';
import type { AppDatabase } from '../types';

export type NewTemplateExercise = Omit<
  typeof templateExercise.$inferInsert,
  'id' | 'createdAt' | 'updatedAt' | 'deletedAt' | 'syncState'
>;

export type TemplateExerciseUpdate = Partial<
  Omit<typeof templateExercise.$inferInsert, 'id' | 'userId' | 'templateId' | 'createdAt'>
>;

export async function createTemplateExercise(db: AppDatabase, input: NewTemplateExercise) {
  const id = newId();
  const now = new Date();
  await db.insert(templateExercise).values({ ...input, id, createdAt: now, updatedAt: now });
  return getTemplateExerciseById(db, input.userId, id);
}

export async function getTemplateExerciseById(db: AppDatabase, userId: string, id: string) {
  const rows = await db
    .select()
    .from(templateExercise)
    .where(
      and(
        eq(templateExercise.id, id),
        eq(templateExercise.userId, userId),
        isNull(templateExercise.deletedAt),
      ),
    )
    .limit(1);
  return rows[0] ?? null;
}

export async function listTemplateExercisesByTemplate(db: AppDatabase, userId: string, templateId: string) {
  return db
    .select()
    .from(templateExercise)
    .where(
      and(
        eq(templateExercise.templateId, templateId),
        eq(templateExercise.userId, userId),
        isNull(templateExercise.deletedAt),
      ),
    );
}

export async function updateTemplateExercise(
  db: AppDatabase,
  userId: string,
  id: string,
  patch: TemplateExerciseUpdate,
) {
  await db
    .update(templateExercise)
    .set({ ...patch, updatedAt: new Date() })
    .where(and(eq(templateExercise.id, id), eq(templateExercise.userId, userId)));
  return getTemplateExerciseById(db, userId, id);
}

export async function softDeleteTemplateExercise(db: AppDatabase, userId: string, id: string) {
  const now = new Date();
  await db
    .update(templateExercise)
    .set({ deletedAt: now, updatedAt: now })
    .where(and(eq(templateExercise.id, id), eq(templateExercise.userId, userId)));
}
