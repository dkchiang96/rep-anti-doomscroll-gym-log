import { deriveLoadDisplay, deriveSplitLoadDisplay } from '../loadConvention';

describe('deriveLoadDisplay', () => {
  it('shows PER DUMBBELL with a doubled total for a dumbbell exercise', () => {
    expect(deriveLoadDisplay('per_side', 'dumbbell', 22.5)).toEqual({
      conventionLabel: 'PER DUMBBELL',
      totalLine: '45 kg total',
    });
  });

  it('shows PER SIDE with a doubled total for a non-dumbbell per_side exercise', () => {
    expect(deriveLoadDisplay('per_side', 'cable', 15)).toEqual({
      conventionLabel: 'PER SIDE',
      totalLine: '30 kg total',
    });
  });

  it('shows TOTAL with no derived total line', () => {
    expect(deriveLoadDisplay('total', 'barbell', 80)).toEqual({
      conventionLabel: 'TOTAL',
      totalLine: null,
    });
  });

  it('shows BODYWEIGHT with no derived total line', () => {
    expect(deriveLoadDisplay('bodyweight', 'bodyweight', 0)).toEqual({
      conventionLabel: 'BODYWEIGHT',
      totalLine: null,
    });
  });

  it('rounds the derived total to 2 decimal places', () => {
    expect(deriveLoadDisplay('per_side', 'dumbbell', 12.525).totalLine).toBe('25.05 kg total');
  });
});

describe('deriveSplitLoadDisplay', () => {
  it('keeps the per-side label and totals left + right', () => {
    expect(deriveSplitLoadDisplay('dumbbell', 20, 17.5)).toEqual({ conventionLabel: 'PER DUMBBELL', totalLine: '37.5 kg total' });
    expect(deriveSplitLoadDisplay('cable', 10, 10).conventionLabel).toBe('PER SIDE');
  });
});
