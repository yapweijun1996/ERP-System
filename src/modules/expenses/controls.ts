import { createHash } from 'node:crypto';
import Decimal from 'decimal.js';
import {
  and,
  asc,
  eq,
  gte,
  inArray,
  isNull,
  lt,
  lte,
  ne,
  or,
  sql,
} from 'drizzle-orm';
import type { DB } from '../../data/db';
import type { Scope } from '../../data/repo';
import { withTenantTransaction } from '../../data/tenantTransaction';
import {
  approvalInstance,
  approvalInstanceStep,
  budgetLine,
  budgetVersion,
  documentExtraction,
  documentVersion,
  employee,
  expenseClaim,
  expenseClaimEvent,
  expenseClaimLine,
  expenseControlPolicyVersion,
  expenseDuplicateOverride,
  expenseDuplicateSignal,
  expenseLineApproval,
  expenseLineControlAssessment,
  expenseLinePolicySnapshot,
  glEntry,
  receiptInboxItem,
} from '../../data/schema';
import {
  decideApprovalWithin,
  listApprovalQueueWithin,
  startApprovalWithin,
} from '../approval/workflow';
import { postApprovedExpenseLineWithin } from './postings';

export class ExpenseControlError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly status = 409,
  ) {
    super(message);
    this.name = 'ExpenseControlError';
  }
}

export interface ExpenseControlPolicyInput {
  policyKey: string;
  versionNo: number;
  validFrom: string;
  validTo?: string | null;
  duplicateHighRiskScore?: number;
  budgetAction: 'warn' | 'extra_approval' | 'block';
  budgetTolerancePct?: string | number;
  budgetExtraApprovalPermissionKey?: string | null;
}

function dateText(value: string, label: string): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)
    || new Date(`${value}T00:00:00.000Z`).toISOString().slice(0, 10) !== value) {
    throw new ExpenseControlError(
      'expense_control_date_invalid',
      `${label} must be a valid ISO date.`,
      422,
    );
  }
  return value;
}

function decimal(value: string | number, label: string): Decimal {
  try {
    const result = new Decimal(value);
    if (result.isFinite()) return result;
  } catch {
    // Fall through to the governed error.
  }
  throw new ExpenseControlError(
    'expense_control_amount_invalid',
    `${label} is invalid.`,
    422,
  );
}

function fixed(value: Decimal): string {
  return value.toDecimalPlaces(4, Decimal.ROUND_HALF_UP).toFixed(4);
}

function reasonText(value: string): string {
  const reason = value.trim();
  if (reason.length < 3 || reason.length > 1000) {
    throw new ExpenseControlError(
      'expense_duplicate_override_reason_required',
      'A duplicate override reason of 3–1000 characters is required.',
      422,
    );
  }
  return reason;
}

function hashText(value: string): string {
  return createHash('sha256').update(value, 'utf8').digest('hex');
}

function businessKey(line: typeof expenseClaimLine.$inferSelect): string | null {
  if (!line.merchantTaxNumber) return null;
  return hashText([
    line.merchant.trim().replace(/\s+/g, ' ').toLowerCase(),
    line.transactionDate,
    new Decimal(line.originalGross).toFixed(4),
    line.merchantTaxNumber.trim().toUpperCase(),
  ].join('|'));
}

export async function configureExpenseControlPolicyVersionWithin(
  tx: DB,
  scope: Scope,
  actorUserId: number,
  input: ExpenseControlPolicyInput,
  now = new Date(),
) {
  const policyKey = input.policyKey.trim().toLowerCase();
  const validFrom = dateText(input.validFrom, 'Control policy start');
  const validTo = input.validTo == null ? null : dateText(input.validTo, 'Control policy end');
  const highRiskScore = input.duplicateHighRiskScore ?? 70;
  const tolerance = decimal(input.budgetTolerancePct ?? 0, 'Budget tolerance');
  const extraPermission = input.budgetExtraApprovalPermissionKey?.trim() || null;
  if (!/^[a-z][a-z0-9._-]{2,63}$/.test(policyKey)
    || !Number.isSafeInteger(input.versionNo) || input.versionNo <= 0
    || !Number.isSafeInteger(highRiskScore) || highRiskScore < 1 || highRiskScore > 100
    || tolerance.lt(0) || tolerance.gt(100)
    || (validTo != null && validTo < validFrom)
    || (input.budgetAction === 'extra_approval'
      && (!extraPermission || extraPermission.length > 120))) {
    throw new ExpenseControlError(
      'expense_control_policy_invalid',
      'Expense control policy configuration is invalid.',
      422,
    );
  }
  const [replay] = await tx.select().from(expenseControlPolicyVersion).where(and(
    eq(expenseControlPolicyVersion.masterFn, scope.masterFn),
    eq(expenseControlPolicyVersion.companyFn, scope.companyFn),
    eq(expenseControlPolicyVersion.policyKey, policyKey),
    eq(expenseControlPolicyVersion.versionNo, input.versionNo),
  )).limit(1);
  if (replay) {
    if (replay.validFrom !== validFrom
      || replay.validTo !== validTo
      || replay.duplicateHighRiskScore !== highRiskScore
      || replay.budgetAction !== input.budgetAction
      || !new Decimal(replay.budgetTolerancePct).eq(tolerance)
      || replay.budgetExtraApprovalPermissionKey !== extraPermission) {
      throw new ExpenseControlError(
        'expense_control_policy_version_conflict',
        'This policy version already contains different confirmed facts.',
      );
    }
    return { version: replay, replayed: true };
  }
  const overlaps = await tx.select({ id: expenseControlPolicyVersion.id })
    .from(expenseControlPolicyVersion).where(and(
      eq(expenseControlPolicyVersion.masterFn, scope.masterFn),
      eq(expenseControlPolicyVersion.companyFn, scope.companyFn),
      eq(expenseControlPolicyVersion.status, 'confirmed'),
      lte(expenseControlPolicyVersion.validFrom, validTo ?? '9999-12-31'),
      or(
        isNull(expenseControlPolicyVersion.validTo),
        gte(expenseControlPolicyVersion.validTo, validFrom),
      ),
    )).limit(1);
  if (overlaps.length) {
    throw new ExpenseControlError(
      'expense_control_policy_overlap',
      'Confirmed expense control policy periods cannot overlap.',
      422,
    );
  }
  const [version] = await tx.insert(expenseControlPolicyVersion).values({
    ...scope,
    policyKey,
    versionNo: input.versionNo,
    validFrom,
    validTo,
    duplicateHighRiskScore: highRiskScore,
    budgetAction: input.budgetAction,
    budgetTolerancePct: tolerance.toFixed(4),
    budgetExtraApprovalPermissionKey: extraPermission,
    confirmedByUserId: actorUserId,
    confirmedAt: now,
    createdAt: now,
    updatedAt: now,
  }).returning();
  return { version, replayed: false };
}

export function configureExpenseControlPolicyVersion(
  db: DB,
  scope: Scope,
  actorUserId: number,
  input: ExpenseControlPolicyInput,
  now = new Date(),
) {
  return withTenantTransaction(db, scope, (tx) =>
    configureExpenseControlPolicyVersionWithin(tx, scope, actorUserId, input, now));
}

async function resolveControlPolicy(
  tx: DB,
  scope: Scope,
  transactionDate: string,
) {
  const policies = await tx.select().from(expenseControlPolicyVersion).where(and(
    eq(expenseControlPolicyVersion.masterFn, scope.masterFn),
    eq(expenseControlPolicyVersion.companyFn, scope.companyFn),
    eq(expenseControlPolicyVersion.status, 'confirmed'),
    lte(expenseControlPolicyVersion.validFrom, transactionDate),
    or(
      isNull(expenseControlPolicyVersion.validTo),
      gte(expenseControlPolicyVersion.validTo, transactionDate),
    ),
  )).orderBy(expenseControlPolicyVersion.validFrom, expenseControlPolicyVersion.id);
  if (policies.length !== 1) {
    throw new ExpenseControlError(
      policies.length
        ? 'expense_control_policy_ambiguous'
        : 'expense_control_policy_missing',
      'Exactly one confirmed expense control policy must cover the transaction date.',
      422,
    );
  }
  return policies[0];
}

async function receiptFacts(
  tx: DB,
  scope: Scope,
  receiptIds: number[],
) {
  if (!receiptIds.length) return new Map<number, { sha256: string; visual: string | null }>();
  const rows = await tx.select({
    receiptId: receiptInboxItem.id,
    sha256: documentVersion.sha256,
    visual: documentExtraction.visualFingerprint,
  }).from(receiptInboxItem)
    .innerJoin(documentVersion, and(
      eq(documentVersion.masterFn, receiptInboxItem.masterFn),
      eq(documentVersion.companyFn, receiptInboxItem.companyFn),
      eq(documentVersion.id, receiptInboxItem.versionId),
    ))
    .innerJoin(documentExtraction, and(
      eq(documentExtraction.masterFn, receiptInboxItem.masterFn),
      eq(documentExtraction.companyFn, receiptInboxItem.companyFn),
      eq(documentExtraction.id, receiptInboxItem.extractionId),
    ))
    .where(and(
      eq(receiptInboxItem.masterFn, scope.masterFn),
      eq(receiptInboxItem.companyFn, scope.companyFn),
      inArray(receiptInboxItem.id, receiptIds),
    ));
  return new Map(rows.map((row) => [
    row.receiptId,
    { sha256: row.sha256, visual: row.visual },
  ]));
}

async function duplicateSignals(
  tx: DB,
  scope: Scope,
  line: typeof expenseClaimLine.$inferSelect,
) {
  const candidates = await tx.select({
    line: expenseClaimLine,
  }).from(expenseClaimLine).innerJoin(expenseClaim, and(
    eq(expenseClaim.id, expenseClaimLine.claimId),
    eq(expenseClaim.masterFn, expenseClaimLine.masterFn),
    eq(expenseClaim.companyFn, expenseClaimLine.companyFn),
  )).where(and(
    eq(expenseClaimLine.masterFn, scope.masterFn),
    eq(expenseClaimLine.companyFn, scope.companyFn),
    ne(expenseClaimLine.claimId, line.claimId),
    ne(expenseClaim.status, 'draft'),
  )).orderBy(asc(expenseClaimLine.id)).limit(500);
  const currentFacts = line.receiptInboxItemId == null
    ? null
    : (await receiptFacts(tx, scope, [line.receiptInboxItemId]))
      .get(line.receiptInboxItemId) ?? null;
  const candidateReceiptIds = candidates.flatMap(({ line: candidate }) =>
    candidate.receiptInboxItemId == null ? [] : [candidate.receiptInboxItemId]);
  const candidateFacts = await receiptFacts(tx, scope, candidateReceiptIds);
  const signalRows: Array<{
    matchedLineId: number;
    signalType: 'file_hash' | 'image_fingerprint' | 'business_key';
    signalHash: string;
    riskPoints: number;
    detail: Record<string, unknown>;
  }> = [];
  if (currentFacts) {
    const fileMatch = candidates.find(({ line: candidate }) =>
      candidate.receiptInboxItemId != null
      && candidateFacts.get(candidate.receiptInboxItemId)?.sha256 === currentFacts.sha256);
    if (fileMatch) {
      signalRows.push({
        matchedLineId: fileMatch.line.id,
        signalType: 'file_hash',
        signalHash: currentFacts.sha256,
        riskPoints: 100,
        detail: { algorithm: 'sha256', exact: true },
      });
    }
    if (currentFacts.visual) {
      const visualMatch = candidates.find(({ line: candidate }) =>
        candidate.receiptInboxItemId != null
        && candidateFacts.get(candidate.receiptInboxItemId)?.visual === currentFacts.visual);
      if (visualMatch) {
        signalRows.push({
          matchedLineId: visualMatch.line.id,
          signalType: 'image_fingerprint',
          signalHash: currentFacts.visual,
          riskPoints: 60,
          detail: { algorithm: 'provider_visual_fingerprint_v1', exact: true },
        });
      }
    }
  }
  const currentBusinessKey = businessKey(line);
  if (currentBusinessKey) {
    const businessMatch = candidates.find(({ line: candidate }) =>
      businessKey(candidate) === currentBusinessKey);
    if (businessMatch) {
      signalRows.push({
        matchedLineId: businessMatch.line.id,
        signalType: 'business_key',
        signalHash: currentBusinessKey,
        riskPoints: 40,
        detail: {
          fields: ['merchant', 'transaction_date', 'gross', 'merchant_tax_number'],
        },
      });
    }
  }
  return signalRows;
}

function monthBounds(transactionDate: string) {
  const [year, month] = transactionDate.split('-').map(Number);
  const from = new Date(Date.UTC(year, month - 1, 1));
  const to = new Date(Date.UTC(year, month, 1));
  return { year, periodNo: month, from, to };
}

async function budgetAssessment(
  tx: DB,
  scope: Scope,
  snapshot: typeof expenseLinePolicySnapshot.$inferSelect,
  transactionDate: string,
  tolerancePct: string,
) {
  const { year, periodNo, from, to } = monthBounds(transactionDate);
  const [version] = await tx.select().from(budgetVersion).where(and(
    eq(budgetVersion.masterFn, scope.masterFn),
    eq(budgetVersion.companyFn, scope.companyFn),
    eq(budgetVersion.fiscalYear, year),
    eq(budgetVersion.currency, snapshot.functionalCurrency),
    eq(budgetVersion.status, 'approved'),
    eq(budgetVersion.isActive, true),
  )).limit(1);
  const [line] = version
    ? await tx.select().from(budgetLine).where(and(
      eq(budgetLine.masterFn, scope.masterFn),
      eq(budgetLine.companyFn, scope.companyFn),
      eq(budgetLine.budgetVersionId, version.id),
      eq(budgetLine.accountId, snapshot.expenseAccountId),
      eq(budgetLine.periodNo, periodNo),
    )).limit(1).for('update')
    : [];
  const lineAmount = new Decimal(snapshot.baseExpense);
  if (!version || !line) {
    return {
      budgetVersionId: version?.id ?? null,
      budgetLineId: null,
      budgetAmount: null,
      consumedAmount: '0.0000',
      lineAmount: fixed(lineAmount),
      remainingAfter: null,
      budgetBreached: true,
    };
  }
  const [actual] = await tx.select({
    amount: sql<string>`coalesce(sum(${glEntry.debit} - ${glEntry.credit}), 0)`,
  }).from(glEntry).where(and(
    eq(glEntry.masterFn, scope.masterFn),
    eq(glEntry.companyFn, scope.companyFn),
    eq(glEntry.accountId, snapshot.expenseAccountId),
    gte(glEntry.postedAt, from),
    lt(glEntry.postedAt, to),
  ));
  const [pending] = await tx.select({
    amount: sql<string>`coalesce(sum(${expenseLineControlAssessment.lineAmount}), 0)`,
  }).from(expenseLineControlAssessment).innerJoin(expenseLineApproval, and(
    eq(expenseLineApproval.masterFn, expenseLineControlAssessment.masterFn),
    eq(expenseLineApproval.companyFn, expenseLineControlAssessment.companyFn),
    eq(expenseLineApproval.assessmentId, expenseLineControlAssessment.id),
  )).where(and(
    eq(expenseLineControlAssessment.masterFn, scope.masterFn),
    eq(expenseLineControlAssessment.companyFn, scope.companyFn),
    eq(expenseLineControlAssessment.budgetLineId, line.id),
    inArray(expenseLineApproval.status, ['pending', 'approved']),
  ));
  const consumed = Decimal.max(
    new Decimal(0),
    new Decimal(actual?.amount ?? 0).plus(pending?.amount ?? 0),
  );
  const budget = new Decimal(line.amount);
  const allowed = budget.mul(
    new Decimal(1).plus(new Decimal(tolerancePct).div(100)),
  );
  return {
    budgetVersionId: version.id,
    budgetLineId: line.id,
    budgetAmount: fixed(budget),
    consumedAmount: fixed(consumed),
    lineAmount: fixed(lineAmount),
    remainingAfter: fixed(budget.minus(consumed).minus(lineAmount)),
    budgetBreached: consumed.plus(lineAmount).gt(allowed),
  };
}

export async function startExpenseLineControlsWithin(
  tx: DB,
  scope: Scope,
  input: {
    claim: typeof expenseClaim.$inferSelect;
    lines: Array<typeof expenseClaimLine.$inferSelect>;
    snapshots: Array<typeof expenseLinePolicySnapshot.$inferSelect>;
    claimVersion: number;
    now: Date;
  },
) {
  const [subject] = await tx.select().from(employee).where(and(
    eq(employee.masterFn, scope.masterFn),
    eq(employee.companyFn, scope.companyFn),
    eq(employee.userId, input.claim.ownerUserId),
    eq(employee.isActive, true),
  )).limit(1);
  if (!subject) {
    throw new ExpenseControlError(
      'expense_claim_employee_identity_missing',
      'The claim owner must be an active employee before approval can start.',
      422,
    );
  }
  const started = [];
  for (let index = 0; index < input.lines.length; index += 1) {
    const line = input.lines[index];
    const snapshot = input.snapshots[index];
    const policy = await resolveControlPolicy(tx, scope, line.transactionDate);
    const signals = await duplicateSignals(tx, scope, line);
    const score = Math.min(100, signals.reduce((sum, signal) => sum + signal.riskPoints, 0));
    const riskLevel = score === 0
      ? 'none'
      : score < 40
        ? 'low'
        : score < policy.duplicateHighRiskScore
          ? 'medium'
          : 'high';
    const budget = await budgetAssessment(
      tx,
      scope,
      snapshot,
      line.transactionDate,
      policy.budgetTolerancePct,
    );
    if (budget.budgetBreached && policy.budgetAction === 'block') {
      throw new ExpenseControlError(
        'expense_budget_blocked',
        `Line ${line.lineNo} exceeds or lacks an approved budget.`,
        422,
      );
    }
    const [assessment] = await tx.insert(expenseLineControlAssessment).values({
      ...scope,
      claimId: input.claim.id,
      lineId: line.id,
      claimVersion: input.claimVersion,
      controlPolicyVersionId: policy.id,
      duplicateRiskScore: score,
      duplicateRiskLevel: riskLevel,
      budgetAction: policy.budgetAction,
      ...budget,
      assessedAt: input.now,
    }).returning();
    if (signals.length) {
      await tx.insert(expenseDuplicateSignal).values(signals.map((signal) => ({
        ...scope,
        assessmentId: assessment.id,
        lineId: line.id,
        ...signal,
        detectedAt: input.now,
      })));
    }
    const extraPermissionSteps = budget.budgetBreached
      && policy.budgetAction === 'extra_approval'
      && policy.budgetExtraApprovalPermissionKey
      ? [{
        label: 'Budget exception approval',
        permissionKey: policy.budgetExtraApprovalPermissionKey,
        position: 'before_final' as const,
      }]
      : [];
    const approval = await startApprovalWithin(tx, scope, {
      domain: 'expense',
      entityType: 'expense_claim_line',
      entityId: line.id,
      entityVersion: input.claimVersion,
      subjectEmployeeId: subject.id,
      submittedByUserId: input.claim.ownerUserId,
      effectiveDate: line.transactionDate,
      department: subject.department,
      typeRef: line.categoryCode,
      amount: snapshot.baseGross,
      currency: snapshot.functionalCurrency,
      extraPermissionSteps,
    }, input.now);
    const [lineApproval] = await tx.insert(expenseLineApproval).values({
      ...scope,
      claimId: input.claim.id,
      lineId: line.id,
      claimVersion: input.claimVersion,
      assessmentId: assessment.id,
      approvalInstanceId: approval.id,
      createdAt: input.now,
      updatedAt: input.now,
    }).returning();
    started.push({ lineApproval, assessment, signals, approval });
  }
  return started;
}

export async function overrideHighRiskDuplicateWithin(
  tx: DB,
  scope: Scope,
  actor: { userId: number; canOverride: boolean },
  assessmentId: number,
  reasonValue: string,
  now = new Date(),
) {
  if (!actor.canOverride) {
    throw new ExpenseControlError(
      'expense_duplicate_override_permission_required',
      'Finance duplicate-override permission is required.',
      403,
    );
  }
  const reason = reasonText(reasonValue);
  const [assessment] = await tx.select().from(expenseLineControlAssessment).where(and(
    eq(expenseLineControlAssessment.masterFn, scope.masterFn),
    eq(expenseLineControlAssessment.companyFn, scope.companyFn),
    eq(expenseLineControlAssessment.id, assessmentId),
  )).limit(1);
  if (!assessment) {
    throw new ExpenseControlError(
      'expense_control_assessment_missing',
      'Expense control assessment is unavailable.',
      404,
    );
  }
  if (assessment.duplicateRiskLevel !== 'high') {
    throw new ExpenseControlError(
      'expense_duplicate_override_not_required',
      'Only a high-risk duplicate assessment may be overridden.',
      422,
    );
  }
  const [existing] = await tx.select().from(expenseDuplicateOverride).where(and(
    eq(expenseDuplicateOverride.masterFn, scope.masterFn),
    eq(expenseDuplicateOverride.companyFn, scope.companyFn),
    eq(expenseDuplicateOverride.assessmentId, assessment.id),
  )).limit(1);
  if (existing) {
    if (existing.overriddenByUserId !== actor.userId || existing.reason !== reason) {
      throw new ExpenseControlError(
        'expense_duplicate_override_conflict',
        'This high-risk assessment already has a different immutable override.',
      );
    }
    return { override: existing, replayed: true };
  }
  const [override] = await tx.insert(expenseDuplicateOverride).values({
    ...scope,
    assessmentId: assessment.id,
    reason,
    overriddenByUserId: actor.userId,
    overriddenAt: now,
  }).returning();
  return { override, replayed: false };
}

async function refreshClaimApprovalStatus(
  tx: DB,
  scope: Scope,
  claimId: number,
  actorUserId: number,
  reason: string | null,
  now: Date,
) {
  const [claim] = await tx.select().from(expenseClaim).where(and(
    eq(expenseClaim.masterFn, scope.masterFn),
    eq(expenseClaim.companyFn, scope.companyFn),
    eq(expenseClaim.id, claimId),
  )).limit(1).for('update');
  if (!claim) throw new ExpenseControlError('expense_claim_missing', 'Expense claim is unavailable.', 404);
  const rows = await tx.select({ status: expenseLineApproval.status })
    .from(expenseLineApproval).where(and(
      eq(expenseLineApproval.masterFn, scope.masterFn),
      eq(expenseLineApproval.companyFn, scope.companyFn),
      eq(expenseLineApproval.claimId, claimId),
    ));
  const statuses = rows.map((row) => row.status);
  let nextStatus = 'pending_approval';
  if (statuses.includes('returned')) nextStatus = 'returned';
  else if (statuses.length > 0 && statuses.every((status) => status === 'approved')) {
    nextStatus = 'approved';
  } else if (statuses.length > 0 && statuses.every((status) => status === 'rejected')) {
    nextStatus = 'rejected';
  } else if (statuses.some((status) => status === 'approved' || status === 'rejected')) {
    nextStatus = 'partially_approved';
  }
  if (claim.status !== nextStatus) {
    await tx.update(expenseClaim).set({
      status: nextStatus,
      updatedAt: now,
    }).where(eq(expenseClaim.id, claim.id));
  }
  await tx.insert(expenseClaimEvent).values({
    ...scope,
    claimId: claim.id,
    eventType: 'approval_updated',
    actorUserId,
    fromStatus: claim.status,
    toStatus: nextStatus,
    reason: reason ?? 'Expense line approval state updated.',
    claimVersion: claim.version,
    createdAt: now,
  });
  return nextStatus;
}

export async function decideExpenseLineWithin(
  tx: DB,
  scope: Scope,
  input: {
    lineApprovalId: number;
    actorUserId: number;
    decision: 'approved' | 'rejected' | 'returned';
    reason?: string | null;
  },
  now = new Date(),
) {
  const [lineApproval] = await tx.select().from(expenseLineApproval).where(and(
    eq(expenseLineApproval.masterFn, scope.masterFn),
    eq(expenseLineApproval.companyFn, scope.companyFn),
    eq(expenseLineApproval.id, input.lineApprovalId),
  )).limit(1).for('update');
  if (!lineApproval) {
    throw new ExpenseControlError(
      'expense_line_approval_missing',
      'Expense line approval is unavailable.',
      404,
    );
  }
  const [instance] = await tx.select().from(approvalInstance).where(eq(
    approvalInstance.id,
    lineApproval.approvalInstanceId,
  )).limit(1);
  const [nextStep] = instance
    ? await tx.select({ id: approvalInstanceStep.id }).from(approvalInstanceStep)
      .where(and(
        eq(approvalInstanceStep.instanceId, instance.id),
        eq(approvalInstanceStep.stepNo, instance.currentStepNo + 1),
      )).limit(1)
    : [];
  if (input.decision === 'approved' && !nextStep) {
    const [assessment] = await tx.select().from(expenseLineControlAssessment).where(eq(
      expenseLineControlAssessment.id,
      lineApproval.assessmentId,
    )).limit(1);
    if (assessment?.duplicateRiskLevel === 'high') {
      const [override] = await tx.select({ id: expenseDuplicateOverride.id })
        .from(expenseDuplicateOverride).where(and(
          eq(expenseDuplicateOverride.masterFn, scope.masterFn),
          eq(expenseDuplicateOverride.companyFn, scope.companyFn),
          eq(expenseDuplicateOverride.assessmentId, assessment.id),
        )).limit(1);
      if (!override) {
        throw new ExpenseControlError(
          'expense_duplicate_override_required',
          'Final approval of a high-risk duplicate requires a Finance override and reason.',
          422,
        );
      }
    }
  }
  const decision = await decideApprovalWithin(tx, scope, {
    instanceId: lineApproval.approvalInstanceId,
    actorUserId: input.actorUserId,
    decision: input.decision,
    reason: input.reason,
  }, now);
  const status = decision.status === 'pending' ? 'pending' : decision.status;
  await tx.update(expenseLineApproval).set({
    status,
    updatedAt: now,
  }).where(eq(expenseLineApproval.id, lineApproval.id));
  const posting = status === 'approved'
    ? await postApprovedExpenseLineWithin(
      tx,
      scope,
      lineApproval.id,
      input.actorUserId,
      now,
      now,
    )
    : null;
  const claimStatus = await refreshClaimApprovalStatus(
    tx,
    scope,
    lineApproval.claimId,
    input.actorUserId,
    input.reason?.trim() || null,
    now,
  );
  return {
    lineApprovalId: lineApproval.id,
    status,
    claimStatus,
    decision,
    posting,
  };
}

export async function listExpenseApprovalQueueWithin(
  tx: DB,
  scope: Scope,
  actorUserId: number,
  now = new Date(),
) {
  const queue = await listApprovalQueueWithin(tx, scope, actorUserId, 'expense', now);
  if (!queue.length) return [];
  const links = await tx.select({
    link: expenseLineApproval,
    line: expenseClaimLine,
    claim: expenseClaim,
    assessment: expenseLineControlAssessment,
  }).from(expenseLineApproval)
    .innerJoin(expenseClaimLine, eq(expenseClaimLine.id, expenseLineApproval.lineId))
    .innerJoin(expenseClaim, eq(expenseClaim.id, expenseLineApproval.claimId))
    .innerJoin(
      expenseLineControlAssessment,
      eq(expenseLineControlAssessment.id, expenseLineApproval.assessmentId),
    )
    .where(and(
      eq(expenseLineApproval.masterFn, scope.masterFn),
      eq(expenseLineApproval.companyFn, scope.companyFn),
      inArray(
        expenseLineApproval.approvalInstanceId,
        queue.map((row) => row.id),
      ),
    ));
  const byInstance = new Map(links.map((row) => [row.link.approvalInstanceId, row]));
  return queue.flatMap((approval) => {
    const linked = byInstance.get(approval.id);
    return linked ? [{ approval, ...linked }] : [];
  });
}
