import { describe, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import { seedDemo } from '../data/seed';
import { appUser, master } from '../data/schema';
import { freshDb } from '../test/helpers';
import {
  MODULE_KEYS,
  isModuleEnabled,
  listMasterModules,
  moduleKeyForResourcePrefix,
  setMasterModule,
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

  it('defaults every module to enabled for a tenant with no overrides', async () => {
    const db = await freshDb();
    await seedDemo(db);
    const session = await adminSession(db);
    const modules = await listMasterModules(db, session.masterFn, session.activeCompanyFn);
    expect(modules).toHaveLength(MODULE_KEYS.length);
    expect(modules.every((m) => m.enabled)).toBe(true);
  });

  it('disables and re-enables a module, reflected in listMasterModules and isModuleEnabled', async () => {
    const db = await freshDb();
    await seedDemo(db);
    const session = await adminSession(db);

    await setMasterModule(db, session, 'service', false, 'disable-service');
    const disabled = await setMasterModule(db, session, 'crm', false, 'disable-crm');
    expect(disabled).toMatchObject({ moduleKey: 'crm', enabled: false });
    expect(await isModuleEnabled(db, session.masterFn, session.activeCompanyFn, 'crm')).toBe(false);
    const afterDisable = await listMasterModules(db, session.masterFn, session.activeCompanyFn);
    expect(afterDisable.find((m) => m.moduleKey === 'crm')).toMatchObject({ moduleKey: 'crm', enabled: false });
    expect(afterDisable.find((m) => m.moduleKey === 'sales')).toMatchObject({ moduleKey: 'sales', enabled: true });

    const reenabled = await setMasterModule(db, session, 'crm', true, 're-enable-crm');
    expect(reenabled).toMatchObject({ moduleKey: 'crm', enabled: true });
    expect(await isModuleEnabled(db, session.masterFn, session.activeCompanyFn, 'crm')).toBe(true);
    await setMasterModule(db, session, 'service', true, 're-enable-service');
  });

  it('rejects an unknown module key and rejects disabling admin', async () => {
    const db = await freshDb();
    await seedDemo(db);
    const session = await adminSession(db);
    await expect(setMasterModule(db, session, 'not-a-module', false, 'bad-key'))
      .rejects.toMatchObject({ code: 'invalid_module_key' });
    await expect(setMasterModule(db, session, 'admin', false, 'disable-admin'))
      .rejects.toMatchObject({ code: 'admin_module_required' });
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

    await setMasterModule(db, session, 'purchasing', false, 'disable-purchasing-m1');
    expect(await isModuleEnabled(db, session.masterFn, session.activeCompanyFn, 'purchasing')).toBe(false);
    expect(await isModuleEnabled(db, session.masterFn, 'C-MY', 'purchasing')).toBe(true);
    expect(await isModuleEnabled(db, 'OTHER-M3', 'OTHER-C3', 'purchasing')).toBe(false);
  });

  it('maps generic-resource URL prefixes to their gating module key', () => {
    expect(moduleKeyForResourcePrefix('assets')).toBe('asset');
    expect(moduleKeyForResourcePrefix('crm')).toBe('crm');
    expect(moduleKeyForResourcePrefix('some-future-resource')).toBe('some-future-resource');
  });
});
