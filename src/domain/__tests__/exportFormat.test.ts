import { buildFullJsonExport, buildSetCsv, deriveTotalKg, type ExportSetRow } from '../exportFormat';

describe('deriveTotalKg', () => {
  it('doubles per_side weight', () => {
    expect(deriveTotalKg('per_side', 20)).toBe(40);
  });

  it('leaves total and bodyweight as-is', () => {
    expect(deriveTotalKg('total', 80)).toBe(80);
    expect(deriveTotalKg('bodyweight', 0)).toBe(0);
  });

  it('adds left and right for a split set', () => {
    expect(deriveTotalKg('per_side', 20, 17.5)).toBe(37.5);
  });
});

describe('buildSetCsv', () => {
  const baseRow: ExportSetRow = {
    sessionId: 's1',
    sessionStartedAt: new Date('2026-08-16T12:00:00.000Z'),
    sessionNote: null,
    exerciseName: 'Incline dumbbell press',
    muscleGroup: 'Chest',
    equipmentType: 'dumbbell',
    loadConvention: 'per_side',
    weightKg: 22.5,
    reps: 8,
    setType: 'working',
  };

  it('writes a header row and one data row per set, with the derived total', () => {
    const csv = buildSetCsv([baseRow]);
    const lines = csv.split('\n');
    expect(lines[0]).toBe(
      'date,session_note,exercise,muscle_group,equipment_type,load_convention,weight_kg,total_kg,reps,set_type,side',
    );
    expect(lines[1]).toBe('2026-08-16,,Incline dumbbell press,Chest,dumbbell,per_side,22.5,45,8,working,');
  });

  it('exports side and gives both rows of a split pair the left + right total', () => {
    const left: ExportSetRow = { ...baseRow, setId: 'L', side: 'left', parentSetId: null, weightKg: 22.5, reps: 10 };
    const plain: ExportSetRow = { ...baseRow, setId: 'P', side: null, parentSetId: null, weightKg: 22.5, reps: 8 };
    const right: ExportSetRow = { ...baseRow, setId: 'R', side: 'right', parentSetId: 'L', weightKg: 20, reps: 9 };
    const lines = buildSetCsv([left, plain, right]).split('\n');
    expect(lines[1]).toBe('2026-08-16,,Incline dumbbell press,Chest,dumbbell,per_side,22.5,42.5,10,working,left');
    expect(lines[2]).toBe('2026-08-16,,Incline dumbbell press,Chest,dumbbell,per_side,22.5,45,8,working,');
    expect(lines[3]).toBe('2026-08-16,,Incline dumbbell press,Chest,dumbbell,per_side,20,42.5,9,working,right');
  });

  it('quotes fields containing commas, quotes, or newlines', () => {
    const csv = buildSetCsv([{ ...baseRow, sessionNote: 'felt "great", pushed hard\nnew PR' }]);
    expect(csv).toContain('"felt ""great"", pushed hard\nnew PR"');
  });
});

describe('buildFullJsonExport', () => {
  it('round-trips through JSON.parse with the exportedAt timestamp preserved as an ISO string', () => {
    const exportedAt = new Date('2026-08-31T00:00:00.000Z');
    const json = buildFullJsonExport({
      exportedAt,
      exercises: [{ id: 'e1' }],
      programmes: [],
      templates: [],
      templateExercises: [],
      sessions: [],
      sessionExercises: [],
      sets: [],
    });
    const parsed = JSON.parse(json);
    expect(parsed.exportedAt).toBe(exportedAt.toISOString());
    expect(parsed.exercises).toEqual([{ id: 'e1' }]);
  });
});
