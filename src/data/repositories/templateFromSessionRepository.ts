// FR-5.3: "save this session as a template." Crosses session_exercise/set
// into template/template_exercise, so it lives alongside the other
// cross-table orchestrators rather than inside a single-table repository.

import { and, eq, isNull } from 'drizzle-orm';

import { collapseToWeakerSide } from '../../domain/sidePairs';
import { sessionExercise, setEntry } from '../schema';
import type { AppDatabase } from '../types';
import { createTemplate } from './templateRepository';
import { createTemplateExercise } from './templateExerciseRepository';

// Skipped exercises have no logged sets to derive a target from, so a saved
// template only carries what was actually performed that session — not what
// was planned but never reached.
export async function createTemplateFromSession(
  db: AppDatabase,
  userId: string,
  sessionId: string,
  name: string,
  programmeId: string | null,
  orderIndex: number,
) {
  const exercises = await db
    .select()
    .from(sessionExercise)
    .where(
      and(
        eq(sessionExercise.sessionId, sessionId),
        eq(sessionExercise.userId, userId),
        isNull(sessionExercise.skippedAt),
        isNull(sessionExercise.deletedAt),
      ),
    );
  const ordered = [...exercises].sort((a, b) => a.orderIndex - b.orderIndex);
  if (ordered.length === 0) return null;

  const template = await createTemplate(db, {
    userId,
    programmeId,
    name,
    dayHint: null,
    orderIndex,
    isArchived: false,
  });
  if (!template) return null;

  for (const [index, se] of ordered.entries()) {
    const sets = await db
      .select()
      .from(setEntry)
      .where(and(eq(setEntry.sessionExerciseId, se.id), eq(setEntry.userId, userId), isNull(setEntry.deletedAt)));

    // A left/right split set is one set (src/domain/sidePairs.ts), judged
    // by its weaker side.
    const logical = collapseToWeakerSide([...sets].sort((a, b) => a.index - b.index));
    const working = logical.filter((s) => s.setType === 'working');
    const basis = working.length > 0 ? working : logical;
    const targetSets = Math.max(working.length, 1);
    const targetRepsMin = basis.length > 0 ? Math.min(...basis.map((s) => s.reps)) : 1;
    const targetRepsMax = basis.length > 0 ? Math.max(...basis.map((s) => s.reps)) : 1;

    await createTemplateExercise(db, {
      userId,
      templateId: template.id,
      exerciseId: se.exerciseId,
      orderIndex: index,
      targetSets,
      targetRepsMin,
      targetRepsMax,
      supersetGroupId: se.supersetGroupId,
      notes: se.note,
    });
  }

  return template;
}
