import { randomBytes } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import type { Server } from 'node:http';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { and, eq } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { Pool } from 'pg';
import * as schema from '../data/schema';
import type { DB } from '../data/db';
import type { SessionData } from '../auth/session';
import { completeProductionSetup } from '../modules/setup/completeSetup';
import {
  createAgentGrant,
  createAgentPrincipal,
  rotateAgentCredential,
} from '../modules/agent/agentIdentity';
import { createApp } from './app';

const postgresUrl = process.env.POSTGRES_URL;
const suite = postgresUrl ? describe : describe.skip;

suite('product case PostgreSQL runtime isolation', () => {
  const suffix = `${process.pid}_${randomBytes(4).toString('hex')}`;
  const databaseName = `erp_product_case_${suffix}`;
  const roleName = `erp_product_case_api_${suffix}`;
  const rolePassword = randomBytes(18).toString('hex');
  let clusterPool: Pool;
  let ownerPool: Pool;
  let apiPool: Pool;
  let ownerDb: DB;
  let server: Server;
  let baseUrl: string;
  let token: string;
  let scope: { masterFn: string; companyFn: string };

  beforeAll(async () => {
    const base = new URL(postgresUrl!);
    const clusterUrl = new URL(base);
    clusterUrl.pathname = '/postgres';
    clusterPool = new Pool({ connectionString: clusterUrl.toString() });
    await clusterPool.query(`create database "${databaseName}"`);

    const ownerUrl = new URL(base);
    ownerUrl.pathname = `/${databaseName}`;
    ownerPool = new Pool({ connectionString: ownerUrl.toString() });
    const migratedOwnerDb = drizzle(ownerPool, { schema });
    await migrate(migratedOwnerDb, { migrationsFolder: 'drizzle' });
    ownerDb = migratedOwnerDb as DB;
    await ownerPool.query(
      `create role "${roleName}" login password '${rolePassword}' nosuperuser nobypassrls nocreatedb nocreaterole noinherit`,
    );
    await ownerPool.query(`grant connect on database "${databaseName}" to "${roleName}"`);
    await ownerPool.query(`grant usage on schema public to "${roleName}"`);
    await ownerPool.query(`grant select, insert, update, delete on all tables in schema public to "${roleName}"`);
    await ownerPool.query(`grant usage, select on all sequences in schema public to "${roleName}"`);
    await ownerPool.query(await readFile('deploy/sql/production-rls.sql', 'utf8'));

    const apiUrl = new URL(base);
    apiUrl.pathname = `/${databaseName}`;
    apiUrl.username = roleName;
    apiUrl.password = rolePassword;
    apiPool = new Pool({ connectionString: apiUrl.toString() });
    const apiDb = drizzle(apiPool, { schema }) as DB;
    const setup = await completeProductionSetup(ownerDb, {
      organizationName: 'Product Case Proof',
      organizationCode: 'PG-CASE',
      companyName: 'Case Proof Singapore',
      country: 'SG',
      adminName: 'Case Administrator',
      adminUsername: 'case.admin',
      adminEmail: 'case.admin@postgres.example',
      adminPassword: 'case-admin-test-password',
      language: 'en',
      moduleKeys: ['expenses_tax'],
    }, 'pg-product-case-setup');
    scope = { masterFn: setup.masterFn, companyFn: setup.companyFn };
    const session: SessionData = {
      userId: setup.userId,
      masterFn: setup.masterFn,
      activeCompanyFn: setup.companyFn,
      username: 'case.admin',
      email: 'case.admin@postgres.example',
      fullName: 'Case Administrator',
    };
    const [operatorRole] = await ownerDb.insert(schema.role).values({
      masterFn: setup.masterFn,
      companyFn: setup.companyFn,
      name: 'Product Case Evidence Operator',
      isSuperadmin: false,
    }).returning({ roleId: schema.role.roleId });
    await ownerDb.insert(schema.rolePermission).values({
      masterFn: setup.masterFn,
      roleId: operatorRole.roleId,
      permissionKey: 'product.cases.evidence_append',
    });
    await ownerDb.insert(schema.roleResourceScope).values({
      masterFn: setup.masterFn,
      companyFn: setup.companyFn,
      roleId: operatorRole.roleId,
      resourceKey: '*',
      scope: 'company',
    });
    await ownerDb.insert(schema.userCompanyRole).values({
      userId: setup.userId,
      companyFn: setup.companyFn,
      roleId: operatorRole.roleId,
      validFrom: new Date('2026-01-01T00:00:00Z'),
      assignedByUserId: setup.userId,
      assignmentSource: 'system',
    });
    const principal = await createAgentPrincipal(ownerDb, session, {
      principalKey: 'case-proof-agent',
      displayName: 'Case Proof Agent',
      ownerUserId: setup.userId,
    }, 'pg-case-principal');
    for (const [actionName, permissionKey, fields] of [
      ['product_case.submit', 'product.cases.submit',
        ['id', 'caseType', 'title', 'description', 'routeKey', 'referenceId', 'status', 'version', 'createdAt']],
      ['product_case.read_own', 'product.cases.read_own',
        ['id', 'caseType', 'title', 'description', 'routeKey', 'referenceId', 'status', 'resolution',
          'version', 'createdAt', 'updatedAt', 'events', 'evidence']],
      ['product_case.append_evidence', 'product.cases.evidence_append',
        ['id', 'kind', 'summary', 'createdAt']],
    ] as const) {
      await createAgentGrant(ownerDb, session, {
        agentPrincipalId: principal.id,
        actionName,
        permissionKey,
        resourceKey: 'product/cases',
        scope: actionName === 'product_case.read_own' ? 'self' : 'company',
        targetType: actionName === 'product_case.read_own' ? 'employee' : 'none',
        targetId: actionName === 'product_case.read_own' ? String(setup.userId) : '',
        fieldAllowlist: [...fields],
      }, `pg-case-grant-${actionName}`);
    }
    token = (await rotateAgentCredential(ownerDb, session, {
      agentPrincipalId: principal.id,
      expectedVersion: principal.version,
    }, 'pg-case-credential')).token;
    server = createApp(apiDb).listen(0, '127.0.0.1');
    await new Promise<void>((resolve) => server.once('listening', resolve));
    const address = server.address();
    if (!address || typeof address === 'string') throw new Error('No test server address.');
    baseUrl = `http://127.0.0.1:${address.port}`;
  }, 90_000);

  afterAll(async () => {
    if (server) await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
    await apiPool?.end();
    await ownerPool?.end();
    if (clusterPool) {
      await clusterPool.query(
        `select pg_terminate_backend(pid) from pg_stat_activity where datname = '${databaseName}' and pid <> pg_backend_pid()`,
      );
      await clusterPool.query(`drop database if exists "${databaseName}"`);
      await clusterPool.query(`drop role if exists "${roleName}"`);
      await clusterPool.end();
    }
  }, 30_000);

  it('persists Agent submission under FORCE RLS and denies cross-tenant reads and event mutation', async () => {
    const create = await fetch(`${baseUrl}/api/agent/cases`, {
      method: 'POST',
      headers: {
        authorization: `Bearer ${token}`,
        'content-type': 'application/json',
        'idempotency-key': 'postgres-case-intent-0001',
      },
      body: JSON.stringify({
        caseType: 'ticket',
        title: 'PostgreSQL pilot report',
        description: 'Scoped issue reported by an ERP Agent.',
      }),
    });
    expect(create.status).toBe(201);
    const { data } = await create.json() as { data: { id: number } };
    const [event] = await ownerDb.select().from(schema.productCaseEvent).where(and(
      eq(schema.productCaseEvent.caseId, data.id),
      eq(schema.productCaseEvent.masterFn, scope.masterFn),
      eq(schema.productCaseEvent.companyFn, scope.companyFn),
    ));
    expect(event).toBeDefined();
    const [caseRow] = await ownerDb.select().from(schema.productCase).where(eq(schema.productCase.id, data.id));
    expect(caseRow.status).toBe('submitted');
    const evidenceResponse = await fetch(`${baseUrl}/api/agent/cases/${data.id}/evidence`, {
      method: 'POST',
      headers: {
        authorization: `Bearer ${token}`,
        'content-type': 'application/json',
        'idempotency-key': 'postgres-evidence-intent-0001',
      },
      body: JSON.stringify({ kind: 'observation', summary: 'The public form did not save.' }),
    });
    expect(evidenceResponse.status).toBe(201);
    const { data: evidenceData } = await evidenceResponse.json() as { data: { id: number } };

    const client = await apiPool.connect();
    try {
      await client.query('begin');
      await client.query("select set_config('app.master_fn', $1, true)", [scope.masterFn]);
      await client.query("select set_config('app.company_fn', 'C-OTHER', true)");
      const foreign = await client.query('select count(*)::integer as count from product_case');
      expect(foreign.rows[0].count).toBe(0);
      const foreignEvidence = await client.query('select count(*)::integer as count from product_case_evidence');
      expect(foreignEvidence.rows[0].count).toBe(0);
      await client.query('rollback');

      await client.query('begin');
      await client.query("select set_config('app.master_fn', $1, true)", [scope.masterFn]);
      await client.query("select set_config('app.company_fn', $1, true)", [scope.companyFn]);
      await expect(client.query('update product_case_event set note = $1 where id = $2', [
        'tampered', event.id,
      ])).rejects.toMatchObject({ code: '55000' });
      await client.query('rollback');

      await client.query('begin');
      await client.query("select set_config('app.master_fn', $1, true)", [scope.masterFn]);
      await client.query("select set_config('app.company_fn', $1, true)", [scope.companyFn]);
      await expect(client.query('delete from product_case_event where id = $1', [event.id]))
        .rejects.toMatchObject({ code: '55000' });
      await client.query('rollback');

      await client.query('begin');
      await client.query("select set_config('app.master_fn', $1, true)", [scope.masterFn]);
      await client.query("select set_config('app.company_fn', $1, true)", [scope.companyFn]);
      await expect(client.query('update product_case_evidence set summary = $1 where id = $2', [
        'tampered', evidenceData.id,
      ])).rejects.toMatchObject({ code: '55000' });
      await client.query('rollback');

      await client.query('begin');
      await client.query("select set_config('app.master_fn', $1, true)", [scope.masterFn]);
      await client.query("select set_config('app.company_fn', $1, true)", [scope.companyFn]);
      await expect(client.query('delete from product_case_evidence where id = $1', [evidenceData.id]))
        .rejects.toMatchObject({ code: '55000' });
      await client.query('rollback');
    } finally {
      client.release();
    }
    const [after] = await ownerDb.select().from(schema.productCaseEvent).where(eq(schema.productCaseEvent.id, event.id));
    expect(after.note).toBeNull();
    const [savedEvidence] = await ownerDb.select().from(schema.productCaseEvidence)
      .where(eq(schema.productCaseEvidence.id, evidenceData.id));
    expect(savedEvidence.summary).toBe('The public form did not save.');
  }, 60_000);
});
