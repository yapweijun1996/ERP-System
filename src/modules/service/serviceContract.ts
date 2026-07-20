// Service contract register — plain insert, mirroring project.ts's shape.
import { and, eq } from 'drizzle-orm';
import Decimal from 'decimal.js';
import type { DB } from '../../data/db';
import type { Scope } from '../../data/repo';
import { customer, serviceContract, SERVICE_CONTRACT_PLANS } from '../../data/schema';

export class InvalidServiceContractStateError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'InvalidServiceContractStateError';
  }
}

export interface CreateServiceContractInput {
  contractNo: string;
  customerId: number;
  plan: string;
  slaResponseHours?: number | null;
  assetsCovered?: number;
  startDate: string; // YYYY-MM-DD
  expiryDate: string; // YYYY-MM-DD
  annualValue: string | number;
}

export async function createServiceContractWithin(
  exec: DB,
  scope: Scope,
  input: CreateServiceContractInput,
) {
  if (!input.contractNo?.trim()) throw new InvalidServiceContractStateError('contractNo is required');
  if (!SERVICE_CONTRACT_PLANS.includes(input.plan as typeof SERVICE_CONTRACT_PLANS[number])) {
    throw new InvalidServiceContractStateError(`plan must be one of: ${SERVICE_CONTRACT_PLANS.join(', ')}`);
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.startDate)) {
    throw new InvalidServiceContractStateError('startDate must be YYYY-MM-DD');
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.expiryDate)) {
    throw new InvalidServiceContractStateError('expiryDate must be YYYY-MM-DD');
  }
  if (input.expiryDate <= input.startDate) {
    throw new InvalidServiceContractStateError('expiryDate must be after startDate');
  }
  if (input.slaResponseHours != null && (!Number.isFinite(input.slaResponseHours) || input.slaResponseHours <= 0)) {
    throw new InvalidServiceContractStateError('slaResponseHours must be a positive number when provided');
  }
  const assetsCovered = input.assetsCovered ?? 0;
  if (!Number.isFinite(assetsCovered) || assetsCovered < 0) {
    throw new InvalidServiceContractStateError('assetsCovered must be non-negative');
  }
  let annualValue: Decimal;
  try {
    annualValue = new Decimal(input.annualValue);
  } catch {
    throw new InvalidServiceContractStateError('annualValue must be a valid decimal');
  }
  if (!annualValue.isFinite() || annualValue.isNegative()) {
    throw new InvalidServiceContractStateError('annualValue must be non-negative');
  }
  if (!Number.isSafeInteger(input.customerId) || input.customerId <= 0) {
    throw new InvalidServiceContractStateError('customerId must be a positive integer');
  }
  const [customerRow] = await exec.select({ id: customer.id }).from(customer).where(and(
    eq(customer.masterFn, scope.masterFn),
    eq(customer.companyFn, scope.companyFn),
    eq(customer.id, input.customerId),
  ));
  if (!customerRow) throw new InvalidServiceContractStateError('customerId is unavailable in this company');

  const [row] = await exec.insert(serviceContract).values({
    masterFn: scope.masterFn,
    companyFn: scope.companyFn,
    contractNo: input.contractNo.trim(),
    customerId: customerRow.id,
    plan: input.plan,
    slaResponseHours: input.slaResponseHours ?? null,
    assetsCovered: Math.round(assetsCovered),
    startDate: input.startDate,
    expiryDate: input.expiryDate,
    annualValue: annualValue.toFixed(2),
  }).returning({ id: serviceContract.id });
  return { id: row.id };
}

export function createServiceContract(db: DB, scope: Scope, input: CreateServiceContractInput) {
  return db.transaction((tx) => createServiceContractWithin(tx, scope, input));
}
