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
    .where(
      and(
        eq(programme.userId, userId),
        eq(programme.isActive, true),
        eq(programme.isArchived, false),
        isNull(programme.deletedAt),
      ),
    )
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

// FR-5.2: exactly one programme is active at a time — deactivate every
// other programme before activating this one.
export async function setActiveProgramme(db: AppDatabase, userId: string, id: string) {
  const now = new Date();
  await db.update(programme).set({ isActive: false, updatedAt: now }).where(eq(programme.userId, userId));
  await db
    .update(programme)
    .set({ isActive: true, updatedAt: now })
    .where(and(eq(programme.id, id), eq(programme.userId, userId)));
  return getProgrammeById(db, userId, id);
}

// An archived programme can't stay active (Home would keep offering its days),
// so archiving also clears the active flag. Restoring it later does not make it
// active again — that's an explicit choice on the Programmes screen.
export async function archiveProgramme(db: AppDatabase, userId: string, id: string) {
  const now = new Date();
  await db
    .update(programme)
    .set({ isArchived: true, isActive: false, archivedAt: now, updatedAt: now })
    .where(and(eq(programme.id, id), eq(programme.userId, userId)));
}

// FR-5.8: archiving is fully reversible via the same multi-select mechanism.
export async function unarchiveProgramme(db: AppDatabase, userId: string, id: string) {
  const now = new Date();
  await db
    .update(programme)
    .set({ isArchived: false, archivedAt: null, updatedAt: now })
    .where(and(eq(programme.id, id), eq(programme.userId, userId)));
}

export async function softDeleteProgramme(db: AppDatabase, userId: string, id: string) {
  const now = new Date();
  await db
    .update(programme)
    .set({ deletedAt: now, updatedAt: now })
    .where(and(eq(programme.id, id), eq(programme.userId, userId)));
}
