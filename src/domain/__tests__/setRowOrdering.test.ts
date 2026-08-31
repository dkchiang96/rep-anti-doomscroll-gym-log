import { orderRowsForDisplay } from '../setRowOrdering';

describe('orderRowsForDisplay', () => {
  it('keeps already-sequential top-level rows in index order', () => {
    const rows = [
      { index: 0, parentIndex: null },
      { index: 1, parentIndex: null },
      { index: 2, parentIndex: null },
    ];
    expect(orderRowsForDisplay(rows)).toEqual([0, 1, 2]);
  });

  it('renders a drop set immediately after its parent even when appended at the end', () => {
    // Working sets at 0, 1, then a drop set attached to 0, appended last.
    const rows = [
      { index: 0, parentIndex: null },
      { index: 1, parentIndex: null },
      { index: 2, parentIndex: 0 },
    ];
    expect(orderRowsForDisplay(rows)).toEqual([0, 2, 1]);
  });

  it('orders multiple drop sets under the same parent by their own index', () => {
    const rows = [
      { index: 0, parentIndex: null },
      { index: 1, parentIndex: 0 },
      { index: 2, parentIndex: 0 },
    ];
    expect(orderRowsForDisplay(rows)).toEqual([0, 1, 2]);
  });

  it('falls back to top-level for an orphaned parentIndex', () => {
    const rows = [
      { index: 0, parentIndex: null },
      { index: 1, parentIndex: 99 },
    ];
    expect(orderRowsForDisplay(rows)).toEqual([0, 1]);
  });
});
