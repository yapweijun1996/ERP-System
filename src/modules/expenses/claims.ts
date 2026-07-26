import { createHash } from 'node:crypto';
import Decimal from 'decimal.js';
import {
  and,
  eq,
  inArray,
} from 'drizzle-orm';
import type { DB } from '../../data/db';
import type { Scope } from '../../data/repo';
import { withTenantTransaction } from '../../data/tenantTransaction';
import {
  expenseAllocation,
  expenseClaim,
  expenseClaimEvent,
  expenseClaimLine,
  expenseClaimRevision,
  expenseClaimSubmissionAuthorization,
  expenseLinePolicySnapshot,
  expensePolicyVersion,
  receiptInboxItem,
} from '../../data/schema';
import {
  snapshotSubmittedExpenseLineWithin,
} from './policy';
import { startExpenseLineControlsWithin } from './controls';

const SYSTEM_ACTOR = 'expense-auto-submit-v1';

export class ExpenseClaimError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly status = 409,
  ) {
    super(message);
    this.name = 'ExpenseClaimError';
  }
}

function text(value: string, label: string, min: number, max: number): string {
  const result = value.trim();
  if (result.length < min || result.length > max) {
    throw new ExpenseClaimError(
      'expense_claim_text_invalid',
      `${label} must contain ${min}–${max} characters.`,
      422,
    );
  }
  return result;
}

function amount(value: string | number, label: string, zero = false): Decimal {
  let result: Decimal;
  try {
    result = new Decimal(value);
  } catch {
    throw new ExpenseClaimError('expense_claim_amount_invalid', `${label} is invalid.`, 422);
  }
  if (!result.isFinite() || (zero ? result.lt(0) : result.lte(0))) {
    throw new ExpenseClaimError(
      'expense_claim_amount_invalid',
      `${label} must be ${zero ? 'zero or positive' : 'positive'}.`,
      422,
    );
  }
  return result;
}

function fixed(value: Decimal, places = 4): string {
  return value.toDecimalPlaces(places, Decimal.ROUND_HALF_UP).toFixed(places);
}

function keyText(value: string, label: string): string {
  const key = value.trim();
  if (!/^[A-Za-z0-9][A-Za-z0-9._:-]{7,127}$/.test(key)) {
    throw new ExpenseClaimError(
      'expense_claim_key_invalid',
      `${label} must be a stable 8–128 character key.`,
      422,
    );
  }
  return key;
}

function isoDate(value: string): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)
    || new Date(`${value}T00:00:00.000Z`).toISOString().slice(0, 10) !== value) {
    throw new ExpenseClaimError(
      'expense_claim_date_invalid',
      'Transaction date must be a valid ISO date.',
      422,
    );
  }
  return value;
}

export interface ExpenseAllocationInput {
  dimensionType: 'department' | 'cost_center' | 'project';
  dimensionKey: string;
  amount?: string | number;
  percentage?: string | number;
}

export interface ExpenseClaimLineInput {
  merchant: string;
  merchantTaxNumber?: string | null;
  transactionDate: string;
  purpose: string;
  categoryCode: string;
  paymentSource: 'employee_paid' | 'company_paid';
  originalCurrency: string;
  originalNet: string | number;
  originalTax: string | number;
  originalGross: string | number;
  receiptInboxItemId?: number | null;
  allocationMode: 'amount' | 'percentage';
  allocations: ExpenseAllocationInput[];
}

function normalizeLine(input: ExpenseClaimLineInput) {
  const net = amount(input.originalNet, 'Original net', true);
  const tax = amount(input.originalTax, 'Original tax', true);
  const gross = amount(input.originalGross, 'Original gross');
  if (!net.plus(tax).eq(gross)) {
    throw new ExpenseClaimError(
      'expense_claim_total_invalid',
      'Original net plus tax must equal gross exactly.',
      422,
    );
  }
  if (!input.allocations.length || input.allocations.length > 100) {
    throw new ExpenseClaimError(
      'expense_allocation_required',
      'Each expense line requires 1–100 allocations.',
      422,
    );
  }
  const normalized = input.allocations.map((allocation) => ({
    dimensionType: allocation.dimensionType,
    dimensionKey: text(allocation.dimensionKey, 'Allocation dimension', 1, 80),
    amount: allocation.amount == null ? null : amount(allocation.amount, 'Allocation amount', true),
    percentage: allocation.percentage == null
      ? null
      : amount(allocation.percentage, 'Allocation percentage', true),
  }));
  let allocations: Array<{
    dimensionType: 'department' | 'cost_center' | 'project';
    dimensionKey: string;
    amountOriginal: string;
    percentage: string;
  }>;
  if (input.allocationMode === 'amount') {
    if (normalized.some((row) => row.amount == null)
      || !normalized.reduce((sum, row) => sum.plus(row.amount!), new Decimal(0)).eq(gross)) {
      throw new ExpenseClaimError(
        'expense_allocation_not_reconciled',
        'Amount allocations must reconcile exactly to line gross.',
        422,
      );
    }
    allocations = normalized.map((row) => ({
      dimensionType: row.dimensionType,
      dimensionKey: row.dimensionKey,
      amountOriginal: fixed(row.amount!),
      percentage: fixed(row.amount!.mul(100).div(gross)),
    }));
  } else {
    if (normalized.some((row) => row.percentage == null || row.percentage.gt(100))
      || !normalized.reduce(
        (sum, row) => sum.plus(row.percentage!),
        new Decimal(0),
      ).eq(100)) {
      throw new ExpenseClaimError(
        'expense_allocation_not_reconciled',
        'Percentage allocations must reconcile exactly to 100%.',
        422,
      );
    }
    let allocated = new Decimal(0);
    allocations = normalized.map((row, index) => {
      const allocatedAmount = index === normalized.length - 1
        ? gross.minus(allocated)
        : gross.mul(row.percentage!).div(100)
          .toDecimalPlaces(4, Decimal.ROUND_HALF_UP);
      allocated = allocated.plus(allocatedAmount);
      return {
        dimensionType: row.dimensionType,
        dimensionKey: row.dimensionKey,
        amountOriginal: fixed(allocatedAmount),
        percentage: fixed(row.percentage!),
      };
    });
  }
  if (!allocations.reduce(
    (sum, row) => sum.plus(row.amountOriginal),
    new Decimal(0),
  ).eq(gross)) {
    throw new ExpenseClaimError(
      'expense_allocation_not_reconciled',
      'Derived allocation amounts do not reconcile to line gross.',
      422,
    );
  }
  return {
    merchant: text(input.merchant, 'Merchant', 1, 160),
    merchantTaxNumber: input.merchantTaxNumber == null
      ? null
      : text(input.merchantTaxNumber, 'Merchant tax number', 3, 80).toUpperCase(),
    transactionDate: isoDate(input.transactionDate),
    purpose: text(input.purpose, 'Purpose', 3, 500),
    categoryCode: input.categoryCode.trim().toUpperCase(),
    paymentSource: input.paymentSource,
    originalCurrency: input.originalCurrency.trim().toUpperCase(),
    originalNet: fixed(net),
    originalTax: fixed(tax),
    originalGross: fixed(gross),
    receiptInboxItemId: input.receiptInboxItemId ?? null,
    allocationMode: input.allocationMode,
    allocations,
  };
}

export async function createExpenseClaimDraftWithin(
  tx: DB,
  scope: Scope,
  ownerUserId: number,
  input: {
    claimKey: string;
    claimNo: string;
    title: string;
    autoSubmitAuthorized?: boolean;
  },
  now = new Date(),
) {
  const claimKey = keyText(input.claimKey, 'Claim key');
  const claimNo = text(input.claimNo, 'Claim number', 2, 80);
  const title = text(input.title, 'Claim title', 3, 160);
  const authorized = input.autoSubmitAuthorized === true;
  const [existing] = await tx.select().from(expenseClaim).where(and(
      eq(expenseClaim.masterFn, scope.masterFn),
      eq(expenseClaim.companyFn, scope.companyFn),
      eq(expenseClaim.claimKey, claimKey),
    )).limit(1);
    if (existing) {
      if (existing.ownerUserId !== ownerUserId
        || existing.claimNo !== claimNo
        || existing.title !== title) {
        throw new ExpenseClaimError(
          'expense_claim_key_conflict',
          'This claim key already belongs to different employee-owned facts.',
        );
      }
      return { claim: existing, replayed: true };
    }
    const [claim] = await tx.insert(expenseClaim).values({
      ...scope,
      claimKey,
      claimNo,
      ownerUserId,
      title,
    }).returning();
    await tx.insert(expenseClaimSubmissionAuthorization).values({
      ...scope,
      claimId: claim.id,
      ownerUserId,
      autoSubmitAuthorized: authorized,
      authorizedAt: authorized ? now : null,
    });
    await tx.insert(expenseClaimEvent).values({
      ...scope,
      claimId: claim.id,
      eventType: 'created',
      actorUserId: ownerUserId,
      fromStatus: null,
      toStatus: 'draft',
      reason: 'Employee created an expense claim draft.',
      claimVersion: claim.version,
      createdAt: now,
    });
  return { claim, replayed: false };
}

export function createExpenseClaimDraft(
  db: DB,
  scope: Scope,
  ownerUserId: number,
  input: Parameters<typeof createExpenseClaimDraftWithin>[3],
  now = new Date(),
) {
  return withTenantTransaction(db, scope, (tx) =>
    createExpenseClaimDraftWithin(tx, scope, ownerUserId, input, now));
}

export async function replaceExpenseClaimDraftLinesWithin(
  tx: DB,
  scope: Scope,
  actorUserId: number,
  claimId: number,
  expectedVersion: number,
  inputs: ExpenseClaimLineInput[],
  now = new Date(),
) {
  if (!inputs.length || inputs.length > 100) {
    throw new ExpenseClaimError(
      'expense_claim_lines_required',
      'A claim requires 1–100 expense lines.',
      422,
    );
  }
  const normalized = inputs.map(normalizeLine);
  const [claim] = await tx.select().from(expenseClaim).where(and(
      eq(expenseClaim.masterFn, scope.masterFn),
      eq(expenseClaim.companyFn, scope.companyFn),
      eq(expenseClaim.id, claimId),
    )).limit(1).for('update');
    if (!claim) {
      throw new ExpenseClaimError('expense_claim_missing', 'Expense claim is unavailable.', 404);
    }
    if (claim.ownerUserId !== actorUserId) {
      throw new ExpenseClaimError(
        'expense_claim_employee_owner_required',
        'Only the employee owner may change claim facts.',
        403,
      );
    }
    if (claim.status !== 'draft') {
      throw new ExpenseClaimError(
        'expense_claim_not_draft',
        'Submitted employee-owned claim facts cannot be rewritten.',
      );
    }
    if (claim.version !== expectedVersion) {
      throw new ExpenseClaimError(
        'expense_claim_version_conflict',
        'Expense claim changed before this update.',
      );
    }
    const receiptIds = normalized.flatMap((line) =>
      line.receiptInboxItemId == null ? [] : [line.receiptInboxItemId]);
    if (new Set(receiptIds).size !== receiptIds.length) {
      throw new ExpenseClaimError(
        'expense_receipt_reused',
        'One receipt inbox item cannot support multiple claim lines.',
        422,
      );
    }
    if (receiptIds.length) {
      const receipts = await tx.select({
        id: receiptInboxItem.id,
        ownerUserId: receiptInboxItem.ownerUserId,
      }).from(receiptInboxItem).where(and(
        eq(receiptInboxItem.masterFn, scope.masterFn),
        eq(receiptInboxItem.companyFn, scope.companyFn),
        inArray(receiptInboxItem.id, receiptIds),
      ));
      if (receipts.length !== receiptIds.length
        || receipts.some((receipt) => receipt.ownerUserId !== actorUserId)) {
        throw new ExpenseClaimError(
          'expense_receipt_access_denied',
          'Every linked receipt must belong to the employee in the active company.',
          403,
        );
      }
    }
    const oldLines = await tx.select({ id: expenseClaimLine.id })
      .from(expenseClaimLine).where(and(
        eq(expenseClaimLine.masterFn, scope.masterFn),
        eq(expenseClaimLine.companyFn, scope.companyFn),
        eq(expenseClaimLine.claimId, claim.id),
      ));
    if (oldLines.length) {
      await tx.delete(expenseAllocation).where(and(
        eq(expenseAllocation.masterFn, scope.masterFn),
        eq(expenseAllocation.companyFn, scope.companyFn),
        inArray(expenseAllocation.lineId, oldLines.map((line) => line.id)),
      ));
      await tx.delete(expenseClaimLine).where(and(
        eq(expenseClaimLine.masterFn, scope.masterFn),
        eq(expenseClaimLine.companyFn, scope.companyFn),
        eq(expenseClaimLine.claimId, claim.id),
      ));
    }
    const lines = [];
    for (let index = 0; index < normalized.length; index += 1) {
      const input = normalized[index];
      const [line] = await tx.insert(expenseClaimLine).values({
        ...scope,
        claimId: claim.id,
        lineNo: index + 1,
        merchant: input.merchant,
        merchantTaxNumber: input.merchantTaxNumber,
        transactionDate: input.transactionDate,
        purpose: input.purpose,
        categoryCode: input.categoryCode,
        paymentSource: input.paymentSource,
        originalCurrency: input.originalCurrency,
        originalNet: input.originalNet,
        originalTax: input.originalTax,
        originalGross: input.originalGross,
        receiptInboxItemId: input.receiptInboxItemId,
        updatedAt: now,
      }).returning();
      await tx.insert(expenseAllocation).values(input.allocations.map((allocation, allocationIndex) => ({
        ...scope,
        lineId: line.id,
        allocationNo: allocationIndex + 1,
        mode: input.allocationMode,
        dimensionType: allocation.dimensionType,
        dimensionKey: allocation.dimensionKey,
        amountOriginal: allocation.amountOriginal,
        percentage: allocation.percentage,
      })));
      lines.push(line);
    }
    const [updated] = await tx.update(expenseClaim).set({
      version: claim.version + 1,
      updatedAt: now,
    }).where(and(
      eq(expenseClaim.id, claim.id),
      eq(expenseClaim.version, expectedVersion),
    )).returning();
    if (!updated) {
      throw new ExpenseClaimError(
        'expense_claim_version_conflict',
        'Expense claim changed before this update.',
      );
    }
    await tx.insert(expenseClaimEvent).values({
      ...scope,
      claimId: claim.id,
      eventType: 'draft_replaced',
      actorUserId,
      fromStatus: 'draft',
      toStatus: 'draft',
      reason: 'Employee replaced the complete draft line set.',
      claimVersion: updated.version,
      createdAt: now,
    });
  return { claim: updated, lines };
}

export function replaceExpenseClaimDraftLines(
  db: DB,
  scope: Scope,
  actorUserId: number,
  claimId: number,
  expectedVersion: number,
  inputs: ExpenseClaimLineInput[],
  now = new Date(),
) {
  return withTenantTransaction(db, scope, (tx) =>
    replaceExpenseClaimDraftLinesWithin(
      tx,
      scope,
      actorUserId,
      claimId,
      expectedVersion,
      inputs,
      now,
    ));
}

export async function submitExpenseClaimWithin(
  tx: DB,
  scope: Scope,
  ownerUserId: number,
  claimId: number,
  expectedVersion: number,
  kind: 'employee' | 'system',
  now: Date,
) {
  const [claim] = await tx.select().from(expenseClaim).where(and(
      eq(expenseClaim.masterFn, scope.masterFn),
      eq(expenseClaim.companyFn, scope.companyFn),
      eq(expenseClaim.id, claimId),
    )).limit(1).for('update');
    if (!claim) {
      throw new ExpenseClaimError('expense_claim_missing', 'Expense claim is unavailable.', 404);
    }
    if (claim.ownerUserId !== ownerUserId) {
      throw new ExpenseClaimError(
        'expense_claim_employee_owner_required',
        'Final submission authority belongs to the employee owner.',
        403,
      );
    }
    if (claim.status !== 'draft' && claim.submissionKind !== 'none') {
      return { claim, replayed: true };
    }
    if (claim.status !== 'draft' || claim.version !== expectedVersion) {
      throw new ExpenseClaimError(
        'expense_claim_version_conflict',
        'Only the expected draft version may be submitted.',
      );
    }
    const [authorization] = await tx.select()
      .from(expenseClaimSubmissionAuthorization).where(and(
        eq(expenseClaimSubmissionAuthorization.masterFn, scope.masterFn),
        eq(expenseClaimSubmissionAuthorization.companyFn, scope.companyFn),
        eq(expenseClaimSubmissionAuthorization.claimId, claim.id),
      )).limit(1);
    if (kind === 'system' && (!authorization?.autoSubmitAuthorized
      || authorization.ownerUserId !== ownerUserId
      || !authorization.authorizedAt)) {
      throw new ExpenseClaimError(
        'expense_claim_auto_submit_not_authorized',
        'The employee did not explicitly authorize automatic final submission.',
        403,
      );
    }
    const lines = await tx.select().from(expenseClaimLine).where(and(
      eq(expenseClaimLine.masterFn, scope.masterFn),
      eq(expenseClaimLine.companyFn, scope.companyFn),
      eq(expenseClaimLine.claimId, claim.id),
    )).orderBy(expenseClaimLine.lineNo);
    if (!lines.length) {
      throw new ExpenseClaimError(
        'expense_claim_lines_required',
        'A claim cannot be submitted without lines.',
        422,
      );
    }
    const receiptIds = lines.flatMap((line) =>
      line.receiptInboxItemId == null ? [] : [line.receiptInboxItemId]);
    const receipts = receiptIds.length
      ? await tx.select().from(receiptInboxItem).where(and(
        eq(receiptInboxItem.masterFn, scope.masterFn),
        eq(receiptInboxItem.companyFn, scope.companyFn),
        inArray(receiptInboxItem.id, receiptIds),
      ))
      : [];
    if (kind === 'system' && (receiptIds.length !== lines.length
      || receipts.length !== receiptIds.length
      || receipts.some((receipt) =>
        receipt.status !== 'submitted'
        || receipt.authorizedByUserId !== ownerUserId
        || receipt.systemActorKey !== 'receipt-auto-submit-v1'))) {
      throw new ExpenseClaimError(
        'expense_claim_auto_submit_ineligible',
        'Automatic claim submission requires every line to carry an employee-authorized system-submitted receipt.',
        422,
      );
    }
    const snapshots: Array<typeof expenseLinePolicySnapshot.$inferSelect> = [];
    for (const line of lines) {
      const result = await snapshotSubmittedExpenseLineWithin(
        tx,
        scope,
        ownerUserId,
        {
          lineKey: `claim:${claim.id}:line:${line.id}:v${claim.version + 1}`,
          categoryCode: line.categoryCode,
          transactionDate: line.transactionDate,
          paymentSource: line.paymentSource as 'employee_paid' | 'company_paid',
          originalCurrency: line.originalCurrency,
          originalNet: line.originalNet,
          originalTax: line.originalTax,
          originalGross: line.originalGross,
        },
        now,
      );
      const [policy] = await tx.select({
        evidenceRequired: expensePolicyVersion.evidenceRequired,
      }).from(expensePolicyVersion).where(eq(
        expensePolicyVersion.id,
        result.snapshot.policyVersionId,
      )).limit(1);
      if (policy?.evidenceRequired && line.receiptInboxItemId == null) {
        throw new ExpenseClaimError(
          'expense_claim_evidence_required',
          `Line ${line.lineNo} requires receipt evidence.`,
          422,
        );
      }
      await tx.update(expenseClaimLine).set({
        policySnapshotId: result.snapshot.id,
        updatedAt: now,
      }).where(eq(expenseClaimLine.id, line.id));
      snapshots.push(result.snapshot);
    }
    const allocations = await tx.select().from(expenseAllocation).where(and(
      eq(expenseAllocation.masterFn, scope.masterFn),
      eq(expenseAllocation.companyFn, scope.companyFn),
      inArray(expenseAllocation.lineId, lines.map((line) => line.id)),
    )).orderBy(expenseAllocation.lineId, expenseAllocation.allocationNo);
    const facts = {
      title: claim.title,
      lines: lines.map((line, index) => ({
        ...line,
        policySnapshotId: snapshots[index].id,
        allocations: allocations.filter((allocation) => allocation.lineId === line.id),
      })),
      authorization: kind === 'system' ? {
        statementVersion: authorization?.statementVersion,
        authorizedAt: authorization?.authorizedAt,
      } : null,
    };
    const factsSha256 = createHash('sha256').update(JSON.stringify(facts)).digest('hex');
    const controls = await startExpenseLineControlsWithin(tx, scope, {
      claim,
      lines,
      snapshots,
      claimVersion: claim.version + 1,
      now,
    });
    const [submitted] = await tx.update(expenseClaim).set({
      status: 'pending_approval',
      version: claim.version + 1,
      submissionKind: kind,
      submittedByUserId: ownerUserId,
      systemActorKey: kind === 'system' ? SYSTEM_ACTOR : null,
      submittedAt: now,
      factsSha256,
      updatedAt: now,
    }).where(and(
      eq(expenseClaim.id, claim.id),
      eq(expenseClaim.version, expectedVersion),
      eq(expenseClaim.status, 'draft'),
    )).returning();
    if (!submitted) {
      throw new ExpenseClaimError(
        'expense_claim_version_conflict',
        'Expense claim changed before submission.',
      );
    }
    await tx.insert(expenseClaimRevision).values({
      ...scope,
      claimId: claim.id,
      claimVersion: submitted.version,
      factsSha256,
      facts,
      createdByUserId: ownerUserId,
      createdAt: now,
    });
    await tx.insert(expenseClaimEvent).values({
      ...scope,
      claimId: claim.id,
      eventType: kind === 'system' ? 'system_submitted' : 'submitted',
      actorUserId: ownerUserId,
      fromStatus: 'draft',
      toStatus: 'pending_approval',
      reason: kind === 'system'
        ? 'System submitted under the employee’s explicit prior authorization.'
        : 'Employee submitted the final claim.',
      claimVersion: submitted.version,
      createdAt: now,
    });
    return {
      claim: submitted,
      snapshots,
      controls,
      replayed: false,
    };
}

export function submitExpenseClaimByEmployee(
  db: DB,
  scope: Scope,
  employeeUserId: number,
  claimId: number,
  expectedVersion: number,
  now = new Date(),
) {
  return withTenantTransaction(db, scope, (tx) => submitExpenseClaimWithin(
    tx, scope, employeeUserId, claimId, expectedVersion, 'employee', now,
  ));
}

export function submitAuthorizedExpenseClaimBySystem(
  db: DB,
  scope: Scope,
  employeeUserId: number,
  claimId: number,
  expectedVersion: number,
  now = new Date(),
) {
  return withTenantTransaction(db, scope, (tx) => submitExpenseClaimWithin(
    tx, scope, employeeUserId, claimId, expectedVersion, 'system', now,
  ));
}
