import { createTestDb } from '../../__tests__/testDb';
import { createProgramme, getActiveProgramme } from '../programmeRepository';
import { createSession, endSession, getActiveSession } from '../sessionRepository';
import { archiveTemplate, createTemplate, listTemplatesForProgramme } from '../templateRepository';
import { createUser } from '../userRepository';

const HOUR_MS = 60 * 60 * 1000;

describe('getActiveSession', () => {
  it('returns null when there is no session', async () => {
    const db = createTestDb();
    const user = await createUser(db, { displayName: 'Test User' });
    if (!user) throw new Error('user was not created');

    expect(await getActiveSession(db, user.id)).toBeNull();
  });

  it('returns an in-progress session started under 6 hours ago', async () => {
    const db = createTestDb();
    const user = await createUser(db, { displayName: 'Test User' });
    if (!user) throw new Error('user was not created');

    const startedAt = new Date(Date.now() - 2 * HOUR_MS);
    const session = await createSession(db, {
      userId: user.id,
      templateId: null,
      programmeId: null,
      startedAt,
      endedAt: null,
      note: null,
      source: 'manual',
    });
    if (!session) throw new Error('session was not created');

    const active = await getActiveSession(db, user.id);
    expect(active?.id).toBe(session.id);
  });

  it('does not return a session that has already been ended', async () => {
    const db = createTestDb();
    const user = await createUser(db, { displayName: 'Test User' });
    if (!user) throw new Error('user was not created');

    const session = await createSession(db, {
      userId: user.id,
      templateId: null,
      programmeId: null,
      startedAt: new Date(),
      endedAt: null,
      note: null,
      source: 'manual',
    });
    if (!session) throw new Error('session was not created');
    await endSession(db, user.id, session.id);

    expect(await getActiveSession(db, user.id)).toBeNull();
  });

  it('does not restore an in-progress session older than 6 hours', async () => {
    const db = createTestDb();
    const user = await createUser(db, { displayName: 'Test User' });
    if (!user) throw new Error('user was not created');

    const startedAt = new Date(Date.now() - 7 * HOUR_MS);
    const session = await createSession(db, {
      userId: user.id,
      templateId: null,
      programmeId: null,
      startedAt,
      endedAt: null,
      note: null,
      source: 'manual',
    });
    if (!session) throw new Error('session was not created');

    expect(await getActiveSession(db, user.id)).toBeNull();
  });
});

describe('getActiveProgramme', () => {
  it('returns the programme with isActive set, ignoring inactive ones', async () => {
    const db = createTestDb();
    const user = await createUser(db, { displayName: 'Test User' });
    if (!user) throw new Error('user was not created');

    await createProgramme(db, { userId: user.id, name: 'Old cycle', notes: null, isActive: false, source: 'manual' });
    const active = await createProgramme(db, {
      userId: user.id,
      name: 'Current cycle',
      notes: null,
      isActive: true,
      source: 'manual',
    });
    if (!active) throw new Error('programme was not created');

    const result = await getActiveProgramme(db, user.id);
    expect(result?.id).toBe(active.id);
  });

  it('returns null when no programme is active', async () => {
    const db = createTestDb();
    const user = await createUser(db, { displayName: 'Test User' });
    if (!user) throw new Error('user was not created');

    await createProgramme(db, { userId: user.id, name: 'Old cycle', notes: null, isActive: false, source: 'manual' });

    expect(await getActiveProgramme(db, user.id)).toBeNull();
  });
});

describe('listTemplatesForProgramme', () => {
  it('orders templates by orderIndex and excludes archived or other-programme templates', async () => {
    const db = createTestDb();
    const user = await createUser(db, { displayName: 'Test User' });
    if (!user) throw new Error('user was not created');

    const programme = await createProgramme(db, {
      userId: user.id,
      name: 'Current cycle',
      notes: null,
      isActive: true,
      source: 'manual',
    });
    const otherProgramme = await createProgramme(db, {
      userId: user.id,
      name: 'Other cycle',
      notes: null,
      isActive: false,
      source: 'manual',
    });
    if (!programme || !otherProgramme) throw new Error('programmes were not created');

    const legs = await createTemplate(db, {
      userId: user.id,
      programmeId: programme.id,
      name: 'LEGS',
      dayHint: null,
      orderIndex: 1,
    });
    const push = await createTemplate(db, {
      userId: user.id,
      programmeId: programme.id,
      name: 'PUSH',
      dayHint: null,
      orderIndex: 0,
    });
    const archived = await createTemplate(db, {
      userId: user.id,
      programmeId: programme.id,
      name: 'RETIRED',
      dayHint: null,
      orderIndex: 2,
    });
    await createTemplate(db, {
      userId: user.id,
      programmeId: otherProgramme.id,
      name: 'FROM OTHER PROGRAMME',
      dayHint: null,
      orderIndex: 0,
    });
    if (!legs || !push || !archived) throw new Error('templates were not created');
    await archiveTemplate(db, user.id, archived.id);

    const result = await listTemplatesForProgramme(db, user.id, programme.id);
    expect(result.map((t) => t.name)).toEqual(['PUSH', 'LEGS']);
  });
});
