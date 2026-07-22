import { and, eq } from 'drizzle-orm';
import { describe, expect, it } from 'vitest';
import type { DB } from '../../data/db';
import { account, glEntry, journalHeader, journalLine } from '../../data/schema';
import { freshDb, TEST_SCOPE as SCOPE } from '../../test/helpers';
import {
  createManualJournal,
  ManualJournalError,
  postManualJournal,
  reverseManualJournal,
} from './manualJournal';

async function accounts(db: DB) {
  const rows = await db.insert(account).values([
    {
      masterFn: SCOPE.masterFn, companyFn: SCOPE.companyFn,
      code: '1100', name: 'Fictional Receivable', type: 'asset',
    },
    {
      masterFn: SCOPE.masterFn, companyFn: SCOPE.companyFn,
      code: '4000', name: 'Fictional Revenue', type: 'income',
    },
  ]).returning({ id: account.id, code: account.code });
  return Object.fromEntries(rows.map((row) => [row.code, row.id]));
}

async function draft(db: DB, docNo = 'MJ-TEST-1') {
  const ids = await accounts(db);
  return createManualJournal(db, SCOPE, {
    docNo,
    postingDate: '2026-07-22',
    journalType: 'reclassification',
    memo: 'Fictional year-end reclassification',
    reference: 'TEST-BATCH',
    lines: [
      { accountId: ids['1100'], dimension: 'SG', debit: '123.45', credit: '0' },
      { accountId: ids['4000'], dimension: 'SG', debit: '0', credit: '123.45' },
    ],
  });
}

describe('manual journal', () => {
  it('saves a balanced draft without touching the GL, then posts immutable legs', async () => {
    const db = await freshDb();
    const created = await draft(db);
    expect(created).toMatchObject({
      docNo: 'MJ-TEST-1', status: 'draft', version: 1, lineCount: 2, total: '123.45',
    });
    expect(await db.select().from(glEntry)).toHaveLength(0);

    const posted = await postManualJournal(db, SCOPE, created.id);
    expect(posted).toMatchObject({ status: 'posted', version: 2, lineCount: 2, total: '123.45' });
    const legs = await db.select().from(glEntry).where(eq(glEntry.journalRef, 'MJ-TEST-1'));
    expect(legs.map((line) => [line.debit, line.credit])).toEqual([
      ['123.45', '0.00'],
      ['0.00', '123.45'],
    ]);
    expect(legs[0].postedAt.toISOString().slice(0, 10)).toBe('2026-07-22');
  });

  it('rejects an unbalanced draft atomically', async () => {
    const db = await freshDb();
    const ids = await accounts(db);
    await expect(createManualJournal(db, SCOPE, {
      docNo: 'MJ-UNBALANCED',
      postingDate: '2026-07-22',
      journalType: 'standard',
      memo: 'Fictional invalid entry',
      lines: [
        { accountId: ids['1100'], debit: '10.00', credit: '0' },
        { accountId: ids['4000'], debit: '0', credit: '9.99' },
      ],
    })).rejects.toThrow('Journal must balance');
    expect(await db.select().from(journalHeader)).toHaveLength(0);
    expect(await db.select().from(journalLine)).toHaveLength(0);
  });

  it('rejects a cross-company account before saving any row', async () => {
    const db = await freshDb();
    const ids = await accounts(db);
    const [foreign] = await db.insert(account).values({
      masterFn: SCOPE.masterFn, companyFn: 'OTHER-C',
      code: '9999', name: 'Foreign company account', type: 'expense',
    }).returning({ id: account.id });
    await expect(createManualJournal(db, SCOPE, {
      docNo: 'MJ-CROSS-COMPANY',
      postingDate: '2026-07-22',
      journalType: 'standard',
      memo: 'Fictional cross-company entry',
      lines: [
        { accountId: ids['1100'], debit: '10.00', credit: '0' },
        { accountId: foreign.id, debit: '0', credit: '10.00' },
      ],
    })).rejects.toThrow(ManualJournalError);
    expect(await db.select().from(journalHeader)).toHaveLength(0);
  });

  it('blocks duplicate posting without duplicating GL legs', async () => {
    const db = await freshDb();
    const created = await draft(db, 'MJ-POST-ONCE');
    await postManualJournal(db, SCOPE, created.id);
    await expect(postManualJournal(db, SCOPE, created.id)).rejects.toThrow('Only a draft journal');
    expect(await db.select().from(glEntry).where(eq(glEntry.journalRef, 'MJ-POST-ONCE'))).toHaveLength(2);
  });

  it('reverses a posted journal with swapped lines and leaves both postings balanced', async () => {
    const db = await freshDb();
    const created = await draft(db, 'MJ-ORIGINAL');
    await postManualJournal(db, SCOPE, created.id);
    const result = await reverseManualJournal(db, SCOPE, created.id, {
      docNo: 'MJ-REVERSAL',
      postingDate: '2026-07-23',
      reason: 'Fictional correction',
    });
    expect(result.original).toMatchObject({ status: 'reversed', version: 3 });
    expect(result.reversal).toMatchObject({
      docNo: 'MJ-REVERSAL', status: 'posted', reversalOfId: created.id, total: '123.45',
    });
    const reversedLines = await db.select().from(journalLine).where(and(
      eq(journalLine.masterFn, SCOPE.masterFn),
      eq(journalLine.journalId, result.reversal.id),
    ));
    expect(reversedLines.map((line) => [line.debit, line.credit])).toEqual([
      ['0.00', '123.45'],
      ['123.45', '0.00'],
    ]);
    const reversalLegs = await db.select().from(glEntry).where(eq(glEntry.journalRef, 'MJ-REVERSAL'));
    expect(reversalLegs.reduce((sum, line) => sum + Number(line.debit), 0)).toBe(123.45);
    expect(reversalLegs.reduce((sum, line) => sum + Number(line.credit), 0)).toBe(123.45);
    await expect(reverseManualJournal(db, SCOPE, created.id, {
      docNo: 'MJ-REVERSAL-2', postingDate: '2026-07-24', reason: 'Duplicate',
    })).rejects.toThrow('Only a posted journal');
  });

  it('does not permit a reversal date before the original posting date', async () => {
    const db = await freshDb();
    const created = await draft(db, 'MJ-DATED');
    await postManualJournal(db, SCOPE, created.id);
    await expect(reverseManualJournal(db, SCOPE, created.id, {
      docNo: 'MJ-DATED-REV', postingDate: '2026-07-21', reason: 'Invalid date',
    })).rejects.toThrow('cannot precede');
    expect(await db.select().from(journalHeader)).toHaveLength(1);
    expect(await db.select().from(glEntry)).toHaveLength(2);
  });
});
