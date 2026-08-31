// FR-3.8: drop sets render immediately under their preceding working set,
// indented — regardless of when they were added relative to other sets in
// the same exercise (a drop set is always appended after the exercise's
// other sets in storage order, but must still render attached to its
// parent, not at the bottom of the list).

export interface OrderableRow {
  index: number;
  parentIndex: number | null;
}

export function orderRowsForDisplay(rows: OrderableRow[]): number[] {
  const knownIndices = new Set(rows.map((r) => r.index));
  const childrenByParent = new Map<number, number[]>();
  const topLevel: number[] = [];

  for (const row of rows) {
    if (row.parentIndex != null && knownIndices.has(row.parentIndex)) {
      const children = childrenByParent.get(row.parentIndex) ?? [];
      children.push(row.index);
      childrenByParent.set(row.parentIndex, children);
    } else {
      topLevel.push(row.index);
    }
  }

  topLevel.sort((a, b) => a - b);
  for (const children of childrenByParent.values()) children.sort((a, b) => a - b);

  const order: number[] = [];
  for (const index of topLevel) {
    order.push(index);
    for (const child of childrenByParent.get(index) ?? []) order.push(child);
  }
  return order;
}
