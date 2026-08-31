import { calculatePlatesForTarget, calculateTotalFromPlates, DEFAULT_PLATE_DENOMINATIONS, type PlateInventoryItem } from '../plates';

const inventory: PlateInventoryItem[] = DEFAULT_PLATE_DENOMINATIONS.map((d) => ({
  ...d,
  quantityPerSide: 4,
}));

describe('calculatePlatesForTarget', () => {
  it('matches the PRD worked example: 80kg on a 20kg bar -> 25 + 5 per side', () => {
    const result = calculatePlatesForTarget(80, 20, 'total', inventory);
    expect(result.platesPerSide).toEqual([
      { denominationKg: 25, colourHex: expect.any(String), count: 1 },
      { denominationKg: 5, colourHex: expect.any(String), count: 1 },
    ]);
    expect(result.perSideKg).toBe(30);
    expect(result.achievedTotalKg).toBe(80);
    expect(result.deltaKg).toBe(0);
  });

  it('reports the closest achievable load with an explicit delta when the target is unreachable', () => {
    // needed per side = (83 - 20) / 2 = 31.5; 25+5+1.25=31.25 beats 30 (0.25 vs 1.5 away)
    const result = calculatePlatesForTarget(83, 20, 'total', inventory);
    expect(result.perSideKg).toBe(31.25);
    expect(result.achievedTotalKg).toBe(82.5);
    expect(result.deltaKg).toBe(-0.5);
  });

  it('respects quantity limits instead of assuming unlimited plates', () => {
    const limited: PlateInventoryItem[] = [{ denominationKg: 25, colourHex: '#E2231A', quantityPerSide: 1 }];
    // needed per side = (130 - 20) / 2 = 55, but only one 25kg plate per side exists
    const result = calculatePlatesForTarget(130, 20, 'total', limited);
    expect(result.perSideKg).toBe(25);
    expect(result.achievedTotalKg).toBe(70);
    expect(result.deltaKg).toBe(-60);
  });

  it('computes one side directly for a per_side convention machine, per FR-3.13.6', () => {
    const result = calculatePlatesForTarget(15, 0, 'per_side', inventory);
    expect(result.perSideKg).toBe(15);
    expect(result.platesPerSide).toEqual([{ denominationKg: 15, colourHex: expect.any(String), count: 1 }]);
    expect(result.achievedTotalKg).toBe(15);
    expect(result.deltaKg).toBe(0);
  });

  it('never crashes on an unconfigured inventory, and surfaces the full gap as delta', () => {
    const empty: PlateInventoryItem[] = DEFAULT_PLATE_DENOMINATIONS.map((d) => ({ ...d, quantityPerSide: 0 }));
    const result = calculatePlatesForTarget(80, 20, 'total', empty);
    expect(result.platesPerSide).toEqual([]);
    expect(result.perSideKg).toBe(0);
    expect(result.achievedTotalKg).toBe(20);
    expect(result.deltaKg).toBe(-60);
  });

  it('clamps a target below the bar weight rather than going negative', () => {
    const result = calculatePlatesForTarget(10, 20, 'total', inventory);
    expect(result.perSideKg).toBe(0);
    expect(result.achievedTotalKg).toBe(20);
    expect(result.deltaKg).toBe(10);
  });
});

describe('calculateTotalFromPlates', () => {
  it('reads off the total from plates already on the bar (reverse mode)', () => {
    const total = calculateTotalFromPlates(
      [
        { denominationKg: 25, count: 1 },
        { denominationKg: 5, count: 1 },
      ],
      20,
      'total',
    );
    expect(total).toBe(80);
  });

  it('does not double the base weight for a per_side convention machine', () => {
    const total = calculateTotalFromPlates([{ denominationKg: 15, count: 1 }], 0, 'per_side');
    expect(total).toBe(15);
  });
});
