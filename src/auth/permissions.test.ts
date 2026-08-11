import { describe, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import {
  appUser, role, rolePermission, userCompanyRole,
} from '../data/schema';
import { seedDemo } from '../data/seed';
import { freshDb } from '../test/helpers';
import { hasPermission } from './permissions';
import '../api/resources';

describe('server-side RBAC', () => {
  it('grants declared viewer permissions and denies undeclared writes', async () => {
    const db = await freshDb();
    await seedDemo(db);
    const [viewer] = await db.select({
      userId: appUser.userId,
      username: appUser.username,
      email: appUser.email,
      fullName: appUser.fullName,
    }).from(appUser).where(eq(appUser.email, 'viewer@acme.co'));
    const session = {
      ...viewer,
      masterFn: 'M1',
      activeCompanyFn: 'C-SG',
    };
    expect(await hasPermission(db, session, 'inventory.read')).toBe(true);
    expect(await hasPermission(db, session, 'inventory.products.view')).toBe(true);
    expect(await hasPermission(db, session, 'inventory.products.adjust')).toBe(false);
    expect(await hasPermission(db, session, 'inventory.adjust')).toBe(false);
  });

  it('requires explicit registered owner permissions in the same master', async () => {
    const db = await freshDb();
    await seedDemo(db);
    const [admin] = await db.select({
      userId: appUser.userId,
      username: appUser.username,
      email: appUser.email,
      fullName: appUser.fullName,
    }).from(appUser).where(eq(appUser.email, 'admin@acme.co'));
    // The legacy Superadmin flag is inert. Unknown keys and platform-domain
    // keys deny by default because Company Owner access is explicit.
    expect(await hasPermission(db, {
      ...admin, masterFn: 'M1', activeCompanyFn: 'C-SG',
    }, 'anything.write')).toBe(false);
    expect(await hasPermission(db, {
      ...admin, masterFn: 'OTHER-MASTER', activeCompanyFn: 'C-SG',
    }, 'anything.write')).toBe(false);
    expect(await hasPermission(db, {
      ...admin, masterFn: 'M1', activeCompanyFn: 'C-SG',
    }, 'platform.support.grant')).toBe(false);
  });

  it('unions permissions from every role in the active company only', async () => {
    const db = await freshDb();
    await seedDemo(db);
    const [viewer] = await db.select().from(appUser)
      .where(eq(appUser.username, 'viewer'));
    const [operatorRole] = await db.insert(role).values({
      masterFn: 'M1',
      name: 'Inventory Operator',
    }).returning({ roleId: role.roleId });
    await db.insert(rolePermission).values({
      masterFn: 'M1',
      roleId: operatorRole.roleId,
      permissionKey: 'inventory.adjust',
    });
    await db.insert(userCompanyRole).values({
      userId: viewer.userId,
      companyFn: 'C-SG',
      roleId: operatorRole.roleId,
    });

    const session = {
      userId: viewer.userId,
      masterFn: 'M1',
      activeCompanyFn: 'C-SG',
      username: viewer.username,
      email: viewer.email,
      fullName: viewer.fullName,
    };
    expect(await hasPermission(db, session, 'inventory.read')).toBe(true);
    expect(await hasPermission(db, session, 'inventory.adjust')).toBe(true);
    expect(await hasPermission(db, session, 'finance.write')).toBe(false);
    expect(await hasPermission(db, {
      ...session,
      activeCompanyFn: 'C-MY',
    }, 'inventory.adjust')).toBe(false);
  });
});
