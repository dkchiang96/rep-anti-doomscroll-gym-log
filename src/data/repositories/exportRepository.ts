import { and, asc, eq, gte, inArray, isNull } from 'drizzle-orm';

import type { ExportSetRow, FullExportData } from '../../domain/exportFormat';
import { exercise, programme, session, sessionExercise, setEntry, template, templateExercise } from '../schema';
import type { AppDatabase } from '../types';

// Flattened, one-row-per-set view feeding the CSV export (FR-8). Scoped by
// userId (invariant 4); every join leg excludes soft-deleted rows. `since`
// (punch-list item 2) restricts to sessions started on or after that date —
// omitted entirely means "all time", the pre-existing behaviour.
export async function listSetExportRows(db: AppDatabase, userId: string, since?: Date): Promise<ExportSetRow[]> {
  const rows = await db
    .select({
      sessionId: session.id,
      sessionStartedAt: session.startedAt,
      sessionNote: session.note,
      exerciseName: exercise.name,
      muscleGroup: exercise.muscleGroup,
      equipmentType: exercise.equipmentType,
      loadConvention: exercise.loadConvention,
      weightKg: setEntry.weightKg,
      reps: setEntry.reps,
      setType: setEntry.setType,
      setId: setEntry.id,
      parentSetId: setEntry.parentSetId,
      side: setEntry.side,
      rpe: sessionExercise.rpe,
      exerciseNote: sessionExercise.note,
      distanceM: setEntry.distanceM,
      durationSeconds: setEntry.durationSeconds,
      calories: setEntry.calories,
    })
    .from(setEntry)
    .innerJoin(sessionExercise, eq(sessionExercise.id, setEntry.sessionExerciseId))
    .innerJoin(session, eq(session.id, sessionExercise.sessionId))
    .innerJoin(exercise, eq(exercise.id, sessionExercise.exerciseId))
    .where(
      and(
        eq(setEntry.userId, userId),
        isNull(setEntry.deletedAt),
        isNull(sessionExercise.deletedAt),
        isNull(session.deletedAt),
        isNull(exercise.deletedAt),
        since ? gte(session.startedAt, since) : undefined,
      ),
    )
    .orderBy(asc(session.startedAt), asc(setEntry.index));

  return rows;
}

// Full relational dump feeding the JSON export (FR-8) — every non-deleted
// row this user owns across the training-log and programme tables. Device
// config (plate inventory, rest-cue settings) is deliberately out: this is
// a portable copy of the log, not an app-state backup (that's src/data/backup.ts).
//
// `since` (item 2) date-scopes the actual log entries — sessions,
// session_exercises, sets — to sessions started on or after that date.
// Exercises/programmes/templates are reference data, not dated log entries,
// so they're always exported in full: a date-filtered set of sets pointing
// at exercise ids missing from the export would be worse than a few extra
// library rows.
export async function listFullExportData(
  db: AppDatabase,
  userId: string,
  since?: Date,
): Promise<Omit<FullExportData, 'exportedAt'>> {
  const [exercises, programmes, templates, templateExercises, sessions] = await Promise.all([
    db.select().from(exercise).where(and(eq(exercise.userId, userId), isNull(exercise.deletedAt))),
    db.select().from(programme).where(and(eq(programme.userId, userId), isNull(programme.deletedAt))),
    db.select().from(template).where(and(eq(template.userId, userId), isNull(template.deletedAt))),
    db
      .select()
      .from(templateExercise)
      .where(and(eq(templateExercise.userId, userId), isNull(templateExercise.deletedAt))),
    db
      .select()
      .from(session)
      .where(and(eq(session.userId, userId), isNull(session.deletedAt), since ? gte(session.startedAt, since) : undefined)),
  ]);

  const sessionIds = sessions.map((s) => s.id);
  if (sessionIds.length === 0) {
    return { exercises, programmes, templates, templateExercises, sessions, sessionExercises: [], sets: [] };
  }

  const sessionExercises = await db
    .select()
    .from(sessionExercise)
    .where(and(eq(sessionExercise.userId, userId), isNull(sessionExercise.deletedAt), inArray(sessionExercise.sessionId, sessionIds)));

  const sessionExerciseIds = sessionExercises.map((se) => se.id);
  const sets =
    sessionExerciseIds.length === 0
      ? []
      : await db
          .select()
          .from(setEntry)
          .where(and(eq(setEntry.userId, userId), isNull(setEntry.deletedAt), inArray(setEntry.sessionExerciseId, sessionExerciseIds)));

  return { exercises, programmes, templates, templateExercises, sessions, sessionExercises, sets };
}
