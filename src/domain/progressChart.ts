// FR-7.2: default series is the top **working**-set weight and the reps at
// that set, per session, on a shared time axis. Warm-up sets are excluded.
// This never re-derives or re-converts weightKg — Session 2's importer
// already normalizes stored values to the exercise's locked convention, so
// re-touching it here is exactly how PRD risk P4 (an artificial 50% drop at
// a convention change) would sneak back in.

import { collapseToWeakerSide, type SideTaggable } from './sidePairs';

export type ChartSetType = 'working' | 'warmup' | 'dropset' | 'failure';

// A left/right split set (sidePairs.ts) counts once, at its weaker side, so
// the chart never overstates progress.
export interface ChartSet extends SideTaggable {
  weightKg: number;
  reps: number;
  setType: ChartSetType;
}

export interface ProgressSessionEntry {
  sessionId: string;
  startedAt: Date;
  sets: ChartSet[];
}

export interface ProgressPoint {
  sessionId: string;
  dateMs: number;
  topWeightKg: number;
  reps: number;
}

// Item 9: the Progress chart shows a fixed last-30-days window, not
// all-time history — filtered before buildProgressPoints ever sees the
// entries, so a session skipped for a stretch reads as a real gap within a
// stable 30-day frame instead of the chart's date axis silently
// contracting to whatever's actually there.
// Generic so callers holding richer entries (e.g. with endedAt) keep their type.
export function filterLastNDays<T extends ProgressSessionEntry>(entries: T[], nowMs: number, days = 30): T[] {
  const cutoff = nowMs - days * 24 * 60 * 60 * 1000;
  return entries.filter((e) => e.startedAt.getTime() >= cutoff && e.startedAt.getTime() <= nowMs);
}

export function buildProgressPoints(entries: ProgressSessionEntry[]): ProgressPoint[] {
  const points: ProgressPoint[] = [];

  for (const entry of entries) {
    const candidates = collapseToWeakerSide(entry.sets).filter((s) => s.setType !== 'warmup');
    if (candidates.length === 0) continue;

    let best = candidates[0];
    for (const s of candidates) {
      if (s.weightKg > best.weightKg || (s.weightKg === best.weightKg && s.reps > best.reps)) {
        best = s;
      }
    }

    points.push({
      sessionId: entry.sessionId,
      dateMs: entry.startedAt.getTime(),
      topWeightKg: best.weightKg,
      reps: best.reps,
    });
  }

  return points;
}
