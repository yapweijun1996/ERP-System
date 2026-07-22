import { and, desc, eq, inArray, lt, sql } from 'drizzle-orm';
import type { DB } from '../../data/db';
import type { Scope } from '../../data/repo';
import { customer, importJob, importJobRow, importRowError } from '../../data/schema';

export const MAX_CUSTOMER_IMPORT_ROWS = 250;

export interface CustomerImportSourceRow {
  code?: unknown;
  name?: unknown;
  industry?: unknown;
}

export interface CreateCustomerImportJobInput {
  fileName: string;
  duplicateStrategy: 'update_existing' | 'skip_existing';
  rows: CustomerImportSourceRow[];
}

export class CustomerImportValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'CustomerImportValidationError';
  }
}

export class CustomerImportStateError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'CustomerImportStateError';
  }
}

export async function listCustomerImportJobsWithin(
  exec: DB,
  scope: Scope,
  input: { cursor?: number; limit?: number } = {},
) {
  const cursor = Number.isSafeInteger(input.cursor) && Number(input.cursor) > 0
    ? Number(input.cursor)
    : null;
  const limit = Math.min(Math.max(Number(input.limit) || 50, 1), 100);
  const predicates = [
    eq(importJob.masterFn, scope.masterFn),
    eq(importJob.companyFn, scope.companyFn),
  ];
  if (cursor != null) predicates.push(lt(importJob.id, cursor));

  const rows = await exec.select().from(importJob)
    .where(and(...predicates))
    .orderBy(desc(importJob.id))
    .limit(limit + 1);
  const hasMore = rows.length > limit;
  const data = hasMore ? rows.slice(0, limit) : rows;
  return {
    data,
    nextCursor: hasMore && data.length ? data[data.length - 1].id : null,
  };
}

type RowError = { field: string; errorCode: string; message: string };

function boundedText(value: unknown, field: string, max: number, required: boolean) {
  if (value == null) {
    return required
      ? { value: null, error: { field, errorCode: 'required', message: `${field} is required.` } }
      : { value: null, error: null };
  }
  if (typeof value !== 'string') {
    return {
      value: null,
      error: { field, errorCode: 'invalid_type', message: `${field} must be text.` },
    };
  }
  const trimmed = value.trim();
  if (!trimmed && required) {
    return { value: null, error: { field, errorCode: 'required', message: `${field} is required.` } };
  }
  if (trimmed.length > max) {
    return {
      value: trimmed,
      error: { field, errorCode: 'too_long', message: `${field} must be ${max} characters or fewer.` },
    };
  }
  return { value: trimmed || null, error: null };
}

function validateInput(input: CreateCustomerImportJobInput) {
  if (!input || typeof input !== 'object') {
    throw new CustomerImportValidationError('Import input is required.');
  }
  if (typeof input.fileName !== 'string' || !input.fileName.trim()) {
    throw new CustomerImportValidationError('CSV file name is required.');
  }
  const fileName = input.fileName.trim().split(/[\\/]/).pop()!;
  if (fileName.length > 160 || !fileName.toLowerCase().endsWith('.csv')) {
    throw new CustomerImportValidationError('Use a .csv file name of 160 characters or fewer.');
  }
  if (!['update_existing', 'skip_existing'].includes(input.duplicateStrategy)) {
    throw new CustomerImportValidationError('Duplicate strategy is invalid.');
  }
  if (!Array.isArray(input.rows) || input.rows.length < 1) {
    throw new CustomerImportValidationError('At least one customer row is required.');
  }
  if (input.rows.length > MAX_CUSTOMER_IMPORT_ROWS) {
    throw new CustomerImportValidationError(
      `A customer import is limited to ${MAX_CUSTOMER_IMPORT_ROWS} rows. Split larger files into bounded jobs.`,
    );
  }
  return fileName;
}

export async function createCustomerImportJobWithin(
  exec: DB,
  scope: Scope,
  actorUserId: number,
  input: CreateCustomerImportJobInput,
) {
  if (!Number.isSafeInteger(actorUserId) || actorUserId <= 0) {
    throw new CustomerImportValidationError('An authenticated import owner is required.');
  }
  const fileName = validateInput(input);
  const normalized = input.rows.map((source, index) => {
    if (!source || typeof source !== 'object' || Array.isArray(source)) {
      return {
        rowNumber: index + 2, code: null, name: null, industry: null,
        errors: [{ field: 'row', errorCode: 'invalid_row', message: 'Row must be an object.' }] as RowError[],
      };
    }
    const unsupported = Object.keys(source).filter((key) => !['code', 'name', 'industry'].includes(key));
    if (unsupported.includes('masterFn') || unsupported.includes('companyFn')) {
      throw new CustomerImportValidationError('Tenant scope cannot appear inside import rows.');
    }
    const code = boundedText(source.code, 'code', 40, true);
    const name = boundedText(source.name, 'name', 200, true);
    const industry = boundedText(source.industry, 'industry', 120, false);
    const errors = [code.error, name.error, industry.error].filter(Boolean) as RowError[];
    if (unsupported.length) {
      errors.push({
        field: 'row', errorCode: 'unsupported_field',
        message: `Unsupported field(s): ${unsupported.join(', ')}.`,
      });
    }
    return {
      rowNumber: index + 2,
      code: code.value?.toUpperCase() ?? null,
      name: name.value,
      industry: industry.value,
      errors,
    };
  });

  const validCodes = normalized.flatMap((row) => row.code ? [row.code] : []);
  const existingRows = validCodes.length
    ? await exec.select({ id: customer.id, code: customer.code }).from(customer).where(and(
      eq(customer.masterFn, scope.masterFn),
      eq(customer.companyFn, scope.companyFn),
      inArray(customer.code, [...new Set(validCodes)]),
    ))
    : [];
  const existingByCode = new Map(existingRows.map((row) => [row.code, row.id]));
  const seen = new Set<string>();

  const prepared = normalized.map((row) => {
    const errors = [...row.errors];
    if (row.code) {
      if (seen.has(row.code)) {
        errors.push({
          field: 'code', errorCode: 'duplicate_in_file',
          message: `Customer code ${row.code} appears more than once in this file.`,
        });
      }
      seen.add(row.code);
    }
    const exists = row.code ? existingByCode.has(row.code) : false;
    const skip = errors.length === 0 && exists && input.duplicateStrategy === 'skip_existing';
    return {
      ...row,
      errors,
      operation: errors.length ? 'invalid' : skip ? 'skip' : exists ? 'update' : 'create',
      status: errors.length ? 'error' : skip ? 'skipped' : 'ready',
    } as const;
  });

  const readyRows = prepared.filter((row) => row.status === 'ready').length;
  const errorRows = prepared.filter((row) => row.status === 'error').length;
  const skippedRows = prepared.filter((row) => row.status === 'skipped').length;
  const [job] = await exec.insert(importJob).values({
    ...scope,
    target: 'customer',
    fileName,
    duplicateStrategy: input.duplicateStrategy,
    status: readyRows > 0 ? 'validated' : 'invalid',
    totalRows: prepared.length,
    readyRows,
    errorRows,
    skippedRows,
    createdByUserId: actorUserId,
  }).returning();

  await exec.insert(importJobRow).values(prepared.map((row) => ({
    ...scope,
    jobId: job.id,
    rowNumber: row.rowNumber,
    code: row.code,
    name: row.name,
    industry: row.industry,
    operation: row.operation,
    status: row.status,
  })));
  const errors = prepared.flatMap((row) => row.errors.map((error) => ({
    ...scope,
    jobId: job.id,
    rowNumber: row.rowNumber,
    ...error,
  })));
  if (errors.length) await exec.insert(importRowError).values(errors);

  return job;
}

export async function runCustomerImportJobWithin(exec: DB, scope: Scope, jobId: number) {
  if (!Number.isSafeInteger(jobId) || jobId <= 0) {
    throw new CustomerImportStateError('Import job id is invalid.');
  }
  const [job] = await exec.select().from(importJob).where(and(
    eq(importJob.masterFn, scope.masterFn),
    eq(importJob.companyFn, scope.companyFn),
    eq(importJob.id, jobId),
  )).for('update');
  if (!job) throw new CustomerImportStateError('Import job is unavailable in this company.');
  if (job.status !== 'validated') {
    throw new CustomerImportStateError('Only a validated import job can run.');
  }

  const now = new Date();
  await exec.update(importJob).set({ status: 'processing', startedAt: now, updatedAt: now })
    .where(eq(importJob.id, job.id));
  const rows = await exec.select().from(importJobRow).where(and(
    eq(importJobRow.masterFn, scope.masterFn),
    eq(importJobRow.companyFn, scope.companyFn),
    eq(importJobRow.jobId, job.id),
    eq(importJobRow.status, 'ready'),
  ));

  let importedRows = 0;
  let newlySkippedRows = 0;
  for (const row of rows) {
    if (!row.code || !row.name) {
      throw new CustomerImportStateError(`Validated row ${row.rowNumber} is incomplete.`);
    }
    let customerId: number;
    if (job.duplicateStrategy === 'update_existing') {
      const [upserted] = await exec.insert(customer).values({
        ...scope, code: row.code, name: row.name, industry: row.industry,
      }).onConflictDoUpdate({
        target: [customer.masterFn, customer.companyFn, customer.code],
        set: { name: row.name, industry: row.industry, updatedAt: now },
      }).returning({ id: customer.id });
      customerId = upserted.id;
    } else {
      const [inserted] = await exec.insert(customer).values({
        ...scope, code: row.code, name: row.name, industry: row.industry,
      }).onConflictDoNothing({
        target: [customer.masterFn, customer.companyFn, customer.code],
      }).returning({ id: customer.id });
      if (!inserted) {
        newlySkippedRows += 1;
        await exec.update(importJobRow).set({
          operation: 'skip', status: 'skipped', updatedAt: now,
        }).where(eq(importJobRow.id, row.id));
        continue;
      }
      customerId = inserted.id;
    }
    importedRows += 1;
    await exec.update(importJobRow).set({
      status: 'imported', importedCustomerId: customerId, updatedAt: now,
    }).where(eq(importJobRow.id, row.id));
  }

  const [completed] = await exec.update(importJob).set({
    status: 'completed',
    importedRows,
    skippedRows: job.skippedRows + newlySkippedRows,
    completedAt: now,
    updatedAt: now,
    version: sql`${importJob.version} + 1`,
  }).where(and(
    eq(importJob.masterFn, scope.masterFn),
    eq(importJob.companyFn, scope.companyFn),
    eq(importJob.id, job.id),
  )).returning();
  return completed;
}

export function createCustomerImportJob(
  db: DB,
  scope: Scope,
  actorUserId: number,
  input: CreateCustomerImportJobInput,
) {
  return db.transaction((tx) => createCustomerImportJobWithin(tx, scope, actorUserId, input));
}

export function runCustomerImportJob(db: DB, scope: Scope, jobId: number) {
  return db.transaction((tx) => runCustomerImportJobWithin(tx, scope, jobId));
}
