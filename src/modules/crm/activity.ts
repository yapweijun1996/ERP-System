// Customer-360 — log an activity against a customer's timeline. The activity table
// also backs an opportunity's timeline (see src/data/schema/crm.ts), but no caller
// writes that side yet — opportunity-detail is still Preview (EPIC-010).
import { and, eq } from 'drizzle-orm';
import type { DB } from '../../data/db';
import type { Scope } from '../../data/repo';
import { activity, customer } from '../../data/schema';

export class InvalidActivityStateError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'InvalidActivityStateError';
  }
}

const ACTIVITY_KINDS = ['note', 'call', 'email', 'system'] as const;

export interface CreateCustomerActivityInput {
  customerId: number;
  kind: string;
  body: string;
}

export async function createCustomerActivityWithin(
  exec: DB,
  scope: Scope,
  input: CreateCustomerActivityInput,
) {
  if (!input.body?.trim()) throw new InvalidActivityStateError('Activity body is required.');
  if (!ACTIVITY_KINDS.includes(input.kind as typeof ACTIVITY_KINDS[number])) {
    throw new InvalidActivityStateError(`kind must be one of: ${ACTIVITY_KINDS.join(', ')}`);
  }
  const [scopedCustomer] = await exec.select({ id: customer.id })
    .from(customer)
    .where(and(
      eq(customer.id, input.customerId),
      eq(customer.masterFn, scope.masterFn),
      eq(customer.companyFn, scope.companyFn),
    ))
    .limit(1);
  if (!scopedCustomer) {
    throw new InvalidActivityStateError(
      'The selected customer does not belong to the active company.',
    );
  }
  const [row] = await exec.insert(activity).values({
    masterFn: scope.masterFn, companyFn: scope.companyFn,
    customerId: input.customerId, kind: input.kind, body: input.body.trim(),
  }).returning({ id: activity.id });
  return { id: row.id };
}
