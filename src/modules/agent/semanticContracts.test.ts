import { describe, expect, it } from 'vitest';
import {
  COMPANY_RECEIPT_SEMANTIC_CONTRACT,
  ERP_SEMANTIC_CONTRACT_VERSION,
  SemanticContractError,
  summarizeCompanyReceipts,
  type CompanyReceiptSemanticQuery,
  type CompanyReceiptSemanticRow,
} from './semanticContracts';

const rows: CompanyReceiptSemanticRow[] = [
  {
    id: 10, masterFn: 'M1', companyFn: 'C-SG', uploaderUserId: 7,
    transactionDate: '2026-09-01', amount: '10.5000', currencyCode: 'SGD',
    status: 'ready', version: 1, documentId: 110, documentVersionId: 111,
  },
  {
    id: 11, masterFn: 'M1', companyFn: 'C-SG', uploaderUserId: 8,
    transactionDate: '2026-09-02', amount: '5.2500', currencyCode: 'SGD',
    status: 'ready', version: 2, documentId: 120, documentVersionId: 121,
  },
  {
    id: 12, masterFn: 'M1', companyFn: 'C-SG', uploaderUserId: 8,
    transactionDate: '2026-09-02', amount: '7.7500', currencyCode: 'MYR',
    status: 'ready', version: 1, documentId: 130, documentVersionId: 131,
  },
  {
    id: 13, masterFn: 'M1', companyFn: 'C-SG', uploaderUserId: 7,
    transactionDate: '2026-09-02', amount: '99.0000', currencyCode: 'SGD',
    status: 'voided', version: 3, documentId: 140, documentVersionId: 141,
  },
  {
    id: 14, masterFn: 'M1', companyFn: 'C-SG', uploaderUserId: 7,
    transactionDate: null, amount: '3.0000', currencyCode: 'SGD',
    status: 'ready', version: 1, documentId: 150, documentVersionId: 151,
  },
  {
    id: 15, masterFn: 'M1', companyFn: 'C-SG', uploaderUserId: 7,
    transactionDate: '2026-09-03', amount: '1.2500', currencyCode: 'SGD',
    status: 'ready', version: 1, documentId: 160, documentVersionId: 161,
  },
  {
    id: 16, masterFn: 'M1', companyFn: 'C-MY', uploaderUserId: 7,
    transactionDate: '2026-09-02', amount: '500.0000', currencyCode: 'MYR',
    status: 'ready', version: 1, documentId: 170, documentVersionId: 171,
  },
  {
    id: 17, masterFn: 'M2', companyFn: 'C-SG', uploaderUserId: 7,
    transactionDate: '2026-09-02', amount: '900.0000', currencyCode: 'SGD',
    status: 'ready', version: 1, documentId: 180, documentVersionId: 181,
  },
];

function query(overrides: Partial<CompanyReceiptSemanticQuery> = {}): CompanyReceiptSemanticQuery {
  return {
    scope: { masterFn: 'M1', companyFn: 'C-SG' },
    actorUserId: 7,
    visibility: 'own',
    timeZone: 'Asia/Singapore',
    dateFrom: '2026-09-01',
    dateTo: '2026-09-02',
    asOf: '2026-09-09T00:00:00.000Z',
    ...overrides,
  };
}

describe('tenant-facing Company Receipt semantic contract', () => {
  it('publishes owned terms, fields and deterministic calculation rules', () => {
    expect(ERP_SEMANTIC_CONTRACT_VERSION).toBe(1);
    expect(COMPANY_RECEIPT_SEMANTIC_CONTRACT).toMatchObject({
      entity: 'company_receipt',
      sourceResource: 'expenses/company-receipts',
      supportedQuestions: expect.arrayContaining([
        expect.stringContaining('How many confirmed'),
        expect.stringContaining('total by currency'),
      ]),
      calculation: {
        includedStatus: 'ready',
        dateBoundary: 'inclusive',
        nullDate: 'excluded',
        timezone: 'company.timeZone',
        currency: 'group_without_fx_conversion',
      },
    });
    expect(COMPANY_RECEIPT_SEMANTIC_CONTRACT.fieldOwnership).toEqual(expect.arrayContaining([
      expect.objectContaining({ field: 'masterFn', owner: 'session' }),
      expect.objectContaining({ field: 'companyFn', owner: 'company' }),
      expect.objectContaining({ field: 'amount', owner: 'company_receipt' }),
      expect.objectContaining({ field: 'documentVersionId', owner: 'managed_document' }),
    ]));
  });

  it('returns exact own-scope boundary values and source identifiers', () => {
    const result = summarizeCompanyReceipts(rows, query());
    expect(result).toMatchObject({
      contractVersion: 1,
      scope: { masterFn: 'M1', companyFn: 'C-SG', visibility: 'own' },
      period: {
        dateFrom: '2026-09-01', dateTo: '2026-09-02', inclusive: true,
        timeZone: 'Asia/Singapore',
      },
      asOf: '2026-09-09T00:00:00.000Z',
      receiptCount: 1,
      totalsByCurrency: [{
        currency: 'SGD', amount: '10.5000', receiptCount: 1,
        sources: [{ receiptId: 10, receiptVersion: 1, documentId: 110, documentVersionId: 111 }],
      }],
      sources: [{ receiptId: 10, receiptVersion: 1, documentId: 110, documentVersionId: 111 }],
    });
  });

  it('returns company scope with mixed currencies without FX conversion', () => {
    const result = summarizeCompanyReceipts(rows, query({ visibility: 'company' }));
    expect(result.receiptCount).toBe(3);
    expect(result.totalsByCurrency).toEqual([
      {
        currency: 'MYR', amount: '7.7500', receiptCount: 1,
        sources: [{ receiptId: 12, receiptVersion: 1, documentId: 130, documentVersionId: 131 }],
      },
      {
        currency: 'SGD', amount: '15.7500', receiptCount: 2,
        sources: [
          { receiptId: 10, receiptVersion: 1, documentId: 110, documentVersionId: 111 },
          { receiptId: 11, receiptVersion: 2, documentId: 120, documentVersionId: 121 },
        ],
      },
    ]);
    expect(result.sources.map((source) => source.receiptId)).toEqual([10, 11, 12]);
  });

  it('returns a stable empty result for an empty range', () => {
    const result = summarizeCompanyReceipts(rows, query({
      dateFrom: '2026-10-01', dateTo: '2026-10-31',
    }));
    expect(result.receiptCount).toBe(0);
    expect(result.totalsByCurrency).toEqual([]);
    expect(result.sources).toEqual([]);
  });

  it('fails closed for invalid date, timezone and timestamp contracts', () => {
    expect(() => summarizeCompanyReceipts(rows, query({
      dateFrom: '2026-09-03', dateTo: '2026-09-02',
    }))).toThrowError(new SemanticContractError(
      'semantic_query_invalid', 'dateFrom cannot be after dateTo.',
    ));
    expect(() => summarizeCompanyReceipts(rows, query({ timeZone: 'Not/A_Timezone' })))
      .toThrowError('valid IANA timezone');
    expect(() => summarizeCompanyReceipts(rows, query({ asOf: 'not-a-timestamp' })))
      .toThrowError('valid timestamp');
  });
});
