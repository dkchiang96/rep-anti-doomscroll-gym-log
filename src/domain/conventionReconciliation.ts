// Pure functions for detecting and fixing dumbbell load-convention drift in
// imported history: the same exercise logged as a per-dumbbell weight for a
// while, then as the combined (total) weight, or vice versa. Detection is
// generic — any exercise whose average working weight roughly doubles or
// halves across the history is flagged — not hardcoded to specific names.

import type { ParsedSession } from './keepParser';

export type LoadConvention = 'per_side' | 'total';

export interface DateParts {
  year: number;
  month: number;
  day: number;
}

export interface ConventionCandidate {
  exerciseName: string;
  breakpointDate: DateParts;
  before: { averageWeightKg: number; sampleCount: number };
  after: { averageWeightKg: number; sampleCount: number };
  ratio: number;
}

export interface ConventionDecision {
  exerciseName: string;
  breakpointDate: DateParts;
  beforeConvention: LoadConvention;
  afterConvention: LoadConvention;
}

export interface ApplyConventionResult {
  sessions: ParsedSession[];
  lockedConventions: Map<string, LoadConvention>;
}

const MIN_SESSIONS_PER_SIDE = 2;
const MIN_TOTAL_SESSIONS = 4;

function toEpoch(d: DateParts): number {
  return Date.UTC(d.year, d.month, d.day);
}

function mean(values: number[]): number {
  return values.reduce((a, b) => a + b, 0) / values.length;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function isRatioJump(a: number, b: number): boolean {
  if (a <= 0 || b <= 0) return false;
  const ratio = b / a;
  return (ratio >= 1.8 && ratio <= 2.2) || (ratio >= 1 / 2.2 && ratio <= 1 / 1.8);
}

interface ExerciseSessionEntry extends DateParts {
  weights: number[];
}

function collectByExercise(sessions: ParsedSession[]): Map<string, ExerciseSessionEntry[]> {
  const sorted = [...sessions].sort((a, b) => toEpoch(a) - toEpoch(b));
  const byExercise = new Map<string, ExerciseSessionEntry[]>();

  for (const session of sorted) {
    const perExerciseWeights = new Map<string, number[]>();
    for (const ex of session.exercises) {
      const workingWeights = ex.sets
        .filter((s) => s.setType === 'working' && !s.isBodyweight)
        .map((s) => s.weightKg);
      if (workingWeights.length === 0) continue;
      const key = ex.name.trim().toLowerCase();
      const arr = perExerciseWeights.get(key) ?? [];
      arr.push(...workingWeights);
      perExerciseWeights.set(key, arr);
    }
    for (const [key, weights] of perExerciseWeights) {
      const list = byExercise.get(key) ?? [];
      list.push({ year: session.year, month: session.month, day: session.day, weights });
      byExercise.set(key, list);
    }
  }

  return byExercise;
}

export function detectConventionCandidates(sessions: ParsedSession[]): ConventionCandidate[] {
  const byExercise = collectByExercise(sessions);
  const candidates: ConventionCandidate[] = [];

  for (const [exerciseName, entries] of byExercise) {
    if (entries.length < MIN_TOTAL_SESSIONS) continue;

    const sessionAverages = entries.map((e) => mean(e.weights));
    let best: { splitIdx: number; ratio: number; beforeAvg: number; afterAvg: number } | null = null;

    for (let splitIdx = MIN_SESSIONS_PER_SIDE; splitIdx <= entries.length - MIN_SESSIONS_PER_SIDE; splitIdx++) {
      const beforeAvg = mean(sessionAverages.slice(0, splitIdx));
      const afterAvg = mean(sessionAverages.slice(splitIdx));
      if (!isRatioJump(beforeAvg, afterAvg)) continue;

      const ratio = afterAvg / beforeAvg;
      const distanceFromOne = Math.abs(Math.log2(ratio));
      if (!best || distanceFromOne > Math.abs(Math.log2(best.ratio))) {
        best = { splitIdx, ratio, beforeAvg, afterAvg };
      }
    }

    if (best) {
      const breakpointEntry = entries[best.splitIdx];
      candidates.push({
        exerciseName,
        breakpointDate: { year: breakpointEntry.year, month: breakpointEntry.month, day: breakpointEntry.day },
        before: { averageWeightKg: round2(best.beforeAvg), sampleCount: best.splitIdx },
        after: { averageWeightKg: round2(best.afterAvg), sampleCount: entries.length - best.splitIdx },
        ratio: round2(best.ratio),
      });
    }
  }

  return candidates;
}

export interface ConventionQuestion {
  exerciseName: string;
  /** Present when a ratio jump was detected; null for a dumbbell exercise flagged purely by name. */
  candidate: ConventionCandidate | null;
  beforeConvention: LoadConvention;
  afterConvention: LoadConvention;
}

// Any exercise whose name mentions "dumbbell" is ambiguous between per-side and
// total regardless of whether a ratio jump was detected in this particular
// history — the ambiguity is inherent to the equipment, not just visible when
// it happens to change. (Name-based, so e.g. "hammer curl" without the word
// "dumbbell" is not caught here; the ratio-jump detector remains the general
// safety net.)
const DUMBBELL_NAME_RE = /\bdumbbell\b/i;

export function buildConventionQuestions(sessions: ParsedSession[]): ConventionQuestion[] {
  const candidates = detectConventionCandidates(sessions);
  const candidateNames = new Set(candidates.map((c) => c.exerciseName));

  const allNames = new Set<string>();
  for (const session of sessions) {
    for (const ex of session.exercises) allNames.add(ex.name.trim().toLowerCase());
  }

  const questions: ConventionQuestion[] = candidates.map((c) => {
    const decreasing = c.ratio < 1;
    return {
      exerciseName: c.exerciseName,
      candidate: c,
      beforeConvention: decreasing ? 'total' : 'per_side',
      afterConvention: decreasing ? 'per_side' : 'total',
    };
  });

  for (const name of allNames) {
    if (candidateNames.has(name) || !DUMBBELL_NAME_RE.test(name)) continue;
    questions.push({ exerciseName: name, candidate: null, beforeConvention: 'per_side', afterConvention: 'per_side' });
  }

  return questions;
}

export function conventionQuestionsToDecisions(questions: ConventionQuestion[]): ConventionDecision[] {
  return questions.map((q) => ({
    exerciseName: q.exerciseName,
    breakpointDate: q.candidate?.breakpointDate ?? { year: 1970, month: 0, day: 1 },
    beforeConvention: q.beforeConvention,
    afterConvention: q.afterConvention,
  }));
}

// Normalizes historical weights to a single locked convention per exercise,
// using the user's before/after labelling from the review step. Sessions on
// or after the breakpoint date are left as recorded; sessions before it are
// rescaled to match `afterConvention` when the two differ.
export function applyConventionDecisions(
  sessions: ParsedSession[],
  decisions: ConventionDecision[],
): ApplyConventionResult {
  const lockedConventions = new Map<string, LoadConvention>();
  const decisionByExercise = new Map(decisions.map((d) => [d.exerciseName.trim().toLowerCase(), d]));

  const nextSessions = sessions.map((session) => {
    const sessionEpoch = toEpoch(session);
    return {
      ...session,
      exercises: session.exercises.map((ex) => {
        const key = ex.name.trim().toLowerCase();
        const decision = decisionByExercise.get(key);
        if (!decision) return ex;

        lockedConventions.set(key, decision.afterConvention);
        if (decision.beforeConvention === decision.afterConvention) return ex;

        const breakpointEpoch = toEpoch(decision.breakpointDate);
        if (sessionEpoch >= breakpointEpoch) return ex;

        const factor = decision.beforeConvention === 'total' && decision.afterConvention === 'per_side' ? 0.5 : 2;
        return {
          ...ex,
          sets: ex.sets.map((s) => (s.isBodyweight ? s : { ...s, weightKg: round2(s.weightKg * factor) })),
        };
      }),
    };
  });

  return { sessions: nextSessions, lockedConventions };
}
