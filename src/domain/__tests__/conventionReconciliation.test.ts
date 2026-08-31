import fs from 'fs';
import path from 'path';

import { applyConventionDecisions, buildConventionQuestions, detectConventionCandidates } from '../conventionReconciliation';
import { parseKeepExport } from '../keepParser';

const FIXTURE_PATH = path.join(__dirname, '..', '..', '..', 'docs', 'keep-export.txt');

describe('detectConventionCandidates', () => {
  it('flags incline and flat dumbbell press around the 16 Aug convention change', () => {
    const raw = fs.readFileSync(FIXTURE_PATH, 'utf-8');
    const { sessions } = parseKeepExport(raw, { year: 2025 });
    const candidates = detectConventionCandidates(sessions);

    const incline = candidates.find((c) => c.exerciseName === 'incline dumbbell press');
    expect(incline).toBeDefined();
    expect(incline!.before.averageWeightKg).toBeGreaterThan(incline!.after.averageWeightKg);
    expect(incline!.ratio).toBeLessThan(0.6);

    const flat = candidates.find((c) => c.exerciseName === 'flat dumbbell press');
    expect(flat).toBeDefined();
    expect(flat!.ratio).toBeLessThan(0.6);
  });

  it('does not flag an exercise with no ratio jump', () => {
    const text = [
      '1 Jun',
      'squat - 60kg 10',
      '2 Jun',
      'squat - 62.5kg 10',
      '3 Jun',
      'squat - 65kg 10',
      '4 Jun',
      'squat - 67.5kg 10',
      '5 Jun',
      'squat - 70kg 10',
    ].join('\n');
    const { sessions } = parseKeepExport(text, { year: 2025 });
    const candidates = detectConventionCandidates(sessions);
    expect(candidates.find((c) => c.exerciseName === 'squat')).toBeUndefined();
  });
});

describe('applyConventionDecisions', () => {
  it('normalizes pre-breakpoint weights to the locked convention and leaves post-breakpoint weights untouched', () => {
    const text = [
      '1 Jun',
      'incline dumbbell press - 45kg 8',
      '2 Jun',
      'incline dumbbell press - 45kg 8',
      '16 Aug',
      'incline dumbbell press - 22.5kg 8',
      '17 Aug',
      'incline dumbbell press - 22.5kg 8',
    ].join('\n');
    const { sessions } = parseKeepExport(text, { year: 2025 });

    const { sessions: normalized, lockedConventions } = applyConventionDecisions(sessions, [
      {
        exerciseName: 'incline dumbbell press',
        breakpointDate: { year: 2025, month: 7, day: 16 },
        beforeConvention: 'total',
        afterConvention: 'per_side',
      },
    ]);

    expect(lockedConventions.get('incline dumbbell press')).toBe('per_side');
    const weights = normalized.flatMap((s) => s.exercises.flatMap((e) => e.sets.map((set) => set.weightKg)));
    expect(weights).toEqual([22.5, 22.5, 22.5, 22.5]);
  });
});

describe('buildConventionQuestions', () => {
  it('requires a convention answer for a dumbbell exercise even with no detected jump', () => {
    const text = ['1 Jun', 'lateral raise dumbbell - 5kg 12', '2 Jun', 'lateral raise dumbbell - 5kg 12'].join('\n');
    const { sessions } = parseKeepExport(text, { year: 2025 });
    const questions = buildConventionQuestions(sessions);
    expect(questions.find((q) => q.exerciseName === 'lateral raise dumbbell')).toBeDefined();
  });

  it('does not ask about non-dumbbell exercises with no detected jump', () => {
    const text = ['1 Jun', 'squat - 60kg 10', '2 Jun', 'squat - 60kg 10'].join('\n');
    const { sessions } = parseKeepExport(text, { year: 2025 });
    const questions = buildConventionQuestions(sessions);
    expect(questions).toHaveLength(0);
  });
});
