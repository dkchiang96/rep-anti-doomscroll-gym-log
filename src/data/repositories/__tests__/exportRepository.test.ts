import { buildConventionQuestions, conventionQuestionsToDecisions } from '../../../domain/conventionReconciliation';
import { parseKeepExport } from '../../../domain/keepParser';
import { createTestDb } from '../../__tests__/testDb';
import { importKeepSessions } from '../importRepository';
import { listFullExportData, listSetExportRows } from '../exportRepository';
import { createUser } from '../userRepository';

const KEEP_TEXT = `
1 Jun
bench press - 60kg 8 8 7
`;

const TWO_SESSION_KEEP_TEXT = `
1 Jun
bench press - 60kg 8 8 7
15 Aug
bench press - 65kg 8 8 7
`;

describe('exportRepository', () => {
  it('scopes both export queries to sessions started on or after `since`', async () => {
    const db = createTestDb();
    const owner = await createUser(db, { displayName: 'Owner' });
    if (!owner) throw new Error('user was not created');

    const { sessions } = parseKeepExport(TWO_SESSION_KEEP_TEXT, { year: 2025 });
    const questions = buildConventionQuestions(sessions);
    const decisions = conventionQuestionsToDecisions(questions);
    await importKeepSessions(db, owner.id, sessions, decisions);

    const since = new Date(Date.UTC(2025, 6, 1)); // 1 Jul 2025 — excludes the 1 Jun session

    const rows = await listSetExportRows(db, owner.id, since);
    expect(rows).toHaveLength(3);
    expect(rows.every((r) => r.weightKg === 65)).toBe(true);

    const fullData = await listFullExportData(db, owner.id, since);
    expect(fullData.sessions).toHaveLength(1);
    expect(fullData.sets).toHaveLength(3);
    expect(fullData.sets.every((s) => (s as { weightKg: number }).weightKg === 65)).toBe(true);
    // Reference data is never date-filtered.
    expect(fullData.exercises).toHaveLength(1);

    const allRows = await listSetExportRows(db, owner.id);
    expect(allRows).toHaveLength(6);
    const allFullData = await listFullExportData(db, owner.id);
    expect(allFullData.sessions).toHaveLength(2);
    expect(allFullData.sets).toHaveLength(6);
  });

  it('scopes both export queries to the requesting user only', async () => {
    const db = createTestDb();
    const owner = await createUser(db, { displayName: 'Owner' });
    const other = await createUser(db, { displayName: 'Other' });
    if (!owner || !other) throw new Error('users were not created');

    const { sessions } = parseKeepExport(KEEP_TEXT, { year: 2025 });
    const questions = buildConventionQuestions(sessions);
    const decisions = conventionQuestionsToDecisions(questions);
    await importKeepSessions(db, owner.id, sessions, decisions);

    const rows = await listSetExportRows(db, owner.id);
    expect(rows).toHaveLength(3);
    expect(rows.every((r) => r.exerciseName === 'bench press')).toBe(true);
    expect(rows[0].weightKg).toBe(60);

    const otherRows = await listSetExportRows(db, other.id);
    expect(otherRows).toHaveLength(0);

    const fullData = await listFullExportData(db, owner.id);
    expect(fullData.sets).toHaveLength(3);
    expect(fullData.exercises).toHaveLength(1);
    expect(fullData.sessions).toHaveLength(1);

    const otherFullData = await listFullExportData(db, other.id);
    expect(otherFullData.sets).toHaveLength(0);
    expect(otherFullData.exercises).toHaveLength(0);
  });
});
