// Supplier master update command. Supplier master data is intentionally small
// today; purchasing terms and price lists remain separate governed records.
import { and, eq } from 'drizzle-orm';
import type { DB } from '../../data/db';
import type { Scope } from '../../data/repo';
import { supplier } from '../../data/schema';

export class SupplierUpdateError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly status = 422,
    public readonly fieldErrors?: Record<string, string>,
  ) {
    super(message);
    this.name = 'SupplierUpdateError';
  }
}

export interface UpdateSupplierInput {
  code: unknown;
  name: unknown;
  expectedUpdatedAt?: string | Date | null;
}

function supplierFields(input: UpdateSupplierInput): { code: string; name: string } {
  const fieldErrors: Record<string, string> = {};
  const read = (value: unknown, field: 'code' | 'name', label: string, max: number) => {
    if (typeof value !== 'string' || !value.trim()) {
      fieldErrors[field] = `${label} is required.`;
      return '';
    }
    const trimmed = value.trim();
    if (trimmed.length > max) fieldErrors[field] = `${label} must be ${max} characters or fewer.`;
    return trimmed;
  };
  const code = read(input.code, 'code', 'Supplier code', 40);
  const name = read(input.name, 'name', 'Supplier name', 200);
  if (Object.keys(fieldErrors).length) {
    throw new SupplierUpdateError(
      'supplier_validation_failed',
      'Review the highlighted supplier fields.',
      422,
      fieldErrors,
    );
  }
  return { code: code.toUpperCase(), name };
}

function timestampMatches(actual: Date, expected: string | Date): boolean {
  const value = expected instanceof Date ? expected : new Date(expected);
  return !Number.isNaN(value.getTime()) && actual.getTime() === value.getTime();
}

export async function updateSupplierWithin(
  exec: DB,
  scope: Scope,
  supplierId: number,
  input: UpdateSupplierInput,
) {
  const fields = supplierFields(input);
  const code = fields.code;
  const name = fields.name;
  const [before] = await exec.select().from(supplier).where(and(
    eq(supplier.id, supplierId),
    eq(supplier.masterFn, scope.masterFn),
    eq(supplier.companyFn, scope.companyFn),
  )).limit(1).for('update');
  if (!before) {
    throw new SupplierUpdateError(
      'supplier_not_found',
      'Supplier not found in the active company.',
      404,
    );
  }
  if (input.expectedUpdatedAt != null && !timestampMatches(before.updatedAt, input.expectedUpdatedAt)) {
    throw new SupplierUpdateError(
      'supplier_stale',
      'This supplier changed in another session. Refresh and review the latest values before saving.',
      409,
    );
  }
  const [duplicate] = await exec.select({ id: supplier.id }).from(supplier).where(and(
    eq(supplier.masterFn, scope.masterFn),
    eq(supplier.companyFn, scope.companyFn),
    eq(supplier.code, code),
  )).limit(1);
  if (duplicate && duplicate.id !== supplierId) {
    throw new SupplierUpdateError(
      'supplier_code_conflict',
      'Supplier code is already used in this company.',
      409,
      { code: 'Choose a different supplier code.' },
    );
  }
  const now = new Date(Math.max(Date.now(), before.updatedAt.getTime() + 1));
  const [after] = await exec.update(supplier).set({
    code,
    name,
    updatedAt: now,
  }).where(and(
    eq(supplier.id, supplierId),
    eq(supplier.masterFn, scope.masterFn),
    eq(supplier.companyFn, scope.companyFn),
  )).returning();
  if (!after) {
    throw new SupplierUpdateError(
      'supplier_not_found',
      'Supplier not found in the active company.',
      404,
    );
  }
  return { before, after };
}
