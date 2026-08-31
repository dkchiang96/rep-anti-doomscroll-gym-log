// Pure, tested builders for the two share-sheet export formats (FR-8 —
// portable copies of the training log, distinct from the raw SQLite backup
// in src/data/backup.ts). CSV is a flattened one-row-per-set view for
// spreadsheets; JSON is a structured dump of the full relational log.

import type { EquipmentType, LoadConvention } from './loadConvention';

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
}

// Mirrors FR-3.12's derived total: per_side doubles the stored weight,
// everything else is already the full load.
export function deriveTotalKg(convention: LoadConvention, weightKg: number): number {
  return convention === 'per_side' ? weightKg * 2 : weightKg;
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
];

export function buildSetCsv(rows: ExportSetRow[]): string {
  const lines = [CSV_HEADER.join(',')];
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
        deriveTotalKg(row.loadConvention, row.weightKg),
        row.reps,
        row.setType,
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
