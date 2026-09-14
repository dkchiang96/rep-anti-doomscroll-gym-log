// FR-3.1/FR-3.2/FR-3.7: last session's sets become this session's muted,
// editable pre-fill, in the same order and count — warm-ups included
// (patterns repeat), drop sets included and still attached to their
// preceding working set.

export type SetType = 'working' | 'warmup' | 'dropset' | 'failure';

export interface PreviousSet {
  id: string;
  index: number;
  weightKg: number;
  reps: number;
  setType: SetType;
  parentSetId: string | null;
}

export interface GhostSet {
  sourceSetId: string;
  index: number;
  weightKg: number;
  reps: number;
  setType: SetType;
  // Position (within this ghost list) of the set this one is a drop set
  // from. The source set's own DB id is meaningless in a new session.
  parentIndex: number | null;
}

export function buildGhostSets(previousSets: PreviousSet[]): GhostSet[] {
  const ordered = [...previousSets].sort((a, b) => a.index - b.index);
  const positionById = new Map(ordered.map((s, i) => [s.id, i]));

  return ordered.map((s, i) => ({
    sourceSetId: s.id,
    index: i,
    weightKg: s.weightKg,
    reps: s.reps,
    setType: s.setType,
    parentIndex: s.parentSetId != null ? (positionById.get(s.parentSetId) ?? null) : null,
  }));
}

// Punch-list item 6: a row with no real ghost data behind it (no previous
// occurrence of this exercise at all) used to default to 0kg/8 reps, which
// meant tapping through both fields on every first-time exercise. 10kg/10
// reps is a starting point close enough to not need adjusting for most
// exercises, cutting that tapping down. When ghost history does exist, the
// last logged set is still the fallback — this only changes what a row with
// nothing behind it starts at.
export const FALLBACK_WEIGHT_KG = 10;
export const FALLBACK_REPS = 10;

export function resolveFallbackSet(ghostSets: GhostSet[]): { weightKg: number; reps: number } {
  const last = ghostSets[ghostSets.length - 1];
  if (last) return { weightKg: last.weightKg, reps: last.reps };
  return { weightKg: FALLBACK_WEIGHT_KG, reps: FALLBACK_REPS };
}
