import { and, eq } from 'drizzle-orm';
import { describe, expect, it } from 'vitest';
import type { DB } from '../../data/db';
import {
  account,
  bankStatement,
  bankStatementLine,
  glEntry,
} from '../../data/schema';
import { freshDb, TEST_SCOPE as SCOPE } from '../../test/helpers';
import {
  BankReconciliationError,
  createBankStatement,
  matchBankStatementLine,
  reconcileBankStatement,
  unmatchBankStatementLine,
} from './bankReconciliation';

async function accounts(db: DB) {
  const rows = await db.insert(account).values([
    {
      masterFn: SCOPE.masterFn, companyFn: SCOPE.companyFn,
      code: '1000', name: 'Fictional operating bank', type: 'asset',
    },
    {
      masterFn: SCOPE.masterFn, companyFn: SCOPE.companyFn,
      code: '4000', name: 'Fictional clearing', type: 'income',
    },
  ]).returning({ id: account.id, code: account.code });
  return Object.fromEntries(rows.map((row) => [row.code, row.id]));
}

async function posting(db: DB, bankAccountId: number, ref: string, debit: string, credit: string) {
  const [leg] = await db.insert(glEntry).values({
    masterFn: SCOPE.masterFn,
    companyFn: SCOPE.companyFn,
    postedAt: new Date('2026-07-22T00:00:00.000Z'),
    journalRef: ref,
    accountId: bankAccountId,
    debit,
    credit,
    memo: 'Fictional bank movement',
  }).returning({ id: glEntry.id });
  return leg.id;
}

async function statement(db: DB) {
  const ids = await accounts(db);
  const created = await createBankStatement(db, SCOPE, {
    statementNo: 'BS-TEST-1',
    bankAccountId: ids['1000'],
    currency: 'SGD',
    periodStart: '2026-07-01',
    periodEnd: '2026-07-31',
    openingBalance: '100.00',
    closingBalance: '120.00',
    lines: [
      { transactionDate: '2026-07-22', reference: 'IN-1', description: 'Fictional receipt', amount: '25.00' },
      { transactionDate: '2026-07-22', reference: 'OUT-1', description: 'Fictional fee', amount: '-5.00' },
    ],
  });
  return { ids, created };
}

describe('bank reconciliation', () => {
  it('imports a footing statement, matches exact immutable GL legs and reconciles once', async () => {
    const db = await freshDb();
    const { ids, created } = await statement(db);
    expect(created).toMatchObject({
      statementNo: 'BS-TEST-1', status: 'draft', version: 1, lineCount: 2, movement: '20.00',
    });
    const lines = await db.select().from(bankStatementLine)
      .where(eq(bankStatementLine.statementId, created.id));
    const receiptLeg = await posting(db, ids['1000'], 'BR-TEST', '25.00', '0');
    const feeLeg = await posting(db, ids['1000'], 'MJ-FEE', '0', '5.00');
    const glBefore = await db.select().from(glEntry);

    expect(await matchBankStatementLine(db, SCOPE, lines[0].id, { glEntryId: receiptLeg }))
      .toMatchObject({ matchedGlEntryId: receiptLeg, statementVersion: 2 });
    expect(await matchBankStatementLine(db, SCOPE, lines[1].id, { glEntryId: feeLeg }))
      .toMatchObject({ matchedGlEntryId: feeLeg, statementVersion: 3 });
    const reconciled = await reconcileBankStatement(db, SCOPE, created.id);
    expect(reconciled).toMatchObject({ status: 'reconciled', version: 4, matchedLineCount: 2 });
    expect(await db.select().from(glEntry)).toEqual(glBefore);
    await expect(unmatchBankStatementLine(db, SCOPE, lines[0].id))
      .rejects.toThrow('immutable');
  });

  it('rejects non-footing imports, cross-company accounts and amount mismatches atomically', async () => {
    const db = await freshDb();
    const ids = await accounts(db);
    await expect(createBankStatement(db, SCOPE, {
      statementNo: 'BS-BAD-FOOT', bankAccountId: ids['1000'], currency: 'SGD',
      periodStart: '2026-07-01', periodEnd: '2026-07-31',
      openingBalance: '0', closingBalance: '9.99',
      lines: [{ transactionDate: '2026-07-02', description: 'Mismatch', amount: '10.00' }],
    })).rejects.toThrow('does not foot');
    expect(await db.select().from(bankStatement)).toHaveLength(0);

    const [foreign] = await db.insert(account).values({
      masterFn: SCOPE.masterFn, companyFn: 'OTHER-C', code: '1000', name: 'Foreign bank', type: 'asset',
    }).returning({ id: account.id });
    await expect(createBankStatement(db, SCOPE, {
      statementNo: 'BS-FOREIGN', bankAccountId: foreign.id, currency: 'SGD',
      periodStart: '2026-07-01', periodEnd: '2026-07-31',
      openingBalance: '0', closingBalance: '10.00',
      lines: [{ transactionDate: '2026-07-02', description: 'Foreign', amount: '10.00' }],
    })).rejects.toThrow(BankReconciliationError);

    const created = await createBankStatement(db, SCOPE, {
      statementNo: 'BS-MISMATCH', bankAccountId: ids['1000'], currency: 'SGD',
      periodStart: '2026-07-01', periodEnd: '2026-07-31',
      openingBalance: '0', closingBalance: '10.00',
      lines: [{ transactionDate: '2026-07-02', description: 'Exact required', amount: '10.00' }],
    });
    const [line] = await db.select().from(bankStatementLine)
      .where(eq(bankStatementLine.statementId, created.id));
    const wrongLeg = await posting(db, ids['1000'], 'WRONG-AMOUNT', '9.99', '0');
    await expect(matchBankStatementLine(db, SCOPE, line.id, { glEntryId: wrongLeg }))
      .rejects.toThrow('does not equal');
    expect((await db.select().from(bankStatementLine)
      .where(eq(bankStatementLine.id, line.id)))[0].matchedGlEntryId).toBeNull();
  });

  it('prevents one GL leg from matching twice and supports correction before reconciliation', async () => {
    const db = await freshDb();
    const { ids, created } = await statement(db);
    const lines = await db.select().from(bankStatementLine)
      .where(and(
        eq(bankStatementLine.masterFn, SCOPE.masterFn),
        eq(bankStatementLine.statementId, created.id),
      ));
    const receiptLeg = await posting(db, ids['1000'], 'ONE-USE', '25.00', '0');
    await matchBankStatementLine(db, SCOPE, lines[0].id, { glEntryId: receiptLeg });
    const corrected = await unmatchBankStatementLine(db, SCOPE, lines[0].id);
    expect(corrected).toMatchObject({ matchedGlEntryId: null, statementVersion: 3 });
    await matchBankStatementLine(db, SCOPE, lines[0].id, { glEntryId: receiptLeg });
    await expect(matchBankStatementLine(db, SCOPE, lines[1].id, { glEntryId: receiptLeg }))
      .rejects.toThrow();
    await expect(reconcileBankStatement(db, SCOPE, created.id))
      .rejects.toThrow('Every statement line');
  });
});
