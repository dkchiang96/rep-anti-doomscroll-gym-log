import { parseProgrammeJson, validateProgrammeImport } from '../programmeSchema';

// The exact worked example from Appendix A.
const VALID_JSON = {
  schema_version: '1.0',
  programme: {
    name: 'One Month. One Focus. — June',
    notes: 'Progressive overload focus. No pilates or yoga in this plan.',
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
            name: 'Cable Lateral Raise',
            muscle_group: 'Shoulders',
            load_convention: 'per_side',
            target_sets: 4,
            target_reps_min: 12,
            target_reps_max: 20,
            superset_group: null,
            notes: 'single hand each side',
          },
        ],
      },
    ],
  },
};

describe('validateProgrammeImport', () => {
  it('accepts the Appendix A worked example', () => {
    const result = validateProgrammeImport(VALID_JSON);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.name).toBe('One Month. One Focus. — June');
    expect(result.data.templates).toHaveLength(1);
    expect(result.data.templates[0].exercises).toHaveLength(2);
    expect(result.data.templates[0].exercises[0].loadConvention).toBe('per_side');
  });

  it('defaults omitted optional fields (notes, day_hint, superset_group)', () => {
    const stripped = structuredClone(VALID_JSON);
    delete (stripped.programme as any).notes;
    delete (stripped.programme.templates[0] as any).day_hint;
    delete (stripped.programme.templates[0].exercises[0] as any).notes;
    delete (stripped.programme.templates[0].exercises[0] as any).superset_group;

    const result = validateProgrammeImport(stripped);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.notes).toBeNull();
    expect(result.data.templates[0].dayHint).toBeNull();
    expect(result.data.templates[0].exercises[0].supersetGroup).toBeNull();
    expect(result.data.templates[0].exercises[0].notes).toBe('');
  });

  it('rejects a non-object top level with a field-level error, not a crash', () => {
    const result = validateProgrammeImport('not an object');
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors[0].path).toBe('$');
  });

  it('rejects an unsupported schema_version by name', () => {
    const bad = structuredClone(VALID_JSON);
    (bad as any).schema_version = '2.0';
    const result = validateProgrammeImport(bad);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors.some((e) => e.path === 'schema_version')).toBe(true);
  });

  it('rejects an invalid muscle_group naming the exact field path', () => {
    const bad = structuredClone(VALID_JSON);
    (bad.programme.templates[0].exercises[0] as any).muscle_group = 'Wings';
    const result = validateProgrammeImport(bad);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors.some((e) => e.path === 'programme.templates[0].exercises[0].muscle_group')).toBe(true);
  });

  it('rejects an invalid load_convention', () => {
    const bad = structuredClone(VALID_JSON);
    (bad.programme.templates[0].exercises[0] as any).load_convention = 'half_and_half';
    const result = validateProgrammeImport(bad);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors.some((e) => e.path === 'programme.templates[0].exercises[0].load_convention')).toBe(true);
  });

  it('rejects target_reps_min greater than target_reps_max', () => {
    const bad = structuredClone(VALID_JSON);
    bad.programme.templates[0].exercises[0].target_reps_min = 12;
    bad.programme.templates[0].exercises[0].target_reps_max = 6;
    const result = validateProgrammeImport(bad);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors.some((e) => e.path === 'programme.templates[0].exercises[0].target_reps_min')).toBe(true);
  });

  it('rejects a missing required field (programme.name)', () => {
    const bad = structuredClone(VALID_JSON);
    delete (bad.programme as any).name;
    const result = validateProgrammeImport(bad);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors.some((e) => e.path === 'programme.name')).toBe(true);
  });

  it('collects multiple field errors in one pass rather than stopping at the first', () => {
    const bad = structuredClone(VALID_JSON);
    (bad.programme.templates[0].exercises[0] as any).muscle_group = 'Nope';
    (bad.programme.templates[0].exercises[1] as any).load_convention = 'nope';
    const result = validateProgrammeImport(bad);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors.length).toBeGreaterThanOrEqual(2);
  });
});

describe('parseProgrammeJson', () => {
  it('reports invalid JSON as a field error, never a raw parser stack trace', () => {
    const result = parseProgrammeJson('{ this is not json');
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors[0].path).toBe('$');
    expect(result.errors[0].message).toMatch(/Invalid JSON/);
  });

  it('parses and validates well-formed text end to end', () => {
    const result = parseProgrammeJson(JSON.stringify(VALID_JSON));
    expect(result.ok).toBe(true);
  });
});

describe('validateProgrammeImport — schema 1.1 (warm-ups, cardio)', () => {
  // The worked example in docs/PROGRAMME-PROMPT.md is what an LLM copies, so
  // it must always import cleanly — this keeps the prompt and the validator
  // from drifting apart.
  it('accepts the worked example from docs/PROGRAMME-PROMPT.md', () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const fs = require('fs') as typeof import('fs');
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const path = require('path') as typeof import('path');
    const doc = fs.readFileSync(path.join(__dirname, '..', '..', '..', 'docs', 'PROGRAMME-PROMPT.md'), 'utf-8').replace(/\r\n/g, '\n');
    const start = doc.indexOf('{\n  "schema_version"');
    const end = doc.indexOf('\n\nFIELD RULES');
    expect(start).toBeGreaterThan(-1);
    const result = parseProgrammeJson(doc.slice(start, end));
    if (!result.ok) throw new Error(JSON.stringify(result.errors));
    const [push, hyrox] = result.data.templates;
    expect(push.warmUp).toMatch(/^5 min easy bike/);
    expect(push.exercises[0]).toMatchObject({ kind: 'strength', track: null, targetRepsMax: 10 });
    expect(hyrox.exercises.map((e) => e.kind)).toEqual(['cardio', 'cardio', 'cardio', 'cardio']);
    expect(hyrox.exercises[0]).toMatchObject({ muscleGroup: 'Conditioning', track: ['distance_m', 'time'], targetDistanceM: 1000, targetRepsMin: 0, targetRepsMax: 0 });
    expect(hyrox.exercises[1]).toMatchObject({ targetRepsMin: 20, targetRepsMax: 20, targetLoadKg: 6 });
    expect(hyrox.exercises[3]).toMatchObject({ track: ['calories', 'time'], targetCalories: 15 });
  });

  it('still accepts 1.0 files, defaulting new fields', () => {
    const result = validateProgrammeImport(VALID_JSON);
    if (!result.ok) throw new Error('expected ok');
    expect(result.data.templates[0]).toMatchObject({ warmUp: null, warmDown: null });
    expect(result.data.templates[0].exercises[0]).toMatchObject({ kind: 'strength', track: null, targetDistanceM: null });
  });

  const cardioFile = (exercise: Record<string, unknown>, template: Record<string, unknown> = {}) => ({
    schema_version: '1.1',
    programme: {
      name: 'P',
      templates: [
        {
          name: 'DAY',
          ...template,
          exercises: [{ name: 'Run', kind: 'cardio', muscle_group: 'Conditioning', load_convention: 'bodyweight', target_sets: 4, ...exercise }],
        },
      ],
    },
  });
  const errorPaths = (raw: unknown) => {
    const r = validateProgrammeImport(raw);
    return r.ok ? [] : r.errors.map((e) => e.path);
  };
  const ex = 'programme.templates[0].exercises[0]';

  it('requires a valid, non-empty track for cardio', () => {
    expect(errorPaths(cardioFile({}))).toContain(`${ex}.track`);
    expect(errorPaths(cardioFile({ track: [] }))).toContain(`${ex}.track`);
    expect(errorPaths(cardioFile({ track: ['distance_m', 'pace'] }))).toContain(`${ex}.track`);
    expect(errorPaths(cardioFile({ track: ['distance_m', 'time'] }))).toEqual([]);
  });

  it('does not require reps for cardio, but checks them when given', () => {
    expect(errorPaths(cardioFile({ track: ['reps'], target_reps_min: 20 }))).toContain(`${ex}.target_reps_max`);
    expect(errorPaths(cardioFile({ track: ['time'], target_reps_min: 20, target_reps_max: 20 }))).toContain(`${ex}.target_reps_min`);
    expect(errorPaths(cardioFile({ track: ['reps'], target_reps_min: 20, target_reps_max: 20 }))).toEqual([]);
  });

  it('requires each cardio target to have its matching track entry and a valid value', () => {
    expect(errorPaths(cardioFile({ track: ['time'], target_distance_m: 1000 }))).toContain(`${ex}.target_distance_m`);
    expect(errorPaths(cardioFile({ track: ['distance_m'], target_distance_m: -5 }))).toContain(`${ex}.target_distance_m`);
    expect(errorPaths(cardioFile({ track: ['time'], target_time_seconds: 90.5 }))).toContain(`${ex}.target_time_seconds`);
    expect(errorPaths(cardioFile({ track: ['load_kg'], target_load_kg: '6' }))).toContain(`${ex}.target_load_kg`);
  });

  it('rejects cardio fields on a strength exercise, and an unknown kind', () => {
    const strength = (extra: Record<string, unknown>) =>
      cardioFile({ kind: 'strength', target_reps_min: 8, target_reps_max: 8, ...extra });
    expect(errorPaths(strength({ track: ['time'] }))).toContain(`${ex}.track`);
    expect(errorPaths(strength({ target_distance_m: 100 }))).toContain(`${ex}.target_distance_m`);
    expect(errorPaths(strength({}))).toEqual([]);
    expect(errorPaths(cardioFile({ kind: 'yoga', track: ['time'] }))).toContain(`${ex}.kind`);
  });

  it('validates warm_up / warm_down as optional text', () => {
    expect(errorPaths(cardioFile({ track: ['time'] }, { warm_up: 5 }))).toContain('programme.templates[0].warm_up');
    const ok = validateProgrammeImport(cardioFile({ track: ['time'] }, { warm_up: '  jog 5 min  ', warm_down: '' }));
    if (!ok.ok) throw new Error('expected ok');
    expect(ok.data.templates[0]).toMatchObject({ warmUp: 'jog 5 min', warmDown: null });
  });

  it('rejects an unsupported schema_version', () => {
    expect(errorPaths({ ...cardioFile({ track: ['time'] }), schema_version: '2.0' })).toContain('schema_version');
  });
});
