// Service tickets — create (always starts open/unassigned, matching real-world
// dispatch: a ticket is logged before a technician is assigned), assign
// (open -> in_progress), resolve (any non-closed status -> closed, requires a
// real typed diagnosis). Mirrors modules/hr/leaveRequest.ts's decide-state-
// machine shape.
import { and, eq, sql } from 'drizzle-orm';
import type { DB } from '../../data/db';
import type { Scope } from '../../data/repo';
import {
  customer, serviceContract, serviceTicket,
  SERVICE_TICKET_COVERAGES, SERVICE_TICKET_PRIORITIES,
} from '../../data/schema';

export class InvalidServiceTicketStateError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'InvalidServiceTicketStateError';
  }
}

export interface CreateServiceTicketInput {
  ticketNo: string;
  customerId: number;
  contractId?: number | null;
  assetDescription: string;
  serialNo?: string | null;
  issue: string;
  priority?: string;
  coverage?: string;
}

export async function createServiceTicketWithin(
  exec: DB,
  scope: Scope,
  input: CreateServiceTicketInput,
) {
  if (!input.ticketNo?.trim()) throw new InvalidServiceTicketStateError('ticketNo is required');
  if (!input.assetDescription?.trim()) throw new InvalidServiceTicketStateError('assetDescription is required');
  if (!input.issue?.trim()) throw new InvalidServiceTicketStateError('issue is required');
  const priority = input.priority ?? 'Medium';
  if (!SERVICE_TICKET_PRIORITIES.includes(priority as typeof SERVICE_TICKET_PRIORITIES[number])) {
    throw new InvalidServiceTicketStateError(`priority must be one of: ${SERVICE_TICKET_PRIORITIES.join(', ')}`);
  }
  const coverage = input.coverage ?? 'out_of_warranty';
  if (!SERVICE_TICKET_COVERAGES.includes(coverage as typeof SERVICE_TICKET_COVERAGES[number])) {
    throw new InvalidServiceTicketStateError(`coverage must be one of: ${SERVICE_TICKET_COVERAGES.join(', ')}`);
  }
  if (!Number.isSafeInteger(input.customerId) || input.customerId <= 0) {
    throw new InvalidServiceTicketStateError('customerId must be a positive integer');
  }
  const [customerRow] = await exec.select({ id: customer.id }).from(customer).where(and(
    eq(customer.masterFn, scope.masterFn),
    eq(customer.companyFn, scope.companyFn),
    eq(customer.id, input.customerId),
  ));
  if (!customerRow) throw new InvalidServiceTicketStateError('customerId is unavailable in this company');

  let contractId: number | null = null;
  if (input.contractId != null) {
    if (!Number.isSafeInteger(input.contractId) || input.contractId <= 0) {
      throw new InvalidServiceTicketStateError('contractId must be a positive integer');
    }
    const [contractRow] = await exec.select({ id: serviceContract.id }).from(serviceContract).where(and(
      eq(serviceContract.masterFn, scope.masterFn),
      eq(serviceContract.companyFn, scope.companyFn),
      eq(serviceContract.id, input.contractId),
    ));
    if (!contractRow) throw new InvalidServiceTicketStateError('contractId is unavailable in this company');
    contractId = contractRow.id;
  }

  const [row] = await exec.insert(serviceTicket).values({
    masterFn: scope.masterFn,
    companyFn: scope.companyFn,
    ticketNo: input.ticketNo.trim(),
    customerId: customerRow.id,
    contractId,
    assetDescription: input.assetDescription.trim(),
    serialNo: input.serialNo?.trim() || null,
    issue: input.issue.trim(),
    priority,
    coverage,
    status: 'open',
  }).returning({ id: serviceTicket.id, ticketNo: serviceTicket.ticketNo, status: serviceTicket.status });
  return row;
}

export async function assignServiceTicketWithin(
  exec: DB,
  scope: Scope,
  ticketId: number,
  technicianName: string,
) {
  const name = technicianName?.trim();
  if (!name) throw new InvalidServiceTicketStateError('technicianName is required');
  const [ticket] = await exec.select().from(serviceTicket).where(and(
    eq(serviceTicket.masterFn, scope.masterFn),
    eq(serviceTicket.companyFn, scope.companyFn),
    eq(serviceTicket.id, ticketId),
  )).for('update');
  if (!ticket) throw new InvalidServiceTicketStateError(`Service ticket ${ticketId} not found`);
  if (ticket.status !== 'open') {
    throw new InvalidServiceTicketStateError(`Ticket ${ticket.ticketNo} is '${ticket.status}', not 'open' — cannot assign it`);
  }
  const [updated] = await exec.update(serviceTicket).set({
    technicianName: name,
    status: 'in_progress',
    updatedAt: sql`now()`,
  }).where(and(
    eq(serviceTicket.masterFn, scope.masterFn),
    eq(serviceTicket.companyFn, scope.companyFn),
    eq(serviceTicket.id, ticket.id),
  )).returning({
    id: serviceTicket.id, ticketNo: serviceTicket.ticketNo,
    status: serviceTicket.status, technicianName: serviceTicket.technicianName,
  });
  return updated;
}

export async function resolveServiceTicketWithin(
  exec: DB,
  scope: Scope,
  ticketId: number,
  diagnosis: string,
) {
  const notes = diagnosis?.trim();
  if (!notes) throw new InvalidServiceTicketStateError('diagnosis is required to resolve a ticket');
  const [ticket] = await exec.select().from(serviceTicket).where(and(
    eq(serviceTicket.masterFn, scope.masterFn),
    eq(serviceTicket.companyFn, scope.companyFn),
    eq(serviceTicket.id, ticketId),
  )).for('update');
  if (!ticket) throw new InvalidServiceTicketStateError(`Service ticket ${ticketId} not found`);
  if (ticket.status === 'closed') {
    throw new InvalidServiceTicketStateError(`Ticket ${ticket.ticketNo} is already closed`);
  }
  const [updated] = await exec.update(serviceTicket).set({
    diagnosis: notes,
    status: 'closed',
    resolvedAt: sql`now()`,
    updatedAt: sql`now()`,
  }).where(and(
    eq(serviceTicket.masterFn, scope.masterFn),
    eq(serviceTicket.companyFn, scope.companyFn),
    eq(serviceTicket.id, ticket.id),
  )).returning({
    id: serviceTicket.id, ticketNo: serviceTicket.ticketNo,
    status: serviceTicket.status, resolvedAt: serviceTicket.resolvedAt,
  });
  return updated;
}

export function createServiceTicket(db: DB, scope: Scope, input: CreateServiceTicketInput) {
  return db.transaction((tx) => createServiceTicketWithin(tx, scope, input));
}

export function assignServiceTicket(db: DB, scope: Scope, ticketId: number, technicianName: string) {
  return db.transaction((tx) => assignServiceTicketWithin(tx, scope, ticketId, technicianName));
}

export function resolveServiceTicket(db: DB, scope: Scope, ticketId: number, diagnosis: string) {
  return db.transaction((tx) => resolveServiceTicketWithin(tx, scope, ticketId, diagnosis));
}
