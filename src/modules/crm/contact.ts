// Customer-360 — add a contact person to a customer account. Plain insert, same
// shape as createOpportunity.ts: tenant-validate the customer, then a single row.
import { and, eq } from 'drizzle-orm';
import type { DB } from '../../data/db';
import type { Scope } from '../../data/repo';
import { contact, customer } from '../../data/schema';

export class InvalidContactStateError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'InvalidContactStateError';
  }
}

export interface CreateContactInput {
  customerId: number;
  name: string;
  role: string;
  email?: string | null;
  phone?: string | null;
}

export async function createContactWithin(exec: DB, scope: Scope, input: CreateContactInput) {
  if (!input.name?.trim()) throw new InvalidContactStateError('Contact name is required.');
  if (!input.role?.trim()) throw new InvalidContactStateError('Contact role is required.');
  const [scopedCustomer] = await exec.select({ id: customer.id })
    .from(customer)
    .where(and(
      eq(customer.id, input.customerId),
      eq(customer.masterFn, scope.masterFn),
      eq(customer.companyFn, scope.companyFn),
    ))
    .limit(1);
  if (!scopedCustomer) {
    throw new InvalidContactStateError(
      'The selected customer does not belong to the active company.',
    );
  }
  const [row] = await exec.insert(contact).values({
    masterFn: scope.masterFn, companyFn: scope.companyFn,
    customerId: input.customerId, name: input.name.trim(), role: input.role.trim(),
    email: input.email?.trim() || null, phone: input.phone?.trim() || null,
  }).returning({ id: contact.id });
  return { id: row.id };
}
