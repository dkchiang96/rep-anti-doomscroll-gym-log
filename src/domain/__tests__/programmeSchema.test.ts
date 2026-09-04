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
