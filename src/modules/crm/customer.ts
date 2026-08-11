// Customer master — create one tenant-scoped customer from a sales or CRM flow.
// The quick-create path deliberately keeps the required master data small:
// name is required, code can be supplied or is generated, and industry is optional.
import { and, eq } from 'drizzle-orm';
import type { DB } from '../../data/db';
import type { Scope } from '../../data/repo';
import { customer } from '../../data/schema';

export class InvalidCustomerStateError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'InvalidCustomerStateError';
  }
}

export class CustomerUpdateError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly status = 422,
    public readonly fieldErrors?: Record<string, string>,
  ) {
    super(message);
    this.name = 'CustomerUpdateError';
  }
}

export interface CreateCustomerInput {
  code?: unknown;
  name: unknown;
  industry?: unknown;
}

export interface UpdateCustomerInput {
  code: unknown;
  name: unknown;
  industry?: unknown;
  expectedUpdatedAt?: string | Date | null;
}

function boundedText(value: unknown, field: string, max: number, required: boolean): string | null {
  if (value == null) {
    if (required) throw new InvalidCustomerStateError(`${field} is required.`);
    return null;
  }
  if (typeof value !== 'string') {
    throw new InvalidCustomerStateError(`${field} must be text.`);
  }
  const trimmed = value.trim();
  if (!trimmed && required) {
    throw new InvalidCustomerStateError(`${field} is required.`);
  }
  if (trimmed.length > max) {
    throw new InvalidCustomerStateError(`${field} must be ${max} characters or fewer.`);
  }
  return trimmed || null;
}

function generatedCustomerCode(): string {
  const timePart = Date.now().toString(36).toUpperCase().slice(-8);
  const randomPart = Math.floor(Math.random() * (36 ** 6))
    .toString(36).toUpperCase().padStart(6, '0');
  return `CUST-${timePart}-${randomPart}`;
}

export async function createCustomerWithin(
  exec: DB,
  scope: Scope,
  input: CreateCustomerInput,
  ownerUserId?: number,
) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    throw new InvalidCustomerStateError('Customer input is required.');
  }
  const name = boundedText(input.name, 'Customer name', 200, true)!;
  const requestedCode = boundedText(input.code, 'Customer code', 40, false);
  const code = (requestedCode || generatedCustomerCode()).toUpperCase();
  const industry = boundedText(input.industry, 'Industry', 120, false);
  const owner = Number.isSafeInteger(ownerUserId) && Number(ownerUserId) > 0
    ? Number(ownerUserId)
    : null;

  const [existing] = await exec.select({ id: customer.id })
    .from(customer)
    .where(and(
      eq(customer.masterFn, scope.masterFn),
      eq(customer.companyFn, scope.companyFn),
      eq(customer.code, code),
    ))
    .limit(1);
  if (existing) {
    throw new InvalidCustomerStateError(`Customer code ${code} already exists.`);
  }

  const [row] = await exec.insert(customer).values({
    masterFn: scope.masterFn,
    companyFn: scope.companyFn,
    code,
    name,
    industry,
    ownerUserId: owner,
  }).returning({
    id: customer.id,
    code: customer.code,
    name: customer.name,
    industry: customer.industry,
    ownerUserId: customer.ownerUserId,
  });
  return row;
}

function customerUpdateFieldError(
  message: string,
  field: string,
  code = 'customer_validation_failed',
  status = 422,
): CustomerUpdateError {
  return new CustomerUpdateError(code, message, status, { [field]: message });
}

function updateCustomerFields(input: UpdateCustomerInput): {
  code: string;
  name: string;
  industry: string | null;
} {
  const fieldErrors: Record<string, string> = {};
  const read = (value: unknown, label: string, field: string, max: number, required: boolean) => {
    if (value == null) {
      if (required) fieldErrors[field] = `${label} is required.`;
      return null;
    }
    if (typeof value !== 'string') {
      fieldErrors[field] = `${label} must be text.`;
      return null;
    }
    const trimmed = value.trim();
    if (!trimmed && required) fieldErrors[field] = `${label} is required.`;
    if (trimmed.length > max) fieldErrors[field] = `${label} is too long.`;
    return trimmed || null;
  };
  const code = read(input.code, 'Customer code', 'code', 40, true);
  const name = read(input.name, 'Customer name', 'name', 200, true);
  const industry = read(input.industry, 'Industry', 'industry', 120, false);
  if (Object.keys(fieldErrors).length) {
    throw new CustomerUpdateError(
      'customer_validation_failed',
      'Review the highlighted customer fields.',
      422,
      fieldErrors,
    );
  }
  if (!code || !name) throw new CustomerUpdateError('customer_validation_failed', 'Customer code and name are required.');
  return { code: code.toUpperCase(), name, industry };
}

function timestampMatches(actual: Date, expected: string | Date): boolean {
  const value = expected instanceof Date ? expected : new Date(expected);
  return !Number.isNaN(value.getTime()) && actual.getTime() === value.getTime();
}

/** Update customer master data with the same tenant and optimistic-concurrency
 * contract used by employee profiles. The owner is deliberately not editable
 * here because changing ownership is a separate sales-control decision. */
export async function updateCustomerWithin(
  exec: DB,
  scope: Scope,
  customerId: number,
  input: UpdateCustomerInput,
) {
  const fields = updateCustomerFields(input);
  const [before] = await exec.select().from(customer).where(and(
    eq(customer.id, customerId),
    eq(customer.masterFn, scope.masterFn),
    eq(customer.companyFn, scope.companyFn),
  )).limit(1).for('update');
  if (!before) {
    throw new CustomerUpdateError(
      'customer_not_found',
      'Customer not found in the active company.',
      404,
    );
  }
  if (input.expectedUpdatedAt != null && !timestampMatches(before.updatedAt, input.expectedUpdatedAt)) {
    throw new CustomerUpdateError(
      'customer_stale',
      'This customer changed in another session. Refresh and review the latest values before saving.',
      409,
    );
  }
  const [duplicate] = await exec.select({ id: customer.id }).from(customer).where(and(
    eq(customer.masterFn, scope.masterFn),
    eq(customer.companyFn, scope.companyFn),
    eq(customer.code, fields.code),
  )).limit(1);
  if (duplicate && duplicate.id !== customerId) {
    throw customerUpdateFieldError(
      'Customer code is already used in this company.',
      'code',
      'customer_code_conflict',
      409,
    );
  }
  const now = new Date(Math.max(Date.now(), before.updatedAt.getTime() + 1));
  const [after] = await exec.update(customer).set({
    code: fields.code,
    name: fields.name,
    industry: fields.industry,
    updatedAt: now,
  }).where(and(
    eq(customer.id, customerId),
    eq(customer.masterFn, scope.masterFn),
    eq(customer.companyFn, scope.companyFn),
  )).returning();
  if (!after) {
    throw new CustomerUpdateError(
      'customer_not_found',
      'Customer not found in the active company.',
      404,
    );
  }
  return { before, after };
}
