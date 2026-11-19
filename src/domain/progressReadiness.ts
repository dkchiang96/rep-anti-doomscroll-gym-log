// Read-only progression nudge for the live screen: computed from existing
// sessions at render time, nothing stored. Driven by RPE (1–10, required
// per exercise since RPE logging was added) plus whether the most recent
// session hit the top of the target rep range.
//
// "Top of range" = every working set in that session reached
// target_reps_max, all at one weight. A split (left/right) set counts by its
// weaker side. Only 'working' sets are judged.
//
// Rules, on the most recent previous session:
//   RPE 9–10                          → nothing (it was hard: repeat it)
//   top of range, RPE ≤ 7             → add load (one session is enough)
//   top of range, RPE 8 or no RPE     → add load only if the session before
//                                        was also top of range at the same
//                                        weight (the original two-session rule)
//   not top of range, RPE ≤ 6         → push for more reps
//   anything else                     → nothing
// Sessions logged before RPE existed have rpe = null and fall back to the
// two-session rule.

import { collapseToWeakerSide, type SideTaggable } from './sidePairs';

export interface ReadinessSet extends SideTaggable {
  setType: 'working' | 'warmup' | 'dropset' | 'failure';
}

export interface ReadinessSession {
  sets: ReadinessSet[];
  rpe?: number | null;
}

export type ProgressAdvice = 'add_load_easy' | 'add_load_twice' | 'push_reps';

// The single working weight if every working set hit repsMax at it, else null.
function topOfRangeWeight(session: ReadinessSession, targetRepsMax: number): number | null {
  const working = collapseToWeakerSide(session.sets).filter((s) => s.setType === 'working');
  if (working.length === 0) return null;
  const weight = working[0].weightKg;
  for (const s of working) {
    if (s.weightKg !== weight || s.reps < targetRepsMax) return null;
  }
  return weight;
}

function hasWorkingSets(session: ReadinessSession): boolean {
  return session.sets.some((s) => s.setType === 'working');
}

/**
 * @param previousSessions this exercise's past sessions, most recent first,
 *   excluding the session in progress.
 */
export function progressAdvice(previousSessions: ReadinessSession[], targetRepsMax: number): ProgressAdvice | null {
  const latest = previousSessions[0];
  if (!latest) return null;
  const rpe = latest.rpe ?? null;
  if (rpe != null && rpe >= 9) return null;

  const top = topOfRangeWeight(latest, targetRepsMax);
  if (top != null) {
    if (rpe != null && rpe <= 7) return 'add_load_easy';
    const before = previousSessions[1];
    if (before && topOfRangeWeight(before, targetRepsMax) === top) return 'add_load_twice';
    return null;
  }

  if (rpe != null && rpe <= 6 && hasWorkingSets(latest)) return 'push_reps';
  return null;
}
