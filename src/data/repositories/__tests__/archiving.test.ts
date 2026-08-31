import { createTestDb } from '../../__tests__/testDb';
import {
  createPlateInventory,
  listPlateInventory,
  seedDefaultPlateInventoryIfEmpty,
} from '../plateInventoryRepository';
import { archiveProgramme, createProgramme, listProgrammes, unarchiveProgramme } from '../programmeRepository';
import { createSession, getSessionById } from '../sessionRepository';
import { archiveTemplate, createTemplate, listTemplates, unarchiveTemplate } from '../templateRepository';
import { createUser } from '../userRepository';

describe('archiving (FR-5.8)', () => {
  it('archives and restores a programme without touching its data', async () => {
    const db = createTestDb();
    const user = await createUser(db, { displayName: 'Test User' });
    if (!user) throw new Error('user was not created');

    const programme = await createProgramme(db, {
      userId: user.id,
      name: 'One Month One Focus',
      notes: null,
      isActive: false,
      isArchived: false,
      version: 1,
      source: 'manual',
    });
    if (!programme) throw new Error('programme was not created');

    await archiveProgramme(db, user.id, programme.id);
    let all = await listProgrammes(db, user.id);
    let found = all.find((p) => p.id === programme.id);
    expect(found?.isArchived).toBe(true);
    expect(found?.archivedAt).not.toBeNull();

    await unarchiveProgramme(db, user.id, programme.id);
    all = await listProgrammes(db, user.id);
    found = all.find((p) => p.id === programme.id);
    expect(found?.isArchived).toBe(false);
    expect(found?.archivedAt).toBeNull();
  });

  it('archiving a template never deletes it, and a session built from it keeps its link', async () => {
    const db = createTestDb();
    const user = await createUser(db, { displayName: 'Test User' });
    if (!user) throw new Error('user was not created');

    const template = await createTemplate(db, {
      userId: user.id,
      programmeId: null,
      name: 'Push',
      dayHint: null,
      orderIndex: 0,
      isArchived: false,
    });
    if (!template) throw new Error('template was not created');

    const session = await createSession(db, {
      userId: user.id,
      templateId: template.id,
      programmeId: null,
      startedAt: new Date(),
      endedAt: new Date(),
      note: null,
      rawImportText: null,
      source: 'manual',
    });
    if (!session) throw new Error('session was not created');

    await archiveTemplate(db, user.id, template.id);

    const stillListed = (await listTemplates(db, user.id)).find((t) => t.id === template.id);
    expect(stillListed?.isArchived).toBe(true);

    // The historical session's link survives archiving untouched.
    const reloadedSession = await getSessionById(db, user.id, session.id);
    expect(reloadedSession?.templateId).toBe(template.id);

    await unarchiveTemplate(db, user.id, template.id);
    const restored = (await listTemplates(db, user.id)).find((t) => t.id === template.id);
    expect(restored?.isArchived).toBe(false);
    expect(restored?.archivedAt).toBeNull();
  });
});

describe('seedDefaultPlateInventoryIfEmpty', () => {
  it('seeds the FR-3.13.3/.5 default denominations with zero quantity, and never guesses a quantity', async () => {
    const db = createTestDb();
    const user = await createUser(db, { displayName: 'Test User' });
    if (!user) throw new Error('user was not created');

    const seeded = await seedDefaultPlateInventoryIfEmpty(db, user.id);
    expect(seeded).toHaveLength(7);
    expect(seeded.every((p) => p.quantityPerSide === 0)).toBe(true);
    expect(seeded.map((p) => p.denominationKg).sort((a, b) => a - b)).toEqual([1.25, 2.5, 5, 10, 15, 20, 25]);
  });

  it('does not reseed or duplicate an inventory the user already configured', async () => {
    const db = createTestDb();
    const user = await createUser(db, { displayName: 'Test User' });
    if (!user) throw new Error('user was not created');

    await createPlateInventory(db, {
      userId: user.id,
      gymLabel: 'home',
      denominationKg: 20,
      colourHex: '#2C6BAC',
      quantityPerSide: 2,
      isActive: true,
    });

    const result = await seedDefaultPlateInventoryIfEmpty(db, user.id);
    expect(result).toHaveLength(1);
    const all = await listPlateInventory(db, user.id);
    expect(all).toHaveLength(1);
  });
});
