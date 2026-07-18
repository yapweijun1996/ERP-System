import { randomBytes } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { Pool } from 'pg';
import * as schema from '../data/schema';
import type { DB } from '../data/db';
import { withTenantTransaction } from '../data/tenantTransaction';
import { completeProductionSetup } from '../modules/setup/completeSetup';
import { createInvitation, acceptInvitation, requestPasswordReset, confirmPasswordReset } from '../auth/lifecycle';
import { decryptToken, type EncryptedToken } from '../auth/tokenCrypto';
import { processOutboxBatch } from '../worker/outbox';

const postgresUrl = process.env.POSTGRES_URL;
const suite = postgresUrl ? describe : describe.skip;

suite('PostgreSQL 16 security lifecycle proof', () => {
  const suffix = `${process.pid}_${randomBytes(4).toString('hex')}`;
  const databaseName = `erp_security_${suffix}`;
  const roleName = `erp_api_${suffix}`;
  const rolePassword = randomBytes(18).toString('base64url');
  let clusterPool: Pool;
  let ownerPool: Pool;
  let apiPool: Pool;
  let db: DB;

  beforeAll(async () => {
    const base = new URL(postgresUrl!);
    const clusterUrl = new URL(base);
    clusterUrl.pathname = '/postgres';
    clusterPool = new Pool({ connectionString: clusterUrl.toString() });
    await clusterPool.query(`create database "${databaseName}"`);

    const ownerUrl = new URL(base);
    ownerUrl.pathname = `/${databaseName}`;
    ownerPool = new Pool({ connectionString: ownerUrl.toString() });
    const ownerDb = drizzle(ownerPool, { schema });
    await migrate(ownerDb, { migrationsFolder: 'drizzle' });
    await ownerPool.query(
      `create role "${roleName}" login password '${rolePassword}' nosuperuser nobypassrls`,
    );
    await ownerPool.query(`grant connect on database "${databaseName}" to "${roleName}"`);
    await ownerPool.query(`grant usage on schema public to "${roleName}"`);
    await ownerPool.query(
      `grant select, insert, update, delete on all tables in schema public to "${roleName}"`,
    );
    await ownerPool.query(
      `grant usage, select on all sequences in schema public to "${roleName}"`,
    );
    await ownerPool.query(await readFile('deploy/sql/production-rls.sql', 'utf8'));

    const apiUrl = new URL(base);
    apiUrl.pathname = `/${databaseName}`;
    apiUrl.username = roleName;
    apiUrl.password = rolePassword;
    apiPool = new Pool({ connectionString: apiUrl.toString() });
    db = drizzle(apiPool, { schema }) as DB;
  }, 60_000);

  afterAll(async () => {
    await apiPool?.end();
    await ownerPool?.end();
    if (clusterPool) {
      await clusterPool.query(
        `select pg_terminate_backend(pid) from pg_stat_activity
         where datname = '${databaseName}' and pid <> pg_backend_pid()`,
      );
      await clusterPool.query(`drop database if exists "${databaseName}"`);
      await clusterPool.query(`drop role if exists "${roleName}"`);
      await clusterPool.end();
    }
  }, 30_000);

  it('runs setup, RLS, invitations, outbox and password reset as a non-superuser', async () => {
    const setup = await completeProductionSetup(db, {
      organizationName: 'PostgreSQL Security Proof',
      companyName: 'Security Proof Singapore',
      country: 'SG',
      adminName: 'System Administrator',
      adminEmail: 'admin@security-proof.example',
      adminPassword: 'initial-password',
      language: 'en',
    }, 'pg-setup-proof');

    expect(await db.select().from(schema.account)).toHaveLength(0);
    const visibleAccounts = await withTenantTransaction(db, {
      masterFn: setup.masterFn,
      companyFn: setup.companyFn,
    }, (tx) => tx.select().from(schema.account));
    expect(visibleAccounts).toHaveLength(8);

    const [admin] = await db.select().from(schema.appUser)
      .where(eq(schema.appUser.userId, setup.userId));
    const [adminRole] = await db.select().from(schema.role)
      .where(eq(schema.role.masterFn, setup.masterFn));
    const key = Buffer.alloc(32, 11);
    const lifecycle = {
      tokenEncryptionKey: key,
      publicUrl: 'https://erp.example.test',
    };
    const invitation = await createInvitation(db, {
      userId: admin.userId,
      masterFn: setup.masterFn,
      activeCompanyFn: setup.companyFn,
      email: admin.email,
      fullName: admin.fullName,
    }, {
      email: 'invitee@security-proof.example',
      roleId: adminRole.roleId,
    }, 'pg-invite-proof', lifecycle);
    const [inviteEvent] = await db.select().from(schema.outboxEvent)
      .where(eq(schema.outboxEvent.aggregateId, String(invitation.id)));
    const inviteToken = decryptToken(
      (inviteEvent.payload as { token: EncryptedToken }).token,
      key,
    );
    const delivered = await processOutboxBatch(db, {
      async send(message) {
        expect(message.to).toBe('invitee@security-proof.example');
        expect(message.text).toContain('token=');
      },
    }, { tokenEncryptionKey: key, workerId: 'pg-ci-worker' });
    expect(delivered).toEqual({ claimed: 1, delivered: 1, failed: 0 });
    const accepted = await acceptInvitation(db, {
      token: inviteToken,
      fullName: 'Invited User',
      password: 'invited-password',
      language: 'vi',
    }, 'pg-accept-proof');
    await expect(acceptInvitation(db, {
      token: inviteToken,
      fullName: 'Replay',
      password: 'invited-password',
    }, 'pg-accept-replay')).rejects.toMatchObject({ code: 'invitation_invalid' });

    await requestPasswordReset(
      db,
      accepted.email,
      'pg-reset-request',
      lifecycle,
    );
    const [resetEvent] = await db.select().from(schema.outboxEvent)
      .where(eq(schema.outboxEvent.topic, 'auth.password-reset.requested'));
    const resetToken = decryptToken(
      (resetEvent.payload as { token: EncryptedToken }).token,
      key,
    );
    await confirmPasswordReset(db, resetToken, 'changed-password', 'pg-reset-confirm');
    await expect(confirmPasswordReset(
      db,
      resetToken,
      'changed-password',
      'pg-reset-replay',
    )).rejects.toMatchObject({ code: 'reset_invalid' });
  }, 60_000);
});
