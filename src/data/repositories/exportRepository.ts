import { and, asc, eq, isNull } from 'drizzle-orm';

import type { ExportSetRow, FullExportData } from '../../domain/exportFormat';
import { exercise, programme, session, sessionExercise, setEntry, template, templateExercise } from '../schema';
import type { AppDatabase } from '../types';

// Flattened, one-row-per-set view feeding the CSV export (FR-8). Scoped by
// userId (invariant 4); every join leg excludes soft-deleted rows.
export async function listSetExportRows(db: AppDatabase, userId: string): Promise<ExportSetRow[]> {
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
      ),
    )
    .orderBy(asc(session.startedAt), asc(setEntry.index));

  return rows;
}

// Full relational dump feeding the JSON export (FR-8) — every non-deleted
// row this user owns across the training-log and programme tables. Device
// config (plate inventory, rest-cue settings) is deliberately out: this is
// a portable copy of the log, not an app-state backup (that's src/data/backup.ts).
export async function listFullExportData(db: AppDatabase, userId: string): Promise<Omit<FullExportData, 'exportedAt'>> {
  const [exercises, programmes, templates, templateExercises, sessions, sessionExercises, sets] = await Promise.all([
    db.select().from(exercise).where(and(eq(exercise.userId, userId), isNull(exercise.deletedAt))),
    db.select().from(programme).where(and(eq(programme.userId, userId), isNull(programme.deletedAt))),
    db.select().from(template).where(and(eq(template.userId, userId), isNull(template.deletedAt))),
    db
      .select()
      .from(templateExercise)
      .where(and(eq(templateExercise.userId, userId), isNull(templateExercise.deletedAt))),
    db.select().from(session).where(and(eq(session.userId, userId), isNull(session.deletedAt))),
    db
      .select()
      .from(sessionExercise)
      .where(and(eq(sessionExercise.userId, userId), isNull(sessionExercise.deletedAt))),
    db.select().from(setEntry).where(and(eq(setEntry.userId, userId), isNull(setEntry.deletedAt))),
  ]);

  return { exercises, programmes, templates, templateExercises, sessions, sessionExercises, sets };
}
