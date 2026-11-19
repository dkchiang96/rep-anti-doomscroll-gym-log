import { createTestDb } from '../../__tests__/testDb';
import { buildProgrammeMatchRows } from '../../../domain/programmeMatching';
import { validateProgrammeImport } from '../../../domain/programmeSchema';
import { createExercise, getExerciseById, listExercises } from '../exerciseRepository';
import { getActiveProgramme } from '../programmeRepository';
import { importProgramme } from '../programmeImportRepository';
import { listTemplateExercisesByTemplate } from '../templateExerciseRepository';
import { listTemplatesForProgramme } from '../templateRepository';
import { createUser } from '../userRepository';

const RAW_PROGRAMME = {
  schema_version: '1.0',
  programme: {
    name: 'One Month. One Focus. — June',
    notes: 'Progressive overload focus.',
    templates: [
      {
        name: 'PUSH + ABS',
        day_hint: 'Tuesday',
        exercises: [
          {
            name: 'Incline Dumbbell Press',
            muscle_group: 'Chest',
            load_convention: 'per_side',
            target_sets: 4,
            target_reps_min: 6,
            target_reps_max: 10,
            superset_group: null,
            notes: '',
          },
          {
            name: 'Bulgarian Split Squat',
            muscle_group: 'Legs',
            load_convention: 'per_side',
            target_sets: 3,
            target_reps_min: 8,
            target_reps_max: 12,
            superset_group: 'a',
            notes: '',
          },
          {
            name: 'Cable Crunch',
            muscle_group: 'Core',
            load_convention: 'total',
            target_sets: 3,
            target_reps_min: 15,
            target_reps_max: 20,
            superset_group: 'a',
            notes: '',
          },
        ],
      },
    ],
  },
};

async function setup() {
  const db = createTestDb();
  const user = await createUser(db, { displayName: 'Test User' });
  if (!user) throw new Error('user was not created');
  const existing = await createExercise(db, {
    userId: user.id,
    name: 'Incline Dumbbell Press',
    aliases: [],
    muscleGroup: 'Chest',
    equipmentType: 'dumbbell',
    loadConvention: 'per_side',
    barWeightKg: null,
    defaultWeightStep: null,
    source: 'user',
    lastUsedAt: null,
  });
  if (!existing) throw new Error('exercise was not created');
  return { db, user, existing };
}

describe('importProgramme', () => {
  it('creates the programme, template, and template_exercise rows, resolving decisions and creating new exercises', async () => {
    const { db, user, existing } = await setup();

    const validated = validateProgrammeImport(RAW_PROGRAMME);
    if (!validated.ok) throw new Error('fixture should validate');

    const library = await listExercises(db, user.id);
    const matchRows = buildProgrammeMatchRows(validated.data, library);

    // Incline Dumbbell Press auto-matches the existing exercise; the other
    // two have no library match and default to "create".
    expect(matchRows.find((r) => r.name === 'Incline Dumbbell Press')?.decision).toEqual({
      type: 'accept',
      exerciseId: existing.id,
    });

    const createChoices = new Map([
      ['bulgarian split squat', { equipmentType: 'plate_loaded' as const }],
      ['cable crunch', { equipmentType: 'cable' as const }],
    ]);

    const summary = await importProgramme(db, user.id, validated.data, matchRows, createChoices, true);

    expect(summary.templatesImported).toBe(1);
    expect(summary.exercisesImported).toBe(3);
    expect(summary.exercisesCreated).toBe(2);

    const activeProgramme = await getActiveProgramme(db, user.id);
    expect(activeProgramme?.id).toBe(summary.programmeId);
    expect(activeProgramme?.name).toBe('One Month. One Focus. — June');

    const templates = await listTemplatesForProgramme(db, user.id, summary.programmeId);
    expect(templates).toHaveLength(1);
    expect(templates[0].dayHint).toBe('Tuesday');

    const templateExercises = await listTemplateExercisesByTemplate(db, user.id, templates[0].id);
    expect(templateExercises).toHaveLength(3);

    const inclineRow = templateExercises.find((te) => te.exerciseId === existing.id);
    expect(inclineRow?.targetSets).toBe(4);
    expect(inclineRow?.targetRepsMin).toBe(6);
    expect(inclineRow?.targetRepsMax).toBe(10);

    // Never overwrites the existing exercise it matched against.
    const unchanged = await getExerciseById(db, user.id, existing.id);
    expect(unchanged?.equipmentType).toBe('dumbbell');

    // The two superset-linked created exercises share a superset_group_id.
    const squatRow = templateExercises.find((te) => te.exerciseId !== existing.id && te.targetSets === 3 && te.targetRepsMax === 12);
    const crunchRow = templateExercises.find((te) => te.exerciseId !== existing.id && te.targetRepsMax === 20);
    expect(squatRow?.supersetGroupId).toBe('a');
    expect(crunchRow?.supersetGroupId).toBe('a');
  });

  it('never creates a second exercise for the same programme name imported twice across templates', async () => {
    const { db, user } = await setup();
    const raw = structuredClone(RAW_PROGRAMME);
    raw.programme.templates.push({
      name: 'PUSH 2',
      day_hint: null as any,
      exercises: [raw.programme.templates[0].exercises[1]], // Bulgarian Split Squat again
    });
    const validated = validateProgrammeImport(raw);
    if (!validated.ok) throw new Error('fixture should validate');

    const library = await listExercises(db, user.id);
    const matchRows = buildProgrammeMatchRows(validated.data, library);
    const createChoices = new Map([
      ['bulgarian split squat', { equipmentType: 'plate_loaded' as const }],
      ['cable crunch', { equipmentType: 'cable' as const }],
    ]);

    const summary = await importProgramme(db, user.id, validated.data, matchRows, createChoices, false);
    expect(summary.exercisesCreated).toBe(2); // still just squat + crunch, not 3
  });
});

describe('importProgramme — schema 1.1', () => {
  it('stores warm-up/down text, cardio exercise kind/track, and cardio targets', async () => {
    const { db, user } = await setup();
    const raw = {
      schema_version: '1.1',
      programme: {
        name: 'Hybrid',
        templates: [
          {
            name: 'HYROX',
            warm_up: '10 min easy jog',
            warm_down: '5 min walk',
            exercises: [
              {
                name: 'Wall Balls',
                kind: 'cardio',
                muscle_group: 'Conditioning',
                load_convention: 'total',
                track: ['reps', 'load_kg', 'time'],
                target_sets: 4,
                target_reps_min: 20,
                target_reps_max: 20,
                target_load_kg: 6,
                superset_group: 'A',
              },
            ],
          },
        ],
      },
    };
    const validated = validateProgrammeImport(raw);
    if (!validated.ok) throw new Error('fixture should validate');
    const library = (await listExercises(db, user.id)).map((e) => ({ id: e.id, name: e.name, aliases: e.aliases, kind: e.kind }));
    const rows = buildProgrammeMatchRows(validated.data, library);
    const summary = await importProgramme(db, user.id, validated.data, rows, new Map([['wall balls', { equipmentType: 'other' }]]), false);

    const [template] = await listTemplatesForProgramme(db, user.id, summary.programmeId);
    expect(template).toMatchObject({ warmUp: '10 min easy jog', warmDown: '5 min walk' });
    const [te] = await listTemplateExercisesByTemplate(db, user.id, template.id);
    expect(te).toMatchObject({ targetSets: 4, targetRepsMin: 20, targetRepsMax: 20, targetLoadKg: 6, targetDistanceM: null });
    const exercise = await getExerciseById(db, user.id, te.exerciseId);
    expect(exercise).toMatchObject({ kind: 'cardio', track: ['reps', 'load_kg', 'time'], muscleGroup: 'Conditioning' });
  });
});
