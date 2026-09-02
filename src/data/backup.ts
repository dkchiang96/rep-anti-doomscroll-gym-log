// FR-10 (session-10 brief): automatic DB backup on session end, last 30
// retained. Backups are a raw copy of the SQLite file — distinct from the
// user-facing CSV/JSON export in src/domain/exportFormat.ts — with no
// restore UI, since only backup + retention were asked for.

import * as FileSystem from 'expo-file-system/legacy';
import { defaultDatabaseDirectory } from 'expo-sqlite';

import { DB_NAME } from './db';

export const MAX_BACKUPS = 30;
const BACKUP_DIR = `${FileSystem.documentDirectory}backups/`;

// Filenames are timestamp-based and zero-padded (ISO, colons/dots swapped
// for '-'), so lexicographic sort is chronological — no need to parse dates
// back out to find the oldest ones.
export function selectBackupsToDelete(filenames: string[], max: number = MAX_BACKUPS): string[] {
  return [...filenames].sort().reverse().slice(max);
}

function backupFilename(now: Date): string {
  return `rep-${now.toISOString().replace(/[:.]/g, '-')}.db`;
}

// expo-sqlite's defaultDatabaseDirectory is a bare filesystem path (no
// `file://` scheme), but the legacy expo-file-system native module requires
// a `file:` URI for every location it touches — a schemeless path throws
// "Unsupported scheme for location" from copyAsync.
export function toFileUri(path: string): string {
  return path.startsWith('file:') ? path : `file://${path}`;
}

export async function runBackupRetention(now: Date = new Date()): Promise<void> {
  const dirInfo = await FileSystem.getInfoAsync(BACKUP_DIR);
  if (!dirInfo.exists) {
    await FileSystem.makeDirectoryAsync(BACKUP_DIR, { intermediates: true });
  }

  const dbPath = toFileUri(`${defaultDatabaseDirectory}/${DB_NAME}`);
  await FileSystem.copyAsync({ from: dbPath, to: `${BACKUP_DIR}${backupFilename(now)}` });

  const existing = await FileSystem.readDirectoryAsync(BACKUP_DIR);
  const toDelete = selectBackupsToDelete(existing);
  await Promise.all(toDelete.map((name) => FileSystem.deleteAsync(`${BACKUP_DIR}${name}`, { idempotent: true })));
}
