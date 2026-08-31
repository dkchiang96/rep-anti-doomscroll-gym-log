import fs from 'fs';
import path from 'path';

import { parseExerciseLine, parseKeepExport } from '../keepParser';

const FIXTURE_PATH = path.join(__dirname, '..', '..', '..', 'docs', 'keep-export.txt');

describe('parseExerciseLine', () => {
  it('parses working sets plus drop sets', () => {
    const result = parseExerciseLine('exercise - 22.5kg 10 8 7 5 12.5kg 10 7.5kg 10', 'ctx');
    expect(result.name).toBe('exercise');
    expect(result.sets).toHaveLength(6);
    expect(result.sets.slice(0, 4)).toEqual([
      { weightKg: 22.5, isBodyweight: false, reps: 10, setType: 'working', groupIndex: 0 },
      { weightKg: 22.5, isBodyweight: false, reps: 8, setType: 'working', groupIndex: 0 },
      { weightKg: 22.5, isBodyweight: false, reps: 7, setType: 'working', groupIndex: 0 },
      { weightKg: 22.5, isBodyweight: false, reps: 5, setType: 'working', groupIndex: 0 },
    ]);
    expect(result.sets[4]).toEqual({ weightKg: 12.5, isBodyweight: false, reps: 10, setType: 'dropset', groupIndex: 1 });
    expect(result.sets[5]).toEqual({ weightKg: 7.5, isBodyweight: false, reps: 10, setType: 'dropset', groupIndex: 2 });
  });

  it('parses bodyweight sets', () => {
    const result = parseExerciseLine('bw 10 10 8 6', 'ctx');
    expect(result.sets).toHaveLength(4);
    expect(result.sets.every((s) => s.isBodyweight && s.weightKg === 0)).toBe(true);
    expect(result.sets.map((s) => s.reps)).toEqual([10, 10, 8, 6]);
  });

  it('captures trailing annotations as notes', () => {
    const superset = parseExerciseLine('pull back row machinr - 45kg 12 10 10 8 31.5kg 8 18kg 8 (superset)', 'ctx');
    expect(superset.note).toBe('superset');
    expect(superset.sets).toHaveLength(6);
    expect(superset.sets.filter((s) => s.setType === 'dropset')).toHaveLength(2);

    const tooLight = parseExerciseLine(
      'lat pull down - 51.8kg 10 8 8 8 24.8kg 10 11.3kg 10 (superset - too light)',
      'ctx',
    );
    expect(tooLight.note).toBe('superset - too light');

    const change = parseExerciseLine('lying leg curl - 35kg 12 10 10 (change)', 'ctx');
    expect(change.note).toBe('change');
  });

  it('flags unparseable tokens for review without dropping the good sets around them', () => {
    const result = parseExerciseLine('calf raise - 35kg 12 10 10 10AW4', 'ctx');
    expect(result.sets).toHaveLength(3);
    expect(result.reviewItems).toEqual([
      expect.objectContaining({ rawFragment: '10AW4', reason: 'unparseable token' }),
    ]);
  });

  it('flags implausible rep counts instead of accepting them', () => {
    const result = parseExerciseLine('Hip thrust machine- 22.5 kg 10 10 10 103', 'ctx');
    expect(result.sets).toHaveLength(3);
    expect(result.reviewItems).toEqual([
      expect.objectContaining({ rawFragment: '103', reason: 'rep count out of plausible range' }),
    ]);
  });

  it('bails out with zero sets on a garbage-only line', () => {
    const result = parseExerciseLine('AWW3W4', 'ctx');
    expect(result.sets).toHaveLength(0);
  });

  it('bails out when data starts with a bare number and no weight/bw token', () => {
    const result = parseExerciseLine('incline smith - 4', 'ctx');
    expect(result.sets).toHaveLength(0);
  });

  it('handles a dash typed with no space before the first weight token', () => {
    const result = parseExerciseLine('glute isolator -12kg 10 16kg 10 10', 'ctx');
    expect(result.name).toBe('glute isolator');
    expect(result.sets).toEqual([
      { weightKg: 12, isBodyweight: false, reps: 10, setType: 'working', groupIndex: 0 },
      { weightKg: 16, isBodyweight: false, reps: 10, setType: 'dropset', groupIndex: 1 },
      { weightKg: 16, isBodyweight: false, reps: 10, setType: 'dropset', groupIndex: 1 },
    ]);
  });

  it('splits name from data when there is no dash', () => {
    const result = parseExerciseLine('pec fly machine 18kg 15 15 15', 'ctx');
    expect(result.name).toBe('pec fly machine');
    expect(result.sets).toHaveLength(3);
  });
});

describe('parseKeepExport', () => {
  it('splits dates fused onto the previous line', () => {
    const text = ['07 Jun', 'lower back extension roman chair - 5kg 12 12 8 bw 428 Jul', 'incline barbell - 40kg 10'].join(
      '\n',
    );
    const { sessions } = parseKeepExport(text, { year: 2025 });
    expect(sessions).toHaveLength(2);
    expect(sessions[0].day).toBe(7);
    expect(sessions[0].month).toBe(5); // June
    expect(sessions[0].exercises[0].sets.map((s) => s.reps)).toEqual([12, 12, 8, 4]);
    expect(sessions[1].day).toBe(28);
    expect(sessions[1].month).toBe(6); // July
    expect(sessions[1].exercises[0].name).toBe('incline barbell');
  });

  it('carries a parenthetical date-header note through as the session note', () => {
    const { sessions } = parseKeepExport('16 Aug (sick)\nincline dumbbell press - 22.5kg 10', { year: 2025 });
    expect(sessions[0].note).toBe('sick');
  });

  it('flags duplicate dates without merging or dropping either session', () => {
    const text = ['1 Jun', 'squat - 60kg 10', '1 Jun', 'bench - 40kg 10'].join('\n');
    const { sessions, needsReview } = parseKeepExport(text, { year: 2025 });
    expect(sessions).toHaveLength(2);
    expect(needsReview.some((r) => r.reason.includes('separate session blocks'))).toBe(true);
  });

  it('never drops a garbage line silently — it always appears in needsReview', () => {
    const text = ['1 Jun', 'squat - 60kg 10', 'AWW3W4', 'bench - 40kg 10'].join('\n');
    const { sessions, needsReview } = parseKeepExport(text, { year: 2025 });
    expect(sessions[0].exercises).toHaveLength(2);
    expect(needsReview.some((r) => r.rawFragment === 'AWW3W4')).toBe(true);
  });

  it('parses the full real export fixture without throwing and surfaces every known garbage token', () => {
    const raw = fs.readFileSync(FIXTURE_PATH, 'utf-8');
    const { sessions, needsReview } = parseKeepExport(raw, { year: 2025 });

    expect(sessions.length).toBeGreaterThan(30);
    expect(sessions.reduce((n, s) => n + s.exercises.length, 0)).toBeGreaterThan(100);

    const fragments = needsReview.map((r) => r.rawFragment);
    expect(fragments).toContain('153³Ẁ');
    expect(fragments).toContain('AWW3W4');
    expect(fragments).toContain('103');
    expect(fragments).toContain('10AW4');
    expect(needsReview.some((r) => r.rawFragment.includes('incline smith - 4'))).toBe(true);
    expect(needsReview.some((r) => r.reason.includes('separate session blocks'))).toBe(true);

    for (const session of sessions) {
      for (const ex of session.exercises) {
        for (const set of ex.sets) {
          expect(set.reps).toBeGreaterThan(0);
          expect(set.reps).toBeLessThanOrEqual(60);
        }
      }
    }
  });
});

describe('parseKeepExport — fused date collapsing', () => {
  it('does not create a phantom empty session when a fused date lands next to a real header for the same date', () => {
    const text = ['6 Aug', 'lower back extension roman chair - 5kg 12 12 8 bw 428 Jul', '', '', '28 Jul', 'squat - 70kg 8'].join(
      '\n',
    );
    const { sessions, needsReview } = parseKeepExport(text, { year: 2025 });

    expect(sessions).toHaveLength(2);
    expect(sessions.every((s) => s.exercises.length > 0)).toBe(true);
    expect(needsReview.some((r) => r.reason === 'session had no parseable exercises')).toBe(false);
    expect(needsReview.some((r) => r.reason.includes('separate session blocks'))).toBe(false);
  });
});
