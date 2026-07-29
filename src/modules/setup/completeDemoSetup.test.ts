import { and, eq } from 'drizzle-orm';
import { describe, expect, it } from 'vitest';
import {
  account,
  appUser,
  company,
  master,
  rolePermission,
  taxRule,
  userCompany,
  userCompanyRole,
} from '../../data/schema';
import { seedDemo } from '../../data/seed';
import { freshDb } from '../../test/helpers';
import {
  completeDemoSetup,
  DemoSetupError,
} from './completeDemoSetup';

const PASSWORD_HASH = `pbkdf2$100000$${'ab'.repeat(16)}$${'cd'.repeat(32)}`;

describe('completeDemoSetup', () => {
  it('adds a company to the seeded demo master with full canonical setup data', async () => {
    const db = await freshDb();
    await seedDemo(db);

    const result = await completeDemoSetup(db, {
      masterFn: 'M1',
      masterName: 'Demo Group',
      organizationCode: 'DEMO-GROUP',
      companyFn: 'C-MY-NEW',
      companyName: 'Demo Malaysia',
      country: 'MY',
      adminName: 'Demo Administrator',
      adminUsername: 'demo.administrator',
      adminEmail: 'new.admin@example.test',
      adminPasswordHash: PASSWORD_HASH,
      language: 'vi',
    });

    expect(result).toMatchObject({
      masterFn: 'M1',
      organizationCode: 'DEMO-GROUP',
      companyFn: 'C-MY-NEW',
      username: 'demo.administrator',
      email: 'new.admin@example.test',
    });
    expect(await db.select({
      name: master.name,
      loginCode: master.loginCode,
    }).from(master).where(eq(master.masterFn, 'M1'))).toEqual([{
      name: 'Demo Group',
      loginCode: 'DEMO-GROUP',
    }]);
    expect(await db.select().from(company)
      .where(eq(company.companyFn, 'C-MY-NEW'))).toMatchObject([{
      country: 'MY',
      currency: 'MYR',
      taxRegime: 'SST',
      locale: 'vi',
    }]);
    expect(await db.select().from(taxRule).where(and(
      eq(taxRule.companyFn, 'C-MY-NEW'),
      eq(taxRule.taxCode, 'SV'),
    ))).toMatchObject([{ rate: '8.000', validFrom: '2025-07-01' }]);
    expect(await db.select().from(account)
      .where(eq(account.companyFn, 'C-MY-NEW'))).toHaveLength(11);
    const [admin] = await db.select().from(appUser)
      .where(eq(appUser.email, 'new.admin@example.test'));
    expect(admin.passwordHash).toBe(PASSWORD_HASH);
    expect(admin.language).toBe('vi');
    expect(await db.select().from(userCompany)
      .where(eq(userCompany.companyFn, 'C-MY-NEW'))).toHaveLength(1);
    expect(await db.select().from(userCompanyRole)
      .where(eq(userCompanyRole.companyFn, 'C-MY-NEW'))).toHaveLength(1);
    expect((await db.select().from(rolePermission)
      .where(eq(rolePermission.masterFn, 'M1'))).length).toBeGreaterThan(0);
  });

  it('rolls back the whole setup when the company identifier already exists', async () => {
    const db = await freshDb();
    await seedDemo(db);
    const usersBefore = await db.select().from(appUser);

    await expect(completeDemoSetup(db, {
      masterFn: 'M1',
      organizationCode: 'ACME',
      companyFn: 'C-SG',
      companyName: 'Duplicate company',
      country: 'SG',
      adminName: 'Should Roll Back',
      adminUsername: 'rollback.admin',
      adminEmail: 'rollback@example.test',
      adminPasswordHash: PASSWORD_HASH,
      language: 'en',
    })).rejects.toThrow();

    expect(await db.select().from(appUser)).toHaveLength(usersBefore.length);
    expect(await db.select().from(appUser)
      .where(eq(appUser.email, 'rollback@example.test'))).toHaveLength(0);
  });

  it('rejects username and email collisions before changing the seeded master', async () => {
    const db = await freshDb();
    await seedDemo(db);

    await expect(completeDemoSetup(db, {
      masterFn: 'M1',
      masterName: 'Must Not Persist',
      organizationCode: 'MUST-NOT-PERSIST',
      companyFn: 'C-COLLISION',
      companyName: 'Collision Company',
      country: 'SG',
      adminName: 'Collision Admin',
      adminUsername: 'admin',
      adminEmail: 'different.admin@example.test',
      adminPasswordHash: PASSWORD_HASH,
    })).rejects.toThrow('Username admin already belongs to another demo account.');

    expect(await db.select().from(company)
      .where(eq(company.companyFn, 'C-COLLISION'))).toHaveLength(0);
    expect(await db.select({
      name: master.name,
      loginCode: master.loginCode,
    }).from(master).where(eq(master.masterFn, 'M1'))).toEqual([{
      name: 'Acme Group',
      loginCode: 'ACME',
    }]);
  });

  it('applies the entered credentials when setup reuses the exact seeded admin identity', async () => {
    const db = await freshDb();
    await seedDemo(db);
    const usersBefore = await db.select().from(appUser);

    const result = await completeDemoSetup(db, {
      masterFn: 'M1',
      organizationCode: 'ACME',
      companyFn: 'C-SG-SECOND',
      companyName: 'Acme Singapore Second',
      country: 'SG',
      adminName: 'Avery Tan',
      adminUsername: 'admin',
      adminEmail: 'admin@acme.co',
      adminPasswordHash: PASSWORD_HASH,
      language: 'ms',
    });

    expect(await db.select().from(appUser)).toHaveLength(usersBefore.length);
    const [admin] = await db.select().from(appUser).where(and(
      eq(appUser.masterFn, 'M1'),
      eq(appUser.username, 'admin'),
    ));
    expect(admin).toMatchObject({
      userId: result.userId,
      email: 'admin@acme.co',
      fullName: 'Avery Tan',
      passwordHash: PASSWORD_HASH,
      language: 'ms',
      isActive: true,
      accountState: 'active',
      passwordChangeRequired: false,
    });
    expect(await db.select().from(userCompany).where(and(
      eq(userCompany.userId, admin.userId),
      eq(userCompany.companyFn, 'C-SG-SECOND'),
    ))).toHaveLength(1);
  });

  it('rejects a plaintext password before writing anything', async () => {
    const db = await freshDb();
    await seedDemo(db);

    await expect(completeDemoSetup(db, {
      masterFn: 'M1',
      organizationCode: 'ACME',
      companyFn: 'C-INVALID-HASH',
      companyName: 'Invalid',
      country: 'SG',
      adminName: 'Invalid',
      adminUsername: 'invalid.admin',
      adminEmail: 'invalid@example.test',
      adminPasswordHash: 'plaintext-password',
    })).rejects.toThrow(DemoSetupError);
    expect(await db.select().from(company)
      .where(eq(company.companyFn, 'C-INVALID-HASH'))).toHaveLength(0);
  });
});
