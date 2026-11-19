// Pure, tested builders for the two share-sheet export formats (FR-8 —
// portable copies of the training log, distinct from the raw SQLite backup
// in src/data/backup.ts). CSV is a flattened one-row-per-set view for
// spreadsheets; JSON is a structured dump of the full relational log.

import type { EquipmentType, LoadConvention } from './loadConvention';
import { splitTotalKg, type Side } from './sidePairs';

export interface ExportSetRow {
  sessionId: string;
  sessionStartedAt: Date;
  sessionNote: string | null;
  exerciseName: string;
  muscleGroup: string;
  equipmentType: EquipmentType;
  loadConvention: LoadConvention;
  weightKg: number;
  reps: number;
  setType: 'working' | 'warmup' | 'dropset' | 'failure';
  // Left/right tracking (sidePairs.ts). Optional so rows built without them
  // behave as unsplit, which is what every pre-existing set is.
  setId?: string;
  parentSetId?: string | null;
  side?: Side | null;
}

// Mirrors FR-3.12's derived total: per_side doubles the stored weight,
// everything else is already the full load. A left/right split set's total
// is left + right instead (partnerWeightKg = the other side's weight).
export function deriveTotalKg(convention: LoadConvention, weightKg: number, partnerWeightKg: number | null = null): number {
  if (partnerWeightKg != null) return splitTotalKg({ weightKg }, { weightKg: partnerWeightKg });
  return convention === 'per_side' ? weightKg * 2 : weightKg;
}

// For each row of a split pair, the other side's weight; null for unsplit
// rows (or a side whose partner isn't in the export).
function partnerWeights(rows: ExportSetRow[]): Map<ExportSetRow, number> {
  const byId = new Map<string, ExportSetRow>();
  for (const row of rows) if (row.setId) byId.set(row.setId, row);
  const result = new Map<ExportSetRow, number>();
  for (const row of rows) {
    if (row.side !== 'right' || !row.parentSetId) continue;
    const left = byId.get(row.parentSetId);
    if (!left || left.side !== 'left') continue;
    result.set(row, left.weightKg);
    result.set(left, row.weightKg);
  }
  return result;
}

function csvEscape(value: string | number): string {
  const s = String(value);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

const CSV_HEADER = [
  'date',
  'session_note',
  'exercise',
  'muscle_group',
  'equipment_type',
  'load_convention',
  'weight_kg',
  'total_kg',
  'reps',
  'set_type',
  'side',
];

// On a split pair, both rows carry the pair's left + right total — summing
// total_kg over a spreadsheet column counts a split set twice.
export function buildSetCsv(rows: ExportSetRow[]): string {
  const lines = [CSV_HEADER.join(',')];
  const partners = partnerWeights(rows);
  for (const row of rows) {
    lines.push(
      [
        isoDate(row.sessionStartedAt),
        csvEscape(row.sessionNote ?? ''),
        csvEscape(row.exerciseName),
        csvEscape(row.muscleGroup),
        row.equipmentType,
        row.loadConvention,
        row.weightKg,
        deriveTotalKg(row.loadConvention, row.weightKg, partners.get(row) ?? null),
        row.reps,
        row.setType,
        row.side ?? '',
      ].join(','),
    );
  }
  return lines.join('\n');
}

export interface FullExportData {
  exportedAt: Date;
  exercises: Record<string, unknown>[];
  programmes: Record<string, unknown>[];
  templates: Record<string, unknown>[];
  templateExercises: Record<string, unknown>[];
  sessions: Record<string, unknown>[];
  sessionExercises: Record<string, unknown>[];
  sets: Record<string, unknown>[];
}

export function buildFullJsonExport(data: FullExportData): string {
  return JSON.stringify(data, null, 2);
}
