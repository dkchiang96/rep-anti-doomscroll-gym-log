import { drizzle } from 'drizzle-orm/expo-sqlite';
import { migrate } from 'drizzle-orm/expo-sqlite/migrator';
import { openDatabaseSync } from 'expo-sqlite';

import migrations from '../../drizzle/migrations';
import { strings } from '../strings';
import { newId } from './id';
import * as schema from './schema';
import type { AppDatabase } from './types';

const DB_NAME = 'rep.db';

export interface AppInit {
  db: AppDatabase;
  userId: string;
}

async function seedLocalUser(db: AppDatabase): Promise<string> {
  const existing = await db.select().from(schema.user).limit(1);
  if (existing.length > 0) {
    return existing[0].id;
  }

  const id = newId();
  const now = new Date();
  await db.insert(schema.user).values({
    id,
    displayName: strings.defaultUserDisplayName,
    createdAt: now,
    updatedAt: now,
  });
  return id;
}

export async function initDatabase(): Promise<AppInit> {
  const sqliteDb = openDatabaseSync(DB_NAME);
  const db = drizzle(sqliteDb, { schema });

  await migrate(db, migrations);
  const userId = await seedLocalUser(db);

  return { db, userId };
}
