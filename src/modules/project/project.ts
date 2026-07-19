// Project register — plain insert, mirroring createAsset.ts's shape: nothing
// here needs a multi-step transaction. Progress claims (progressClaim.ts) are
// the module's only posting flow.
import { and, eq } from 'drizzle-orm';
import Decimal from 'decimal.js';
import type { DB } from '../../data/db';
import type { Scope } from '../../data/repo';
import { customer, project, PROJECT_STATUSES } from '../../data/schema';

export class InvalidProjectStateError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'InvalidProjectStateError';
  }
}

export interface CreateProjectInput {
  projectNo: string;
  name: string;
  customerId?: number | null;
  managerName: string;
  status?: string;
  startDate: string; // YYYY-MM-DD
  dueDate?: string | null;
  contractValue: string | number;
}

export async function createProjectWithin(exec: DB, scope: Scope, input: CreateProjectInput) {
  if (!input.projectNo?.trim()) throw new InvalidProjectStateError('projectNo is required');
  if (!input.name?.trim()) throw new InvalidProjectStateError('name is required');
  if (!input.managerName?.trim()) throw new InvalidProjectStateError('managerName is required');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.startDate)) {
    throw new InvalidProjectStateError('startDate must be YYYY-MM-DD');
  }
  if (input.dueDate != null && !/^\d{4}-\d{2}-\d{2}$/.test(input.dueDate)) {
    throw new InvalidProjectStateError('dueDate must be YYYY-MM-DD');
  }
  const status = input.status ?? 'open';
  if (!PROJECT_STATUSES.includes(status as typeof PROJECT_STATUSES[number])) {
    throw new InvalidProjectStateError(`status must be one of: ${PROJECT_STATUSES.join(', ')}`);
  }
  let contractValue: Decimal;
  try {
    contractValue = new Decimal(input.contractValue);
  } catch {
    throw new InvalidProjectStateError('contractValue must be a valid decimal');
  }
  if (!contractValue.isFinite() || contractValue.isNegative()) {
    throw new InvalidProjectStateError('contractValue must be non-negative');
  }

  let customerId: number | null = null;
  if (input.customerId != null) {
    if (!Number.isSafeInteger(input.customerId) || input.customerId <= 0) {
      throw new InvalidProjectStateError('customerId must be a positive integer');
    }
    const [row] = await exec.select({ id: customer.id }).from(customer).where(and(
      eq(customer.masterFn, scope.masterFn),
      eq(customer.companyFn, scope.companyFn),
      eq(customer.id, input.customerId),
    ));
    if (!row) throw new InvalidProjectStateError('customerId is unavailable in this company');
    customerId = row.id;
  }

  const [row] = await exec.insert(project).values({
    masterFn: scope.masterFn,
    companyFn: scope.companyFn,
    projectNo: input.projectNo.trim(),
    name: input.name.trim(),
    customerId,
    managerName: input.managerName.trim(),
    status,
    startDate: input.startDate,
    dueDate: input.dueDate?.trim() || null,
    contractValue: contractValue.toFixed(2),
    billedToDate: '0',
  }).returning({ id: project.id });
  return { id: row.id };
}

export function createProject(db: DB, scope: Scope, input: CreateProjectInput) {
  return db.transaction((tx) => createProjectWithin(tx, scope, input));
}
