// Left/right tracking for unilateral per_side lifts. A split set is stored
// as two rows: the original tagged 'left', plus a 'right' row (appended
// after the exercise's other sets, so no reindexing) whose parentSetId
// points at the left row. A set with side = null is one shared value for
// both sides — every set logged before left/right tracking existed.
//
// Everywhere outside the split screen a pair counts as ONE logical set:
// shorthand shows both sides, while the chart, ghost pre-fill and the
// ready-to-progress check use the weaker side so progress is never
// overstated.

import type { EquipmentType, LoadConvention } from './loadConvention';

export type Side = 'left' | 'right';

export interface SideTaggable {
  id?: string;
  weightKg: number;
  reps: number;
  side?: Side | null;
  parentSetId?: string | null;
}

export interface SidePair<T> {
  /** The unsplit set, or the left side of a split one. */
  set: T;
  /** The right side, when this set has been split. */
  right: T | null;
}

// Only non-barbell per_side lifts can be split: a barbell's plates must
// match on both sides, so uneven sides on one bar isn't a real set.
export function supportsSideSplit(convention: LoadConvention, equipmentType: EquipmentType): boolean {
  return convention === 'per_side' && equipmentType !== 'barbell';
}

export function isRightSide(set: SideTaggable): boolean {
  return set.side === 'right';
}

// Folds right rows into their left partner, keeping input order for
// everything else. A right row whose left partner is missing (shouldn't
// happen, but data is never thrown away) is kept as its own set.
export function pairSides<T extends SideTaggable>(sets: T[]): SidePair<T>[] {
  const ids = new Set(sets.map((s) => s.id).filter((id): id is string => id != null));
  const rightByParent = new Map<string, T>();
  for (const s of sets) {
    if (isRightSide(s) && s.parentSetId != null && ids.has(s.parentSetId) && !rightByParent.has(s.parentSetId)) {
      rightByParent.set(s.parentSetId, s);
    }
  }
  const absorbed = new Set(rightByParent.values());

  const pairs: SidePair<T>[] = [];
  for (const s of sets) {
    if (absorbed.has(s)) continue;
    const right = s.id != null && s.side === 'left' ? (rightByParent.get(s.id) ?? null) : null;
    pairs.push({ set: s, right });
  }
  return pairs;
}

// Lower weight wins; at equal weight, fewer reps.
export function weakerSide<T extends SideTaggable>(pair: SidePair<T>): T {
  const { set, right } = pair;
  if (!right) return set;
  if (right.weightKg < set.weightKg) return right;
  if (right.weightKg > set.weightKg) return set;
  return right.reps < set.reps ? right : set;
}

// Collapses each pair to its weaker side — the view the chart, ghost
// pre-fill and readiness check all work from.
export function collapseToWeakerSide<T extends SideTaggable>(sets: T[]): T[] {
  return pairSides(sets).map(weakerSide);
}

// Combined load across both sides of a per_side split set.
export function splitTotalKg(left: { weightKg: number }, right: { weightKg: number }): number {
  return Math.round((left.weightKg + right.weightKg) * 100) / 100;
}
