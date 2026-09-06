import { randomBytes } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import type { Server } from 'node:http';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { Pool } from 'pg';
import * as schema from '../data/schema';
import type { DB } from '../data/db';
import { withTenantTransaction } from '../data/tenantTransaction';
import { createApp } from './app';

const postgresUrl = process.env.POSTGRES_URL;
const suite = postgresUrl ? describe : describe.skip;

function cookies(response: Response, prefix: string) {
  const headers = response.headers as Headers & { getSetCookie?: () => string[] };
  const values = headers.getSetCookie?.() ?? [headers.get('set-cookie') ?? ''];
  const pairs = values.flatMap((value) => Array.from(
    value.matchAll(new RegExp(`(?:^|,\\s*)(${prefix}_(?:session|csrf))=([^;,\\s]+)`, 'g')),
    (match) => `${match[1]}=${match[2]}`,
  ));
  const csrfPair = pairs.find((pair) => pair.startsWith(`${prefix}_csrf=`));
  if (!csrfPair) throw new Error(`Missing ${prefix} cookies`);
  return {
    header: pairs.join('; '),
    csrf: decodeURIComponent(csrfPair.slice(`${prefix}_csrf=`.length)),
  };
}

async function startApi(db: DB) {
  const server = createApp(db).listen(0, '127.0.0.1');
  await new Promise<void>((resolve) => server.once('listening', resolve));
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('No API address');
  return { server, baseUrl: `http://127.0.0.1:${address.port}` };
}

async function stopApi(server: Server) {
  await new Promise<void>((resolve, reject) => {
    server.close((error) => error ? reject(error) : resolve());
  });
}

suite('Platform provisioning PostgreSQL FORCE RLS proof', () => {
  const suffix = `${process.pid}_${randomBytes(4).toString('hex')}`;
  const databaseName = `erp_platform_${suffix}`;
  const roleName = `erp_platform_api_${suffix}`;
  const rolePassword = randomBytes(18).toString('hex');
  let clusterPool: Pool;
  let ownerPool: Pool;
  let apiPool: Pool;
  let db: DB;
  let server: Server;
  let baseUrl: string;

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
      `create role "${roleName}" login password '${rolePassword}' nosuperuser nobypassrls nocreatedb nocreaterole noinherit`,
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
    const running = await startApi(db);
    server = running.server;
    baseUrl = running.baseUrl;
  }, 60_000);

  afterAll(async () => {
    if (server) await stopApi(server);
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

  it('runs current bootstrap → Master → Company flow as a non-superuser and denies cross-tenant writes', async () => {
    const runtimeRole = await apiPool.query(
      `select current_user, rolsuper, rolbypassrls, rolcreatedb, rolcreaterole
       from pg_roles where rolname = current_user`,
    );
    expect(runtimeRole.rows[0]).toMatchObject({
      current_user: roleName,
      rolsuper: false,
      rolbypassrls: false,
      rolcreatedb: false,
      rolcreaterole: false,
    });

    const bootstrap = await fetch(`${baseUrl}/api/setup/platform-superadmin/actions/complete`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        principalKey: 'platform-admin',
        displayName: 'Platform Admin',
        email: 'platform@postgres.example',
        password: 'platform-password-123',
      }),
    });
    expect(bootstrap.status).toBe(201);
    const platform = cookies(bootstrap, 'erp_platform');
    const headers = {
      cookie: platform.header,
      'x-platform-csrf-token': platform.csrf,
      'content-type': 'application/json',
    };

    const masterResponse = await fetch(`${baseUrl}/api/platform/masters`, {
      method: 'POST',
      headers: { ...headers, 'idempotency-key': 'pg-master-1' },
      body: JSON.stringify({ name: 'PostgreSQL Group', loginCode: 'PGROUP' }),
    });
    expect(masterResponse.status).toBe(201);
    const master = (await masterResponse.json()).data as { masterFn: string };

    const firstCompanyResponse = await fetch(
      `${baseUrl}/api/platform/masters/${master.masterFn}/companies`,
      {
        method: 'POST',
        headers: { ...headers, 'idempotency-key': 'pg-company-1' },
        body: JSON.stringify({
          name: 'PostgreSQL Singapore',
          country: 'SG',
          masterAdmin: {
            name: 'Master Admin', username: 'pgmasteradmin',
            email: 'pgmasteradmin@postgres.example', password: 'master-admin-password',
          },
          companyOwner: {
            name: 'Company Owner', username: 'pgowner',
            email: 'pgowner@postgres.example', password: 'company-owner-password',
          },
        }),
      },
    );
    expect(firstCompanyResponse.status).toBe(201);
    const firstCompany = (await firstCompanyResponse.json()).data as { companyFn: string };

    const secondCompanyResponse = await fetch(
      `${baseUrl}/api/platform/masters/${master.masterFn}/companies`,
      {
        method: 'POST',
        headers: { ...headers, 'idempotency-key': 'pg-company-2' },
        body: JSON.stringify({
          name: 'PostgreSQL Malaysia',
          country: 'MY',
          companyOwner: {
            name: 'Malaysia Owner', username: 'pgmyowner',
            email: 'pgmyowner@postgres.example', password: 'company-owner-password',
          },
        }),
      },
    );
    expect(secondCompanyResponse.status).toBe(201);
    const secondCompany = (await secondCompanyResponse.json()).data as { companyFn: string };

    const firstScope = { masterFn: master.masterFn, companyFn: firstCompany.companyFn };
    const visibleFirstOnboarding = await withTenantTransaction(db, firstScope, (tx) =>
      tx.select().from(schema.companyOnboarding));
    expect(visibleFirstOnboarding).toHaveLength(1);
    expect(visibleFirstOnboarding[0].completedSteps).toEqual([
      'company', 'fiscal', 'warehouse', 'roles', 'staff', 'import', 'opening_balance', 'uat',
    ]);
    expect(await withTenantTransaction(db, firstScope, (tx) => tx.select().from(schema.account)))
      .toHaveLength(11);
    expect(await withTenantTransaction(db, firstScope, (tx) => tx.select().from(schema.account)
      .where(eq(schema.account.companyFn, secondCompany.companyFn))))
      .toHaveLength(0);

    await expect(withTenantTransaction(db, firstScope, (tx) => tx.insert(schema.account).values({
      masterFn: master.masterFn,
      companyFn: secondCompany.companyFn,
      code: '9900',
      name: 'Cross tenant write',
      type: 'expense',
    }))).rejects.toMatchObject({
      cause: expect.objectContaining({
        code: '42501',
        message: expect.stringMatching(/row-level security policy/i),
      }),
    });
  }, 60_000);
});
