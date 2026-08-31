// FR-3.4: "the app learns the user's gym's cable stack ladder ... and offers
// it as the step." Individual logged weights are often rounded to one
// decimal by whoever typed them, so consecutive diffs on a real ladder
// wobble by a few hundredths of a kilo (11.3, 18.0, 24.8, 31.5, 38.3, 45.0,
// 51.8 is a real 6.75kg ladder whose diffs alternate 6.7/6.8). Averaging
// across the whole run cancels that rounding noise out; per-diff tolerance
// then rejects weights that aren't actually a ladder.

const ROUND_TO_KG = 0.25;
const TOLERANCE_KG = 0.15;
const MIN_DISTINCT_WEIGHTS = 3;

function roundTo(value: number, precision: number): number {
  return Math.round(value / precision) * precision;
}

export function inferWeightStep(weights: number[]): number | null {
  const distinct = Array.from(new Set(weights.map((w) => Math.round(w * 100) / 100))).sort((a, b) => a - b);
  if (distinct.length < MIN_DISTINCT_WEIGHTS) return null;

  const first = distinct[0];
  const last = distinct[distinct.length - 1];
  const avgStep = (last - first) / (distinct.length - 1);

  for (let i = 1; i < distinct.length; i++) {
    const diff = distinct[i] - distinct[i - 1];
    if (Math.abs(diff - avgStep) > TOLERANCE_KG) return null;
  }

  return Math.round(roundTo(avgStep, ROUND_TO_KG) * 100) / 100;
}
