// Bank Receipt — collects a posted progress claim's AR in full. One receipt per claim;
// "already receipted" is derived by checking for an existing bank_receipt row against
// the claim, not a stored flag (same computed-not-stored precedent as EPIC-023's
// "Converted" requisition status). Posts Dr 1000 Cash / Cr 1100 AR, no new CoA codes
// beyond the new Cash account.
import { and, eq } from 'drizzle-orm';
import Decimal from 'decimal.js';
import type { DB } from '../../data/db';
import type { Scope } from '../../data/repo';
import { account, bankReceipt, glEntry, progressClaim } from '../../data/schema';

export class BankReceiptError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'BankReceiptError';
  }
}

function required(value: string | undefined, label: string) {
  const normalized = value?.trim();
  if (!normalized) throw new BankReceiptError(`${label} is required.`);
  return normalized;
}

async function accountId(exec: DB, scope: Scope, code: string) {
  const [row] = await exec.select({ id: account.id }).from(account).where(and(
    eq(account.masterFn, scope.masterFn),
    eq(account.companyFn, scope.companyFn),
    eq(account.code, code),
  ));
  if (!row) throw new BankReceiptError(`Account ${code} is not configured.`);
  return row.id;
}

export interface CreateBankReceiptInput {
  docNo: string;
  progressClaimId: number;
  receivedDate: string;
  bankRef?: string | null;
  amount: string | number;
}

export async function createBankReceiptWithin(exec: DB, scope: Scope, input: CreateBankReceiptInput) {
  const docNo = required(input.docNo, 'Receipt number');
  if (!Number.isSafeInteger(input.progressClaimId) || input.progressClaimId <= 0) {
    throw new BankReceiptError('progressClaimId must be a positive integer.');
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.receivedDate)) {
    throw new BankReceiptError('receivedDate must use YYYY-MM-DD.');
  }
  let amount: Decimal;
  try {
    amount = new Decimal(input.amount);
  } catch {
    throw new BankReceiptError('amount must be a valid decimal.');
  }
  if (!amount.isFinite() || amount.lte(0)) {
    throw new BankReceiptError('amount must be greater than zero.');
  }

  const [claim] = await exec.select({
    id: progressClaim.id,
    docNo: progressClaim.docNo,
    status: progressClaim.status,
    totalAmount: progressClaim.totalAmount,
  }).from(progressClaim).where(and(
    eq(progressClaim.masterFn, scope.masterFn),
    eq(progressClaim.companyFn, scope.companyFn),
    eq(progressClaim.id, input.progressClaimId),
  )).for('update');
  if (!claim) throw new BankReceiptError('Progress claim is unavailable in this company.');
  if (claim.status !== 'posted') {
    throw new BankReceiptError('Only a posted progress claim can be receipted.');
  }
  if (!amount.eq(new Decimal(claim.totalAmount))) {
    throw new BankReceiptError(`amount must equal the claim total (${claim.totalAmount}).`);
  }

  const [existing] = await exec.select({ id: bankReceipt.id }).from(bankReceipt).where(and(
    eq(bankReceipt.masterFn, scope.masterFn),
    eq(bankReceipt.companyFn, scope.companyFn),
    eq(bankReceipt.progressClaimId, claim.id),
  ));
  if (existing) throw new BankReceiptError(`Progress claim ${claim.docNo} has already been receipted.`);

  const [receipt] = await exec.insert(bankReceipt).values({
    masterFn: scope.masterFn,
    companyFn: scope.companyFn,
    docNo,
    progressClaimId: claim.id,
    receivedDate: input.receivedDate,
    bankRef: input.bankRef?.trim() || null,
    amount: amount.toFixed(2),
  }).returning({
    id: bankReceipt.id,
    docNo: bankReceipt.docNo,
    progressClaimId: bankReceipt.progressClaimId,
    amount: bankReceipt.amount,
  });

  const cashId = await accountId(exec, scope, '1000');
  const arId = await accountId(exec, scope, '1100');
  await exec.insert(glEntry).values([
    {
      masterFn: scope.masterFn, companyFn: scope.companyFn, journalRef: docNo,
      accountId: cashId, debit: amount.toFixed(2), credit: '0', memo: `Bank receipt — ${claim.docNo}`,
    },
    {
      masterFn: scope.masterFn, companyFn: scope.companyFn, journalRef: docNo,
      accountId: arId, debit: '0', credit: amount.toFixed(2), memo: `Bank receipt — ${claim.docNo}`,
    },
  ]);

  return receipt;
}

export function createBankReceipt(db: DB, scope: Scope, input: CreateBankReceiptInput) {
  return db.transaction((tx) => createBankReceiptWithin(tx, scope, input));
}
