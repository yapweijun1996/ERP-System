import { and, eq } from 'drizzle-orm';
import { describe, expect, it } from 'vitest';
import { company } from '../data/schema';
import { seedDemo } from '../data/seed';
import { freshDb } from '../test/helpers';
import { effectiveCapabilities } from './permissions';
import { createRole } from './adminLifecycle';
import { getAuthorizationVersionWithin } from './authorizationVersion';

const scope = { masterFn: 'M1', companyFn: 'C-SG' };

const adminSession = {
  userId: 1,
  ...scope,
  activeCompanyFn: scope.companyFn,
  username: 'admin',
  email: 'admin@acme.co',
  fullName: 'Admin',
};

describe('tenant authorization version', () => {
  it('starts at one and advances with authorization graph mutations', async () => {
    const db = await freshDb();
    await seedDemo(db);

    const before = await getAuthorizationVersionWithin(db, scope);
    expect(before).toBe(1);

    const created = await createRole(db, adminSession, 'Versioned Role', 'auth-version-role');
    const after = await getAuthorizationVersionWithin(db, scope);
    expect(created.name).toBe('Versioned Role');
    expect(after).toBeGreaterThan(before);

    const [companyRow] = await db.select({ authorizationVersion: company.authorizationVersion })
      .from(company)
      .where(and(eq(company.masterFn, scope.masterFn), eq(company.companyFn, scope.companyFn)));
    expect(companyRow.authorizationVersion).toBe(after);
  });

  it('exposes the current version with derived capabilities after a mutation', async () => {
    const db = await freshDb();
    await seedDemo(db);

    const initial = await effectiveCapabilities(db, adminSession);
    expect(initial.authorizationVersion).toBe(1);

    await createRole(db, adminSession, 'Capability Version Role', 'auth-version-capabilities');
    const current = await getAuthorizationVersionWithin(db, scope);
    const capabilities = await effectiveCapabilities(db, adminSession);

    expect(current).toBeGreaterThan(initial.authorizationVersion);
    expect(capabilities.authorizationVersion).toBe(current);
  });
});
