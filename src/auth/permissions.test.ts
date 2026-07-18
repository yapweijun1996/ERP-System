import { describe, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import { appUser } from '../data/schema';
import { seedDemo } from '../data/seed';
import { freshDb } from '../test/helpers';
import { hasPermission } from './permissions';

describe('server-side RBAC', () => {
  it('grants declared viewer permissions and denies undeclared writes', async () => {
    const db = await freshDb();
    await seedDemo(db);
    const [viewer] = await db.select({
      userId: appUser.userId,
      email: appUser.email,
      fullName: appUser.fullName,
    }).from(appUser).where(eq(appUser.email, 'viewer@acme.co'));
    const session = {
      ...viewer,
      masterFn: 'M1',
      activeCompanyFn: 'C-SG',
    };
    expect(await hasPermission(db, session, 'inventory.read')).toBe(true);
    expect(await hasPermission(db, session, 'inventory.adjust')).toBe(false);
  });

  it('bounds superadmin bypass to a valid assignment in the same master', async () => {
    const db = await freshDb();
    await seedDemo(db);
    const [admin] = await db.select({
      userId: appUser.userId,
      email: appUser.email,
      fullName: appUser.fullName,
    }).from(appUser).where(eq(appUser.email, 'admin@acme.co'));
    expect(await hasPermission(db, {
      ...admin, masterFn: 'M1', activeCompanyFn: 'C-SG',
    }, 'anything.write')).toBe(true);
    expect(await hasPermission(db, {
      ...admin, masterFn: 'OTHER-MASTER', activeCompanyFn: 'C-SG',
    }, 'anything.write')).toBe(false);
  });
});
