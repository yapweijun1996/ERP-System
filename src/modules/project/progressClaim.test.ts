import { eq } from 'drizzle-orm';
import { describe, expect, it } from 'vitest';
import type { DB } from '../../data/db';
import { account, customer, glEntry, project, taxRule } from '../../data/schema';
import { freshDb, TEST_SCOPE as SCOPE } from '../../test/helpers';
import {
  createProgressClaim,
  postProgressClaim,
  ProjectProgressClaimError,
} from './progressClaim';

async function fixture(db: DB, overrides: Partial<{ status: string; customerId: number | null }> = {}) {
  const [cust] = await db.insert(customer).values({
    masterFn: SCOPE.masterFn,
    companyFn: SCOPE.companyFn,
    code: 'PC-CUSTOMER',
    name: 'Fictional Progress Claim Customer',
  }).returning({ id: customer.id });
  const [proj] = await db.insert(project).values({
    masterFn: SCOPE.masterFn,
    companyFn: SCOPE.companyFn,
    projectNo: 'PRJ-PC-1',
    name: 'Fictional Billable Project',
    customerId: overrides.customerId === undefined ? cust.id : overrides.customerId,
    managerName: 'Fictional Manager',
    status: overrides.status ?? 'open',
    startDate: '2026-01-01',
    contractValue: '100000',
  }).returning({ id: project.id, billedToDate: project.billedToDate });
  await db.insert(account).values([
    { masterFn: SCOPE.masterFn, companyFn: SCOPE.companyFn, code: '1100', name: 'AR', type: 'asset' },
    { masterFn: SCOPE.masterFn, companyFn: SCOPE.companyFn, code: '4000', name: 'Revenue', type: 'income' },
    { masterFn: SCOPE.masterFn, companyFn: SCOPE.companyFn, code: '2200', name: 'Output tax', type: 'liability' },
  ]);
  await db.insert(taxRule).values({
    masterFn: SCOPE.masterFn,
    companyFn: SCOPE.companyFn,
    taxRegime: 'GST',
    taxCode: 'SR',
    rate: '9',
    validFrom: '2024-01-01',
  });
  return proj;
}

describe('project progress claims', () => {
  it('creates a tax-snapshotted draft and posts balanced AR legs, incrementing billed_to_date', async () => {
    const db = await freshDb();
    const proj = await fixture(db);
    const draft = await createProgressClaim(db, SCOPE, {
      docNo: 'PC-1',
      projectId: proj.id,
      claimDate: '2026-02-01',
      description: 'Fictional milestone',
      netAmount: '20',
      taxCode: 'SR',
    });
    expect(draft).toMatchObject({ status: 'draft', totalAmount: '21.80' });
    const posted = await postProgressClaim(db, SCOPE, draft.id);
    expect(posted).toMatchObject({ status: 'posted', version: 2, totalAmount: '21.80' });
    const legs = await db.select().from(glEntry).where(eq(glEntry.journalRef, 'PC-1'));
    expect(legs.reduce((sum, row) => sum + Number(row.debit), 0)).toBe(21.8);
    expect(legs.reduce((sum, row) => sum + Number(row.credit), 0)).toBe(21.8);
    const [updated] = await db.select({ billedToDate: project.billedToDate })
      .from(project).where(eq(project.id, proj.id));
    expect(updated.billedToDate).toBe('20.00');
  });

  it('rejects duplicate posting without creating extra GL legs or double-counting billed_to_date', async () => {
    const db = await freshDb();
    const proj = await fixture(db);
    const draft = await createProgressClaim(db, SCOPE, {
      docNo: 'PC-ONCE',
      projectId: proj.id,
      claimDate: '2026-02-01',
      description: 'Fictional milestone',
      netAmount: '10',
      taxCode: 'SR',
    });
    await postProgressClaim(db, SCOPE, draft.id);
    await expect(postProgressClaim(db, SCOPE, draft.id)).rejects.toThrow(ProjectProgressClaimError);
    expect(await db.select().from(glEntry).where(eq(glEntry.journalRef, 'PC-ONCE'))).toHaveLength(3);
    const [updated] = await db.select({ billedToDate: project.billedToDate })
      .from(project).where(eq(project.id, proj.id));
    expect(updated.billedToDate).toBe('10.00');
  });

  it('rejects a claim against an Internal project (no customer)', async () => {
    const db = await freshDb();
    const proj = await fixture(db, { customerId: null });
    await expect(createProgressClaim(db, SCOPE, {
      docNo: 'PC-INTERNAL',
      projectId: proj.id,
      claimDate: '2026-02-01',
      description: 'Fictional milestone',
      netAmount: '10',
      taxCode: 'SR',
    })).rejects.toThrow('An Internal project (no customer) cannot be billed.');
  });

  it('rejects a claim against a completed project', async () => {
    const db = await freshDb();
    const proj = await fixture(db, { status: 'completed' });
    await expect(createProgressClaim(db, SCOPE, {
      docNo: 'PC-COMPLETED',
      projectId: proj.id,
      claimDate: '2026-02-01',
      description: 'Fictional milestone',
      netAmount: '10',
      taxCode: 'SR',
    })).rejects.toThrow('A completed project cannot receive a new progress claim.');
  });

  it('rejects a non-positive net amount', async () => {
    const db = await freshDb();
    const proj = await fixture(db);
    await expect(createProgressClaim(db, SCOPE, {
      docNo: 'PC-ZERO',
      projectId: proj.id,
      claimDate: '2026-02-01',
      description: 'Fictional milestone',
      netAmount: '0',
      taxCode: 'SR',
    })).rejects.toThrow('netAmount must be greater than zero.');
  });
});
