// Cardio / Hyrox stations. A cardio exercise records, per round, whichever
// of these its `track` list names (from the programme file — see
// docs/PROGRAMME-PROMPT.md). Rounds are ordinary set rows: weightKg doubles
// as the round's load and reps as its reps; distance/duration/calories have
// their own nullable columns.

export const CARDIO_METRICS = ['distance_m', 'time', 'reps', 'calories', 'load_kg'] as const;
export type CardioMetric = (typeof CARDIO_METRICS)[number];

export type ExerciseKind = 'strength' | 'cardio';

export interface CardioRound {
  weightKg: number;
  reps: number;
  distanceM?: number | null;
  durationSeconds?: number | null;
  calories?: number | null;
  setType: 'working' | 'warmup' | 'dropset' | 'failure';
}

export interface CardioTarget {
  sets: number;
  repsMin: number;
  repsMax: number;
  distanceM: number | null;
  timeSeconds: number | null;
  calories: number | null;
  loadKg: number | null;
}

export function isCardioMetric(v: unknown): v is CardioMetric {
  return typeof v === 'string' && (CARDIO_METRICS as readonly string[]).includes(v);
}

export function tracks(track: readonly CardioMetric[] | null | undefined, metric: CardioMetric): boolean {
  return track != null && track.includes(metric);
}

function trimNumber(n: number): string {
  return (Math.round(n * 100) / 100).toString();
}

// 245 → "4:05"; 3725 → "1:02:05".
export function formatDuration(totalSeconds: number): string {
  const s = Math.max(0, Math.round(totalSeconds));
  const hours = Math.floor(s / 3600);
  const minutes = Math.floor((s % 3600) / 60);
  const seconds = s % 60;
  const ss = String(seconds).padStart(2, '0');
  if (hours > 0) return `${hours}:${String(minutes).padStart(2, '0')}:${ss}`;
  return `${minutes}:${ss}`;
}

// Keypad time entry, typed as minutes.seconds: "4.05" and "4.5" are both
// 4:05, "4.50" is 4:50, "4" is 4:00. Seconds of 60 or more are rejected
// (null) rather than guessed at.
export function parseMinutesDotSeconds(text: string): number | null {
  const trimmed = text.trim();
  if (!/^\d+(\.\d{0,2})?$/.test(trimmed)) return null;
  const [minPart, secPart = ''] = trimmed.split('.');
  const minutes = Number(minPart);
  const seconds = secPart.length === 0 ? 0 : Number(secPart);
  if (!Number.isFinite(minutes) || !Number.isFinite(seconds) || seconds >= 60) return null;
  return minutes * 60 + seconds;
}

// Whole seconds between a lap's start and stop, never negative.
export function lapDurationSeconds(startedAtMs: number, stoppedAtMs: number): number {
  return Math.max(0, Math.round((stoppedAtMs - startedAtMs) / 1000));
}

// The green target slab: "4 × 1000 M", "4 × 20 REPS @ 6 KG", "5 × 15 CAL".
export function formatCardioTarget(target: CardioTarget, track: readonly CardioMetric[]): string {
  const parts: string[] = [];
  if (tracks(track, 'distance_m') && target.distanceM != null) parts.push(`${trimNumber(target.distanceM)} m`);
  if (tracks(track, 'reps') && target.repsMax > 0) {
    parts.push(target.repsMin === target.repsMax ? `${target.repsMax} reps` : `${target.repsMin}–${target.repsMax} reps`);
  }
  if (tracks(track, 'calories') && target.calories != null) parts.push(`${target.calories} cal`);
  if (tracks(track, 'time') && target.timeSeconds != null) parts.push(`in ${formatDuration(target.timeSeconds)}`);
  if (tracks(track, 'load_kg') && target.loadKg != null) parts.push(`@ ${trimNumber(target.loadKg)} kg`);
  return parts.length > 0 ? `${target.sets} × ${parts.join(' ')}` : `${target.sets} rounds`;
}

// History / Last 3 rounds line, same spirit as keepShorthand: consecutive
// rounds sharing distance/load/calories are grouped under one label, then
// each round shows its reps and/or time — "1000m 4:05 4:12",
// "6kg 20·1:10 20·1:15", "50m 102kg 0:48 0:52". Warm-up rounds excluded.
export function formatCardioShorthand(rounds: CardioRound[], track: readonly CardioMetric[]): string {
  const groups: { label: string; tokens: string[] }[] = [];
  for (const r of rounds) {
    if (r.setType === 'warmup') continue;
    const labelParts: string[] = [];
    if (tracks(track, 'distance_m') && r.distanceM != null) labelParts.push(`${trimNumber(r.distanceM)}m`);
    if (tracks(track, 'load_kg')) labelParts.push(`${trimNumber(r.weightKg)}kg`);
    if (tracks(track, 'calories') && r.calories != null) labelParts.push(`${r.calories}cal`);
    const tokenParts: string[] = [];
    if (tracks(track, 'reps')) tokenParts.push(String(r.reps));
    if (tracks(track, 'time') && r.durationSeconds != null) tokenParts.push(formatDuration(r.durationSeconds));
    const label = labelParts.join(' ');
    const token = tokenParts.length > 0 ? tokenParts.join('·') : '✓';
    const last = groups[groups.length - 1];
    if (last && last.label === label) last.tokens.push(token);
    else groups.push({ label, tokens: [token] });
  }
  return groups.map((g) => [g.label, ...g.tokens].filter((p) => p.length > 0).join(' ')).join(' ');
}
