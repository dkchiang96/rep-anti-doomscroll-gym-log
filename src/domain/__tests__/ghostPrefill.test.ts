import { buildGhostSets, resolveFallbackSet, type PreviousSet } from '../ghostPrefill';

describe('buildGhostSets', () => {
  it('returns an empty list when there is no previous session', () => {
    expect(buildGhostSets([])).toEqual([]);
  });

  it('orders by index regardless of input order and re-indexes from 0', () => {
    const previous: PreviousSet[] = [
      { id: 'b', index: 1, weightKg: 20, reps: 8, setType: 'working', parentSetId: null },
      { id: 'a', index: 0, weightKg: 20, reps: 10, setType: 'working', parentSetId: null },
    ];
    expect(buildGhostSets(previous).map((g) => [g.index, g.sourceSetId])).toEqual([
      [0, 'a'],
      [1, 'b'],
    ]);
  });

  it('includes warm-up sets in the pre-fill', () => {
    const previous: PreviousSet[] = [
      { id: 'w', index: 0, weightKg: 20, reps: 12, setType: 'warmup', parentSetId: null },
      { id: 'a', index: 1, weightKg: 60, reps: 10, setType: 'working', parentSetId: null },
    ];
    const ghosts = buildGhostSets(previous);
    expect(ghosts[0].setType).toBe('warmup');
  });

  it('re-points a drop set at its parent\'s new position, not the old DB id', () => {
    const previous: PreviousSet[] = [
      { id: 'work-1', index: 0, weightKg: 22.5, reps: 10, setType: 'working', parentSetId: null },
      { id: 'drop-1', index: 1, weightKg: 12.5, reps: 10, setType: 'dropset', parentSetId: 'work-1' },
    ];
    const ghosts = buildGhostSets(previous);
    expect(ghosts[1].parentIndex).toBe(0);
  });
});

describe('resolveFallbackSet', () => {
  it('falls back to 10kg/10 reps when there is no ghost history at all', () => {
    expect(resolveFallbackSet([])).toEqual({ weightKg: 10, reps: 10 });
  });

  it('uses the last ghost set\'s weight/reps when history exists', () => {
    const ghosts = buildGhostSets([
      { id: 'a', index: 0, weightKg: 20, reps: 10, setType: 'working', parentSetId: null },
      { id: 'b', index: 1, weightKg: 22.5, reps: 8, setType: 'working', parentSetId: null },
    ]);
    expect(resolveFallbackSet(ghosts)).toEqual({ weightKg: 22.5, reps: 8 });
  });
});
