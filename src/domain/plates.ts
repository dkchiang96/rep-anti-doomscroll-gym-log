// FR-3.13: plate maths. Pure, no I/O — the calculator UI and the inventory
// seeder both consume this.

export type PlateConvention = 'per_side' | 'total';

export interface PlateInventoryItem {
  denominationKg: number;
  colourHex: string;
  quantityPerSide: number;
}

export interface PlateBreakdownEntry {
  denominationKg: number;
  colourHex: string;
  count: number;
}

export interface PlateCalculationResult {
  /** Largest denomination first. */
  platesPerSide: PlateBreakdownEntry[];
  perSideKg: number;
  achievedTotalKg: number;
  /** achievedTotalKg - targetKg. Zero means the target is exactly achievable. */
  deltaKg: number;
}

// FR-3.13.3/.5: the standard commercial-gym denominations, in the IWF colour
// convention. Quantity is deliberately left at 0 — how many of each plate a
// given gym actually has is not something this app should guess (CLAUDE.md
// invariant), so nothing is usable until the user records their own counts.
export const DEFAULT_PLATE_DENOMINATIONS: readonly { denominationKg: number; colourHex: string }[] = [
  { denominationKg: 25, colourHex: '#E2231A' },
  { denominationKg: 20, colourHex: '#2C6BAC' },
  { denominationKg: 15, colourHex: '#F4C430' },
  { denominationKg: 10, colourHex: '#3C8D40' },
  { denominationKg: 5, colourHex: '#FFFFFF' },
  { denominationKg: 2.5, colourHex: '#2B2B2B' },
  { denominationKg: 1.25, colourHex: '#C7C7C7' },
];

const SCALE = 100; // hundredths of a kg — avoids float drift when summing plates.

function scale(kg: number): number {
  return Math.round(kg * SCALE);
}

function unscale(v: number): number {
  return v / SCALE;
}

function round2(kg: number): number {
  return Math.round(kg * 100) / 100;
}

/**
 * FR-3.13.1/.3/.6: given a target weight (already in the exercise's own
 * convention — a per_side value if per_side, a combined value if total),
 * find the closest achievable per-side plate load from the owned inventory
 * and report it largest-denomination-first, with an explicit delta if the
 * target can't be hit exactly. Bar/base weight is required (no default) —
 * callers must block on `barWeightKg == null` before calling this.
 */
export function calculatePlatesForTarget(
  targetKg: number,
  barWeightKg: number,
  convention: PlateConvention,
  inventory: PlateInventoryItem[],
): PlateCalculationResult {
  const active = [...inventory]
    .filter((p) => p.quantityPerSide > 0)
    .sort((a, b) => b.denominationKg - a.denominationKg);

  const perSideNeededKg = convention === 'total' ? (targetKg - barWeightKg) / 2 : targetKg - barWeightKg;
  const neededScaled = Math.max(0, scale(perSideNeededKg));

  const denomScaled = active.map((p) => scale(p.denominationKg));
  const quantities = active.map((p) => p.quantityPerSide);

  // Bounded knapsack over achievable per-side sums, computed as a suffix
  // series (reachableFrom[i] = sums reachable using denominations[i:] only).
  // Exact search (not greedy) so "closest achievable" is actually closest.
  const reachableFrom: Set<number>[] = [new Set([0])];
  for (let i = active.length - 1; i >= 0; i--) {
    const next = new Set(reachableFrom[0]);
    for (const sum of reachableFrom[0]) {
      for (let c = 1; c <= quantities[i]; c++) {
        next.add(sum + denomScaled[i] * c);
      }
    }
    reachableFrom.unshift(next);
  }

  let bestSum = 0;
  let bestDiff = Infinity;
  for (const sum of reachableFrom[0]) {
    const diff = Math.abs(sum - neededScaled);
    if (diff < bestDiff || (diff === bestDiff && sum < bestSum)) {
      bestDiff = diff;
      bestSum = sum;
    }
  }

  // Reconstruct the chosen sum greedily largest-denomination-first — the
  // conventional way a lifter actually loads a bar (FR-3.13.1) — while
  // using reachableFrom to guarantee the remainder is still completable.
  const counts = active.map(() => 0);
  let remaining = bestSum;
  for (let i = 0; i < active.length; i++) {
    const maxByQuantity = Math.min(quantities[i], denomScaled[i] > 0 ? Math.floor(remaining / denomScaled[i]) : 0);
    for (let c = maxByQuantity; c >= 0; c--) {
      if (reachableFrom[i + 1].has(remaining - denomScaled[i] * c)) {
        counts[i] = c;
        remaining -= denomScaled[i] * c;
        break;
      }
    }
  }

  const platesPerSide: PlateBreakdownEntry[] = active
    .map((p, i) => ({ denominationKg: p.denominationKg, colourHex: p.colourHex, count: counts[i] }))
    .filter((p) => p.count > 0);

  const perSideKg = unscale(bestSum);
  const achievedTotalKg = convention === 'total' ? perSideKg * 2 + barWeightKg : perSideKg + barWeightKg;

  return {
    platesPerSide,
    perSideKg: round2(perSideKg),
    achievedTotalKg: round2(achievedTotalKg),
    deltaKg: round2(achievedTotalKg - targetKg),
  };
}

/** FR-3.13.4: reverse mode — plates already on the bar, read off the total. */
export function calculateTotalFromPlates(
  selectedCounts: { denominationKg: number; count: number }[],
  barWeightKg: number,
  convention: PlateConvention,
): number {
  const perSideKg = selectedCounts.reduce((sum, p) => sum + p.denominationKg * p.count, 0);
  const total = convention === 'total' ? perSideKg * 2 + barWeightKg : perSideKg + barWeightKg;
  return round2(total);
}
