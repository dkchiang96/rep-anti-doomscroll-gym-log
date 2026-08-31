import { and, eq, isNull } from 'drizzle-orm';

import { newId } from '../id';
import { programme } from '../schema';
import type { AppDatabase } from '../types';

export type NewProgramme = Omit<
  typeof programme.$inferInsert,
  'id' | 'createdAt' | 'updatedAt' | 'archivedAt' | 'deletedAt' | 'syncState'
>;

export type ProgrammeUpdate = Partial<Omit<typeof programme.$inferInsert, 'id' | 'userId' | 'createdAt'>>;

export async function createProgramme(db: AppDatabase, input: NewProgramme) {
  const id = newId();
  const now = new Date();
  await db.insert(programme).values({ ...input, id, createdAt: now, updatedAt: now });
  return getProgrammeById(db, input.userId, id);
}

export async function getProgrammeById(db: AppDatabase, userId: string, id: string) {
  const rows = await db
    .select()
    .from(programme)
    .where(and(eq(programme.id, id), eq(programme.userId, userId), isNull(programme.deletedAt)))
    .limit(1);
  return rows[0] ?? null;
}

export async function getActiveProgramme(db: AppDatabase, userId: string) {
  const rows = await db
    .select()
    .from(programme)
    .where(and(eq(programme.userId, userId), eq(programme.isActive, true), isNull(programme.deletedAt)))
    .limit(1);
  return rows[0] ?? null;
}

export async function listProgrammes(db: AppDatabase, userId: string) {
  return db
    .select()
    .from(programme)
    .where(and(eq(programme.userId, userId), isNull(programme.deletedAt)));
}

export async function updateProgramme(db: AppDatabase, userId: string, id: string, patch: ProgrammeUpdate) {
  await db
    .update(programme)
    .set({ ...patch, updatedAt: new Date() })
    .where(and(eq(programme.id, id), eq(programme.userId, userId)));
  return getProgrammeById(db, userId, id);
}

export async function archiveProgramme(db: AppDatabase, userId: string, id: string) {
  const now = new Date();
  await db
    .update(programme)
    .set({ isArchived: true, archivedAt: now, updatedAt: now })
    .where(and(eq(programme.id, id), eq(programme.userId, userId)));
}

export async function softDeleteProgramme(db: AppDatabase, userId: string, id: string) {
  const now = new Date();
  await db
    .update(programme)
    .set({ deletedAt: now, updatedAt: now })
    .where(and(eq(programme.id, id), eq(programme.userId, userId)));
}
