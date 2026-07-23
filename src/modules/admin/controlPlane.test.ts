import { and, eq } from 'drizzle-orm';
import { describe, expect, it } from 'vitest';
import { accountingPeriod, auditLog, companyPolicy, documentSequence } from '../../data/schema';
import { seedDemo } from '../../data/seed';
import { freshDb } from '../../test/helpers';
import {
  getMasterControlWithin,
  getSystemSettingsWithin,
  setAccountingPeriodStatusWithin,
  updateCompanyPolicyWithin,
  updateDocumentSequenceWithin,
} from './controlPlane';

describe('tenant control plane', () => {
  it('returns only the session tenant and active-company user facts', async () => {
    const db = await freshDb(); await seedDemo(db);
    const result = await getMasterControlWithin(db, { masterFn: 'M1', companyFn: 'C-SG' });
    expect(result.master.masterFn).toBe('M1');
    expect(result.companies.map((row) => row.companyFn)).toEqual(['C-MY', 'C-SG']);
    expect(result.users.every((row) => row.companyFn === 'C-SG')).toBe(true);
    expect(result.users).toHaveLength(2);
  });

  it('keeps settings company-scoped and audits every mutation', async () => {
    const db = await freshDb(); await seedDemo(db);
    const scope = { masterFn: 'M1', companyFn: 'C-SG' };
    const actor = { userId: 1, requestId: 'settings-test' };
    const before = await getSystemSettingsWithin(db, scope);
    const [myPolicyBefore] = await db.select().from(companyPolicy).where(eq(companyPolicy.companyFn, 'C-MY'));
    expect(before.company.companyFn).toBe('C-SG');
    expect(before.sequences.length).toBeGreaterThan(0);
    const policy = await updateCompanyPolicyWithin(db, scope, actor, {
      dateFormat: 'DD/MM/YYYY', negativeStockPolicy: 'warn', approvalThreshold: '25000.00',
      sessionTimeoutMinutes: 60, defaultWarehouseCode: 'SG-MAIN',
    });
    expect(policy).toMatchObject({ dateFormat: 'DD/MM/YYYY', approvalThreshold: '25000.00' });
    const sequence = before.sequences[0];
    await updateDocumentSequenceWithin(db, scope, actor, sequence.id, {
      prefix: 'TEST-', nextNumber: 88, padding: 6, resetPolicy: 'yearly',
    });
    const period = before.periods.find((row) => row.status === 'open')!;
    await setAccountingPeriodStatusWithin(db, scope, actor, period.id, 'locked');
    expect((await db.select().from(accountingPeriod).where(eq(accountingPeriod.id, period.id)))[0].status).toBe('locked');
    expect(await db.select().from(auditLog).where(eq(auditLog.requestId, 'settings-test'))).toHaveLength(3);
    expect((await db.select().from(companyPolicy).where(eq(companyPolicy.companyFn, 'C-MY')))[0]).toEqual(myPolicyBefore);
    expect((await db.select().from(documentSequence).where(and(
      eq(documentSequence.companyFn, 'C-SG'), eq(documentSequence.id, sequence.id),
    )))[0].prefix).toBe('TEST-');
  });

  it('rejects invalid policy and cross-company sequence updates', async () => {
    const db = await freshDb(); await seedDemo(db);
    const scope = { masterFn: 'M1', companyFn: 'C-SG' };
    const actor = { userId: 1, requestId: 'invalid-settings' };
    await expect(updateCompanyPolicyWithin(db, scope, actor, {
      dateFormat: 'invalid', negativeStockPolicy: 'block', approvalThreshold: '0',
      sessionTimeoutMinutes: 30,
    })).rejects.toMatchObject({ code: 'invalid_date_format' });
    const [mySequence] = await db.select().from(documentSequence).where(eq(documentSequence.companyFn, 'C-MY'));
    await expect(updateDocumentSequenceWithin(db, scope, actor, mySequence.id, {
      prefix: 'SG-', nextNumber: 1, padding: 4, resetPolicy: 'never',
    })).rejects.toMatchObject({ code: 'sequence_not_found' });
  });
});
