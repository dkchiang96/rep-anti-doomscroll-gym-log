import { and, eq, isNull } from 'drizzle-orm';

import { newId } from '../id';
import { plateInventory } from '../schema';
import type { AppDatabase } from '../types';

export type NewPlateInventory = Omit<
  typeof plateInventory.$inferInsert,
  'id' | 'createdAt' | 'updatedAt' | 'deletedAt' | 'syncState'
>;

export type PlateInventoryUpdate = Partial<
  Omit<typeof plateInventory.$inferInsert, 'id' | 'userId' | 'createdAt'>
>;

export async function createPlateInventory(db: AppDatabase, input: NewPlateInventory) {
  const id = newId();
  const now = new Date();
  await db.insert(plateInventory).values({ ...input, id, createdAt: now, updatedAt: now });
  return getPlateInventoryById(db, input.userId, id);
}

export async function getPlateInventoryById(db: AppDatabase, userId: string, id: string) {
  const rows = await db
    .select()
    .from(plateInventory)
    .where(and(eq(plateInventory.id, id), eq(plateInventory.userId, userId), isNull(plateInventory.deletedAt)))
    .limit(1);
  return rows[0] ?? null;
}

export async function listPlateInventory(db: AppDatabase, userId: string) {
  return db
    .select()
    .from(plateInventory)
    .where(and(eq(plateInventory.userId, userId), isNull(plateInventory.deletedAt)));
}

export async function updatePlateInventory(
  db: AppDatabase,
  userId: string,
  id: string,
  patch: PlateInventoryUpdate,
) {
  await db
    .update(plateInventory)
    .set({ ...patch, updatedAt: new Date() })
    .where(and(eq(plateInventory.id, id), eq(plateInventory.userId, userId)));
  return getPlateInventoryById(db, userId, id);
}

export async function softDeletePlateInventory(db: AppDatabase, userId: string, id: string) {
  const now = new Date();
  await db
    .update(plateInventory)
    .set({ deletedAt: now, updatedAt: now })
    .where(and(eq(plateInventory.id, id), eq(plateInventory.userId, userId)));
}
