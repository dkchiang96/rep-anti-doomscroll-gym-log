import { and, asc, eq, isNull } from 'drizzle-orm';

import { session, sessionExercise, setEntry } from '../schema';
import type { AppDatabase } from '../types';

export interface ProgressSessionEntry {
  sessionId: string;
  startedAt: Date;
  // Null while the session is still in progress — the Progress screen only
  // offers delete for a finished one.
  endedAt: Date | null;
  sets: {
    id: string;
    weightKg: number;
    reps: number;
    setType: typeof setEntry.$inferSelect.setType;
    // Left/right tracking — see src/domain/sidePairs.ts.
    side: typeof setEntry.$inferSelect.side;
    parentSetId: string | null;
  }[];
}

// FR-7.1/7.3: every past session that performed this exercise, in order —
// feeds both the chart (progressChart.ts) and the shorthand table
// (keepShorthand.ts). Scoped by userId (invariant 4); soft-deleted sets,
// session_exercises, and sessions are all excluded.
export async function listSessionHistoryForExercise(
  db: AppDatabase,
  userId: string,
  exerciseId: string,
): Promise<ProgressSessionEntry[]> {
  const rows = await db
    .select({
      sessionId: session.id,
      startedAt: session.startedAt,
      endedAt: session.endedAt,
      index: setEntry.index,
      weightKg: setEntry.weightKg,
      reps: setEntry.reps,
      setType: setEntry.setType,
      setId: setEntry.id,
      side: setEntry.side,
      parentSetId: setEntry.parentSetId,
    })
    .from(setEntry)
    .innerJoin(sessionExercise, eq(sessionExercise.id, setEntry.sessionExerciseId))
    .innerJoin(session, eq(session.id, sessionExercise.sessionId))
    .where(
      and(
        eq(setEntry.userId, userId),
        eq(sessionExercise.exerciseId, exerciseId),
        isNull(setEntry.deletedAt),
        isNull(sessionExercise.deletedAt),
        isNull(session.deletedAt),
      ),
    )
    .orderBy(asc(session.startedAt), asc(setEntry.index));

  const bySession = new Map<string, ProgressSessionEntry>();
  for (const row of rows) {
    let entry = bySession.get(row.sessionId);
    if (!entry) {
      entry = { sessionId: row.sessionId, startedAt: row.startedAt, endedAt: row.endedAt, sets: [] };
      bySession.set(row.sessionId, entry);
    }
    entry.sets.push({
      id: row.setId,
      weightKg: row.weightKg,
      reps: row.reps,
      setType: row.setType,
      side: row.side,
      parentSetId: row.parentSetId,
    });
  }

  return Array.from(bySession.values()).sort((a, b) => a.startedAt.getTime() - b.startedAt.getTime());
}
