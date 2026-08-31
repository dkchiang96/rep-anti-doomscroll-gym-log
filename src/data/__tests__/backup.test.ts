import { selectBackupsToDelete } from '../backup';

describe('selectBackupsToDelete', () => {
  it('keeps the 30 most recent (lexicographically greatest) filenames and returns the rest', () => {
    const filenames = Array.from({ length: 35 }, (_, i) => `rep-2026-01-${String(i + 1).padStart(2, '0')}.db`);
    const toDelete = selectBackupsToDelete(filenames);
    expect(toDelete).toHaveLength(5);
    // The 5 oldest (lowest date-suffix) should be exactly what's flagged for deletion.
    expect(toDelete.sort()).toEqual(filenames.slice(0, 5).sort());
  });

  it('deletes nothing when at or under the limit', () => {
    const filenames = Array.from({ length: 30 }, (_, i) => `rep-2026-01-${String(i + 1).padStart(2, '0')}.db`);
    expect(selectBackupsToDelete(filenames)).toHaveLength(0);
    expect(selectBackupsToDelete(filenames.slice(0, 3))).toHaveLength(0);
  });

  it('respects a custom max', () => {
    const filenames = ['a', 'b', 'c', 'd'];
    expect(selectBackupsToDelete(filenames, 2)).toEqual(['b', 'a']);
  });
});
