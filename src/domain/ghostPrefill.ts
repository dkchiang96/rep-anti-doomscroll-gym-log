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
