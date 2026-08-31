// Orchestrates writing a validated programme import (Appendix A schema) plus
// its reviewed name-mapping decisions into SQLite — no raw Drizzle/SQL here,
// per invariant 6. FR-6.6: purely additive, never touches existing rows.

import type { MatchDecision, ProgrammeMatchRow } from '../../domain/programmeMatching';
import type { ProgrammeImportData } from '../../domain/programmeSchema';
import type { EquipmentType } from '../../domain/loadConvention';
import type { AppDatabase } from '../types';
import { createExercise } from './exerciseRepository';
import { createProgramme } from './programmeRepository';
import { createTemplate } from './templateRepository';
import { createTemplateExercise } from './templateExerciseRepository';

export interface ProgrammeImportSummary {
  programmeId: string;
  templatesImported: number;
  exercisesImported: number;
  exercisesCreated: number;
}

// The user picks equipment type per "create" row on the review screen (the
// Appendix A schema has no equipment_type field); this is just the shape the
// screen hands back alongside each row's decision.
export interface CreateChoice {
  equipmentType: EquipmentType;
}

export async function importProgramme(
  db: AppDatabase,
  userId: string,
  data: ProgrammeImportData,
  matchRows: ProgrammeMatchRow<{ id: string; name: string; aliases: string[] }>[],
  createChoices: Map<string, CreateChoice>,
  activateProgramme: boolean,
): Promise<ProgrammeImportSummary> {
  const decisionByName = new Map<string, MatchDecision>(matchRows.map((r) => [r.name.trim().toLowerCase(), r.decision]));
  const sampleByName = new Map(matchRows.map((r) => [r.name.trim().toLowerCase(), r.sample]));
  const resolvedExerciseId = new Map<string, string>();
  let exercisesCreated = 0;

  async function resolveExerciseId(name: string): Promise<string> {
    const key = name.trim().toLowerCase();
    const cached = resolvedExerciseId.get(key);
    if (cached) return cached;

    const decision = decisionByName.get(key);
    if (!decision) throw new Error(`no review decision for exercise "${name}"`);

    if (decision.type === 'accept' || decision.type === 'remap') {
      resolvedExerciseId.set(key, decision.exerciseId);
      return decision.exerciseId;
    }

    const sample = sampleByName.get(key);
    if (!sample) throw new Error(`no sample data for created exercise "${name}"`);
    const choice = createChoices.get(key);
    const created = await createExercise(db, {
      userId,
      name: sample.name,
      aliases: [],
      muscleGroup: sample.muscleGroup,
      equipmentType: choice?.equipmentType ?? 'other',
      loadConvention: sample.loadConvention,
      barWeightKg: null,
      defaultWeightStep: null,
      source: 'imported',
      lastUsedAt: null,
    });
    if (!created) throw new Error(`failed to create exercise "${name}"`);
    exercisesCreated += 1;
    resolvedExerciseId.set(key, created.id);
    return created.id;
  }

  const programme = await createProgramme(db, {
    userId,
    name: data.name,
    notes: data.notes,
    isActive: activateProgramme,
    isArchived: false,
    version: 1,
    source: 'json_import',
  });
  if (!programme) throw new Error('failed to create programme');

  let templatesImported = 0;
  let exercisesImported = 0;

  for (const [templateIndex, template] of data.templates.entries()) {
    const createdTemplate = await createTemplate(db, {
      userId,
      programmeId: programme.id,
      name: template.name,
      dayHint: template.dayHint,
      orderIndex: templateIndex,
      isArchived: false,
    });
    if (!createdTemplate) throw new Error(`failed to create template "${template.name}"`);
    templatesImported += 1;

    for (const [exerciseIndex, exercise] of template.exercises.entries()) {
      const exerciseId = await resolveExerciseId(exercise.name);
      const createdTemplateExercise = await createTemplateExercise(db, {
        userId,
        templateId: createdTemplate.id,
        exerciseId,
        orderIndex: exerciseIndex,
        targetSets: exercise.targetSets,
        targetRepsMin: exercise.targetRepsMin,
        targetRepsMax: exercise.targetRepsMax,
        supersetGroupId: exercise.supersetGroup,
        notes: exercise.notes.length > 0 ? exercise.notes : null,
      });
      if (!createdTemplateExercise) throw new Error('failed to create template exercise');
      exercisesImported += 1;
    }
  }

  return {
    programmeId: programme.id,
    templatesImported,
    exercisesImported,
    exercisesCreated,
  };
}
