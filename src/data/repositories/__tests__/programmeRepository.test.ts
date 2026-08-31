import { createTestDb } from '../../__tests__/testDb';
import { createProgramme, listProgrammes, setActiveProgramme } from '../programmeRepository';
import { createUser } from '../userRepository';

describe('setActiveProgramme', () => {
  it('activates exactly one programme, deactivating any previously active one', async () => {
    const db = createTestDb();
    const user = await createUser(db, { displayName: 'Test User' });
    if (!user) throw new Error('user was not created');

    const a = await createProgramme(db, {
      userId: user.id,
      name: 'A',
      notes: null,
      isActive: true,
      isArchived: false,
      version: 1,
      source: 'manual',
    });
    const b = await createProgramme(db, {
      userId: user.id,
      name: 'B',
      notes: null,
      isActive: false,
      isArchived: false,
      version: 1,
      source: 'manual',
    });
    if (!a || !b) throw new Error('programmes were not created');

    await setActiveProgramme(db, user.id, b.id);

    const all = await listProgrammes(db, user.id);
    const activeIds = all.filter((p) => p.isActive).map((p) => p.id);
    expect(activeIds).toEqual([b.id]);
  });
});
