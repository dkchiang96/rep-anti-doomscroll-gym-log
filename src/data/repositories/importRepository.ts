// Orchestrates writing a parsed Keep import into SQLite by calling the
// existing per-table repositories — no raw Drizzle/SQL here, per invariant 6.

import type { ConventionDecision, LoadConvention } from '../../domain/conventionReconciliation';
import { applyConventionDecisions } from '../../domain/conventionReconciliation';
import type { ParsedExerciseEntry, ParsedSession } from '../../domain/keepParser';
import type { AppDatabase } from '../types';
import { createExercise, listExercises } from './exerciseRepository';
import { createSession } from './sessionRepository';
import { createSessionExercise } from './sessionExerciseRepository';
import { createSet } from './setRepository';

const BODYWEIGHT_NAME_RE = /\b(pull\s*up|push\s*up|crunch|russian twist|roller|plank|leg raise|sit ?up|dip)\b/i;
const BARBELL_NAME_RE = /\bbarbell\b|\bsmith\b/i;
const CABLE_NAME_RE = /\bcable\b/i;
const MACHINE_NAME_RE = /\bmachine\b|pulldown|pull down|roman chair/i;

const MUSCLE_GROUP_RULES: [RegExp, string][] = [
  [/squat|lunge|thrust|abduct|adduct|leg curl|leg press|calf/i, 'Legs'],
  [/press|fly|pec|chest/i, 'Chest'],
  [/row|pull ?up|pulldown|pull down|lat |back|rear delt/i, 'Back'],
  [/curl|tricep|extension/i, 'Arms'],
  [/lateral raise|shoulder|delt/i, 'Shoulders'],
  [/crunch|twist|roller|leg raise|ab[s]? /i, 'Core'],
  [/walk|treadmill|incline threadmill/i, 'Cardio'],
];

function inferMuscleGroup(name: string): string {
  for (const [re, group] of MUSCLE_GROUP_RULES) {
    if (re.test(name)) return group;
  }
  return 'Uncategorised';
}

type EquipmentType =
  | 'barbell'
  | 'dumbbell'
  | 'selectorised'
  | 'plate_loaded'
  | 'cable'
  | 'bodyweight'
  | 'other';

function inferEquipmentType(name: string, isBodyweightOnly: boolean): EquipmentType {
  if (isBodyweightOnly || BODYWEIGHT_NAME_RE.test(name)) return 'bodyweight';
  if (/\bdumbbell\b/i.test(name)) return 'dumbbell';
  if (BARBELL_NAME_RE.test(name)) return 'barbell';
  if (CABLE_NAME_RE.test(name)) return 'cable';
  if (MACHINE_NAME_RE.test(name)) return 'selectorised';
  return 'other';
}

function isBodyweightOnly(sessions: ParsedSession[], nameKey: string): boolean {
  let sawAny = false;
  for (const session of sessions) {
    for (const ex of session.exercises) {
      if (ex.name.trim().toLowerCase() !== nameKey) continue;
      for (const set of ex.sets) {
        sawAny = true;
        if (!set.isBodyweight) return false;
      }
    }
  }
  return sawAny;
}

export interface ImportSummary {
  sessionsImported: number;
  exercisesImported: number;
  setsImported: number;
}

// Fixed neutral time-of-day since Keep exports carry no timestamps — endedAt
// is set equal to startedAt to mark the session explicitly closed rather than
// inventing a plausible-looking duration.
function sessionTimestamp(session: ParsedSession): Date {
  return new Date(session.year, session.month, session.day, 12, 0, 0);
}

export async function importKeepSessions(
  db: AppDatabase,
  userId: string,
  sessions: ParsedSession[],
  decisions: ConventionDecision[],
): Promise<ImportSummary> {
  const { sessions: normalizedSessions, lockedConventions } = applyConventionDecisions(sessions, decisions);

  const existing = await listExercises(db, userId);
  const exerciseCache = new Map(existing.map((e) => [e.name.trim().toLowerCase(), e]));

  async function resolveExercise(entry: ParsedExerciseEntry) {
    const key = entry.name.trim().toLowerCase();
    const cached = exerciseCache.get(key);
    if (cached) return cached;

    const bodyweightOnly = isBodyweightOnly(normalizedSessions, key);
    const loadConvention: LoadConvention | 'bodyweight' = bodyweightOnly
      ? 'bodyweight'
      : (lockedConventions.get(key) ?? 'total');

    const created = await createExercise(db, {
      userId,
      name: entry.name,
      aliases: [],
      muscleGroup: inferMuscleGroup(entry.name),
      equipmentType: inferEquipmentType(entry.name, bodyweightOnly),
      loadConvention,
      barWeightKg: null,
      defaultWeightStep: null,
      source: 'imported',
      lastUsedAt: null,
    });
    if (!created) throw new Error(`failed to create exercise "${entry.name}"`);
    exerciseCache.set(key, created);
    return created;
  }

  let sessionsImported = 0;
  let exercisesImported = 0;
  let setsImported = 0;

  for (const session of normalizedSessions) {
    const timestamp = sessionTimestamp(session);
    const createdSession = await createSession(db, {
      userId,
      templateId: null,
      programmeId: null,
      startedAt: timestamp,
      endedAt: timestamp,
      note: session.note,
      rawImportText: session.rawText,
      source: 'import',
    });
    if (!createdSession) throw new Error('failed to create imported session');
    sessionsImported += 1;

    for (const [orderIndex, entry] of session.exercises.entries()) {
      const exercise = await resolveExercise(entry);
      const createdSessionExercise = await createSessionExercise(db, {
        userId,
        sessionId: createdSession.id,
        exerciseId: exercise.id,
        orderIndex,
        supersetGroupId: null,
        note: entry.note,
      });
      if (!createdSessionExercise) throw new Error('failed to create session exercise');
      exercisesImported += 1;

      let previousSetId: string | null = null;
      for (const [index, set] of entry.sets.entries()) {
        const created = await createSet(db, {
          userId,
          sessionExerciseId: createdSessionExercise.id,
          index,
          weightKg: set.weightKg,
          reps: set.reps,
          setType: set.setType,
          parentSetId: set.setType === 'dropset' ? previousSetId : null,
          restAfterSeconds: null,
          completedAt: null,
        });
        if (!created) throw new Error('failed to create set');
        previousSetId = created.id;
        setsImported += 1;
      }
    }
  }

  return { sessionsImported, exercisesImported, setsImported };
}
