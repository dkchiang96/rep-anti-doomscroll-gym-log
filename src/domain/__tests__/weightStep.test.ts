import { inferWeightStep } from '../weightStep';

describe('inferWeightStep', () => {
  it('detects the 6.75kg cable stack ladder from the PRD, despite rounding wobble', () => {
    expect(inferWeightStep([11.3, 18.0, 24.8, 31.5, 38.3, 45.0, 51.8])).toBe(6.75);
  });

  it('detects a perfectly even ladder', () => {
    expect(inferWeightStep([20, 25, 30, 35])).toBe(5);
  });

  it('is order- and duplicate-insensitive', () => {
    expect(inferWeightStep([35, 20, 30, 25, 25, 20])).toBe(5);
  });

  it('returns null when weights are not a consistent ladder', () => {
    expect(inferWeightStep([10, 12, 15, 20])).toBeNull();
  });

  it('returns null with fewer than 3 distinct weights', () => {
    expect(inferWeightStep([20, 25])).toBeNull();
    expect(inferWeightStep([20])).toBeNull();
    expect(inferWeightStep([])).toBeNull();
  });
});
