import Decimal from 'decimal.js';
import {
  and,
  asc,
  desc,
  eq,
  inArray,
} from 'drizzle-orm';
import type { DB } from '../../data/db';
import type { Scope } from '../../data/repo';
import {
  account,
  employee,
  employeePayoutProfile,
  expenseClaim,
  expensePosting,
  reimbursementPaymentBatch,
  reimbursementPaymentBatchEvent,
  reimbursementPaymentBatchLine,
} from '../../data/schema';

export const REIMBURSEMENT_BATCH_MAX_LINES = 500;

export class ReimbursementBatchError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly status = 409,
    public readonly details?: Record<string, string>,
  ) {
    super(message);
    this.name = 'ReimbursementBatchError';
  }
}

export interface ReimbursementBatchInput {
  batchKey: string;
  batchNo: string;
  currency: string;
  sourceBankAccountId: number;
  postingIds: number[];
}

function text(
  value: string | null | undefined,
  key: string,
  label: string,
  min: number,
  max: number,
): string {
  const result = value?.trim() ?? '';
  if (result.length < min || result.length > max) {
    throw new ReimbursementBatchError(
      'reimbursement_batch_invalid',
      `${label} must contain ${min}–${max} characters.`,
      422,
      { [key]: `${label} must contain ${min}–${max} characters.` },
    );
  }
  return result;
}

function postingIds(values: number[]): number[] {
  const normalized = Array.from(new Set(values.map(Number)));
  if (
    normalized.length === 0
    || normalized.length > REIMBURSEMENT_BATCH_MAX_LINES
    || normalized.some((id) => !Number.isSafeInteger(id) || id <= 0)
    || normalized.length !== values.length
  ) {
    throw new ReimbursementBatchError(
      'reimbursement_batch_postings_invalid',
      `Select 1–${REIMBURSEMENT_BATCH_MAX_LINES} distinct posted employee payables.`,
      422,
    );
  }
  return normalized;
}

function batchProjection(batch: typeof reimbursementPaymentBatch.$inferSelect) {
  return {
    id: batch.id,
    batchKey: batch.batchKey,
    batchNo: batch.batchNo,
    currency: batch.currency,
    sourceBankAccountId: batch.sourceBankAccountId,
    status: batch.status,
    version: batch.version,
    itemCount: batch.itemCount,
    totalAmount: batch.totalAmount,
    preparedByUserId: batch.preparedByUserId,
    preparedAt: batch.preparedAt,
    releasedByUserId: batch.releasedByUserId,
    releasedAt: batch.releasedAt,
    releaseReason: batch.releaseReason,
    releaseFactsSha256: batch.releaseFactsSha256,
    createdAt: batch.createdAt,
    updatedAt: batch.updatedAt,
  };
}

function lineProjection(line: typeof reimbursementPaymentBatchLine.$inferSelect) {
  return {
    id: line.id,
    batchId: line.batchId,
    lineNo: line.lineNo,
    expensePostingId: line.expensePostingId,
    claimId: line.claimId,
    claimLineId: line.claimLineId,
    ownerUserId: line.ownerUserId,
    employeeId: line.employeeId,
    payoutProfileId: line.payoutProfileId,
    payoutProfileVersion: line.payoutProfileVersion,
    currency: line.currency,
    amount: line.amount,
    payableAccountId: line.payableAccountId,
    claimNo: line.claimNo,
    accountHolderMasked: line.accountHolderMasked,
    accountNumberMasked: line.accountNumberMasked,
    bankName: line.bankName,
    postingFactsSha256: line.postingFactsSha256,
    destinationSnapshotted: line.payoutEnvelopeSnapshot != null,
    createdAt: line.createdAt,
  };
}

async function readBatchWithLines(
  tx: DB,
  scope: Scope,
  batchId: number,
) {
  const [batch] = await tx.select().from(reimbursementPaymentBatch).where(and(
    eq(reimbursementPaymentBatch.masterFn, scope.masterFn),
    eq(reimbursementPaymentBatch.companyFn, scope.companyFn),
    eq(reimbursementPaymentBatch.id, batchId),
  )).limit(1);
  if (!batch) {
    throw new ReimbursementBatchError(
      'reimbursement_batch_not_found',
      'The reimbursement batch is unavailable.',
      404,
    );
  }
  const lines = await tx.select().from(reimbursementPaymentBatchLine).where(and(
    eq(reimbursementPaymentBatchLine.masterFn, scope.masterFn),
    eq(reimbursementPaymentBatchLine.companyFn, scope.companyFn),
    eq(reimbursementPaymentBatchLine.batchId, batch.id),
  )).orderBy(asc(reimbursementPaymentBatchLine.lineNo));
  return {
    batch: batchProjection(batch),
    lines: lines.map(lineProjection),
  };
}

async function eligibleSources(
  tx: DB,
  scope: Scope,
  currency: string,
  allowBatchId?: number,
) {
  const candidates = await tx.select({
    posting: expensePosting,
    claim: {
      id: expenseClaim.id,
      claimNo: expenseClaim.claimNo,
      ownerUserId: expenseClaim.ownerUserId,
      title: expenseClaim.title,
    },
    employee: {
      id: employee.id,
      employeeNo: employee.employeeNo,
      fullName: employee.fullName,
      department: employee.department,
      isActive: employee.isActive,
    },
    profile: employeePayoutProfile,
  }).from(expensePosting)
    .innerJoin(expenseClaim, and(
      eq(expenseClaim.masterFn, scope.masterFn),
      eq(expenseClaim.companyFn, scope.companyFn),
      eq(expenseClaim.id, expensePosting.claimId),
    ))
    .innerJoin(employee, and(
      eq(employee.masterFn, scope.masterFn),
      eq(employee.companyFn, scope.companyFn),
      eq(employee.userId, expenseClaim.ownerUserId),
      eq(employee.isActive, true),
    ))
    .innerJoin(employeePayoutProfile, and(
      eq(employeePayoutProfile.masterFn, scope.masterFn),
      eq(employeePayoutProfile.companyFn, scope.companyFn),
      eq(employeePayoutProfile.employeeId, employee.id),
      eq(employeePayoutProfile.verificationStatus, 'verified'),
      eq(employeePayoutProfile.currency, currency),
    ))
    .where(and(
      eq(expensePosting.masterFn, scope.masterFn),
      eq(expensePosting.companyFn, scope.companyFn),
      eq(expensePosting.paymentSource, 'employee_paid'),
      eq(expensePosting.functionalCurrency, currency),
    ))
    .orderBy(asc(expensePosting.postingDate), asc(expensePosting.id))
    .limit(REIMBURSEMENT_BATCH_MAX_LINES + 1);
  const used = await tx.select({
    expensePostingId: reimbursementPaymentBatchLine.expensePostingId,
    batchId: reimbursementPaymentBatchLine.batchId,
  }).from(reimbursementPaymentBatchLine).where(and(
    eq(reimbursementPaymentBatchLine.masterFn, scope.masterFn),
    eq(reimbursementPaymentBatchLine.companyFn, scope.companyFn),
  ));
  const usedByPosting = new Map(used.map((row) => [row.expensePostingId, row.batchId]));
  return candidates.filter((row) => {
    const usedBatchId = usedByPosting.get(row.posting.id);
    return usedBatchId == null || usedBatchId === allowBatchId;
  });
}

export async function listOpenReimbursementPayablesWithin(
  tx: DB,
  scope: Scope,
  currencyInput: string,
) {
  const currency = currencyInput.trim().toUpperCase();
  if (!/^[A-Z]{3}$/.test(currency)) {
    throw new ReimbursementBatchError(
      'reimbursement_batch_currency_invalid',
      'Currency must be a three-letter currency code.',
      422,
    );
  }
  const sources = await eligibleSources(tx, scope, currency);
  return sources.slice(0, REIMBURSEMENT_BATCH_MAX_LINES).map((source) => ({
    expensePostingId: source.posting.id,
    postingDate: source.posting.postingDate,
    claimId: source.claim.id,
    claimNo: source.claim.claimNo,
    claimTitle: source.claim.title,
    employee: source.employee,
    payoutProfile: {
      id: source.profile.id,
      version: source.profile.version,
      verificationStatus: source.profile.verificationStatus,
      bankName: source.profile.bankName,
      accountHolderMasked: source.profile.accountHolderMasked,
      accountNumberMasked: source.profile.accountNumberMasked,
    },
    currency: source.posting.functionalCurrency,
    amount: source.posting.baseGross,
    payableAccountId: source.posting.creditAccountId,
    postingFactsSha256: source.posting.factsSha256,
  }));
}

async function assertSourceBankAccount(
  tx: DB,
  scope: Scope,
  sourceBankAccountId: number,
) {
  const [bank] = await tx.select().from(account).where(and(
    eq(account.masterFn, scope.masterFn),
    eq(account.companyFn, scope.companyFn),
    eq(account.id, sourceBankAccountId),
  )).limit(1);
  if (!bank || bank.type !== 'asset') {
    throw new ReimbursementBatchError(
      'reimbursement_batch_bank_account_invalid',
      'The source bank account must be an active company asset account.',
      422,
    );
  }
  return bank;
}

async function replaceLines(
  tx: DB,
  scope: Scope,
  batch: typeof reimbursementPaymentBatch.$inferSelect,
  actorUserId: number,
  selectedPostingIds: number[],
  now: Date,
  eventType: 'created' | 'membership_replaced',
) {
  if (batch.status !== 'draft') {
    throw new ReimbursementBatchError(
      'reimbursement_batch_locked',
      'Released batch membership is immutable.',
    );
  }
  if (batch.preparedByUserId !== actorUserId) {
    throw new ReimbursementBatchError(
      'reimbursement_batch_preparer_required',
      'Only the original preparer may change draft membership.',
      403,
    );
  }
  const selected = postingIds(selectedPostingIds);
  const sources = await eligibleSources(tx, scope, batch.currency, batch.id);
  const byPosting = new Map(sources.map((source) => [source.posting.id, source]));
  const missing = selected.filter((id) => !byPosting.has(id));
  if (missing.length) {
    throw new ReimbursementBatchError(
      'reimbursement_batch_payable_ineligible',
      'Every selected posting must be an open employee payable with a current verified payout profile.',
      422,
      { postingIds: missing.join(',') },
    );
  }
  const rows = selected.map((postingId, index) => {
    const source = byPosting.get(postingId)!;
    return {
      ...scope,
      batchId: batch.id,
      lineNo: index + 1,
      expensePostingId: source.posting.id,
      claimId: source.claim.id,
      claimLineId: source.posting.lineId,
      ownerUserId: source.claim.ownerUserId,
      employeeId: source.employee.id,
      payoutProfileId: source.profile.id,
      payoutProfileVersion: source.profile.version,
      currency: source.posting.functionalCurrency,
      amount: source.posting.baseGross,
      payableAccountId: source.posting.creditAccountId,
      claimNo: source.claim.claimNo,
      accountHolderMasked: source.profile.accountHolderMasked,
      accountNumberMasked: source.profile.accountNumberMasked,
      bankName: source.profile.bankName,
      payoutEnvelopeSnapshot: null,
      postingFactsSha256: source.posting.factsSha256,
      createdAt: now,
    };
  });
  const total = rows.reduce(
    (sum, row) => sum.plus(row.amount),
    new Decimal(0),
  ).toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
  await tx.delete(reimbursementPaymentBatchLine).where(and(
    eq(reimbursementPaymentBatchLine.masterFn, scope.masterFn),
    eq(reimbursementPaymentBatchLine.companyFn, scope.companyFn),
    eq(reimbursementPaymentBatchLine.batchId, batch.id),
  ));
  const lines = await tx.insert(reimbursementPaymentBatchLine).values(rows).returning();
  const [updated] = await tx.update(reimbursementPaymentBatch).set({
    itemCount: lines.length,
    totalAmount: total.toFixed(2),
    version: batch.version + (eventType === 'created' ? 0 : 1),
    updatedAt: now,
  }).where(and(
    eq(reimbursementPaymentBatch.masterFn, scope.masterFn),
    eq(reimbursementPaymentBatch.companyFn, scope.companyFn),
    eq(reimbursementPaymentBatch.id, batch.id),
    eq(reimbursementPaymentBatch.version, batch.version),
  )).returning();
  if (!updated) {
    throw new ReimbursementBatchError(
      'reimbursement_batch_version_conflict',
      'The reimbursement batch changed before membership was saved.',
    );
  }
  await tx.insert(reimbursementPaymentBatchEvent).values({
    ...scope,
    batchId: batch.id,
    actorUserId,
    eventType,
    batchVersion: updated.version,
    reason: eventType === 'created' ? null : 'Draft membership was replaced.',
    detail: {
      itemCount: lines.length,
      totalAmount: total.toFixed(2),
      postingIds: selected,
    },
    occurredAt: now,
  });
  return {
    batch: batchProjection(updated),
    lines: lines.map(lineProjection),
  };
}

export async function createReimbursementBatchWithin(
  tx: DB,
  scope: Scope,
  actorUserId: number,
  input: ReimbursementBatchInput,
  now = new Date(),
) {
  const batchKey = text(input.batchKey, 'batchKey', 'Batch key', 8, 128);
  if (!/^[A-Za-z0-9][A-Za-z0-9._:-]{7,127}$/.test(batchKey)) {
    throw new ReimbursementBatchError(
      'reimbursement_batch_invalid',
      'Batch key contains unsupported characters.',
      422,
      { batchKey: 'Use letters, digits, dots, underscores, colons or hyphens.' },
    );
  }
  const batchNo = text(input.batchNo, 'batchNo', 'Batch number', 3, 80);
  const currency = input.currency.trim().toUpperCase();
  if (!/^[A-Z]{3}$/.test(currency)) {
    throw new ReimbursementBatchError(
      'reimbursement_batch_currency_invalid',
      'Currency must be a three-letter currency code.',
      422,
    );
  }
  if (!Number.isSafeInteger(input.sourceBankAccountId) || input.sourceBankAccountId <= 0) {
    throw new ReimbursementBatchError(
      'reimbursement_batch_bank_account_invalid',
      'A valid source bank account is required.',
      422,
    );
  }
  await assertSourceBankAccount(tx, scope, input.sourceBankAccountId);
  const [existing] = await tx.select().from(reimbursementPaymentBatch).where(and(
    eq(reimbursementPaymentBatch.masterFn, scope.masterFn),
    eq(reimbursementPaymentBatch.companyFn, scope.companyFn),
    eq(reimbursementPaymentBatch.batchKey, batchKey),
  )).limit(1);
  if (existing) {
    if (
      existing.batchNo !== batchNo
      || existing.currency !== currency
      || existing.sourceBankAccountId !== input.sourceBankAccountId
      || existing.preparedByUserId !== actorUserId
    ) {
      throw new ReimbursementBatchError(
        'reimbursement_batch_key_conflict',
        'Batch key is already used for different facts.',
      );
    }
    const current = await readBatchWithLines(tx, scope, existing.id);
    if (
      current.lines.map((line) => line.expensePostingId).join(',')
      !== postingIds(input.postingIds).join(',')
    ) {
      throw new ReimbursementBatchError(
        'reimbursement_batch_key_conflict',
        'Batch key is already used for different membership.',
      );
    }
    return { ...current, replayed: true };
  }
  const [batch] = await tx.insert(reimbursementPaymentBatch).values({
    ...scope,
    batchKey,
    batchNo,
    currency,
    sourceBankAccountId: input.sourceBankAccountId,
    status: 'draft',
    version: 1,
    itemCount: 0,
    totalAmount: '0.00',
    preparedByUserId: actorUserId,
    preparedAt: now,
    createdAt: now,
    updatedAt: now,
  }).returning();
  const result = await replaceLines(
    tx,
    scope,
    batch,
    actorUserId,
    input.postingIds,
    now,
    'created',
  );
  return { ...result, replayed: false };
}

export async function replaceReimbursementBatchLinesWithin(
  tx: DB,
  scope: Scope,
  actorUserId: number,
  batchId: number,
  expectedVersion: number,
  selectedPostingIds: number[],
  now = new Date(),
) {
  const [batch] = await tx.select().from(reimbursementPaymentBatch).where(and(
    eq(reimbursementPaymentBatch.masterFn, scope.masterFn),
    eq(reimbursementPaymentBatch.companyFn, scope.companyFn),
    eq(reimbursementPaymentBatch.id, batchId),
  )).limit(1).for('update');
  if (!batch) {
    throw new ReimbursementBatchError(
      'reimbursement_batch_not_found',
      'The reimbursement batch is unavailable.',
      404,
    );
  }
  if (batch.version !== expectedVersion) {
    throw new ReimbursementBatchError(
      'reimbursement_batch_version_conflict',
      'The reimbursement batch changed before membership was saved.',
    );
  }
  return replaceLines(
    tx,
    scope,
    batch,
    actorUserId,
    selectedPostingIds,
    now,
    'membership_replaced',
  );
}

export async function releaseReimbursementBatchWithin(
  tx: DB,
  scope: Scope,
  actorUserId: number,
  batchId: number,
  expectedVersion: number,
  reasonValue: string,
  hashValue: (value: unknown) => string | Promise<string>,
  now = new Date(),
) {
  const reason = text(reasonValue, 'reason', 'Release reason', 3, 500);
  const [batch] = await tx.select().from(reimbursementPaymentBatch).where(and(
    eq(reimbursementPaymentBatch.masterFn, scope.masterFn),
    eq(reimbursementPaymentBatch.companyFn, scope.companyFn),
    eq(reimbursementPaymentBatch.id, batchId),
  )).limit(1).for('update');
  if (!batch) {
    throw new ReimbursementBatchError(
      'reimbursement_batch_not_found',
      'The reimbursement batch is unavailable.',
      404,
    );
  }
  if (batch.status === 'released') {
    if (batch.releasedByUserId === actorUserId && batch.releaseReason === reason) {
      return { ...(await readBatchWithLines(tx, scope, batch.id)), replayed: true };
    }
    throw new ReimbursementBatchError(
      'reimbursement_batch_locked',
      'The reimbursement batch is already released.',
    );
  }
  if (batch.version !== expectedVersion) {
    throw new ReimbursementBatchError(
      'reimbursement_batch_version_conflict',
      'The reimbursement batch changed before release.',
    );
  }
  if (batch.preparedByUserId === actorUserId) {
    throw new ReimbursementBatchError(
      'reimbursement_batch_maker_checker_required',
      'The batch releaser must be different from the preparer.',
      403,
    );
  }
  const lines = await tx.select().from(reimbursementPaymentBatchLine).where(and(
    eq(reimbursementPaymentBatchLine.masterFn, scope.masterFn),
    eq(reimbursementPaymentBatchLine.companyFn, scope.companyFn),
    eq(reimbursementPaymentBatchLine.batchId, batch.id),
  )).orderBy(asc(reimbursementPaymentBatchLine.lineNo)).for('update');
  if (!lines.length) {
    throw new ReimbursementBatchError(
      'reimbursement_batch_empty',
      'At least one open payable is required before release.',
      422,
    );
  }
  if (lines.some((line) => line.ownerUserId === actorUserId)) {
    throw new ReimbursementBatchError(
      'reimbursement_batch_self_payment_forbidden',
      'A releaser cannot approve a batch containing their own expense claim.',
      403,
    );
  }
  const profiles = await tx.select().from(employeePayoutProfile).where(and(
    eq(employeePayoutProfile.masterFn, scope.masterFn),
    eq(employeePayoutProfile.companyFn, scope.companyFn),
    inArray(employeePayoutProfile.id, lines.map((line) => line.payoutProfileId)),
  )).for('update');
  const byProfile = new Map(profiles.map((profile) => [profile.id, profile]));
  for (const line of lines) {
    const profile = byProfile.get(line.payoutProfileId);
    if (
      !profile
      || profile.employeeId !== line.employeeId
      || profile.verificationStatus !== 'verified'
      || profile.version !== line.payoutProfileVersion
      || profile.currency !== line.currency
    ) {
      throw new ReimbursementBatchError(
        'reimbursement_batch_payout_changed',
        `Payout profile for line ${line.lineNo} changed or is no longer verified.`,
        422,
      );
    }
  }
  for (const line of lines) {
    const profile = byProfile.get(line.payoutProfileId)!;
    await tx.update(reimbursementPaymentBatchLine).set({
      payoutEnvelopeSnapshot: profile.detailsEnvelope,
    }).where(and(
      eq(reimbursementPaymentBatchLine.masterFn, scope.masterFn),
      eq(reimbursementPaymentBatchLine.companyFn, scope.companyFn),
      eq(reimbursementPaymentBatchLine.id, line.id),
    ));
  }
  const releaseFacts = {
    schema: 'reimbursement-batch-release-v1',
    batchId: batch.id,
    batchKey: batch.batchKey,
    batchNo: batch.batchNo,
    currency: batch.currency,
    sourceBankAccountId: batch.sourceBankAccountId,
    preparedByUserId: batch.preparedByUserId,
    releasedByUserId: actorUserId,
    items: await Promise.all(lines.map(async (line) => {
      const profile = byProfile.get(line.payoutProfileId)!;
      return {
        lineNo: line.lineNo,
        expensePostingId: line.expensePostingId,
        postingFactsSha256: line.postingFactsSha256,
        claimId: line.claimId,
        claimLineId: line.claimLineId,
        ownerUserId: line.ownerUserId,
        employeeId: line.employeeId,
        payoutProfileId: line.payoutProfileId,
        payoutProfileVersion: line.payoutProfileVersion,
        payoutEnvelopeSha256: await hashValue(profile.detailsEnvelope),
        currency: line.currency,
        amount: line.amount,
        payableAccountId: line.payableAccountId,
      };
    })),
  };
  const [released] = await tx.update(reimbursementPaymentBatch).set({
    status: 'released',
    version: batch.version + 1,
    releasedByUserId: actorUserId,
    releasedAt: now,
    releaseReason: reason,
    releaseFactsSha256: await hashValue(releaseFacts),
    updatedAt: now,
  }).where(and(
    eq(reimbursementPaymentBatch.masterFn, scope.masterFn),
    eq(reimbursementPaymentBatch.companyFn, scope.companyFn),
    eq(reimbursementPaymentBatch.id, batch.id),
    eq(reimbursementPaymentBatch.version, batch.version),
  )).returning();
  if (!released) {
    throw new ReimbursementBatchError(
      'reimbursement_batch_version_conflict',
      'The reimbursement batch changed before release.',
    );
  }
  await tx.insert(reimbursementPaymentBatchEvent).values({
    ...scope,
    batchId: batch.id,
    actorUserId,
    eventType: 'released',
    batchVersion: released.version,
    reason,
    detail: {
      itemCount: released.itemCount,
      totalAmount: released.totalAmount,
      releaseFactsSha256: released.releaseFactsSha256,
    },
    occurredAt: now,
  });
  return {
    ...(await readBatchWithLines(tx, scope, batch.id)),
    replayed: false,
  };
}

export async function listReimbursementBatchesWithin(
  tx: DB,
  scope: Scope,
) {
  const batches = await tx.select().from(reimbursementPaymentBatch).where(and(
    eq(reimbursementPaymentBatch.masterFn, scope.masterFn),
    eq(reimbursementPaymentBatch.companyFn, scope.companyFn),
  )).orderBy(desc(reimbursementPaymentBatch.preparedAt), desc(reimbursementPaymentBatch.id))
    .limit(200);
  if (!batches.length) return [];
  const lines = await tx.select().from(reimbursementPaymentBatchLine).where(and(
    eq(reimbursementPaymentBatchLine.masterFn, scope.masterFn),
    eq(reimbursementPaymentBatchLine.companyFn, scope.companyFn),
    inArray(reimbursementPaymentBatchLine.batchId, batches.map((batch) => batch.id)),
  )).orderBy(
    asc(reimbursementPaymentBatchLine.batchId),
    asc(reimbursementPaymentBatchLine.lineNo),
  );
  const linesByBatch = new Map<number, ReturnType<typeof lineProjection>[]>();
  for (const line of lines) {
    const projected = lineProjection(line);
    linesByBatch.set(line.batchId, [...(linesByBatch.get(line.batchId) ?? []), projected]);
  }
  return batches.map((batch) => ({
    batch: batchProjection(batch),
    lines: linesByBatch.get(batch.id) ?? [],
  }));
}
