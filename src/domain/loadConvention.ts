// FR-3.12: the load convention is always visible, with a derived read-only
// total beneath it. Exactly one source of truth per exercise — the total is
// never itself editable.

export type LoadConvention = 'per_side' | 'total' | 'bodyweight';
export type EquipmentType =
  | 'barbell'
  | 'dumbbell'
  | 'selectorised'
  | 'plate_loaded'
  | 'cable'
  | 'bodyweight'
  | 'other';

export interface LoadDisplay {
  conventionLabel: string;
  totalLine: string | null;
}

function formatKg(kg: number): string {
  return (Math.round(kg * 100) / 100).toString();
}

function conventionLabel(convention: LoadConvention, equipmentType: EquipmentType): string {
  if (convention === 'total') return 'TOTAL';
  if (convention === 'bodyweight') return 'BODYWEIGHT';
  // per_side
  return equipmentType === 'dumbbell' ? 'PER DUMBBELL' : 'PER SIDE';
}

export function deriveLoadDisplay(
  convention: LoadConvention,
  equipmentType: EquipmentType,
  weightKg: number,
): LoadDisplay {
  const label = conventionLabel(convention, equipmentType);
  if (convention === 'per_side') {
    return { conventionLabel: label, totalLine: `${formatKg(weightKg * 2)} kg total` };
  }
  return { conventionLabel: label, totalLine: null };
}
