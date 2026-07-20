import { eq } from 'drizzle-orm';
import { describe, expect, it } from 'vitest';
import type { DB } from '../../data/db';
import { account, customer, glEntry, project, taxRule } from '../../data/schema';
import { freshDb, TEST_SCOPE as SCOPE } from '../../test/helpers';
import { createProgressClaim, postProgressClaim } from '../project/progressClaim';
import { createBankReceipt, BankReceiptError } from './bankReceipt';

async function fixture(db: DB) {
  const [cust] = await db.insert(customer).values({
    masterFn: SCOPE.masterFn, companyFn: SCOPE.companyFn,
    code: 'BR-CUSTOMER', name: 'Fictional Bank Receipt Customer',
  }).returning({ id: customer.id });
  const [proj] = await db.insert(project).values({
    masterFn: SCOPE.masterFn, companyFn: SCOPE.companyFn, projectNo: 'PRJ-BR-1',
    name: 'Fictional Billable Project', customerId: cust.id,
    managerName: 'Fictional Manager', startDate: '2026-01-01', contractValue: '100000',
  }).returning({ id: project.id });
  await db.insert(account).values([
    { masterFn: SCOPE.masterFn, companyFn: SCOPE.companyFn, code: '1000', name: 'Cash', type: 'asset' },
    { masterFn: SCOPE.masterFn, companyFn: SCOPE.companyFn, code: '1100', name: 'AR', type: 'asset' },
    { masterFn: SCOPE.masterFn, companyFn: SCOPE.companyFn, code: '4000', name: 'Revenue', type: 'income' },
    { masterFn: SCOPE.masterFn, companyFn: SCOPE.companyFn, code: '2200', name: 'Output tax', type: 'liability' },
  ]);
  await db.insert(taxRule).values({
    masterFn: SCOPE.masterFn, companyFn: SCOPE.companyFn, taxRegime: 'GST', taxCode: 'SR',
    rate: '9', validFrom: '2024-01-01',
  });
  return proj;
}

async function postedClaim(db: DB, proj: { id: number }, docNo = 'PC-BR-1') {
  const draft = await createProgressClaim(db, SCOPE, {
    docNo, projectId: proj.id, claimDate: '2026-02-01',
    description: 'Fictional milestone', netAmount: '100', taxCode: 'SR',
  });
  return postProgressClaim(db, SCOPE, draft.id);
}

describe('bank receipt', () => {
  it('collects a posted claim in full and posts a balanced Dr Cash / Cr AR', async () => {
    const db = await freshDb();
    const proj = await fixture(db);
    const claim = await postedClaim(db, proj);
    const receipt = await createBankReceipt(db, SCOPE, {
      docNo: 'BR-1', progressClaimId: claim.claimId, receivedDate: '2026-02-05',
      bankRef: 'REF-123', amount: claim.totalAmount,
    });
    expect(receipt).toMatchObject({ docNo: 'BR-1', progressClaimId: claim.claimId, amount: '109.00' });
    const legs = await db.select().from(glEntry).where(eq(glEntry.journalRef, 'BR-1'));
    expect(legs.reduce((sum, row) => sum + Number(row.debit), 0)).toBe(109);
    expect(legs.reduce((sum, row) => sum + Number(row.credit), 0)).toBe(109);
  });

  it('rejects receipting a claim that has not been posted', async () => {
    const db = await freshDb();
    const proj = await fixture(db);
    const draft = await createProgressClaim(db, SCOPE, {
      docNo: 'PC-BR-DRAFT', projectId: proj.id, claimDate: '2026-02-01',
      description: 'Fictional milestone', netAmount: '100', taxCode: 'SR',
    });
    await expect(createBankReceipt(db, SCOPE, {
      docNo: 'BR-DRAFT', progressClaimId: draft.id, receivedDate: '2026-02-05', amount: draft.totalAmount,
    })).rejects.toThrow('Only a posted progress claim can be receipted.');
  });

  it('rejects a second receipt against an already-receipted claim', async () => {
    const db = await freshDb();
    const proj = await fixture(db);
    const claim = await postedClaim(db, proj);
    await createBankReceipt(db, SCOPE, {
      docNo: 'BR-FIRST', progressClaimId: claim.claimId, receivedDate: '2026-02-05', amount: claim.totalAmount,
    });
    await expect(createBankReceipt(db, SCOPE, {
      docNo: 'BR-SECOND', progressClaimId: claim.claimId, receivedDate: '2026-02-06', amount: claim.totalAmount,
    })).rejects.toThrow('has already been receipted');
  });

  it('rejects an amount that does not match the claim total', async () => {
    const db = await freshDb();
    const proj = await fixture(db);
    const claim = await postedClaim(db, proj);
    await expect(createBankReceipt(db, SCOPE, {
      docNo: 'BR-MISMATCH', progressClaimId: claim.claimId, receivedDate: '2026-02-05', amount: '50',
    })).rejects.toThrow(BankReceiptError);
  });
});
