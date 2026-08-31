import { eq } from 'drizzle-orm';

import { newId } from '../id';
import { user } from '../schema';
import type { AppDatabase } from '../types';

export type NewUser = Omit<typeof user.$inferInsert, 'id' | 'createdAt' | 'updatedAt'>;

export async function createUser(db: AppDatabase, input: NewUser) {
  const id = newId();
  const now = new Date();
  await db.insert(user).values({ ...input, id, createdAt: now, updatedAt: now });
  return getUser(db, id);
}

export async function getUser(db: AppDatabase, userId: string) {
  const rows = await db.select().from(user).where(eq(user.id, userId)).limit(1);
  return rows[0] ?? null;
}

export async function updateDisplayName(db: AppDatabase, userId: string, displayName: string) {
  await db
    .update(user)
    .set({ displayName, updatedAt: new Date() })
    .where(eq(user.id, userId));
  return getUser(db, userId);
}

export type RestSettingsPatch = Partial<
  Pick<
    typeof user.$inferInsert,
    'restFlashIntervalSeconds' | 'restSoundEnabled' | 'restVibrationEnabled' | 'restCameraFlashEnabled'
  >
>;

export async function updateRestSettings(db: AppDatabase, userId: string, patch: RestSettingsPatch) {
  await db
    .update(user)
    .set({ ...patch, updatedAt: new Date() })
    .where(eq(user.id, userId));
  return getUser(db, userId);
}
