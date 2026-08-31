import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import fs from 'fs';
import path from 'path';

import * as schema from '../schema';
import type { AppDatabase } from '../types';

const DRIZZLE_DIR = path.join(__dirname, '..', '..', '..', 'drizzle');

// Applies the same drizzle-kit-generated SQL files (in journal order) that the
// app runs on expo-sqlite, against an in-memory better-sqlite3 database, so
// repository tests exercise the real schema without needing a device/emulator.
export function createTestDb(): AppDatabase {
  const sqlite = new Database(':memory:');
  const journal = JSON.parse(fs.readFileSync(path.join(DRIZZLE_DIR, 'meta', '_journal.json'), 'utf-8'));
  for (const entry of journal.entries) {
    const migrationSql = fs.readFileSync(path.join(DRIZZLE_DIR, `${entry.tag}.sql`), 'utf-8');
    sqlite.exec(migrationSql);
  }
  return drizzle(sqlite, { schema }) as unknown as AppDatabase;
}
