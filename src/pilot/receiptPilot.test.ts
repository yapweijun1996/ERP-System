import { describe, expect, it } from 'vitest';
import { readFile, stat, rm } from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { pilotPolicy, runReceiptPilot, PilotFailure, verifyPilotInspection } from './receiptPilot';
import { createPgliteDb } from '../data/db';
import { companyReceiptPack } from '../data/schema';

describe('Receipt pilot rehearsal and live authorization gate', () => {
  it('ignores inherited keys and activation in default fixture mode', () => {
    expect(pilotPolicy('fixture', 'C-SG', { OPENAI_API_KEY: 'not-used', TASK234_OPENAI_API_KEY: 'not-used', ERP_RECEIPT_ASSISTANT_ENABLED: 'true' }, false))
      .toMatchObject({ mode: 'fixture', apiKey: 'synthetic-pilot-key', approvalReference: null });
  });
  it.each([{}, { TASK234_OPENAI_API_KEY: 'fixture-secret' }, { TASK234_LIVE_APPROVED: 'true', TASK234_OPENAI_API_KEY: 'fixture-secret' }])('rejects incomplete live authority', (env) => {
    expect(() => pilotPolicy('live', 'C-SG', env, true)).toThrow('pilot_live_authorization_required');
  });
  it('requires a TTY and caps the approved budget at USD 1', () => {
    const env = { TASK234_LIVE_APPROVED: 'true', TASK234_APPROVAL_REFERENCE: 'test-approval', TASK234_OPENAI_API_KEY: 'fixture-secret', TASK234_MAX_COST_MICROS: '1000001', TASK234_INPUT_MICROS_PER_MILLION: '400000', TASK234_OUTPUT_MICROS_PER_MILLION: '1600000', TASK234_MAX_OUTPUT_TOKENS: '1024' };
    expect(() => pilotPolicy('live', 'C-SG', env, false)).toThrow('pilot_live_authorization_required');
    expect(() => pilotPolicy('live', 'C-SG', env, true)).toThrow('pilot_budget_policy_required');
  });
  it.each(['C-SG', 'C-MY'])('rehearses %s with persisted/reopened Pack and PDF evidence', async (company) => {
    const result = await runReceiptPilot(pilotPolicy('fixture', company, {}, false), async (review) => {
      expect(review.companyFn).toBe(company);
      expect(review.selectionDigest).toMatch(/^[a-f0-9]{64}$/);
      expect(review.evidenceFiles).toHaveLength(2);
      for (const source of review.evidenceFiles) {
        const content = await readFile(source.path);
        expect(createHash('sha256').update(content).digest('hex')).toBe(source.sourceSha256);
        expect(content.subarray(0, 5).toString()).toBe('%PDF-');
        expect((await stat(source.path)).mode & 0o777).toBe(0o600);
      }
      return review.selectionDigest;
    });
    try {
      expect(result.evidence).toMatchObject({ mode: 'fixture', syntheticDataOnly: true, confirmationSource: 'simulated_fixture', persistedAfterReopen: true, savedPdfVerified: true, humanViewedPdf: false, productionVerified: false,
        sourceFilesHashVerified: true, humanViewedSources: false, providerCalls: 5 });
      expect(result.evidence.receiptIds).toHaveLength(2);
      const evidence = await readFile(path.join(result.outputDirectory, 'evidence.json'), 'utf8');
      expect(evidence).not.toMatch(/synthetic-pilot-key|intentKey|credentialEnvelope|demo1234|erp_session/);
      expect((await stat(path.join(result.outputDirectory, 'evidence.json'))).mode & 0o777).toBe(0o600);
      expect((await stat(result.outputDirectory)).mode & 0o777).toBe(0o700);
    } finally { await rm(result.outputDirectory, { recursive: true }); }
  });
  it.each(['missing', 'failed', 'receipt_version', 'document_version', 'document_hash'])('rejects %s detail evidence', (scenario) => {
    const receipt = { id: 1, version: 2, documentId: 3, documentVersionId: 4, documentVersionNo: 1, documentSha256: 'a'.repeat(64) };
    const row = { receiptId: 1, receiptVersion: 2, documentId: 3, documentVersionId: 4, documentSha256: 'a'.repeat(64) };
    if (scenario === 'receipt_version') receipt.version = 1;
    if (scenario === 'document_version') receipt.documentVersionId = 5;
    if (scenario === 'document_hash') receipt.documentSha256 = 'b'.repeat(64);
    expect(() => verifyPilotInspection({ preview: { rows: [row] },
      toolResults: scenario === 'missing' ? [] : [{ action: 'receipt.get', callId: 'detail', ok: scenario !== 'failed', body: { data: receipt } }],
    })).toThrow('pilot_inspection_missing');
  });
  it('cancels a mismatched confirmation without persisting a Pack', async () => {
    let failure: PilotFailure | undefined;
    try {
      await runReceiptPilot(pilotPolicy('fixture', 'C-SG', {}, false), async () => 'declined');
    } catch (error) {
      expect(error).toBeInstanceOf(PilotFailure);
      failure = error as PilotFailure;
    }
    expect(failure?.code).toBe('pilot_confirmation_declined');
    const directory = failure!.outputDirectory;
    try {
      const db = await createPgliteDb(path.join(directory, 'database'));
      try { expect(await db.select().from(companyReceiptPack)).toHaveLength(0); }
      finally { await (db as unknown as { $client: { close(): Promise<void> } }).$client.close(); }
      expect(JSON.parse(await readFile(path.join(directory, 'evidence.json'), 'utf8'))).toMatchObject({
        completed: false, code: 'pilot_confirmation_declined', providerUsageAvailable: false,
      });
      await expect(stat(path.join(directory, 'receipt-pack.pdf'))).rejects.toMatchObject({ code: 'ENOENT' });
    } finally { await rm(directory, { recursive: true }); }
  });
});
