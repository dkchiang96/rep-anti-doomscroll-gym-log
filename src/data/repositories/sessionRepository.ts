import { and, eq, isNull } from 'drizzle-orm';

import { newId } from '../id';
import { session } from '../schema';
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
