import { and, asc, desc, eq, isNull } from 'drizzle-orm';

import { exercise, session, sessionExercise, setEntry, template } from '../schema';
import type { AppDatabase } from '../types';

// R6: session list (History screen). Same read-model shape as
// progressRepository.ts — scoped by userId, every soft-deleted leg excluded.

export interface SessionSummary {
  id: string;
  startedAt: Date;
  endedAt: Date | null;
  templateName: string | null;
}

export async function listSessionSummaries(db: AppDatabase, userId: string): Promise<SessionSummary[]> {
  const rows = await db
    .select({
      id: session.id,
      startedAt: session.startedAt,
      endedAt: session.endedAt,
      templateName: template.name,
    })
    .from(session)
    .leftJoin(template, eq(template.id, session.templateId))
    .where(and(eq(session.userId, userId), isNull(session.deletedAt)))
    .orderBy(desc(session.startedAt));
  return rows;
}

export interface SessionDetailExercise {
  sessionExerciseId: string;
  exerciseId: string;
  exerciseName: string;
  isBodyweight: boolean;
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

// Feeds keepShorthand.formatSessionExerciseShorthand — one line per exercise
// performed in the session, in the order it was performed.
export async function getSessionDetail(
  db: AppDatabase,
  userId: string,
  sessionId: string,
): Promise<SessionDetailExercise[]> {
  const exerciseRows = await db
    .select({
      sessionExerciseId: sessionExercise.id,
      orderIndex: sessionExercise.orderIndex,
      exerciseId: exercise.id,
      exerciseName: exercise.name,
      loadConvention: exercise.loadConvention,
    })
    .from(sessionExercise)
    .innerJoin(exercise, eq(exercise.id, sessionExercise.exerciseId))
    .where(
      and(
        eq(sessionExercise.sessionId, sessionId),
        eq(sessionExercise.userId, userId),
        isNull(sessionExercise.deletedAt),
        isNull(exercise.deletedAt),
      ),
    )
    .orderBy(asc(sessionExercise.orderIndex));

  const result: SessionDetailExercise[] = [];
  for (const row of exerciseRows) {
    const setRows = await db
      .select({
        id: setEntry.id,
        weightKg: setEntry.weightKg,
        reps: setEntry.reps,
        setType: setEntry.setType,
        side: setEntry.side,
        parentSetId: setEntry.parentSetId,
      })
      .from(setEntry)
      .where(
        and(
          eq(setEntry.sessionExerciseId, row.sessionExerciseId),
          eq(setEntry.userId, userId),
          isNull(setEntry.deletedAt),
        ),
      )
      .orderBy(asc(setEntry.index));

    result.push({
      sessionExerciseId: row.sessionExerciseId,
      exerciseId: row.exerciseId,
      exerciseName: row.exerciseName,
      isBodyweight: row.loadConvention === 'bodyweight',
      sets: setRows,
    });
  }

  return result;
}
