import { describe, expect, it } from 'vitest';
import {
  AGENT_ACTION_CONTRACT_VERSION,
  AgentActionContractError,
  getAgentActionContract,
  listAgentActionContracts,
  parseAgentActionInput,
  validateAgentActionOutput,
} from './actionContracts';

const digestA = 'a'.repeat(64);
const digestB = 'b'.repeat(64);
const digestC = 'c'.repeat(64);

const receipt = {
  id: 101,
  receiptKey: 'receipt-101',
  documentId: 201,
  documentVersionId: 301,
  documentVersionNo: 1,
  documentSha256: digestA,
  evidenceSha256: digestB,
  originalFileName: 'receipt-101.pdf',
  uploaderUserId: 401,
  uploaderName: 'Alicia Tan',
  transactionDate: '2026-09-01',
  merchant: 'Example Supplies',
  receiptNumber: 'R-101',
  amount: '123.4500',
  currency: 'SGD',
  category: 'Office',
  businessPurpose: 'Stationery',
  notes: null,
  status: 'ready',
  version: 1,
  voidReason: null,
  voidedAt: null,
  voidedByUserId: null,
  createdAt: '2026-09-01T08:00:00.000Z',
  updatedAt: '2026-09-01T08:00:00.000Z',
};

const packRow = {
  receiptId: receipt.id,
  receiptVersion: receipt.version,
  transactionDate: receipt.transactionDate,
  merchant: receipt.merchant,
  receiptNumber: receipt.receiptNumber,
  category: receipt.category,
  businessPurpose: receipt.businessPurpose,
  notes: receipt.notes,
  amount: receipt.amount,
  currency: receipt.currency,
  uploaderUserId: receipt.uploaderUserId,
  uploaderName: receipt.uploaderName,
  documentId: receipt.documentId,
  documentVersionId: receipt.documentVersionId,
  documentSha256: digestC,
  originalFileName: receipt.originalFileName,
};

const pack = {
  id: 501,
  packKey: 'pack-2026-09',
  visibility: 'company' as const,
  locale: 'en' as const,
  filters: { search: '', dateFrom: '2026-09-01', dateTo: '2026-09-30' },
  rows: [packRow],
  totals: [{ currency: 'SGD', amount: '123.4500', receiptCount: 1 }],
  sourceSha256: digestC,
  rowCount: 1,
  documentCount: 1,
  retentionUntil: '2027-09-01T00:00:00.000Z',
  legalHold: false,
  recordVersion: 1,
  createdByUserId: 401,
  createdAt: '2026-09-01T08:01:00.000Z',
};

function expectContractError(
  callback: () => unknown,
  code: AgentActionContractError['code'],
): void {
  let caught: unknown;
  try {
    callback();
  } catch (error) {
    caught = error;
  }
  expect(caught).toBeInstanceOf(AgentActionContractError);
  expect((caught as AgentActionContractError).code).toBe(code);
}

describe('AI Native ERP action contracts', () => {
  it('publishes the six versioned pilot actions and their authority boundaries', () => {
    const contracts = listAgentActionContracts();
    expect(contracts.map((contract) => contract.name)).toEqual([
      'receipt.search',
      'receipt.get',
      'receipt_pack.prepare',
      'receipt_pack.create',
      'receipt_pack.get',
      'receipt_pack.export',
    ]);
    expect(contracts.every((contract) => contract.version === AGENT_ACTION_CONTRACT_VERSION))
      .toBe(true);
    expect(getAgentActionContract('receipt_pack.prepare')).toMatchObject({
      availability: 'contract_only',
      effect: 'prepare',
      actionClass: 'draft',
      confirmationAuthority: 'none',
      mutationBoundary: 'none',
      authorization: 'read_only_non_authorizing',
      sideEffects: expect.arrayContaining(['no_pack_write', 'no_approval_grant']),
    });
    expect(getAgentActionContract('receipt_pack.create')).toMatchObject({
      actionClass: 'confirmed_execution',
      confirmationAuthority: 'active_human_session',
      mutationBoundary: 'receipt_pack_snapshot',
      authorization: 'confirmation_required',
    });
    expect(getAgentActionContract('receipt_pack.export')).toMatchObject({
      actionClass: 'read',
      confirmationAuthority: 'none',
      mutationBoundary: 'none',
    });
    expect(getAgentActionContract('receipt_pack.create').idempotency).toMatchObject({
      mode: 'required',
      keyField: 'packKey',
      replayable: true,
      conflictCode: 'company_receipt_pack_key_conflict',
    });
    expect(getAgentActionContract('receipt.search').pagination).toMatchObject({
      style: 'keyset',
      requestField: 'afterId',
      responseField: 'nextCursor',
      maxPageSize: 100,
    });
  });

  it('accepts bounded inputs while preserving date and string representations', () => {
    expect(parseAgentActionInput('receipt.search', {
      limit: 100,
      afterId: 10,
      search: 'stationery',
      dateFrom: '2026-09-01',
      dateTo: '2026-09-30',
    })).toEqual({
      limit: 100,
      afterId: 10,
      search: 'stationery',
      dateFrom: '2026-09-01',
      dateTo: '2026-09-30',
    });
    expect(parseAgentActionInput('receipt_pack.prepare', {
      dateFrom: '2026-09-01',
      dateTo: '2026-09-30',
      locale: 'ms',
    })).toEqual({
      dateFrom: '2026-09-01',
      dateTo: '2026-09-30',
      locale: 'ms',
    });
    expect(parseAgentActionInput('receipt_pack.create', {
      packKey: 'pack-2026-09',
      dateFrom: '2026-09-01',
      dateTo: '2026-09-30',
      locale: 'en',
    })).toMatchObject({ packKey: 'pack-2026-09', dateFrom: '2026-09-01' });
  });

  it('rejects invalid dates, bounds, ranges, unknown fields, and nested authority', () => {
    expectContractError(
      () => parseAgentActionInput('receipt.search', { limit: 0 }),
      'agent_action_input_invalid',
    );
    expectContractError(
      () => parseAgentActionInput('receipt.search', { limit: 101 }),
      'agent_action_input_invalid',
    );
    expectContractError(
      () => parseAgentActionInput('receipt.search', { dateFrom: '2026-02-30' }),
      'agent_action_input_invalid',
    );
    expectContractError(
      () => parseAgentActionInput('receipt.search', {
        dateFrom: '2026-10-01',
        dateTo: '2026-09-01',
      }),
      'agent_action_input_invalid',
    );
    expectContractError(
      () => parseAgentActionInput('receipt.get', { receiptId: 1, unexpected: true }),
      'agent_action_input_invalid',
    );
    expectContractError(
      () => parseAgentActionInput('receipt_pack.create', {
        packKey: 'pack-2026-09',
        dateFrom: '2026-09-01',
        dateTo: '2026-09-30',
        filters: { companyFn: 'client-controlled-company' },
      }),
      'tenant_scope_is_session_derived',
    );
    expectContractError(
      () => parseAgentActionInput('receipt.search', {
        filters: [{ nested: { actorUserId: 99 } }],
      }),
      'tenant_scope_is_session_derived',
    );
  });

  it('validates representative receipt, pack, preparation, and export envelopes', () => {
    validateAgentActionOutput('receipt.search', {
      data: [receipt],
      meta: {
        scope: 'company',
        actorUserId: 401,
        limit: 50,
        nextCursor: null,
        filters: { search: '', dateFrom: null, dateTo: null },
        actions: { create: true, edit: false, void: false },
      },
    });
    validateAgentActionOutput('receipt.get', { data: receipt, meta: { scope: 'company' } });
    validateAgentActionOutput('receipt_pack.prepare', {
      data: {
        selectionDigest: digestC,
        visibility: 'company',
        filters: pack.filters,
        rows: pack.rows,
        totals: pack.totals,
        rowCount: 1,
        documentCount: 1,
        preparedAt: '2026-09-01T08:01:00.000Z',
      },
      meta: { preparationOnly: true, authorizationRequired: true, completeResult: true },
    });
    validateAgentActionOutput('receipt_pack.create', {
      data: { pack, replayed: false },
      meta: {
        immutableSnapshot: true,
        completeResult: true,
        missingDatesExcluded: true,
        currencyTotalsSeparated: true,
      },
    });
    validateAgentActionOutput('receipt_pack.get', {
      data: pack,
      meta: { immutableSnapshot: true, completeResult: true, accessVisibility: 'company' },
    });
    validateAgentActionOutput('receipt_pack.export', {
      contentType: 'application/pdf',
      byteLength: 2048,
      artifactSha256: digestA,
      sourceSha256: digestC,
      accessPurpose: 'receipt_pack_preview',
    });
  });

  it('rejects output shape drift and unknown actions with stable errors', () => {
    expectContractError(
      () => validateAgentActionOutput('receipt_pack.get', {
        data: pack,
        meta: { immutableSnapshot: true, completeResult: true },
      }),
      'agent_action_output_invalid',
    );
    expectContractError(
      () => getAgentActionContract('receipt.unknown'),
      'agent_action_unknown',
    );
  });
});
