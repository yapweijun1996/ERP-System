import { describe, expect, it } from 'vitest';
import { and, eq } from 'drizzle-orm';
import { seedDemo } from '../data/seed';
import {
  auditLog,
  company,
  companyModule,
  masterModule,
  platformPrincipal,
  platformRole,
  platformRolePermission,
} from '../data/schema';
import { freshDb } from '../test/helpers';
import { COMMERCIAL_MODULE_KEYS, BASELINE_SERVICE_KEYS } from './moduleCatalog';
import {
  isPlatformModuleEffectivelyEnabled,
  listCompanyAllocations,
  listMasterEntitlements,
  setCompanyAllocation,
  setMasterEntitlement,
} from './platformEntitlement';
import {
  createPlatformSession,
  getPlatformSession,
  provisionPlatformPrincipal,
  PLATFORM_ROLE_TEMPLATES,
} from './platformSupport';

describe('platform module entitlement', () => {
  async function seeded() {
    const db = await freshDb();
    await seedDemo(db);
    const principal = await provisionPlatformPrincipal(db, {
      principalKey: 'test-platform-superadmin', displayName: 'Test Platform Superadmin',
      roleCodes: [PLATFORM_ROLE_TEMPLATES.superadmin.code],
    });
    const credentials = await createPlatformSession(db, principal.principalId);
    const session = await getPlatformSession(db, credentials.token, { touch: false });
    return { db, session: session!, credentials };
  }

  it('keeps baseline services outside the commercial catalog', () => {
    expect(COMMERCIAL_MODULE_KEYS).toContain('expenses_tax');
    expect(COMMERCIAL_MODULE_KEYS).not.toContain('admin');
    expect(BASELINE_SERVICE_KEYS).toEqual(expect.arrayContaining(['dashboard', 'my-work', 'admin', 'settings', 'account', 'notifications']));
  });

  it('seeds a deterministic platform authority fixture without a browser credential', async () => {
    const db = await freshDb();
    await seedDemo(db);
    const [role] = await db.select().from(platformRole)
      .where(eq(platformRole.code, PLATFORM_ROLE_TEMPLATES.superadmin.code));
    expect(role).toMatchObject({ code: 'platform_superadmin', isSystemRole: true });
    const permissions = await db.select({ permissionKey: platformRolePermission.permissionKey })
      .from(platformRolePermission)
      .where(eq(platformRolePermission.platformRoleId, role.platformRoleId));
    expect(permissions.map((item) => item.permissionKey).sort()).toEqual([
      'platform.modules.manage', 'platform.modules.read',
    ]);
    expect(await db.select().from(platformPrincipal)).toHaveLength(0);
    const masterRows = await db.select().from(masterModule).where(eq(masterModule.masterFn, 'M1'));
    expect(masterRows).toHaveLength(COMMERCIAL_MODULE_KEYS.length);
  });

  it('masks allocation with Master entitlement and restores it without rewriting allocation', async () => {
    const { db, session } = await seeded();
    const initial = (await listMasterEntitlements(db, session, 'M1'))
      .find((item) => item.moduleKey === 'expenses_tax')!;
    expect(initial).toMatchObject({ masterEnabled: false, defaultCompanyAllocated: false, version: 1 });

    const allocated = await setCompanyAllocation(db, session, {
      masterFn: 'M1', companyFn: 'C-SG', moduleKey: 'expenses_tax', allocated: true,
      expectedVersion: 1,
    }, 'allocate-expenses');
    expect(allocated).toMatchObject({ companyAllocated: true, effectiveEnabled: false, version: 2 });

    await setMasterEntitlement(db, session, {
      masterFn: 'M1', moduleKey: 'expenses_tax', enabled: true,
      defaultCompanyAllocated: true, expectedVersion: 1,
    }, 'enable-expenses');
    expect(await isPlatformModuleEffectivelyEnabled(db, 'M1', 'C-SG', 'expenses_tax')).toBe(true);

    await setMasterEntitlement(db, session, {
      masterFn: 'M1', moduleKey: 'expenses_tax', enabled: false,
      defaultCompanyAllocated: true, expectedVersion: 2,
    }, 'mask-expenses');
    const masked = (await listCompanyAllocations(db, session, 'M1', 'C-SG'))
      .find((item) => item.moduleKey === 'expenses_tax')!;
    expect(masked).toMatchObject({ masterEnabled: false, companyAllocated: true, effectiveEnabled: false });

    await setMasterEntitlement(db, session, {
      masterFn: 'M1', moduleKey: 'expenses_tax', enabled: true,
      defaultCompanyAllocated: true, expectedVersion: 3,
    }, 'restore-expenses');
    expect(await isPlatformModuleEffectivelyEnabled(db, 'M1', 'C-SG', 'expenses_tax')).toBe(true);

    await expect(setCompanyAllocation(db, session, {
      masterFn: 'M1', companyFn: 'C-SG', moduleKey: 'expenses_tax', allocated: false,
      expectedVersion: 1,
    }, 'stale-allocation')).rejects.toMatchObject({ code: 'platform_allocation_version_conflict' });

    const [storedAllocation] = await db.select().from(companyModule).where(and(
      eq(companyModule.masterFn, 'M1'), eq(companyModule.companyFn, 'C-SG'),
      eq(companyModule.moduleKey, 'expenses_tax'),
    ));
    expect(storedAllocation).toMatchObject({ enabled: true, version: 2 });
    const audits = await db.select().from(auditLog).where(eq(auditLog.platformPrincipalId, session.principalId));
    expect(audits.map((row) => row.action)).toEqual(expect.arrayContaining([
      'platform_set_entitlement', 'platform_set_allocation',
    ]));
  });

  it('does not grant commercial entitlement authority to support roles', async () => {
    const { db } = await seeded();
    const principal = await provisionPlatformPrincipal(db, {
      principalKey: 'support-only', displayName: 'Support Only',
      roleCodes: [PLATFORM_ROLE_TEMPLATES.supportAdmin.code],
    });
    const credentials = await createPlatformSession(db, principal.principalId);
    const session = (await getPlatformSession(db, credentials.token, { touch: false }))!;
    expect(session.permissions).not.toContain('platform.modules.read');
    await expect(listMasterEntitlements(db, session, 'M1'))
      .rejects.toMatchObject({ code: 'platform_permission_denied' });
  });

  it('enforces hard dependencies and invalidates affected authorization state', async () => {
    const { db, session } = await seeded();
    await expect(setMasterEntitlement(db, session, {
      masterFn: 'M1', moduleKey: 'inventory', enabled: false,
      defaultCompanyAllocated: true, expectedVersion: 1,
    }, 'disable-required-master')).rejects.toMatchObject({ code: 'platform_module_dependency_conflict' });
    await expect(setCompanyAllocation(db, session, {
      masterFn: 'M1', companyFn: 'C-SG', moduleKey: 'finance', allocated: false,
      expectedVersion: 1,
    }, 'disable-required-allocation')).rejects.toMatchObject({ code: 'platform_module_dependency_conflict' });

    const before = await db.select({ companyFn: company.companyFn, version: company.authorizationVersion })
      .from(company).where(eq(company.masterFn, 'M1'));
    await setMasterEntitlement(db, session, {
      masterFn: 'M1', moduleKey: 'expenses_tax', enabled: true,
      defaultCompanyAllocated: false, expectedVersion: 1,
    }, 'master-invalidation');
    const afterMaster = await db.select({ companyFn: company.companyFn, version: company.authorizationVersion })
      .from(company).where(eq(company.masterFn, 'M1'));
    for (const row of before) {
      expect(afterMaster.find((item) => item.companyFn === row.companyFn)?.version).toBe(row.version + 1);
    }
    await setCompanyAllocation(db, session, {
      masterFn: 'M1', companyFn: 'C-SG', moduleKey: 'expenses_tax', allocated: true,
      expectedVersion: 1,
    }, 'company-invalidation');
    const afterCompany = await db.select({ companyFn: company.companyFn, version: company.authorizationVersion })
      .from(company).where(eq(company.masterFn, 'M1'));
    expect(afterCompany.find((item) => item.companyFn === 'C-SG')?.version)
      .toBe(afterMaster.find((item) => item.companyFn === 'C-SG')!.version + 1);
    expect(afterCompany.find((item) => item.companyFn === 'C-MY')?.version)
      .toBe(afterMaster.find((item) => item.companyFn === 'C-MY')!.version);
  });
});
