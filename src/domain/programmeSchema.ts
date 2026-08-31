// FR-6.1/6.5: strict validation of the Appendix A programme JSON schema.
// Pure function — invalid input never reaches the repository layer, and
// every rejection names the offending field path in plain language rather
// than surfacing a parser stack trace.

import { MUSCLE_GROUPS } from './muscleGroups';
import type { LoadConvention } from './loadConvention';

const LOAD_CONVENTIONS: LoadConvention[] = ['per_side', 'total', 'bodyweight'];
const SUPPORTED_SCHEMA_VERSION = '1.0';

export interface FieldError {
  path: string;
  message: string;
}

export interface ProgrammeImportExercise {
  name: string;
  muscleGroup: (typeof MUSCLE_GROUPS)[number];
  loadConvention: LoadConvention;
  targetSets: number;
  targetRepsMin: number;
  targetRepsMax: number;
  supersetGroup: string | null;
  notes: string;
}

export interface ProgrammeImportTemplate {
  name: string;
  dayHint: string | null;
  exercises: ProgrammeImportExercise[];
}

export interface ProgrammeImportData {
  name: string;
  notes: string | null;
  templates: ProgrammeImportTemplate[];
}

export type ProgrammeValidationResult =
  | { ok: true; data: ProgrammeImportData }
  | { ok: false; errors: FieldError[] };

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function isNonEmptyString(v: unknown): v is string {
  return typeof v === 'string' && v.trim().length > 0;
}

function isPositiveInt(v: unknown): v is number {
  return typeof v === 'number' && Number.isInteger(v) && v > 0;
}

export function validateProgrammeImport(raw: unknown): ProgrammeValidationResult {
  const errors: FieldError[] = [];

  if (!isPlainObject(raw)) {
    return { ok: false, errors: [{ path: '$', message: 'The top level of the JSON must be an object.' }] };
  }

  if (raw.schema_version !== SUPPORTED_SCHEMA_VERSION) {
    errors.push({
      path: 'schema_version',
      message: `Expected "${SUPPORTED_SCHEMA_VERSION}", got ${JSON.stringify(raw.schema_version)}.`,
    });
  }

  if (!isPlainObject(raw.programme)) {
    errors.push({ path: 'programme', message: 'Missing or not an object.' });
    return { ok: false, errors };
  }
  const programme = raw.programme;

  if (!isNonEmptyString(programme.name)) {
    errors.push({ path: 'programme.name', message: 'Required, must be a non-empty string.' });
  }

  const notes =
    programme.notes === undefined || programme.notes === null
      ? null
      : typeof programme.notes === 'string'
        ? programme.notes
        : undefined;
  if (notes === undefined) {
    errors.push({ path: 'programme.notes', message: 'Must be a string if present.' });
  }

  if (!Array.isArray(programme.templates) || programme.templates.length === 0) {
    errors.push({ path: 'programme.templates', message: 'Required, must be a non-empty array.' });
    return { ok: false, errors };
  }

  const templates: ProgrammeImportTemplate[] = [];

  programme.templates.forEach((rawTemplate, templateIndex) => {
    const templatePath = `programme.templates[${templateIndex}]`;
    if (!isPlainObject(rawTemplate)) {
      errors.push({ path: templatePath, message: 'Must be an object.' });
      return;
    }

    if (!isNonEmptyString(rawTemplate.name)) {
      errors.push({ path: `${templatePath}.name`, message: 'Required, must be a non-empty string.' });
    }

    const dayHint =
      rawTemplate.day_hint === undefined || rawTemplate.day_hint === null
        ? null
        : typeof rawTemplate.day_hint === 'string'
          ? rawTemplate.day_hint
          : undefined;
    if (dayHint === undefined) {
      errors.push({ path: `${templatePath}.day_hint`, message: 'Must be a string if present.' });
    }

    if (!Array.isArray(rawTemplate.exercises) || rawTemplate.exercises.length === 0) {
      errors.push({ path: `${templatePath}.exercises`, message: 'Required, must be a non-empty array.' });
      return;
    }

    const exercises: ProgrammeImportExercise[] = [];

    rawTemplate.exercises.forEach((rawExercise, exerciseIndex) => {
      const exercisePath = `${templatePath}.exercises[${exerciseIndex}]`;
      if (!isPlainObject(rawExercise)) {
        errors.push({ path: exercisePath, message: 'Must be an object.' });
        return;
      }

      let valid = true;

      if (!isNonEmptyString(rawExercise.name)) {
        errors.push({ path: `${exercisePath}.name`, message: 'Required, must be a non-empty string.' });
        valid = false;
      }

      const muscleGroup = MUSCLE_GROUPS.find((g) => g === rawExercise.muscle_group);
      if (!muscleGroup) {
        errors.push({
          path: `${exercisePath}.muscle_group`,
          message: `Must be one of: ${MUSCLE_GROUPS.join(', ')}. Got ${JSON.stringify(rawExercise.muscle_group)}.`,
        });
        valid = false;
      }

      const loadConvention = LOAD_CONVENTIONS.find((c) => c === rawExercise.load_convention);
      if (!loadConvention) {
        errors.push({
          path: `${exercisePath}.load_convention`,
          message: `Must be one of: ${LOAD_CONVENTIONS.join(', ')}. Got ${JSON.stringify(rawExercise.load_convention)}.`,
        });
        valid = false;
      }

      if (!isPositiveInt(rawExercise.target_sets)) {
        errors.push({ path: `${exercisePath}.target_sets`, message: 'Required, must be a positive integer.' });
        valid = false;
      }

      const repsMinOk = isPositiveInt(rawExercise.target_reps_min);
      if (!repsMinOk) {
        errors.push({ path: `${exercisePath}.target_reps_min`, message: 'Required, must be a positive integer.' });
        valid = false;
      }
      const repsMaxOk = isPositiveInt(rawExercise.target_reps_max);
      if (!repsMaxOk) {
        errors.push({ path: `${exercisePath}.target_reps_max`, message: 'Required, must be a positive integer.' });
        valid = false;
      }
      if (repsMinOk && repsMaxOk && (rawExercise.target_reps_min as number) > (rawExercise.target_reps_max as number)) {
        errors.push({
          path: `${exercisePath}.target_reps_min`,
          message: 'Must be less than or equal to target_reps_max.',
        });
        valid = false;
      }

      let supersetGroup: string | null | undefined = null;
      if (rawExercise.superset_group !== undefined && rawExercise.superset_group !== null) {
        if (typeof rawExercise.superset_group === 'string' && rawExercise.superset_group.length > 0) {
          supersetGroup = rawExercise.superset_group;
        } else {
          errors.push({
            path: `${exercisePath}.superset_group`,
            message: 'Must be a non-empty string or null.',
          });
          valid = false;
        }
      }

      let exerciseNotes: string | undefined = '';
      if (rawExercise.notes !== undefined) {
        if (typeof rawExercise.notes === 'string') {
          exerciseNotes = rawExercise.notes;
        } else {
          errors.push({ path: `${exercisePath}.notes`, message: 'Must be a string if present.' });
          valid = false;
        }
      }

      if (!valid) return;

      exercises.push({
        name: (rawExercise.name as string).trim(),
        muscleGroup: muscleGroup!,
        loadConvention: loadConvention!,
        targetSets: rawExercise.target_sets as number,
        targetRepsMin: rawExercise.target_reps_min as number,
        targetRepsMax: rawExercise.target_reps_max as number,
        supersetGroup: supersetGroup ?? null,
        notes: exerciseNotes ?? '',
      });
    });

    if (isNonEmptyString(rawTemplate.name) && dayHint !== undefined && exercises.length > 0) {
      templates.push({ name: (rawTemplate.name as string).trim(), dayHint, exercises });
    }
  });

  if (errors.length > 0) {
    return { ok: false, errors };
  }

  return {
    ok: true,
    data: {
      name: (programme.name as string).trim(),
      notes: notes && notes.trim().length > 0 ? notes : null,
      templates,
    },
  };
}

export function parseProgrammeJson(text: string): ProgrammeValidationResult {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown parse error.';
    return { ok: false, errors: [{ path: '$', message: `Invalid JSON: ${message}` }] };
  }
  return validateProgrammeImport(raw);
}
