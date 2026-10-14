import { eq } from 'drizzle-orm';
import { describe, expect, it } from 'vitest';
import { auditLog, company, companyProfile } from '../../data/schema';
import { seedDemo } from '../../data/seed';
import { freshDb } from '../../test/helpers';
import { readCompanyProfileWithin, updateCompanyProfileWithin } from './companyProfile';

const sg = { masterFn: 'M1', companyFn: 'C-SG' };
const actor = { userId: 1, requestId: 'company-profile-test' };
const png = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Y9hJxEAAAAASUVORK5CYII=';
const input = {
  name: 'Acme Singapore Legal Pte Ltd', registrationNo: '202600001A', taxNo: 'M90000001A',
  addressLine1: '10 Example Road', addressLine2: '#02-01', city: 'Singapore',
  region: '', postalCode: '123456', logoDataUrl: png, expectedVersion: 0,
};

describe('Company profile', () => {
  it('persists scoped facts and a validated logo with an audit-safe version', async () => {
    const db = await freshDb(); await seedDemo(db);
    expect((await readCompanyProfileWithin(db, sg)).profileVersion).toBe(0);
    const saved = await db.transaction((tx) => updateCompanyProfileWithin(tx, sg, actor, input));
    expect(saved).toMatchObject({ name: input.name, registrationNo: input.registrationNo,
      taxNo: input.taxNo, postalCode: input.postalCode, profileVersion: 1, logoDataUrl: png });
    expect((await db.select().from(company).where(eq(company.companyFn, 'C-SG')))[0].name).toBe(input.name);
    expect((await db.select().from(company).where(eq(company.companyFn, 'C-MY')))[0].name).not.toBe(input.name);
    expect(await db.select().from(companyProfile)).toHaveLength(1);
    const [audit] = await db.select().from(auditLog).where(eq(auditLog.requestId, actor.requestId));
    expect(audit).toMatchObject({ entity: 'company_profile', action: 'update' });
    expect(JSON.stringify(audit)).not.toContain('base64');
    await expect(db.transaction((tx) => updateCompanyProfileWithin(tx, sg, actor, input)))
      .rejects.toMatchObject({ code: 'profile_version_conflict' });
    const cleared = await db.transaction((tx) => updateCompanyProfileWithin(tx, sg, actor, {
      ...input, expectedVersion: 1, logoDataUrl: null,
    }));
    expect(cleared).toMatchObject({ profileVersion: 2, logoDataUrl: null });
  });

  it('rejects wrong tenant scope and invalid or oversized logo bytes', async () => {
    const db = await freshDb(); await seedDemo(db);
    await expect(readCompanyProfileWithin(db, { masterFn: 'OTHER', companyFn: 'C-SG' }))
      .rejects.toMatchObject({ code: 'company_not_found' });
    await expect(db.transaction((tx) => updateCompanyProfileWithin(tx, sg, actor, {
      ...input, logoDataUrl: 'data:image/png;base64,JVBERi0xLjQKMTIzNDU2Nzg5MA==',
    }))).rejects.toMatchObject({ code: 'invalid_logo' });
    await expect(db.transaction((tx) => updateCompanyProfileWithin(tx, sg, actor, {
      ...input, logoDataUrl: `data:image/png;base64,${Buffer.alloc(256 * 1024 + 1).toString('base64')}`,
    }))).rejects.toMatchObject({ code: 'invalid_logo_size' });
    expect(await db.select().from(companyProfile)).toHaveLength(0);
  });
});
