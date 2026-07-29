import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { Server } from 'node:http';
import { and, eq } from 'drizzle-orm';
import type { DB } from '../data/db';
import {
  account,
  apiIdempotency,
  activity,
  auditLog,
  customer,
  glEntry,
  invoice,
  inventoryAdjustment,
  inventoryLot,
  inventorySerial,
  opportunity,
  product,
  purchaseOrder,
  purchaseOrderApproval,
  purchaseOrderLine,
  purchaseRfq,
  purchaseRfqLine,
  salesOrder,
  salesOrderApproval,
  salesOrderLine,
  salesDelivery,
  salesDeliveryLine,
  stockLevel,
  stockLocationBalance,
  stockMovement,
  stockTransfer,
  stockReservation,
  supplier,
  supplierQuotation,
  supplierInvoice,
  goodsReceipt,
  warehouseBin,
  warehousePick,
  warehousePickLine,
  warehouse,
} from '../data/schema';
import { seedDemo } from '../data/seed';
import { freshDb } from '../test/helpers';
import { setStockQtyForFixture } from '../modules/inventory/stock';
import { createApp } from './app';

interface RunningApi {
  baseUrl: string;
  server: Server;
}

async function startApi(db: DB): Promise<RunningApi> {
  const server = createApp(db).listen(0, '127.0.0.1');
  await new Promise<void>((resolve) => server.once('listening', resolve));
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('HTTP test server has no TCP address');
  return { baseUrl: `http://127.0.0.1:${address.port}`, server };
}

async function stopApi(server: Server): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    server.close((error) => error ? reject(error) : resolve());
  });
}

function responseCookies(response: Response): { header: string; csrf: string } {
  const headers = response.headers as Headers & { getSetCookie?: () => string[] };
  const values = headers.getSetCookie?.() ?? [headers.get('set-cookie') ?? ''];
  const pairs = values.flatMap((value) => {
    const matches = value.matchAll(/(?:^|,\s*)(erp_(?:session|csrf))=([^;,\s]+)/g);
    return Array.from(matches, (match) => `${match[1]}=${match[2]}`);
  });
  const csrfPair = pairs.find((pair) => pair.startsWith('erp_csrf='));
  if (!csrfPair || !pairs.some((pair) => pair.startsWith('erp_session='))) {
    throw new Error(`Missing auth cookies: ${values.join(' | ')}`);
  }
  return {
    header: pairs.join('; '),
    csrf: decodeURIComponent(csrfPair.slice('erp_csrf='.length)),
  };
}

async function login(baseUrl: string, email = 'admin@acme.co', password = 'demo1234') {
  const response = await fetch(`${baseUrl}/api/auth/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ organizationCode: 'ACME', username: email.split('@')[0], password }),
  });
  expect(response.status).toBe(200);
  return responseCookies(response);
}

describe('production API security contract', () => {
  let db: DB;
  let running: RunningApi;

  beforeEach(async () => {
    db = await freshDb();
    await seedDemo(db);
    running = await startApi(db);
  });

  afterEach(async () => {
    await stopApi(running.server);
  });

  it('persists sessions across application restarts', async () => {
    const cookies = await login(running.baseUrl);
    await stopApi(running.server);
    running = await startApi(db);
    const response = await fetch(`${running.baseUrl}/api/auth/session`, {
      headers: { cookie: cookies.header },
    });
    expect(response.status).toBe(200);
    const sessionBody = await response.json();
    expect(sessionBody).toMatchObject({
      masterFn: 'M1',
      activeCompanyFn: 'C-SG',
      email: 'admin@acme.co',
    });
    expect(sessionBody.companyFns.sort()).toEqual(['C-MY', 'C-SG']);
  });

  it('signs in with organization code and organization-scoped username', async () => {
    const response = await fetch(`${running.baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        organizationCode: ' acme ',
        username: ' ADMIN ',
        password: 'demo1234',
      }),
    });
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      organizationCode: 'ACME',
      username: 'admin',
      email: 'admin@acme.co',
      masterFn: 'M1',
    });
    const wrongOrganization = await fetch(`${running.baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        organizationCode: 'UNKNOWN',
        username: 'admin',
        password: 'demo1234',
      }),
    });
    expect(wrongOrganization.status).toBe(401);
    expect((await wrongOrganization.json()).error.code).toBe('invalid_credentials');

    const legacyEmailOnly = await fetch(`${running.baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email: 'admin@acme.co', password: 'demo1234' }),
    });
    expect(legacyEmailOnly.status).toBe(400);
    expect((await legacyEmailOnly.json()).error).toMatchObject({
      code: 'invalid_request',
      fieldErrors: {
        organizationCode: 'Organization code is required.',
        username: 'Username is required.',
      },
    });
  });

  it('manages an explicit union of company roles through the authenticated API', async () => {
    const cookies = await login(running.baseUrl);
    const headers = {
      cookie: cookies.header,
      'content-type': 'application/json',
      'x-csrf-token': cookies.csrf,
    };
    const createRole = await fetch(`${running.baseUrl}/api/admin/roles`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ name: 'Auditor' }),
    });
    expect(createRole.status).toBe(201);
    const auditorRoleId = (await createRole.json()).data.id as number;

    const usersBefore = await fetch(`${running.baseUrl}/api/admin/users`, {
      headers: { cookie: cookies.header },
    });
    expect(usersBefore.status).toBe(200);
    const userPayload = (await usersBefore.json()).data;
    const viewer = userPayload.users.find(
      (user: { username: string }) => user.username === 'viewer',
    );
    expect(viewer.roles.map(
      (assigned: { roleName: string }) => assigned.roleName,
    )).toEqual(['Viewer', 'Employee']);
    expect(viewer.roles.every(
      (assigned: { managedBySystem: boolean }) => assigned.managedBySystem === false,
    )).toBe(true);

    const setRoles = await fetch(
      `${running.baseUrl}/api/admin/users/${viewer.id}/actions/set-roles`,
      {
        method: 'POST',
        headers: { ...headers, 'x-request-id': 'set-viewer-role-union' },
        body: JSON.stringify({
          roleIds: [
            ...viewer.roles.map((assigned: { roleId: number }) => assigned.roleId),
            auditorRoleId,
            auditorRoleId,
          ],
        }),
      },
    );
    expect(setRoles.status).toBe(200);
    expect((await setRoles.json()).data.roles.map(
      (assigned: { name: string }) => assigned.name,
    )).toEqual(['Viewer', 'Employee', 'Auditor']);

    const usersAfter = await fetch(`${running.baseUrl}/api/admin/users`, {
      headers: { cookie: cookies.header },
    });
    const updatedViewer = (await usersAfter.json()).data.users.find(
      (user: { username: string }) => user.username === 'viewer',
    );
    expect(updatedViewer.roles.map(
      (assigned: { roleName: string }) => assigned.roleName,
    )).toEqual(['Viewer', 'Employee', 'Auditor']);
    const [audit] = await db.select().from(auditLog)
      .where(eq(auditLog.requestId, 'set-viewer-role-union'));
    expect(audit).toMatchObject({
      entity: 'user_company_role',
      action: 'set_roles',
      entityId: String(viewer.id),
    });
  });

  it('requires a matching CSRF header for state-changing requests', async () => {
    const cookies = await login(running.baseUrl);
    const missing = await fetch(`${running.baseUrl}/api/auth/session/actions/switch-company`, {
      method: 'POST',
      headers: { cookie: cookies.header, 'content-type': 'application/json' },
      body: JSON.stringify({ companyFn: 'C-MY' }),
    });
    expect(missing.status).toBe(403);
    expect((await missing.json()).error.code).toBe('csrf_invalid');

    const valid = await fetch(`${running.baseUrl}/api/auth/session/actions/switch-company`, {
      method: 'POST',
      headers: {
        cookie: cookies.header,
        'content-type': 'application/json',
        'x-csrf-token': cookies.csrf,
        'x-request-id': 'switch-test',
      },
      body: JSON.stringify({ companyFn: 'C-MY' }),
    });
    expect(valid.status).toBe(200);
    expect((await valid.json()).data.activeCompanyFn).toBe('C-MY');
    const [audit] = await db.select().from(auditLog)
      .where(eq(auditLog.requestId, 'switch-test'));
    expect(audit).toMatchObject({ action: 'switch_company', actorUserId: 1 });
  });

  it('rejects switching to a company without a user assignment', async () => {
    const cookies = await login(running.baseUrl, 'viewer@acme.co', 'viewer1234');
    const response = await fetch(`${running.baseUrl}/api/auth/session/actions/switch-company`, {
      method: 'POST',
      headers: {
        cookie: cookies.header,
        'content-type': 'application/json',
        'x-csrf-token': cookies.csrf,
      },
      body: JSON.stringify({ companyFn: 'C-MY' }),
    });
    expect(response.status).toBe(403);
    expect((await response.json()).error.code).toBe('company_access_denied');
  });

  it('enforces write permission before dispatching a registered action', async () => {
    const cookies = await login(running.baseUrl, 'viewer@acme.co', 'viewer1234');
    const response = await fetch(
      `${running.baseUrl}/api/crm/opportunities/1/actions/convert`,
      {
        method: 'POST',
        headers: {
          cookie: cookies.header,
          'content-type': 'application/json',
          'x-csrf-token': cookies.csrf,
          'idempotency-key': 'viewer-denied',
        },
        body: JSON.stringify({}),
      },
    );
    expect(response.status).toBe(403);
    expect((await response.json()).error.code).toBe('permission_denied');
  });

  it('blocks a non-superadmin from a disabled module, but exempts the superadmin who disabled it', async () => {
    const adminCookies = await login(running.baseUrl);
    const adminJsonHeaders = {
      cookie: adminCookies.header,
      'content-type': 'application/json',
      'x-csrf-token': adminCookies.csrf,
    };
    const disableService = await fetch(`${running.baseUrl}/api/admin/modules/service/actions/set-enabled`, {
      method: 'POST',
      headers: adminJsonHeaders,
      body: JSON.stringify({ enabled: false }),
    });
    expect(disableService.status).toBe(200);
    const disable = await fetch(`${running.baseUrl}/api/admin/modules/crm/actions/set-enabled`, {
      method: 'POST',
      headers: adminJsonHeaders,
      body: JSON.stringify({ enabled: false }),
    });
    expect(disable.status).toBe(200);
    expect((await disable.json()).data).toMatchObject({ moduleKey: 'crm', enabled: false });

    // Superadmin is exempt from a gate meant to restrict their own organization's
    // other users, not their own visibility.
    const adminList = await fetch(`${running.baseUrl}/api/crm/customers`, {
      headers: { cookie: adminCookies.header },
    });
    expect(adminList.status).toBe(200);

    // viewer@acme.co genuinely holds crm.read (seed.ts) -- the only reason this
    // request can fail is the module gate, not a permission gap.
    const viewerCookies = await login(running.baseUrl, 'viewer@acme.co', 'viewer1234');
    const viewerList = await fetch(`${running.baseUrl}/api/crm/customers`, {
      headers: { cookie: viewerCookies.header },
    });
    expect(viewerList.status).toBe(403);
    expect((await viewerList.json()).error.code).toBe('module_disabled');

    // Unrelated modules are unaffected for the same viewer.
    const viewerInventory = await fetch(`${running.baseUrl}/api/inventory/products`, {
      headers: { cookie: viewerCookies.header },
    });
    expect(viewerInventory.status).toBe(200);

    const reenable = await fetch(`${running.baseUrl}/api/admin/modules/crm/actions/set-enabled`, {
      method: 'POST',
      headers: adminJsonHeaders,
      body: JSON.stringify({ enabled: true }),
    });
    expect(reenable.status).toBe(200);
    const viewerListAgain = await fetch(`${running.baseUrl}/api/crm/customers`, {
      headers: { cookie: viewerCookies.header },
    });
    expect(viewerListAgain.status).toBe(200);
  });

  it('never allows disabling the admin module itself', async () => {
    const cookies = await login(running.baseUrl);
    const response = await fetch(`${running.baseUrl}/api/admin/modules/admin/actions/set-enabled`, {
      method: 'POST',
      headers: {
        cookie: cookies.header,
        'content-type': 'application/json',
        'x-csrf-token': cookies.csrf,
      },
      body: JSON.stringify({ enabled: false }),
    });
    expect(response.status).toBe(400);
    expect((await response.json()).error.code).toBe('admin_module_required');
  });

  it('takes tenant scope only from the session and rejects query overrides', async () => {
    const cookies = await login(running.baseUrl);
    const override = await fetch(
      `${running.baseUrl}/api/inventory/products?companyFn=C-MY`,
      { headers: { cookie: cookies.header } },
    );
    expect(override.status).toBe(400);
    expect((await override.json()).error.code).toBe('invalid_query');
  });

  it('serves the complete canonical inventory read model with camel-case API fields', async () => {
    const [item] = await db.select({ id: product.id }).from(product)
      .where(eq(product.sku, 'SG-WIDGET'));
    const [location] = await db.insert(warehouse).values({
      masterFn: 'M1',
      companyFn: 'C-SG',
      code: 'API-WH',
      name: 'API Warehouse',
    }).returning({ id: warehouse.id });
    const [bin] = await db.insert(warehouseBin).values({
      masterFn: 'M1',
      companyFn: 'C-SG',
      warehouseId: location.id,
      code: 'A-01',
      name: 'Aisle A 01',
    }).returning({ id: warehouseBin.id });
    await db.insert(stockLevel).values({
      masterFn: 'M1',
      companyFn: 'C-SG',
      productId: item.id,
      warehouseId: location.id,
      qty: '5.0000',
    });
    await db.insert(stockLocationBalance).values({
      masterFn: 'M1',
      companyFn: 'C-SG',
      productId: item.id,
      warehouseId: location.id,
      binId: bin.id,
      trackingKey: 'none',
      qty: '5.0000',
    });
    await db.insert(stockMovement).values({
      masterFn: 'M1',
      companyFn: 'C-SG',
      productId: item.id,
      warehouseId: location.id,
      binId: bin.id,
      movementGroup: 'api-read-proof',
      qty: '5.0000',
      direction: 'in',
      refType: 'inventory_adjustment',
      refId: 1,
    });

    const cookies = await login(running.baseUrl);
    const resources = [
      'products',
      'warehouses',
      'stock-levels',
      'stock-movements',
      'bins',
      'location-balances',
    ];
    const responses = await Promise.all(resources.map((resource) => fetch(
      `${running.baseUrl}/api/inventory/${resource}?limit=100`,
      { headers: { cookie: cookies.header } },
    )));
    responses.forEach((response) => expect(response.status).toBe(200));
    const [productsBody, warehousesBody, levelsBody, movementsBody, binsBody, balancesBody] =
      await Promise.all(responses.map((response) => response.json()));

    expect(productsBody.data).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: item.id, sku: 'SG-WIDGET', standardCost: '6.5000' }),
    ]));
    expect(warehousesBody.data).toEqual([
      expect.objectContaining({ id: location.id, code: 'API-WH' }),
    ]);
    expect(levelsBody.data).toEqual([
      expect.objectContaining({ productId: item.id, warehouseId: location.id, qty: '5.0000' }),
    ]);
    expect(movementsBody.data).toEqual([
      expect.objectContaining({
        productId: item.id,
        warehouseId: location.id,
        binId: bin.id,
        direction: 'in',
      }),
    ]);
    expect(binsBody.data).toEqual([
      expect.objectContaining({ warehouseId: location.id, code: 'A-01' }),
    ]);
    expect(balancesBody.data).toEqual([
      expect.objectContaining({
        productId: item.id,
        warehouseId: location.id,
        binId: bin.id,
        trackingKey: 'none',
        qty: '5.0000',
      }),
    ]);
  });

  it('serves the complete canonical sales read model with tenant-scoped joins', async () => {
    const [buyer] = await db.select({ id: customer.id }).from(customer)
      .where(eq(customer.code, 'CUST1'));
    const [item] = await db.select({ id: product.id }).from(product)
      .where(eq(product.sku, 'SG-WIDGET'));
    const [order] = await db.insert(salesOrder).values({
      masterFn: 'M1',
      companyFn: 'C-SG',
      docNo: 'SO-READ-MODEL',
      customerId: buyer.id,
      orderDate: '2026-07-19',
      currency: 'SGD',
      netAmount: '10.00',
      taxAmount: '0.90',
      totalAmount: '10.90',
    }).returning({ id: salesOrder.id });
    await db.insert(salesOrderLine).values({
      masterFn: 'M1',
      companyFn: 'C-SG',
      orderId: order.id,
      lineNo: 1,
      productId: item.id,
      qty: '1',
      unitPrice: '10',
      netAmount: '10',
      taxCode: 'SR',
      taxRate: '9',
      taxAmount: '0.9',
    });
    await db.insert(invoice).values({
      masterFn: 'M1',
      companyFn: 'C-SG',
      docNo: 'INV-SO-READ-MODEL',
      orderId: order.id,
      customerId: buyer.id,
      invoiceDate: '2026-07-19',
      currency: 'SGD',
      netAmount: '10.00',
      taxAmount: '0.90',
      totalAmount: '10.90',
    });
    const cookies = await login(running.baseUrl);
    const resources = ['customers', 'orders', 'order-lines', 'invoices'];
    const responses = await Promise.all(resources.map((resource) => fetch(
      `${running.baseUrl}/api/sales/${resource}?limit=100`,
      { headers: { cookie: cookies.header } },
    )));
    responses.forEach((response) => expect(response.status).toBe(200));
    const [customersBody, ordersBody, linesBody, invoicesBody] = await Promise.all(
      responses.map((response) => response.json()),
    );
    expect(customersBody.data).toEqual(expect.arrayContaining([
      expect.objectContaining({ code: 'CUST1', name: expect.any(String) }),
    ]));
    expect(ordersBody.data[0]).toMatchObject({
      docNo: expect.any(String),
      customerId: expect.any(Number),
      totalAmount: expect.any(String),
    });
    expect(linesBody.data[0]).toMatchObject({
      orderId: expect.any(Number),
      productId: expect.any(Number),
      unitPrice: expect.any(String),
      taxRate: expect.any(String),
    });
    expect(invoicesBody.data[0]).toMatchObject({
      docNo: expect.any(String),
      orderId: expect.any(Number),
      customerId: expect.any(Number),
    });
    expect(
      linesBody.data.every((line: { orderId: number }) =>
        ordersBody.data.some((order: { id: number }) => order.id === line.orderId)),
    ).toBe(true);
  });

  it('serves canonical chart-of-accounts and immutable journal legs', async () => {
    const accounts = await db.select().from(account);
    const ar = accounts.find((row) => row.code === '1100');
    const revenue = accounts.find((row) => row.code === '4000');
    expect(ar).toBeDefined();
    expect(revenue).toBeDefined();
    await db.insert(glEntry).values([
      {
        masterFn: 'M1',
        companyFn: 'C-SG',
        journalRef: 'JE-READ-MODEL',
        accountId: ar!.id,
        debit: '25.00',
        credit: '0',
        memo: 'AR',
      },
      {
        masterFn: 'M1',
        companyFn: 'C-SG',
        journalRef: 'JE-READ-MODEL',
        accountId: revenue!.id,
        debit: '0',
        credit: '25.00',
        memo: 'Revenue',
      },
    ]);
    const cookies = await login(running.baseUrl);
    const [accountsResponse, entriesResponse] = await Promise.all([
      fetch(`${running.baseUrl}/api/finance/accounts?limit=100`, {
        headers: { cookie: cookies.header },
      }),
      fetch(`${running.baseUrl}/api/finance/gl-entries?limit=100`, {
        headers: { cookie: cookies.header },
      }),
    ]);
    expect(accountsResponse.status).toBe(200);
    expect(entriesResponse.status).toBe(200);
    const accountsBody = await accountsResponse.json();
    const entriesBody = await entriesResponse.json();
    expect(accountsBody.data).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: ar!.id, code: '1100', type: 'asset' }),
      expect.objectContaining({ id: revenue!.id, code: '4000', type: 'income' }),
    ]));
    // Filtered to this test's own journalRef: seedDemo() also seeds real GL legs
    // (EPIC-024's Payment Voucher/Bank Receipt demo fixtures) that would otherwise
    // leak into an unfiltered exact-array assertion here.
    const ownEntries = (entriesBody.data as Array<{ journalRef: string }>)
      .filter((row) => row.journalRef === 'JE-READ-MODEL');
    expect(ownEntries).toEqual([
      expect.objectContaining({
        journalRef: 'JE-READ-MODEL',
        accountId: ar!.id,
        debit: '25.00',
        credit: '0.00',
      }),
      expect.objectContaining({
        journalRef: 'JE-READ-MODEL',
        accountId: revenue!.id,
        debit: '0.00',
        credit: '25.00',
      }),
    ]);
  });

  it('runs the canonical purchasing approval, receive and supplier-invoice chain over HTTP', async () => {
    const [item] = await db.select({ id: product.id }).from(product)
      .where(eq(product.sku, 'SG-WIDGET'));
    const [vendor] = await db.select({ id: supplier.id }).from(supplier)
      .where(eq(supplier.code, 'SUPP1'));
    const [location] = await db.insert(warehouse).values({
      masterFn: 'M1',
      companyFn: 'C-SG',
      code: 'PUR-API',
      name: 'Purchasing API Warehouse',
    }).returning({ id: warehouse.id });
    const cookies = await login(running.baseUrl);
    const headers = {
      cookie: cookies.header,
      'content-type': 'application/json',
      'x-csrf-token': cookies.csrf,
    };
    const movementCountBefore = (await db.select().from(stockMovement)).length;

    const created = await fetch(`${running.baseUrl}/api/purchasing/purchase-orders`, {
      method: 'POST',
      headers: { ...headers, 'x-request-id': 'po-create-api' },
      body: JSON.stringify({
        docNo: 'PO-API-1',
        supplierId: vendor.id,
        orderDate: '2026-07-19',
        currency: 'SGD',
        lines: [{
          productId: item.id,
          qty: 2,
          unitCost: 10,
          taxCode: 'SR',
        }],
      }),
    });
    expect(created.status).toBe(201);
    const createdBody = await created.json();
    expect(createdBody.data).toMatchObject({
      status: 'pending_approval',
      net: 20,
      tax: 1.8,
      total: 21.8,
      lines: 1,
    });
    const orderId = createdBody.data.orderId as number;

    const blockedReceipt = await fetch(
      `${running.baseUrl}/api/purchasing/purchase-orders/${orderId}/actions/receive`,
      {
        method: 'POST',
        headers: { ...headers, 'idempotency-key': 'po-receive-before-approval' },
        body: JSON.stringify({
          warehouseId: location.id,
          docNo: 'GR-BLOCKED-API',
          receivedDate: '2026-07-19',
        }),
      },
    );
    expect(blockedReceipt.status).toBe(409);
    expect(await db.select().from(stockMovement)).toHaveLength(movementCountBefore);
    expect(await db.select().from(glEntry).where(eq(glEntry.journalRef, 'PO-API-1'))).toHaveLength(0);

    const missingNote = await fetch(
      `${running.baseUrl}/api/purchasing/purchase-orders/${orderId}/actions/approve`,
      {
        method: 'POST',
        headers: { ...headers, 'idempotency-key': 'po-approve-missing-note' },
        body: '{}',
      },
    );
    expect(missingNote.status).toBe(400);
    expect((await missingNote.json()).error.code).toBe('invalid_action_payload');
    const viewerApprovalAuth = await login(running.baseUrl, 'viewer@acme.co', 'viewer1234');
    const deniedApproval = await fetch(
      `${running.baseUrl}/api/purchasing/purchase-orders/${orderId}/actions/approve`,
      {
        method: 'POST',
        headers: {
          cookie: viewerApprovalAuth.header,
          'content-type': 'application/json',
          'x-csrf-token': viewerApprovalAuth.csrf,
          'idempotency-key': 'viewer-po-approve-denied',
        },
        body: JSON.stringify({ note: 'Viewer must not approve.' }),
      },
    );
    expect(deniedApproval.status).toBe(403);
    expect((await deniedApproval.json()).error.code).toBe('permission_denied');

    const approve = () => fetch(
      `${running.baseUrl}/api/purchasing/purchase-orders/${orderId}/actions/approve`,
      {
        method: 'POST',
        headers: {
          ...headers,
          'idempotency-key': 'po-approve-api-1',
          'x-request-id': 'po-approve-api',
        },
        body: JSON.stringify({ note: 'Approved for the production requirement.' }),
      },
    );
    const approved = await approve();
    expect(approved.status).toBe(200);
    expect((await approved.json()).data).toMatchObject({
      status: 'open',
      approvalStatus: 'approved',
      decidedByName: 'Admin',
    });
    const approvalReplay = await approve();
    expect(approvalReplay.status).toBe(200);
    expect(approvalReplay.headers.get('idempotency-replayed')).toBe('true');
    expect(await db.select().from(stockMovement)).toHaveLength(movementCountBefore);
    expect(await db.select().from(glEntry).where(eq(glEntry.journalRef, 'PO-API-1'))).toHaveLength(0);

    const lineResponse = await fetch(
      `${running.baseUrl}/api/purchasing/purchase-order-lines?limit=100`,
      { headers: { cookie: cookies.header } },
    );
    expect(lineResponse.status).toBe(200);
    const lineRows = (await lineResponse.json()).data as Array<{ orderId: number }>;
    // Filtered to this order's own lines: seedDemo() also seeds an unrelated PO/line
    // (EPIC-024's Payment Voucher demo fixture) that would otherwise leak into an
    // unfiltered exact-array assertion here.
    expect(lineRows.filter((row) => row.orderId === orderId)).toEqual([
      expect.objectContaining({
        orderId,
        productId: item.id,
        qty: '2.0000',
        unitCost: '10.0000',
      }),
    ]);

    const receive = () => fetch(
      `${running.baseUrl}/api/purchasing/purchase-orders/${orderId}/actions/receive`,
      {
        method: 'POST',
        headers: { ...headers, 'idempotency-key': 'po-receive-api-1' },
        body: JSON.stringify({
          warehouseId: location.id,
          docNo: 'GR-API-1',
          receivedDate: '2026-07-19',
        }),
      },
    );
    const received = await receive();
    expect(received.status).toBe(200);
    expect((await received.json()).data).toMatchObject({ lines: 1 });
    const replay = await receive();
    expect(replay.status).toBe(200);
    expect(replay.headers.get('idempotency-replayed')).toBe('true');

    const invoiced = await fetch(
      `${running.baseUrl}/api/purchasing/purchase-orders/${orderId}/actions/post-invoice`,
      {
        method: 'POST',
        headers: { ...headers, 'idempotency-key': 'po-invoice-api-1' },
        body: JSON.stringify({
          docNo: 'SINV-API-1',
          invoiceDate: '2026-07-19',
        }),
      },
    );
    expect(invoiced.status).toBe(200);
    expect((await invoiced.json()).data).toMatchObject({
      net: 20,
      tax: 1.8,
      total: 21.8,
    });

    // Filtered to this test's own order (seedDemo() also seeds an unrelated
    // PO/invoice — EPIC-024's Payment Voucher demo fixture).
    expect(await db.select().from(purchaseOrder).where(eq(purchaseOrder.id, orderId))).toHaveLength(1);
    expect(await db.select().from(purchaseOrderApproval)
      .where(eq(purchaseOrderApproval.orderId, orderId))).toEqual([
      expect.objectContaining({
        status: 'approved',
        decidedByName: 'Admin',
        decisionNote: 'Approved for the production requirement.',
      }),
    ]);
    expect(await db.select().from(purchaseOrderLine).where(eq(purchaseOrderLine.orderId, orderId))).toHaveLength(1);
    expect(await db.select().from(goodsReceipt).where(eq(goodsReceipt.orderId, orderId))).toHaveLength(1);
    expect(await db.select().from(supplierInvoice).where(eq(supplierInvoice.orderId, orderId))).toHaveLength(1);
    expect(await db.select().from(stockLocationBalance)).toEqual([
      expect.objectContaining({
        productId: item.id,
        warehouseId: location.id,
        trackingKey: 'none',
        qty: '2.0000',
      }),
    ]);
    expect((await db.select().from(glEntry)
      .where(eq(glEntry.journalRef, 'SINV-API-1')))).toHaveLength(3);
    expect((await db.select().from(auditLog)
      .where(eq(auditLog.requestId, 'po-create-api')))).toEqual([
      expect.objectContaining({
        entity: 'purchasing/purchase-orders', entityId: String(orderId), action: 'create',
      }),
    ]);
    expect((await db.select().from(auditLog)
      .where(eq(auditLog.requestId, 'po-approve-api')))).toEqual([
      expect.objectContaining({ entity: 'purchasing/purchase-orders', action: 'approve' }),
    ]);

    const viewer = await login(running.baseUrl, 'viewer@acme.co', 'viewer1234');
    const denied = await fetch(`${running.baseUrl}/api/purchasing/purchase-orders`, {
      method: 'POST',
      headers: {
        cookie: viewer.header,
        'content-type': 'application/json',
        'x-csrf-token': viewer.csrf,
      },
      body: JSON.stringify({
        docNo: 'PO-DENIED',
        supplierId: vendor.id,
        orderDate: '2026-07-19',
        currency: 'SGD',
        lines: [{ productId: item.id, qty: 1, unitCost: 1, taxCode: 'SR' }],
      }),
    });
    expect(denied.status).toBe(403);
    expect((await denied.json()).error.code).toBe('permission_denied');
  });

  it('runs the RFQ, competitive supplier quotation and purchase-order award chain over HTTP', async () => {
    const [item] = await db.select({ id: product.id }).from(product)
      .where(eq(product.sku, 'SG-WIDGET'));
    const vendors = await db.select({ id: supplier.id }).from(supplier)
      .where(and(eq(supplier.masterFn, 'M1'), eq(supplier.companyFn, 'C-SG')));
    expect(vendors.length).toBeGreaterThanOrEqual(2);
    const cookies = await login(running.baseUrl);
    const headers = {
      cookie: cookies.header,
      'content-type': 'application/json',
      'x-csrf-token': cookies.csrf,
    };
    const created = await fetch(`${running.baseUrl}/api/purchasing/rfqs`, {
      method: 'POST',
      headers: { ...headers, 'x-request-id': 'rfq-create-api' },
      body: JSON.stringify({
        docNo: 'RFQ-API-1', subject: 'API competitive source',
        rfqDate: '2026-07-22', responseDueDate: '2026-08-15',
        supplierIds: vendors.slice(0, 2).map((row) => row.id),
        lines: [{ productId: item.id, qty: 4 }],
      }),
    });
    expect(created.status).toBe(201);
    const rfqId = (await created.json()).data.id as number;

    const issue = () => fetch(`${running.baseUrl}/api/purchasing/rfqs/${rfqId}/actions/issue`, {
      method: 'POST', headers: { ...headers, 'idempotency-key': 'rfq-issue-api-1' }, body: '{}',
    });
    expect((await issue()).status).toBe(200);
    const issueReplay = await issue();
    expect(issueReplay.status).toBe(200);
    expect(issueReplay.headers.get('idempotency-replayed')).toBe('true');

    const [rfqLine] = await db.select({ id: purchaseRfqLine.id }).from(purchaseRfqLine)
      .where(eq(purchaseRfqLine.rfqId, rfqId));
    const createQuote = async (supplierId: number, docNo: string, unitCost: number) => {
      const response = await fetch(`${running.baseUrl}/api/purchasing/supplier-quotations`, {
        method: 'POST', headers,
        body: JSON.stringify({
          docNo, rfqId, supplierId, quoteDate: '2026-07-23', validUntil: '2026-09-30',
          currency: 'SGD', leadTimeDays: 8, paymentTerms: 'Net 30',
          lines: [{ rfqLineId: rfqLine.id, unitCost, taxCode: 'SR' }],
        }),
      });
      expect(response.status).toBe(201);
      return (await response.json()).data as { id: number; totalAmount: string };
    };
    const winner = await createQuote(vendors[0].id, 'SQ-API-1', 6);
    await createQuote(vendors[1].id, 'SQ-API-2', 7);
    expect(winner.totalAmount).toBe('26.16');
    const [responded] = await db.select().from(purchaseRfq).where(eq(purchaseRfq.id, rfqId));
    expect(responded.status).toBe('responded');

    const award = () => fetch(
      `${running.baseUrl}/api/purchasing/supplier-quotations/${winner.id}/actions/convert-to-purchase-order`,
      {
        method: 'POST',
        headers: { ...headers, 'x-request-id': 'rfq-award-api', 'idempotency-key': 'rfq-award-api-1' },
        body: JSON.stringify({ docNo: 'PO-RFQ-API-1', orderDate: '2026-07-24' }),
      },
    );
    const awarded = await award();
    expect(awarded.status).toBe(200);
    expect((await awarded.json()).data).toMatchObject({
      quotationId: winner.id, rfqId, purchaseOrderNo: 'PO-RFQ-API-1',
      status: 'pending_approval', totalAmount: '26.16',
    });
    const replay = await award();
    expect(replay.status).toBe(200);
    expect(replay.headers.get('idempotency-replayed')).toBe('true');
    const quotes = await db.select().from(supplierQuotation)
      .where(eq(supplierQuotation.rfqId, rfqId));
    expect(quotes.map((row) => row.status).sort()).toEqual(['converted', 'rejected']);
    const [order] = await db.select().from(purchaseOrder)
      .where(eq(purchaseOrder.supplierQuotationId, winner.id));
    expect(order).toMatchObject({ docNo: 'PO-RFQ-API-1', status: 'pending_approval' });
    expect(await db.select().from(purchaseOrderApproval)
      .where(eq(purchaseOrderApproval.orderId, order.id))).toEqual([
      expect.objectContaining({ status: 'pending' }),
    ]);
    const [audit] = await db.select().from(auditLog)
      .where(eq(auditLog.requestId, 'rfq-award-api'));
    expect(audit).toMatchObject({
      entity: 'purchasing/supplier-quotations', entityId: String(winner.id),
      action: 'convert-to-purchase-order',
    });
  });

  it('revokes logout sessions and does not accept the CSRF cookie alone', async () => {
    const cookies = await login(running.baseUrl);
    const cookieOnly = await fetch(`${running.baseUrl}/api/auth/logout`, {
      method: 'POST',
      headers: { cookie: cookies.header },
    });
    expect(cookieOnly.status).toBe(403);

    const logout = await fetch(`${running.baseUrl}/api/auth/logout`, {
      method: 'POST',
      headers: { cookie: cookies.header, 'x-csrf-token': cookies.csrf },
    });
    expect(logout.status).toBe(200);
    const session = await fetch(`${running.baseUrl}/api/auth/session`, {
      headers: { cookie: cookies.header },
    });
    expect(session.status).toBe(401);
  });

  it('returns the structured error contract for malformed JSON', async () => {
    const response = await fetch(`${running.baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-request-id': 'bad-json' },
      body: '{',
    });
    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({
      error: {
        code: 'invalid_json',
        message: 'Request body is not valid JSON.',
        requestId: 'bad-json',
      },
    });
  });

  it('dispatches a CRM conversion with atomic idempotency, audit and ETag', async () => {
    const [item] = await db.select({ id: product.id }).from(product)
      .where(eq(product.sku, 'SG-WIDGET'));
    const [location] = await db.insert(warehouse).values({
      masterFn: 'M1',
      companyFn: 'C-SG',
      code: 'MAIN',
      name: 'Main Warehouse',
    }).returning({ id: warehouse.id });
    await db.insert(stockLevel).values({
      masterFn: 'M1',
      companyFn: 'C-SG',
      productId: item.id,
      warehouseId: location.id,
      qty: '2',
    });
    const cookies = await login(running.baseUrl);
    const detail = await fetch(`${running.baseUrl}/api/crm/opportunities/1`, {
      headers: { cookie: cookies.header },
    });
    expect(detail.status).toBe(200);
    expect(detail.headers.get('etag')).toBe('"1"');

    const payload = {
      docNo: 'SO-API-1',
      orderDate: '2026-07-18',
      lines: [{
        productId: item.id,
        warehouseId: location.id,
        qty: 5,
        unitPrice: 10,
        taxCode: 'SR',
      }],
    };
    const action = (body: unknown, key?: string) => fetch(
      `${running.baseUrl}/api/crm/opportunities/1/actions/convert`,
      {
        method: 'POST',
        headers: {
          cookie: cookies.header,
          'content-type': 'application/json',
          'x-csrf-token': cookies.csrf,
          'x-request-id': 'crm-action-test',
          ...(key ? { 'idempotency-key': key } : {}),
        },
        body: JSON.stringify(body),
      },
    );
    const missingKey = await action(payload);
    expect(missingKey.status).toBe(428);
    expect((await missingKey.json()).error.code).toBe('idempotency_key_required');

    const insufficient = await action(payload, 'crm-convert-1');
    expect(insufficient.status).toBe(409);
    expect((await insufficient.json()).error.code).toBe('insufficient_stock');
    expect(await db.select().from(apiIdempotency)).toHaveLength(0);

    await db.update(stockLevel).set({ qty: '50' }).where(eq(stockLevel.productId, item.id));
    const converted = await action(payload, 'crm-convert-1');
    expect(converted.status).toBe(200);
    const convertedBody = await converted.json();
    expect(convertedBody.data).toMatchObject({ opportunityId: 1, total: 54.5 });
    const replay = await action(payload, 'crm-convert-1');
    expect(replay.status).toBe(200);
    expect(replay.headers.get('idempotency-replayed')).toBe('true');
    expect(await replay.json()).toEqual(convertedBody);

    const changed = await action({ ...payload, docNo: 'SO-CHANGED' }, 'crm-convert-1');
    expect(changed.status).toBe(409);
    expect((await changed.json()).error.code).toBe('idempotency_key_reused');
    const [audit] = await db.select().from(auditLog)
      .where(eq(auditLog.requestId, 'crm-action-test'));
    expect(audit).toMatchObject({
      entity: 'crm/opportunities',
      entityId: '1',
      action: 'convert',
    });
  });

  it('serves the canonical CRM customer pipeline and creates opportunities with tenant/RBAC guards', async () => {
    const cookies = await login(running.baseUrl);
    const customersResponse = await fetch(`${running.baseUrl}/api/crm/customers`, {
      headers: { cookie: cookies.header },
    });
    expect(customersResponse.status).toBe(200);
    const customersBody = await customersResponse.json();
    expect(customersBody.data).toEqual([
      expect.objectContaining({ code: 'CUST1', name: 'Beta Pte Ltd' }),
    ]);

    const [buyer] = await db.select({ id: customer.id }).from(customer)
      .where(eq(customer.code, 'CUST1'));
    const headers = {
      cookie: cookies.header,
      'content-type': 'application/json',
      'x-csrf-token': cookies.csrf,
      'x-request-id': 'crm-create-api',
    };
    const createdResponse = await fetch(`${running.baseUrl}/api/crm/opportunities`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        docNo: 'OPP-API-NEW',
        customerId: buyer.id,
        title: 'Canonical API opportunity',
        value: 12500,
        currency: 'SGD',
        stage: 'qualified',
        probability: 40,
        closeDate: '2026-08-31',
      }),
    });
    expect(createdResponse.status).toBe(201);
    const createdBody = await createdResponse.json();
    expect(createdBody.data).toMatchObject({
      id: expect.any(Number),
      opportunityId: expect.any(Number),
      docNo: 'OPP-API-NEW',
    });
    expect(await db.select().from(opportunity)
      .where(eq(opportunity.docNo, 'OPP-API-NEW'))).toEqual([
      expect.objectContaining({
        masterFn: 'M1',
        companyFn: 'C-SG',
        customerId: buyer.id,
        stage: 'qualified',
      }),
    ]);
    expect(await db.select().from(auditLog)
      .where(eq(auditLog.requestId, 'crm-create-api'))).toEqual([
      expect.objectContaining({
        entity: 'crm/opportunities',
        entityId: String(createdBody.data.id),
        action: 'create',
      }),
    ]);

    const [foreignCustomer] = await db.insert(customer).values({
      masterFn: 'M1',
      companyFn: 'C-MY',
      code: 'MY-CROSS',
      name: 'Malaysia Customer',
    }).returning({ id: customer.id });
    const crossTenant = await fetch(`${running.baseUrl}/api/crm/opportunities`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        docNo: 'OPP-CROSS',
        customerId: foreignCustomer.id,
        title: 'Wrong tenant',
        value: 100,
        currency: 'SGD',
        closeDate: '2026-08-31',
      }),
    });
    expect(crossTenant.status).toBe(422);
    expect((await crossTenant.json()).error.code).toBe('validation_failed');

    const viewer = await login(running.baseUrl, 'viewer@acme.co', 'viewer1234');
    const denied = await fetch(`${running.baseUrl}/api/crm/opportunities`, {
      method: 'POST',
      headers: {
        cookie: viewer.header,
        'content-type': 'application/json',
        'x-csrf-token': viewer.csrf,
      },
      body: JSON.stringify({
        docNo: 'OPP-DENIED',
        customerId: buyer.id,
        title: 'Denied',
        value: 100,
        currency: 'SGD',
        closeDate: '2026-08-31',
      }),
    });
    expect(denied.status).toBe(403);
    expect((await denied.json()).error.code).toBe('permission_denied');
  });

  it('logs an opportunity activity and marks the opportunity lost through audited API writes', async () => {
    const cookies = await login(running.baseUrl);
    const [buyer] = await db.select({ id: customer.id }).from(customer)
      .where(eq(customer.code, 'CUST1'));
    const [opp] = await db.insert(opportunity).values({
      masterFn: 'M1', companyFn: 'C-SG', docNo: 'OPP-API-LOSS',
      customerId: buyer.id, title: 'At-risk API deal', value: '2500', currency: 'SGD',
      stage: 'proposal', probability: '55', closeDate: '2026-09-30',
    }).returning({ id: opportunity.id });
    const headers = {
      cookie: cookies.header,
      'content-type': 'application/json',
      'x-csrf-token': cookies.csrf,
    };

    const logged = await fetch(`${running.baseUrl}/api/crm/activities`, {
      method: 'POST',
      headers: { ...headers, 'x-request-id': 'crm-activity-api' },
      body: JSON.stringify({
        opportunityId: opp.id,
        customerId: buyer.id,
        kind: 'call',
        body: 'Customer requested a revised proposal.',
      }),
    });
    expect(logged.status).toBe(201);

    const markLost = () => fetch(
      `${running.baseUrl}/api/crm/opportunities/${opp.id}/actions/mark-lost`,
      {
        method: 'POST',
        headers: {
          ...headers,
          'x-request-id': 'crm-lost-api',
          'idempotency-key': `crm-lost-${opp.id}-v1`,
        },
        body: JSON.stringify({ reason: 'Budget withdrawn' }),
      },
    );
    const lost = await markLost();
    expect(lost.status).toBe(200);
    expect((await lost.json()).data).toMatchObject({ id: opp.id, stage: 'lost', version: 2 });
    const replay = await markLost();
    expect(replay.status).toBe(200);
    expect(replay.headers.get('idempotency-replayed')).toBe('true');

    const [stored] = await db.select().from(opportunity).where(eq(opportunity.id, opp.id));
    expect(stored).toMatchObject({ stage: 'lost', version: 2 });
    const events = await db.select().from(activity).where(eq(activity.opportunityId, opp.id));
    expect(events.map((event) => event.body)).toEqual([
      'Customer requested a revised proposal.',
      'Marked lost: Budget withdrawn',
    ]);
    const [audit] = await db.select().from(auditLog).where(eq(auditLog.requestId, 'crm-lost-api'));
    expect(audit).toMatchObject({
      entity: 'crm/opportunities',
      entityId: String(opp.id),
      action: 'mark-lost',
    });
  });

  it('creates and approves a sales order over HTTP with RBAC, audit and idempotency', async () => {
    const [item] = await db.select({ id: product.id }).from(product)
      .where(eq(product.sku, 'SG-WIDGET'));
    const [buyer] = await db.select({ id: customer.id }).from(customer)
      .where(eq(customer.code, 'CUST1'));
    const stockBefore = (await db.select().from(stockMovement)).length;
    const glBefore = (await db.select().from(glEntry)).length;
    const cookies = await login(running.baseUrl);
    const headers = {
      cookie: cookies.header,
      'content-type': 'application/json',
      'x-csrf-token': cookies.csrf,
    };
    const created = await fetch(`${running.baseUrl}/api/sales/orders`, {
      method: 'POST',
      headers: { ...headers, 'x-request-id': 'sales-order-create-api' },
      body: JSON.stringify({
        docNo: 'SO-APPROVAL-API-1',
        customerId: buyer.id,
        orderDate: '2026-07-22',
        currency: 'SGD',
        approvalReason: 'Direct API order requires sales approval.',
        lines: [{ productId: item.id, qty: '3', unitPrice: '12.50', taxCode: 'SR' }],
      }),
    });
    expect(created.status).toBe(201);
    const createdBody = (await created.json()).data as {
      orderId: number;
      approvalId: number;
      totalAmount: string;
    };
    expect(createdBody).toMatchObject({ totalAmount: '40.88' });
    const [approval] = await db.select().from(salesOrderApproval)
      .where(eq(salesOrderApproval.id, createdBody.approvalId));
    expect(approval).toMatchObject({
      orderId: createdBody.orderId,
      status: 'pending',
      reason: 'Direct API order requires sales approval.',
    });
    expect((await db.select().from(stockMovement)).length).toBe(stockBefore);
    expect((await db.select().from(glEntry)).length).toBe(glBefore);

    const blockedConfirm = await fetch(
      `${running.baseUrl}/api/sales/orders/${createdBody.orderId}/actions/confirm`,
      {
        method: 'POST',
        headers: { ...headers, 'idempotency-key': 'sales-order-confirm-before-approval' },
        body: JSON.stringify({ warehouseId: 1 }),
      },
    );
    expect(blockedConfirm.status).toBe(409);
    expect((await blockedConfirm.json()).error.code).toBe('invalid_state');

    const approve = () => fetch(
      `${running.baseUrl}/api/sales/orders/${createdBody.orderId}/actions/approve`,
      {
        method: 'POST',
        headers: {
          ...headers,
          'x-request-id': 'sales-order-approve-api',
          'idempotency-key': 'sales-order-approve-api-1',
        },
        body: JSON.stringify({ note: 'Commercial terms reviewed and approved.' }),
      },
    );
    const approved = await approve();
    expect(approved.status).toBe(200);
    expect((await approved.json()).data).toMatchObject({
      id: createdBody.orderId,
      status: 'draft',
      approvalStatus: 'approved',
      decidedByName: 'Admin',
    });
    const replay = await approve();
    expect(replay.status).toBe(200);
    expect(replay.headers.get('idempotency-replayed')).toBe('true');
    expect((await db.select().from(stockMovement)).length).toBe(stockBefore);
    expect((await db.select().from(glEntry)).length).toBe(glBefore);
    const [createAudit] = await db.select().from(auditLog)
      .where(eq(auditLog.requestId, 'sales-order-create-api'));
    const [approveAudit] = await db.select().from(auditLog)
      .where(eq(auditLog.requestId, 'sales-order-approve-api'));
    expect(createAudit).toMatchObject({
      entity: 'sales/orders', action: 'create', entityId: String(createdBody.orderId),
    });
    expect(approveAudit).toMatchObject({
      entity: 'sales/orders', action: 'approve', entityId: String(createdBody.orderId),
    });

    const viewer = await login(running.baseUrl, 'viewer@acme.co', 'viewer1234');
    const denied = await fetch(`${running.baseUrl}/api/sales/orders`, {
      method: 'POST',
      headers: {
        cookie: viewer.header,
        'content-type': 'application/json',
        'x-csrf-token': viewer.csrf,
      },
      body: JSON.stringify({
        docNo: 'SO-DENIED', customerId: buyer.id, orderDate: '2026-07-22', currency: 'SGD',
        lines: [{ productId: item.id, qty: 1, unitPrice: 1, taxCode: 'SR' }],
      }),
    });
    expect(denied.status).toBe(403);
    expect((await denied.json()).error.code).toBe('permission_denied');
  });

  it('confirms an existing sales draft through the transactional action dispatcher', async () => {
    const [item] = await db.select({ id: product.id }).from(product)
      .where(eq(product.sku, 'SG-WIDGET'));
    const [buyer] = await db.select({ id: customer.id }).from(customer)
      .where(eq(customer.code, 'CUST1'));
    const [location] = await db.insert(warehouse).values({
      masterFn: 'M1',
      companyFn: 'C-SG',
      code: 'SALES-ACTION',
      name: 'Sales action warehouse',
    }).returning({ id: warehouse.id });
    await db.insert(stockLevel).values({
      masterFn: 'M1',
      companyFn: 'C-SG',
      productId: item.id,
      warehouseId: location.id,
      qty: '20',
    });
    const [draft] = await db.insert(salesOrder).values({
      masterFn: 'M1',
      companyFn: 'C-SG',
      docNo: 'SO-API-DRAFT',
      customerId: buyer.id,
      status: 'draft',
      orderDate: '2026-07-18',
      currency: 'SGD',
      netAmount: '50.00',
      taxAmount: '4.50',
      totalAmount: '54.50',
    }).returning({ id: salesOrder.id });
    await db.insert(salesOrderLine).values({
      masterFn: 'M1',
      companyFn: 'C-SG',
      orderId: draft.id,
      lineNo: 1,
      productId: item.id,
      qty: '5',
      unitPrice: '10',
      netAmount: '50',
      taxCode: 'SR',
      taxRate: '9',
      taxAmount: '4.5',
    });

    const cookies = await login(running.baseUrl);
    const action = (key?: string) => fetch(
      `${running.baseUrl}/api/sales/orders/${draft.id}/actions/confirm`,
      {
        method: 'POST',
        headers: {
          cookie: cookies.header,
          'content-type': 'application/json',
          'x-csrf-token': cookies.csrf,
          'x-request-id': 'sales-confirm-test',
          ...(key ? { 'idempotency-key': key } : {}),
        },
        body: JSON.stringify({ warehouseId: location.id }),
      },
    );

    const missingKey = await action();
    expect(missingKey.status).toBe(428);
    const confirmed = await action('sales-confirm-1');
    expect(confirmed.status).toBe(200);
    const confirmedBody = await confirmed.json();
    expect(confirmedBody.data).toMatchObject({
      orderId: draft.id,
      deliveryDocNo: 'DO-SO-API-DRAFT',
      invDocNo: 'INV-SO-API-DRAFT',
      total: 54.5,
    });
    const replay = await action('sales-confirm-1');
    expect(replay.status).toBe(200);
    expect(replay.headers.get('idempotency-replayed')).toBe('true');
    expect(await replay.json()).toEqual(confirmedBody);
    const duplicate = await action('sales-confirm-2');
    expect(duplicate.status).toBe(409);
    expect((await duplicate.json()).error.code).toBe('invalid_state');

    const [remaining] = await db.select({ qty: stockLevel.qty }).from(stockLevel)
      .where(and(
        eq(stockLevel.productId, item.id),
        eq(stockLevel.warehouseId, location.id),
      ));
    expect(Number(remaining.qty)).toBe(15);
    expect(await db.select().from(invoice).where(eq(invoice.orderId, draft.id))).toHaveLength(1);
    const [delivery] = await db.select().from(salesDelivery)
      .where(eq(salesDelivery.orderId, draft.id));
    expect(delivery).toMatchObject({
      docNo: 'DO-SO-API-DRAFT',
      status: 'delivered',
      version: 2,
    });
    expect(await db.select().from(salesDeliveryLine)
      .where(eq(salesDeliveryLine.deliveryId, delivery.id)))
      .toMatchObject([{ productId: item.id, warehouseId: location.id, deliveredQty: '5.0000' }]);
    const legs = await db.select().from(glEntry)
      .where(eq(glEntry.journalRef, 'INV-SO-API-DRAFT'));
    expect(legs.reduce((sum, leg) => sum + Number(leg.debit), 0)).toBe(54.5);
    expect(legs.reduce((sum, leg) => sum + Number(leg.credit), 0)).toBe(54.5);
    const [audit] = await db.select().from(auditLog)
      .where(eq(auditLog.requestId, 'sales-confirm-test'));
    expect(audit).toMatchObject({
      entity: 'sales/orders',
      entityId: String(draft.id),
      action: 'confirm',
    });
  });

  it('creates and posts inventory adjustments and transfers with idempotent actions', async () => {
    const [item] = await db.select({ id: product.id }).from(product)
      .where(eq(product.sku, 'SG-WIDGET'));
    const locations = await db.insert(warehouse).values([
      { masterFn: 'M1', companyFn: 'C-SG', code: 'INV-A', name: 'Inventory A' },
      { masterFn: 'M1', companyFn: 'C-SG', code: 'INV-B', name: 'Inventory B' },
    ]).returning({ id: warehouse.id });
    await db.insert(stockLevel).values({
      masterFn: 'M1',
      companyFn: 'C-SG',
      productId: item.id,
      warehouseId: locations[0].id,
      qty: '10',
    });
    const cookies = await login(running.baseUrl);
    const headers = {
      cookie: cookies.header,
      'content-type': 'application/json',
      'x-csrf-token': cookies.csrf,
    };

    const createAdjustment = await fetch(`${running.baseUrl}/api/inventory/adjustments`, {
      method: 'POST',
      headers: { ...headers, 'x-request-id': 'adjustment-create-test' },
      body: JSON.stringify({
        docNo: 'ADJ-API-1',
        warehouseId: locations[0].id,
        adjustmentDate: '2026-06-30',
        reason: 'API count',
        lines: [{ productId: item.id, countedQty: 12 }],
      }),
    });
    expect(createAdjustment.status).toBe(201);
    const adjustment = (await createAdjustment.json()).data;
    const missingAdjustmentKey = await fetch(
      `${running.baseUrl}/api/inventory/adjustments/${adjustment.id}/actions/post`,
      { method: 'POST', headers, body: '{}' },
    );
    expect(missingAdjustmentKey.status).toBe(428);
    const postAdjustment = () => fetch(
      `${running.baseUrl}/api/inventory/adjustments/${adjustment.id}/actions/post`,
      {
        method: 'POST',
        headers: {
          ...headers,
          'idempotency-key': 'adjustment-post-1',
          'x-request-id': 'adjustment-post-test',
        },
        body: '{}',
      },
    );
    const posted = await postAdjustment();
    expect(posted.status).toBe(200);
    const postedBody = await posted.json();
    expect(postedBody.data).toMatchObject({ status: 'posted', valueImpact: '13.00' });
    const replay = await postAdjustment();
    expect(replay.headers.get('idempotency-replayed')).toBe('true');
    expect(await replay.json()).toEqual(postedBody);

    const createTransfer = await fetch(`${running.baseUrl}/api/inventory/transfers`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        docNo: 'TRF-API-1',
        fromWarehouseId: locations[0].id,
        toWarehouseId: locations[1].id,
        transferDate: '2026-07-18',
        lines: [{ productId: item.id, qty: 5 }],
      }),
    });
    expect(createTransfer.status).toBe(201);
    const transfer = (await createTransfer.json()).data;
    const completed = await fetch(
      `${running.baseUrl}/api/inventory/transfers/${transfer.id}/actions/complete`,
      {
        method: 'POST',
        headers: { ...headers, 'idempotency-key': 'transfer-complete-1' },
        body: '{}',
      },
    );
    expect(completed.status).toBe(200);
    expect((await completed.json()).data).toMatchObject({ status: 'completed' });

    const [source] = await db.select({ qty: stockLevel.qty }).from(stockLevel).where(and(
      eq(stockLevel.productId, item.id),
      eq(stockLevel.warehouseId, locations[0].id),
    ));
    const [destination] = await db.select({ qty: stockLevel.qty }).from(stockLevel).where(and(
      eq(stockLevel.productId, item.id),
      eq(stockLevel.warehouseId, locations[1].id),
    ));
    expect([Number(source.qty), Number(destination.qty)]).toEqual([7, 5]);
    expect(await db.select().from(inventoryAdjustment)).toHaveLength(1);
    expect(await db.select().from(stockTransfer)).toHaveLength(1);
    expect(await db.select().from(stockMovement)).toHaveLength(3);
  });

  it('creates tenant-scoped bins, lots and serial registrations through the resource API', async () => {
    const [location] = await db.insert(warehouse).values({
      masterFn: 'M1',
      companyFn: 'C-SG',
      code: 'TRACK-API',
      name: 'Tracking API Warehouse',
    }).returning({ id: warehouse.id });
    const items = await db.insert(product).values([
      {
        masterFn: 'M1',
        companyFn: 'C-SG',
        sku: 'LOT-API',
        name: 'Lot API Product',
        trackingType: 'lot',
      },
      {
        masterFn: 'M1',
        companyFn: 'C-SG',
        sku: 'SERIAL-API',
        name: 'Serial API Product',
        trackingType: 'serial',
      },
    ]).returning({ id: product.id, trackingType: product.trackingType });
    const cookies = await login(running.baseUrl);
    const headers = {
      cookie: cookies.header,
      'content-type': 'application/json',
      'x-csrf-token': cookies.csrf,
    };
    const create = (resource: string, payload: unknown) => fetch(
      `${running.baseUrl}/api/inventory/${resource}`,
      { method: 'POST', headers, body: JSON.stringify(payload) },
    );

    const binResponse = await create('bins', {
      warehouseId: location.id,
      code: 'A-01',
      name: 'Aisle A 01',
    });
    expect(binResponse.status).toBe(201);
    const lotItem = items.find((item) => item.trackingType === 'lot')!;
    const serialItem = items.find((item) => item.trackingType === 'serial')!;
    const lotResponse = await create('lots', {
      productId: lotItem.id,
      lotNo: 'LOT-API-001',
      expiryDate: '2027-07-18',
      qualityStatus: 'hold',
    });
    expect(lotResponse.status).toBe(201);
    const serialResponse = await create('serials', {
      productId: serialItem.id,
      serialNo: 'SERIAL-API-001',
    });
    expect(serialResponse.status).toBe(201);
    const invalidLot = await create('lots', {
      productId: 999999,
      lotNo: 'INVALID',
    });
    expect(invalidLot.status).toBe(422);
    expect((await invalidLot.json()).error.code).toBe('validation_failed');

    expect(await db.select().from(warehouseBin)
      .where(eq(warehouseBin.code, 'A-01'))).toHaveLength(1);
    expect(await db.select().from(inventoryLot)
      .where(eq(inventoryLot.lotNo, 'LOT-API-001'))).toHaveLength(1);
    expect(await db.select().from(inventorySerial)
      .where(eq(inventorySerial.serialNo, 'SERIAL-API-001'))).toHaveLength(1);

    const viewer = await login(running.baseUrl, 'viewer@acme.co', 'viewer1234');
    const denied = await fetch(`${running.baseUrl}/api/inventory/bins`, {
      method: 'POST',
      headers: {
        cookie: viewer.header,
        'content-type': 'application/json',
        'x-csrf-token': viewer.csrf,
      },
      body: JSON.stringify({
        warehouseId: location.id,
        code: 'DENIED',
        name: 'Denied',
      }),
    });
    expect(denied.status).toBe(403);
  });

  it('creates, records and idempotently completes warehouse picks through the API', async () => {
    const [item] = await db.select({ id: product.id }).from(product)
      .where(eq(product.sku, 'SG-WIDGET'));
    const [location] = await db.insert(warehouse).values({
      masterFn: 'M1',
      companyFn: 'C-SG',
      code: 'PICK-API',
      name: 'Pick API Warehouse',
    }).returning({ id: warehouse.id });
    await db.insert(stockLevel).values({
      masterFn: 'M1',
      companyFn: 'C-SG',
      productId: item.id,
      warehouseId: location.id,
      qty: '0',
    });
    await setStockQtyForFixture(db, {
      masterFn: 'M1',
      companyFn: 'C-SG',
    }, item.id, location.id, 10);
    const [bin] = await db.select({ id: warehouseBin.id }).from(warehouseBin)
      .where(eq(warehouseBin.warehouseId, location.id));
    const cookies = await login(running.baseUrl);
    const headers = {
      cookie: cookies.header,
      'content-type': 'application/json',
      'x-csrf-token': cookies.csrf,
    };

    const createdResponse = await fetch(`${running.baseUrl}/api/warehouse/picks`, {
      method: 'POST',
      headers: { ...headers, 'x-request-id': 'warehouse-pick-create' },
      body: JSON.stringify({
        docNo: 'PICK-API-1',
        warehouseId: location.id,
        pickDate: '2026-07-19',
        assignee: 'API operator',
        lines: [{ productId: item.id, binId: bin.id, qty: 4 }],
      }),
    });
    expect(createdResponse.status).toBe(201);
    const created = (await createdResponse.json()).data;
    expect(created).toMatchObject({ docNo: 'PICK-API-1', status: 'open' });
    expect(created.lines).toHaveLength(1);

    const pickLine = () => fetch(
      `${running.baseUrl}/api/warehouse/picks/${created.id}/actions/pick-line`,
      {
        method: 'POST',
        headers: { ...headers, 'idempotency-key': 'warehouse-pick-line-1' },
        body: JSON.stringify({ lineId: created.lines[0].id, qty: 4 }),
      },
    );
    const recorded = await pickLine();
    expect(recorded.status).toBe(200);
    const recordedBody = await recorded.json();
    expect(recordedBody.data).toMatchObject({ pickedQty: '4' });
    const replayedLine = await pickLine();
    expect(replayedLine.headers.get('idempotency-replayed')).toBe('true');
    expect(await replayedLine.json()).toEqual(recordedBody);

    const complete = () => fetch(
      `${running.baseUrl}/api/warehouse/picks/${created.id}/actions/complete`,
      {
        method: 'POST',
        headers: { ...headers, 'idempotency-key': 'warehouse-pick-complete-1' },
        body: '{}',
      },
    );
    const completed = await complete();
    expect(completed.status).toBe(200);
    const completedBody = await completed.json();
    expect(completedBody.data).toMatchObject({ status: 'picked' });
    const replayedComplete = await complete();
    expect(replayedComplete.headers.get('idempotency-replayed')).toBe('true');
    expect(await replayedComplete.json()).toEqual(completedBody);

    expect(await db.select().from(warehousePick)).toMatchObject([
      { docNo: 'PICK-API-1', status: 'picked' },
    ]);
    expect(await db.select().from(warehousePickLine)).toMatchObject([
      { pickedQty: '4.0000', requiredQty: '4.0000' },
    ]);
    expect(await db.select().from(stockReservation)).toMatchObject([
      { status: 'consumed' },
    ]);
    const [remaining] = await db.select({ qty: stockLevel.qty }).from(stockLevel)
      .where(eq(stockLevel.warehouseId, location.id));
    expect(Number(remaining.qty)).toBe(6);
    expect(await db.select().from(stockMovement)
      .where(eq(stockMovement.refType, 'warehouse_pick'))).toHaveLength(1);

    const viewer = await login(running.baseUrl, 'viewer@acme.co', 'viewer1234');
    const denied = await fetch(`${running.baseUrl}/api/warehouse/picks`, {
      method: 'POST',
      headers: {
        cookie: viewer.header,
        'content-type': 'application/json',
        'x-csrf-token': viewer.csrf,
      },
      body: JSON.stringify({
        docNo: 'PICK-DENIED',
        warehouseId: location.id,
        pickDate: '2026-07-19',
        lines: [{ productId: item.id, binId: bin.id, qty: 1 }],
      }),
    });
    expect(denied.status).toBe(403);
  });
});
