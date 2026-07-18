import { describe, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import { freshDb } from '../../test/helpers';
import {
  account,
  appUser,
  auditLog,
  company,
  master,
  role,
  systemState,
  taxRule,
  userCompany,
} from '../../data/schema';
import { completeProductionSetup } from './completeSetup';

describe('production setup command', () => {
  it('creates a complete tenant foundation in one transaction', async () => {
    const db = await freshDb();
    const result = await completeProductionSetup(db, {
      organizationName: 'Example Manufacturing Group',
      companyName: 'Example Manufacturing Singapore',
      country: 'SG',
      adminName: 'System Administrator',
      adminEmail: 'admin@example.test',
      adminPassword: 'secure-password',
      language: 'ja',
    }, 'setup-test');
    expect(await db.select().from(master)).toHaveLength(1);
    expect(await db.select().from(company)).toHaveLength(1);
    expect(await db.select().from(appUser)).toHaveLength(1);
    expect(await db.select().from(userCompany)).toHaveLength(1);
    expect(await db.select().from(account)).toHaveLength(9);
    expect(await db.select().from(taxRule)).toHaveLength(1);
    expect((await db.select().from(role))[0].isSuperadmin).toBe(true);
    expect((await db.select().from(auditLog))[0]).toMatchObject({
      action: 'production_setup',
      actorUserId: result.userId,
    });
    expect((await db.select().from(systemState)
      .where(eq(systemState.key, 'production_setup')))[0].value)
      .toMatchObject({ status: 'completed' });

    await expect(completeProductionSetup(db, {
      organizationName: 'Second',
      companyName: 'Second',
      country: 'MY',
      adminName: 'Second Admin',
      adminEmail: 'second@example.test',
      adminPassword: 'secure-password',
    }, 'setup-replay')).rejects.toMatchObject({ code: 'already_initialized' });
  });

  it('rolls back all setup state when validation fails', async () => {
    const db = await freshDb();
    await expect(completeProductionSetup(db, {
      organizationName: 'Example',
      companyName: 'Example',
      country: 'US',
      adminName: 'Admin',
      adminEmail: 'admin@example.test',
      adminPassword: 'secure-password',
    }, 'setup-invalid')).rejects.toMatchObject({ code: 'unsupported_country' });
    expect(await db.select().from(master)).toHaveLength(0);
    expect(await db.select().from(systemState)).toHaveLength(0);
  });
});
