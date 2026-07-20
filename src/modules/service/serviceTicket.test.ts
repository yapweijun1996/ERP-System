import { describe, expect, it } from 'vitest';
import type { DB } from '../../data/db';
import { customer } from '../../data/schema';
import { freshDb, TEST_SCOPE as SCOPE } from '../../test/helpers';
import {
  assignServiceTicket,
  createServiceTicket,
  InvalidServiceTicketStateError,
  resolveServiceTicket,
} from './serviceTicket';

async function fixtureCustomer(db: DB) {
  const [row] = await db.insert(customer).values({
    masterFn: SCOPE.masterFn,
    companyFn: SCOPE.companyFn,
    code: 'SVC-TICKET-CUSTOMER',
    name: 'Fictional Ticket Customer',
  }).returning({ id: customer.id });
  return row;
}

describe('service tickets', () => {
  it('creates a ticket that always starts open and unassigned', async () => {
    const db = await freshDb();
    const cust = await fixtureCustomer(db);
    const created = await createServiceTicket(db, SCOPE, {
      ticketNo: 'SVC-1',
      customerId: cust.id,
      assetDescription: 'Fictional Conveyor Unit',
      issue: 'Fictional overheating issue',
    });
    expect(created).toMatchObject({ status: 'open' });
  });

  it('assigns an open ticket, moving it to in_progress', async () => {
    const db = await freshDb();
    const cust = await fixtureCustomer(db);
    const created = await createServiceTicket(db, SCOPE, {
      ticketNo: 'SVC-ASSIGN',
      customerId: cust.id,
      assetDescription: 'Fictional Conveyor Unit',
      issue: 'Fictional issue',
    });
    const assigned = await assignServiceTicket(db, SCOPE, created.id, 'Fictional Technician');
    expect(assigned).toMatchObject({ status: 'in_progress', technicianName: 'Fictional Technician' });
  });

  it('rejects assigning a ticket that is not open', async () => {
    const db = await freshDb();
    const cust = await fixtureCustomer(db);
    const created = await createServiceTicket(db, SCOPE, {
      ticketNo: 'SVC-ASSIGN-TWICE',
      customerId: cust.id,
      assetDescription: 'Fictional Conveyor Unit',
      issue: 'Fictional issue',
    });
    await assignServiceTicket(db, SCOPE, created.id, 'Fictional Technician');
    await expect(assignServiceTicket(db, SCOPE, created.id, 'Another Technician'))
      .rejects.toThrow(InvalidServiceTicketStateError);
  });

  it('rejects assigning with an empty technician name', async () => {
    const db = await freshDb();
    const cust = await fixtureCustomer(db);
    const created = await createServiceTicket(db, SCOPE, {
      ticketNo: 'SVC-ASSIGN-EMPTY',
      customerId: cust.id,
      assetDescription: 'Fictional Conveyor Unit',
      issue: 'Fictional issue',
    });
    await expect(assignServiceTicket(db, SCOPE, created.id, '   '))
      .rejects.toThrow('technicianName is required');
  });

  it('resolves an in_progress ticket with a diagnosis, closing it', async () => {
    const db = await freshDb();
    const cust = await fixtureCustomer(db);
    const created = await createServiceTicket(db, SCOPE, {
      ticketNo: 'SVC-RESOLVE',
      customerId: cust.id,
      assetDescription: 'Fictional Conveyor Unit',
      issue: 'Fictional issue',
    });
    await assignServiceTicket(db, SCOPE, created.id, 'Fictional Technician');
    const resolved = await resolveServiceTicket(db, SCOPE, created.id, 'Fictional root cause found and fixed.');
    expect(resolved.status).toBe('closed');
    expect(resolved.resolvedAt).not.toBeNull();
  });

  it('resolves directly from open without requiring assignment first', async () => {
    const db = await freshDb();
    const cust = await fixtureCustomer(db);
    const created = await createServiceTicket(db, SCOPE, {
      ticketNo: 'SVC-RESOLVE-DIRECT',
      customerId: cust.id,
      assetDescription: 'Fictional Conveyor Unit',
      issue: 'Fictional issue',
    });
    const resolved = await resolveServiceTicket(db, SCOPE, created.id, 'Trivial fix, no dispatch needed.');
    expect(resolved.status).toBe('closed');
  });

  it('rejects resolving an already-closed ticket', async () => {
    const db = await freshDb();
    const cust = await fixtureCustomer(db);
    const created = await createServiceTicket(db, SCOPE, {
      ticketNo: 'SVC-RESOLVE-TWICE',
      customerId: cust.id,
      assetDescription: 'Fictional Conveyor Unit',
      issue: 'Fictional issue',
    });
    await resolveServiceTicket(db, SCOPE, created.id, 'First resolution.');
    await expect(resolveServiceTicket(db, SCOPE, created.id, 'Second resolution.'))
      .rejects.toThrow(InvalidServiceTicketStateError);
  });

  it('rejects resolving with an empty diagnosis', async () => {
    const db = await freshDb();
    const cust = await fixtureCustomer(db);
    const created = await createServiceTicket(db, SCOPE, {
      ticketNo: 'SVC-RESOLVE-EMPTY',
      customerId: cust.id,
      assetDescription: 'Fictional Conveyor Unit',
      issue: 'Fictional issue',
    });
    await expect(resolveServiceTicket(db, SCOPE, created.id, '   '))
      .rejects.toThrow('diagnosis is required to resolve a ticket');
  });

  it('rejects a customerId that does not belong to this company', async () => {
    const db = await freshDb();
    await expect(createServiceTicket(db, SCOPE, {
      ticketNo: 'SVC-BADCUST',
      customerId: 999999,
      assetDescription: 'Fictional Conveyor Unit',
      issue: 'Fictional issue',
    })).rejects.toThrow(InvalidServiceTicketStateError);
  });
});
