import type { BaseSQLiteDatabase } from 'drizzle-orm/sqlite-core';

// Shape shared by the expo-sqlite driver (used by the app) and the
// better-sqlite3 driver (used by tests) — repositories are written against
// this so they work unchanged against either.
export type AppDatabase = BaseSQLiteDatabase<'sync', any, any>;
