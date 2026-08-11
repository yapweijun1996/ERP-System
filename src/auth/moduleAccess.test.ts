import { describe, expect, it } from 'vitest';
import { and, eq } from 'drizzle-orm';
import { seedDemo } from '../data/seed';
import { appUser, companyModule, master, masterModule } from '../data/schema';
import { freshDb } from '../test/helpers';
import {
  MODULE_KEYS,
  isModuleEnabled,
  listMasterModules,
  moduleKeyForResourcePrefix,
} from './moduleAccess';

describe('company module access control', () => {
  async function adminSession(db: Awaited<ReturnType<typeof freshDb>>) {
    const [admin] = await db.select().from(appUser).where(eq(appUser.email, 'admin@acme.co'));
    return {
      userId: admin.userId,
      masterFn: admin.masterFn,
      activeCompanyFn: 'C-SG',
      username: admin.username,
      email: admin.email,
      fullName: admin.fullName,
    };
  }

  it('returns only the effective tenant projection', async () => {
    const db = await freshDb();
    await seedDemo(db);
    const session = await adminSession(db);
    const modules = await listMasterModules(db, session.masterFn, session.activeCompanyFn);
    expect(modules).toHaveLength(MODULE_KEYS.length);
    expect(modules.find((module) => module.moduleKey === 'sales')?.enabled).toBe(true);
    expect(modules.find((module) => module.moduleKey === 'expenses_tax')?.enabled).toBe(false);
    expect(modules[0]).not.toHaveProperty('masterEnabled');
    expect(modules[0]).not.toHaveProperty('companyAllocated');
  });

  it('masks an allocation when the Master entitlement is disabled and restores it unchanged', async () => {
    const db = await freshDb();
    await seedDemo(db);
    const session = await adminSession(db);

    await db.update(masterModule).set({ enabled: false }).where(and(
      eq(masterModule.masterFn, session.masterFn),
      eq(masterModule.moduleKey, 'crm'),
    ));
    expect(await isModuleEnabled(db, session.masterFn, session.activeCompanyFn, 'crm')).toBe(false);
    const [allocation] = await db.select({ enabled: companyModule.enabled })
      .from(companyModule).where(and(
        eq(companyModule.masterFn, session.masterFn),
        eq(companyModule.companyFn, session.activeCompanyFn),
        eq(companyModule.moduleKey, 'crm'),
      ));
    expect(allocation.enabled).toBe(true);
    await db.update(masterModule).set({ enabled: true }).where(and(
      eq(masterModule.masterFn, session.masterFn),
      eq(masterModule.moduleKey, 'crm'),
    ));
    expect(await isModuleEnabled(db, session.masterFn, session.activeCompanyFn, 'crm')).toBe(true);
  });

  it('fails closed for unknown, missing Master, and missing Company state', async () => {
    const db = await freshDb();
    await seedDemo(db);
    const session = await adminSession(db);
    expect(await isModuleEnabled(db, session.masterFn, session.activeCompanyFn, 'not-a-module')).toBe(false);
    expect(await isModuleEnabled(db, 'MISSING', session.activeCompanyFn, 'sales')).toBe(false);
    expect(await isModuleEnabled(db, session.masterFn, 'MISSING', 'sales')).toBe(false);
  });

  it('scopes module state per company -- one company disabling a module never affects another', async () => {
    const db = await freshDb();
    await seedDemo(db);
    const session = await adminSession(db);
    await db.insert(master).values({
      masterFn: 'OTHER-M3',
      loginCode: 'OTHER-M3',
      name: 'Other Master 3',
    });

    await db.update(companyModule).set({ enabled: false }).where(and(
      eq(companyModule.masterFn, session.masterFn),
      eq(companyModule.companyFn, session.activeCompanyFn),
      eq(companyModule.moduleKey, 'purchasing'),
    ));
    expect(await isModuleEnabled(db, session.masterFn, session.activeCompanyFn, 'purchasing')).toBe(false);
    expect(await isModuleEnabled(db, session.masterFn, 'C-MY', 'purchasing')).toBe(true);
    expect(await isModuleEnabled(db, 'OTHER-M3', 'OTHER-C3', 'purchasing')).toBe(false);
  });

  it('maps generic-resource URL prefixes to their gating module key', () => {
    expect(moduleKeyForResourcePrefix('assets')).toBe('asset');
    expect(moduleKeyForResourcePrefix('crm')).toBe('crm');
    expect(moduleKeyForResourcePrefix('account')).toBeNull();
    expect(moduleKeyForResourcePrefix('some-future-resource')).toBe('some-future-resource');
  });

});
