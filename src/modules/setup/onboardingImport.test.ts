import { eq } from 'drizzle-orm';
import { describe, expect, it } from 'vitest';
import { appUser, customer } from '../../data/schema';
import { seedDemo } from '../../data/seed';
import { freshDb } from '../../test/helpers';
import { commitOnboardingImport, preflightOnboardingImport } from './onboardingImport';

describe('onboarding import pipeline', () => {
  async function fixture() {
    const db = await freshDb();
    await seedDemo(db);
    const [admin] = await db.select().from(appUser).where(eq(appUser.username, 'admin'));
    return {
      db,
      session: {
        userId: admin.userId, masterFn: 'M1', activeCompanyFn: 'C-SG',
        username: admin.username, email: admin.email, fullName: admin.fullName,
      },
    };
  }

  it('preflights, commits atomically and replays the same source without duplicate rows', async () => {
    const { db, session } = await fixture();
    const buffer = Buffer.from('code,name,industry\nUAT-C001,UAT Customer,Technology\n');
    const checked = await preflightOnboardingImport(db, session, {
      target: 'customer', format: 'csv', fileName: 'customers.csv', buffer,
    }, 'preflight');
    expect(checked).toMatchObject({ status: 'validated', totalRows: 1, errorRows: 0 });
    const committed = await commitOnboardingImport(
      db, session, checked.id, checked.version, false, 'commit',
    );
    expect(committed).toMatchObject({ status: 'committed', importedRows: 1 });
    expect(await db.select().from(customer).where(eq(customer.code, 'UAT-C001'))).toHaveLength(1);
    const replay = await preflightOnboardingImport(db, session, {
      target: 'customer', format: 'csv', fileName: 'customers.csv', buffer,
    }, 'replay');
    expect(replay.replayed).toBe(true);
  });

  it('rejects an unbalanced GL file before any ledger write can be committed', async () => {
    const { db, session } = await fixture();
    const checked = await preflightOnboardingImport(db, session, {
      target: 'gl', format: 'csv', fileName: 'gl.csv',
      buffer: Buffer.from('journalRef,accountCode,debit,credit\nOPEN-1,1100,100,0\n'),
    }, 'invalid-gl');
    expect(checked).toMatchObject({ status: 'invalid', errorRows: 1 });
    await expect(commitOnboardingImport(db, session, checked.id, checked.version, false, 'blocked'))
      .rejects.toMatchObject({ code: 'import_has_errors' });
  });
});
