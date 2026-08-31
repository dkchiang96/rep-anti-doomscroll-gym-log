import { and, eq, isNull } from 'drizzle-orm';

import { newId } from '../id';
import { template } from '../schema';
import type { AppDatabase } from '../types';

export type NewTemplate = Omit<
  typeof template.$inferInsert,
  'id' | 'createdAt' | 'updatedAt' | 'archivedAt' | 'deletedAt' | 'syncState'
>;

export type TemplateUpdate = Partial<Omit<typeof template.$inferInsert, 'id' | 'userId' | 'createdAt'>>;

export async function createTemplate(db: AppDatabase, input: NewTemplate) {
  const id = newId();
  const now = new Date();
  await db.insert(template).values({ ...input, id, createdAt: now, updatedAt: now });
  return getTemplateById(db, input.userId, id);
}

export async function getTemplateById(db: AppDatabase, userId: string, id: string) {
  const rows = await db
    .select()
    .from(template)
    .where(and(eq(template.id, id), eq(template.userId, userId), isNull(template.deletedAt)))
    .limit(1);
  return rows[0] ?? null;
}

export async function listTemplates(db: AppDatabase, userId: string) {
  return db
    .select()
    .from(template)
    .where(and(eq(template.userId, userId), isNull(template.deletedAt)));
}

export async function updateTemplate(db: AppDatabase, userId: string, id: string, patch: TemplateUpdate) {
  await db
    .update(template)
    .set({ ...patch, updatedAt: new Date() })
    .where(and(eq(template.id, id), eq(template.userId, userId)));
  return getTemplateById(db, userId, id);
}

export async function archiveTemplate(db: AppDatabase, userId: string, id: string) {
  const now = new Date();
  await db
    .update(template)
    .set({ isArchived: true, archivedAt: now, updatedAt: now })
    .where(and(eq(template.id, id), eq(template.userId, userId)));
}

export async function softDeleteTemplate(db: AppDatabase, userId: string, id: string) {
  const now = new Date();
  await db
    .update(template)
    .set({ deletedAt: now, updatedAt: now })
    .where(and(eq(template.id, id), eq(template.userId, userId)));
}
