// FR-6.1/6.5: strict validation of the Appendix A programme JSON schema.
// Pure function — invalid input never reaches the repository layer, and
// every rejection names the offending field path in plain language rather
// than surfacing a parser stack trace.

import { MUSCLE_GROUPS } from './muscleGroups';
import type { LoadConvention } from './loadConvention';
import { CARDIO_METRICS, isCardioMetric, type CardioMetric, type ExerciseKind } from './cardio';

const LOAD_CONVENTIONS: LoadConvention[] = ['per_side', 'total', 'bodyweight'];
// 1.1 (docs/PROGRAMME-PROMPT.md) adds per-day warm_up/warm_down text and
// cardio stations. Every 1.1 field is optional or defaulted, so a 1.0 file
// is also a valid 1.1 file and still imports unchanged.
const SUPPORTED_SCHEMA_VERSIONS = ['1.0', '1.1'];

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
  kind: ExerciseKind;
  /** Cardio only: what each round records. Null for strength. */
  track: CardioMetric[] | null;
  /** Cardio per-round targets — null when not given (always null for strength). */
  targetDistanceM: number | null;
  targetTimeSeconds: number | null;
  targetCalories: number | null;
  targetLoadKg: number | null;
}

export interface ProgrammeImportTemplate {
  name: string;
  dayHint: string | null;
  warmUp: string | null;
  warmDown: string | null;
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

function isPositiveNumber(v: unknown): v is number {
  return typeof v === 'number' && Number.isFinite(v) && v > 0;
}

// Optional free text: undefined/null → null, a string → trimmed (empty →
// null), anything else → undefined (the caller reports it).
function optionalText(v: unknown): string | null | undefined {
  if (v === undefined || v === null) return null;
  if (typeof v !== 'string') return undefined;
  const trimmed = v.trim();
  return trimmed.length > 0 ? trimmed : null;
}

const CARDIO_TARGET_FIELDS: {
  field: 'target_distance_m' | 'target_time_seconds' | 'target_calories' | 'target_load_kg';
  metric: CardioMetric;
  key: 'distanceM' | 'timeSeconds' | 'calories' | 'loadKg';
  check: (v: unknown) => v is number;
  rule: string;
}[] = [
  { field: 'target_distance_m', metric: 'distance_m', key: 'distanceM', check: isPositiveNumber, rule: 'a positive number' },
  { field: 'target_time_seconds', metric: 'time', key: 'timeSeconds', check: isPositiveInt, rule: 'a positive integer' },
  { field: 'target_calories', metric: 'calories', key: 'calories', check: isPositiveInt, rule: 'a positive integer' },
  { field: 'target_load_kg', metric: 'load_kg', key: 'loadKg', check: isPositiveNumber, rule: 'a positive number' },
];

export function validateProgrammeImport(raw: unknown): ProgrammeValidationResult {
  const errors: FieldError[] = [];

  if (!isPlainObject(raw)) {
    return { ok: false, errors: [{ path: '$', message: 'The top level of the JSON must be an object.' }] };
  }

  if (typeof raw.schema_version !== 'string' || !SUPPORTED_SCHEMA_VERSIONS.includes(raw.schema_version)) {
    errors.push({
      path: 'schema_version',
      message: `Expected "1.1" (or "1.0"), got ${JSON.stringify(raw.schema_version)}.`,
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

    const warmUp = optionalText(rawTemplate.warm_up);
    if (warmUp === undefined) {
      errors.push({ path: `${templatePath}.warm_up`, message: 'Must be a string if present.' });
    }
    const warmDown = optionalText(rawTemplate.warm_down);
    if (warmDown === undefined) {
      errors.push({ path: `${templatePath}.warm_down`, message: 'Must be a string if present.' });
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

      const kind: ExerciseKind | undefined =
        rawExercise.kind === undefined || rawExercise.kind === null || rawExercise.kind === 'strength'
          ? 'strength'
          : rawExercise.kind === 'cardio'
            ? 'cardio'
            : undefined;
      if (kind === undefined) {
        errors.push({
          path: `${exercisePath}.kind`,
          message: `Must be "strength" or "cardio". Got ${JSON.stringify(rawExercise.kind)}.`,
        });
        valid = false;
      }
      const isCardio = kind === 'cardio';

      if (!isPositiveInt(rawExercise.target_sets)) {
        errors.push({ path: `${exercisePath}.target_sets`, message: 'Required, must be a positive integer.' });
        valid = false;
      }

      // Strength: reps are required. Cardio: optional, both or neither, and
      // only when "reps" is tracked (checked with the other cardio rules).
      const repsGiven = rawExercise.target_reps_min !== undefined || rawExercise.target_reps_max !== undefined;
      const checkReps = !isCardio || repsGiven;
      const repsMinOk = isPositiveInt(rawExercise.target_reps_min);
      if (checkReps && !repsMinOk) {
        errors.push({
          path: `${exercisePath}.target_reps_min`,
          message: isCardio ? 'Must be a positive integer, given together with target_reps_max.' : 'Required, must be a positive integer.',
        });
        valid = false;
      }
      const repsMaxOk = isPositiveInt(rawExercise.target_reps_max);
      if (checkReps && !repsMaxOk) {
        errors.push({
          path: `${exercisePath}.target_reps_max`,
          message: isCardio ? 'Must be a positive integer, given together with target_reps_min.' : 'Required, must be a positive integer.',
        });
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

      // Cardio stations (docs/PROGRAMME-PROMPT.md): a non-empty track list,
      // and every target must have its matching track entry.
      let track: CardioMetric[] | null = null;
      const cardioTargets: { distanceM: number | null; timeSeconds: number | null; calories: number | null; loadKg: number | null } = {
        distanceM: null,
        timeSeconds: null,
        calories: null,
        loadKg: null,
      };
      if (isCardio) {
        const rawTrack = rawExercise.track;
        if (!Array.isArray(rawTrack) || rawTrack.length === 0 || !rawTrack.every(isCardioMetric)) {
          errors.push({
            path: `${exercisePath}.track`,
            message: `Required for cardio: a non-empty list of ${CARDIO_METRICS.join(', ')}.`,
          });
          valid = false;
        } else {
          track = Array.from(new Set(rawTrack as CardioMetric[]));
        }
        for (const t of CARDIO_TARGET_FIELDS) {
          const value = rawExercise[t.field];
          if (value === undefined || value === null) continue;
          if (!t.check(value)) {
            errors.push({ path: `${exercisePath}.${t.field}`, message: `Must be ${t.rule}.` });
            valid = false;
          } else if (track && !track.includes(t.metric)) {
            errors.push({ path: `${exercisePath}.${t.field}`, message: `Needs "${t.metric}" in track.` });
            valid = false;
          } else {
            cardioTargets[t.key] = value;
          }
        }
        if (repsGiven && track && !track.includes('reps')) {
          errors.push({ path: `${exercisePath}.target_reps_min`, message: 'Reps targets need "reps" in track.' });
          valid = false;
        }
      } else {
        if (rawExercise.track !== undefined && rawExercise.track !== null) {
          errors.push({ path: `${exercisePath}.track`, message: 'Only allowed when kind is "cardio".' });
          valid = false;
        }
        for (const t of CARDIO_TARGET_FIELDS) {
          if (rawExercise[t.field] !== undefined && rawExercise[t.field] !== null) {
            errors.push({ path: `${exercisePath}.${t.field}`, message: 'Only allowed when kind is "cardio".' });
            valid = false;
          }
        }
      }

      if (!valid) return;

      exercises.push({
        name: (rawExercise.name as string).trim(),
        muscleGroup: muscleGroup!,
        loadConvention: loadConvention!,
        targetSets: rawExercise.target_sets as number,
        // A cardio station without reps targets stores 0/0 ("not applicable").
        targetRepsMin: repsMinOk ? (rawExercise.target_reps_min as number) : 0,
        targetRepsMax: repsMaxOk ? (rawExercise.target_reps_max as number) : 0,
        supersetGroup: supersetGroup ?? null,
        notes: exerciseNotes ?? '',
        kind: kind ?? 'strength',
        track,
        targetDistanceM: cardioTargets.distanceM,
        targetTimeSeconds: cardioTargets.timeSeconds,
        targetCalories: cardioTargets.calories,
        targetLoadKg: cardioTargets.loadKg,
      });
    });

    if (isNonEmptyString(rawTemplate.name) && dayHint !== undefined && warmUp !== undefined && warmDown !== undefined && exercises.length > 0) {
      templates.push({ name: (rawTemplate.name as string).trim(), dayHint, warmUp, warmDown, exercises });
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
