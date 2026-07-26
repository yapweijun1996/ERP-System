import {
  and,
  desc,
  eq,
  inArray,
} from 'drizzle-orm';
import type { DB } from '../../data/db';
import type { Scope } from '../../data/repo';
import {
  expenseAllocation,
  expenseBankChargeOverride,
  expenseClaim,
  expenseClaimEvent,
  expenseClaimLine,
  expenseClaimRevision,
  expenseDuplicateOverride,
  expenseDuplicateSignal,
  expenseLineApproval,
  expenseLineControlAssessment,
  expenseLinePolicySnapshot,
  expensePosting,
  expensePostingLeg,
} from '../../data/schema';

export class ExpenseClaimPresentationError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly status = 409,
  ) {
    super(message);
    this.name = 'ExpenseClaimPresentationError';
  }
}

export async function listEmployeeExpenseClaimsWithin(
  tx: DB,
  scope: Scope,
  ownerUserId: number,
) {
  const claims = await tx.select().from(expenseClaim).where(and(
    eq(expenseClaim.masterFn, scope.masterFn),
    eq(expenseClaim.companyFn, scope.companyFn),
    eq(expenseClaim.ownerUserId, ownerUserId),
  )).orderBy(desc(expenseClaim.updatedAt), desc(expenseClaim.id)).limit(100);
  if (!claims.length) return [];
  const lines = await tx.select().from(expenseClaimLine).where(and(
    eq(expenseClaimLine.masterFn, scope.masterFn),
    eq(expenseClaimLine.companyFn, scope.companyFn),
    inArray(expenseClaimLine.claimId, claims.map((claim) => claim.id)),
  )).orderBy(expenseClaimLine.claimId, expenseClaimLine.lineNo);
  const allocations = lines.length
    ? await tx.select().from(expenseAllocation).where(and(
      eq(expenseAllocation.masterFn, scope.masterFn),
      eq(expenseAllocation.companyFn, scope.companyFn),
      inArray(expenseAllocation.lineId, lines.map((line) => line.id)),
    )).orderBy(expenseAllocation.lineId, expenseAllocation.allocationNo)
    : [];
  return claims.map((claim) => ({
    ...claim,
    lines: lines.filter((line) => line.claimId === claim.id).map((line) => ({
      ...line,
      allocations: allocations.filter((allocation) => allocation.lineId === line.id),
    })),
  }));
}

/** Owner-only case-detail projection. Duplicate evidence is deliberately summarized:
 * employees can see why their line needs review without learning another claimant's
 * line id, evidence hash, or Finance-only override reason. */
export async function readEmployeeExpenseClaimWithin(
  tx: DB,
  scope: Scope,
  ownerUserId: number,
  claimId: number,
) {
  const owned = await listEmployeeExpenseClaimsWithin(tx, scope, ownerUserId);
  const claimWithLines = owned.find((row) => row.id === claimId);
  if (!claimWithLines) {
    throw new ExpenseClaimPresentationError(
      'expense_claim_not_found',
      'Expense claim is unavailable.',
      404,
    );
  }
  const { lines, ...claim } = claimWithLines;
  const lineIds = lines.map((line) => line.id);
  const snapshotIds = lines.flatMap((line) =>
    line.policySnapshotId == null ? [] : [line.policySnapshotId]);
  const [
    snapshots,
    assessments,
    approvals,
    postings,
    events,
    revisions,
  ] = await Promise.all([
    snapshotIds.length
      ? tx.select().from(expenseLinePolicySnapshot).where(and(
        eq(expenseLinePolicySnapshot.masterFn, scope.masterFn),
        eq(expenseLinePolicySnapshot.companyFn, scope.companyFn),
        inArray(expenseLinePolicySnapshot.id, snapshotIds),
      ))
      : [],
    lineIds.length
      ? tx.select().from(expenseLineControlAssessment).where(and(
        eq(expenseLineControlAssessment.masterFn, scope.masterFn),
        eq(expenseLineControlAssessment.companyFn, scope.companyFn),
        inArray(expenseLineControlAssessment.lineId, lineIds),
      ))
      : [],
    lineIds.length
      ? tx.select().from(expenseLineApproval).where(and(
        eq(expenseLineApproval.masterFn, scope.masterFn),
        eq(expenseLineApproval.companyFn, scope.companyFn),
        inArray(expenseLineApproval.lineId, lineIds),
      ))
      : [],
    lineIds.length
      ? tx.select().from(expensePosting).where(and(
        eq(expensePosting.masterFn, scope.masterFn),
        eq(expensePosting.companyFn, scope.companyFn),
        inArray(expensePosting.lineId, lineIds),
      ))
      : [],
    tx.select().from(expenseClaimEvent).where(and(
      eq(expenseClaimEvent.masterFn, scope.masterFn),
      eq(expenseClaimEvent.companyFn, scope.companyFn),
      eq(expenseClaimEvent.claimId, claim.id),
    )).orderBy(expenseClaimEvent.id),
    tx.select().from(expenseClaimRevision).where(and(
      eq(expenseClaimRevision.masterFn, scope.masterFn),
      eq(expenseClaimRevision.companyFn, scope.companyFn),
      eq(expenseClaimRevision.claimId, claim.id),
    )).orderBy(expenseClaimRevision.claimVersion),
  ]);
  const assessmentIds = assessments.map((assessment) => assessment.id);
  const postingIds = postings.map((posting) => posting.id);
  const [signals, overrides, bankOverrides, postingLegs] = await Promise.all([
    assessmentIds.length
      ? tx.select({
        assessmentId: expenseDuplicateSignal.assessmentId,
        signalType: expenseDuplicateSignal.signalType,
        riskPoints: expenseDuplicateSignal.riskPoints,
        detectedAt: expenseDuplicateSignal.detectedAt,
      }).from(expenseDuplicateSignal).where(and(
        eq(expenseDuplicateSignal.masterFn, scope.masterFn),
        eq(expenseDuplicateSignal.companyFn, scope.companyFn),
        inArray(expenseDuplicateSignal.assessmentId, assessmentIds),
      ))
      : [],
    assessmentIds.length
      ? tx.select({
        assessmentId: expenseDuplicateOverride.assessmentId,
        overriddenAt: expenseDuplicateOverride.overriddenAt,
      }).from(expenseDuplicateOverride).where(and(
        eq(expenseDuplicateOverride.masterFn, scope.masterFn),
        eq(expenseDuplicateOverride.companyFn, scope.companyFn),
        inArray(expenseDuplicateOverride.assessmentId, assessmentIds),
      ))
      : [],
    snapshotIds.length
      ? tx.select({
        snapshotId: expenseBankChargeOverride.snapshotId,
        actualBaseGross: expenseBankChargeOverride.actualBaseGross,
        actualFxRate: expenseBankChargeOverride.actualFxRate,
        verifiedAt: expenseBankChargeOverride.verifiedAt,
      }).from(expenseBankChargeOverride).where(and(
        eq(expenseBankChargeOverride.masterFn, scope.masterFn),
        eq(expenseBankChargeOverride.companyFn, scope.companyFn),
        inArray(expenseBankChargeOverride.snapshotId, snapshotIds),
      ))
      : [],
    postingIds.length
      ? tx.select().from(expensePostingLeg).where(and(
        eq(expensePostingLeg.masterFn, scope.masterFn),
        eq(expensePostingLeg.companyFn, scope.companyFn),
        inArray(expensePostingLeg.postingId, postingIds),
      )).orderBy(expensePostingLeg.postingId, expensePostingLeg.legNo)
      : [],
  ]);
  return {
    claim,
    lines: lines.map((line) => {
      const snapshot = snapshots.find((row) => row.id === line.policySnapshotId) ?? null;
      const assessment = assessments.find((row) => row.lineId === line.id) ?? null;
      const approval = approvals.find((row) => row.lineId === line.id) ?? null;
      const posting = postings.find((row) => row.lineId === line.id) ?? null;
      return {
        ...line,
        policy: snapshot ? {
          id: snapshot.id,
          originalCurrency: snapshot.originalCurrency,
          functionalCurrency: snapshot.functionalCurrency,
          policyFxRate: snapshot.policyFxRate,
          baseExpense: snapshot.baseExpense,
          baseInputTax: snapshot.baseInputTax,
          baseGross: snapshot.baseGross,
          taxTreatment: snapshot.taxTreatment,
          taxCode: snapshot.taxCode,
          paymentSource: snapshot.paymentSource,
          fxMethod: snapshot.fxMethod,
          bankChargeOverride: bankOverrides.find((row) => row.snapshotId === snapshot.id) ?? null,
        } : null,
        control: assessment ? {
          ...assessment,
          signals: signals.filter((row) => row.assessmentId === assessment.id),
          duplicateOverride: overrides.find((row) =>
            row.assessmentId === assessment.id) ?? null,
        } : null,
        approval,
        posting: posting ? {
          ...posting,
          legs: postingLegs.filter((row) => row.postingId === posting.id),
        } : null,
      };
    }),
    events,
    revisions,
  };
}
