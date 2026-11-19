import { collapseToWeakerSide, pairSides, splitTotalKg, supportsSideSplit, weakerSide, type SideTaggable } from '../sidePairs';

describe('supportsSideSplit', () => {
  it('allows non-barbell per_side lifts only', () => {
    expect(supportsSideSplit('per_side', 'dumbbell')).toBe(true);
    expect(supportsSideSplit('per_side', 'cable')).toBe(true);
    expect(supportsSideSplit('per_side', 'plate_loaded')).toBe(true);
    expect(supportsSideSplit('per_side', 'barbell')).toBe(false);
    expect(supportsSideSplit('total', 'dumbbell')).toBe(false);
    expect(supportsSideSplit('bodyweight', 'bodyweight')).toBe(false);
  });
});

describe('pairSides', () => {
  it('leaves unsplit (side = null) sets as single sets — backward compatible', () => {
    const sets = [
      { id: 'a', weightKg: 20, reps: 10, side: null, parentSetId: null },
      { id: 'b', weightKg: 20, reps: 8, side: null, parentSetId: null },
    ];
    expect(pairSides(sets)).toEqual([
      { set: sets[0], right: null },
      { set: sets[1], right: null },
    ]);
  });

  it('works on sets with no id or side fields at all', () => {
    const sets = [{ weightKg: 20, reps: 10 }];
    expect(pairSides(sets)).toEqual([{ set: sets[0], right: null }]);
  });

  it('folds an appended right row into its left partner, keeping position', () => {
    const sets = [
      { id: 'a', weightKg: 20, reps: 10, side: 'left' as const, parentSetId: null },
      { id: 'b', weightKg: 20, reps: 10, side: null, parentSetId: null },
      { id: 'r', weightKg: 17.5, reps: 8, side: 'right' as const, parentSetId: 'a' },
    ];
    expect(pairSides(sets)).toEqual([
      { set: sets[0], right: sets[2] },
      { set: sets[1], right: null },
    ]);
  });

  it('keeps a drop set attached to a left row as its own set', () => {
    const sets = [
      { id: 'a', weightKg: 20, reps: 10, side: 'left' as const, parentSetId: null },
      { id: 'r', weightKg: 20, reps: 9, side: 'right' as const, parentSetId: 'a' },
      { id: 'd', weightKg: 10, reps: 12, side: null, parentSetId: 'a' },
    ];
    const pairs = pairSides(sets);
    expect(pairs).toHaveLength(2);
    expect(pairs[0].right).toBe(sets[1]);
    expect(pairs[1].set).toBe(sets[2]);
  });

  it('keeps an orphaned right row rather than dropping data', () => {
    const sets = [{ id: 'r', weightKg: 20, reps: 9, side: 'right' as const, parentSetId: 'missing' }];
    expect(pairSides(sets)).toEqual([{ set: sets[0], right: null }]);
  });
});

describe('weakerSide', () => {
  const left: SideTaggable = { id: 'a', weightKg: 20, reps: 10, side: 'left' };
  it('picks the lower weight', () => {
    const right = { id: 'r', weightKg: 17.5, reps: 12, side: 'right' as const, parentSetId: 'a' };
    expect(weakerSide({ set: left, right })).toBe(right);
  });
  it('picks fewer reps at equal weight', () => {
    const right = { id: 'r', weightKg: 20, reps: 8, side: 'right' as const, parentSetId: 'a' };
    expect(weakerSide({ set: left, right })).toBe(right);
  });
  it('returns the set itself when unsplit', () => {
    expect(weakerSide({ set: left, right: null })).toBe(left);
  });
});

describe('collapseToWeakerSide', () => {
  it('turns each pair into one set at its weaker side', () => {
    const sets = [
      { id: 'a', weightKg: 20, reps: 10, side: 'left' as const, parentSetId: null },
      { id: 'b', weightKg: 22.5, reps: 8, side: null, parentSetId: null },
      { id: 'r', weightKg: 20, reps: 7, side: 'right' as const, parentSetId: 'a' },
    ];
    expect(collapseToWeakerSide(sets)).toEqual([sets[2], sets[1]]);
  });
});

describe('splitTotalKg', () => {
  it('adds left and right', () => {
    expect(splitTotalKg({ weightKg: 20 }, { weightKg: 17.5 })).toBe(37.5);
  });
});
