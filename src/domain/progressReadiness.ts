// Read-only "ready to progress" flag for the live screen: computed from
// existing sessions at render time, nothing stored.
//
// Fires when each of the two most recent previous sessions hit the top of
// the target rep range on every working set, all at one weight, and that
// weight is the same in both sessions. A split (left/right) set counts by
// its weaker side. Only 'working' sets are judged — warm-ups, drop sets and
// failure sets don't say whether the working weight is too light.

import { collapseToWeakerSide, type SideTaggable } from './sidePairs';

export interface ReadinessSet extends SideTaggable {
  setType: 'working' | 'warmup' | 'dropset' | 'failure';
}

export interface ReadinessSession {
  sets: ReadinessSet[];
}

// Returns the single working weight if every working set hit repsMax at it,
// otherwise null.
function topOfRangeWeight(session: ReadinessSession, targetRepsMax: number): number | null {
  const working = collapseToWeakerSide(session.sets).filter((s) => s.setType === 'working');
  if (working.length === 0) return null;
  const weight = working[0].weightKg;
  for (const s of working) {
    if (s.weightKg !== weight || s.reps < targetRepsMax) return null;
  }
  return weight;
}

/**
 * @param previousSessions this exercise's past sessions, most recent first,
 *   excluding the session in progress.
 */
export function isReadyToProgress(previousSessions: ReadinessSession[], targetRepsMax: number): boolean {
  if (previousSessions.length < 2) return false;
  const latest = topOfRangeWeight(previousSessions[0], targetRepsMax);
  if (latest == null) return false;
  const before = topOfRangeWeight(previousSessions[1], targetRepsMax);
  return before === latest;
}
