import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import fs from 'fs';
import path from 'path';

import * as schema from '../schema';
import type { AppDatabase } from '../types';

const MIGRATION_SQL_PATH = path.join(__dirname, '..', '..', '..', 'drizzle', '0000_clumsy_rhino.sql');

// Applies the same drizzle-kit-generated SQL that the app runs on expo-sqlite,
// against an in-memory better-sqlite3 database, so repository tests exercise
// the real schema without needing a device/emulator.
export function createTestDb(): AppDatabase {
  const sqlite = new Database(':memory:');
  const migrationSql = fs.readFileSync(MIGRATION_SQL_PATH, 'utf-8');
  sqlite.exec(migrationSql);
  return drizzle(sqlite, { schema }) as unknown as AppDatabase;
}
