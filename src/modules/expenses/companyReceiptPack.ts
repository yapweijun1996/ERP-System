import { createHash } from 'node:crypto';
import { and, eq, inArray } from 'drizzle-orm';
import type { DB } from '../../data/db';
import type { Scope } from '../../data/repo';
import { documentVersion } from '../../data/schema';
import { assertDocumentScanClean } from '../documents/processing';
import {
  createDocumentStorageRegistry,
  type DocumentStorageBackend, type DocumentStorageRegistry, type StoredDocumentVersion,
} from '../documents/storage';
import type { EvidencePdfDocument } from '../documents/evidencePdf';
import { renderCompanyReceiptPackPdf } from './companyReceiptPackPdf';
import type { CompanyReceiptReadVisibility } from './companyReceipt';
import {
  createCompanyReceiptPackCommands, CompanyReceiptPackError,
  type CompanyReceiptPackAction, type CompanyReceiptPackAccessPurpose,
} from './companyReceiptPackCommands';
export * from './companyReceiptPackCommands';

const MAX_PACK_SOURCE_BYTES = 250 * 1024 * 1024;
function sha256(value: string | Uint8Array): string {
  return createHash('sha256').update(value).digest('hex');
}
function fail(code: string, message: string, status = 422): never {
  throw new CompanyReceiptPackError(code, message, status);
}

export const {
  normalizeCompanyReceiptPackKey,
  normalizeCompanyReceiptPackFilters,
  normalizeCompanyReceiptPackLocale,
  selectCompanyReceiptPackWithin,
  readCompanyReceiptPackByKeyWithin,
  createCompanyReceiptPackFromSelectionWithin,
  createCompanyReceiptPackWithin,
  listCompanyReceiptPacksWithin,
  readCompanyReceiptPackWithin,
} = createCompanyReceiptPackCommands(sha256);

function accessPurpose(action: CompanyReceiptPackAction): CompanyReceiptPackAccessPurpose {
  return action === 'view'
    ? 'receipt_pack_preview'
    : 'receipt_pack_original_evidence_export';
}

export async function renderCompanyReceiptPackWithin(
  tx: DB,
  scope: Scope,
  actorUserId: number,
  currentVisibility: CompanyReceiptReadVisibility,
  packId: number,
  action: CompanyReceiptPackAction,
  registry: DocumentStorageRegistry = createDocumentStorageRegistry(),
) {
  const pack = await readCompanyReceiptPackWithin(
    tx, scope, actorUserId, currentVisibility, packId,
  );
  const versionIds = pack.rows.map((row) => row.documentVersionId);
  const versions = await tx.select().from(documentVersion).where(and(
    eq(documentVersion.masterFn, scope.masterFn),
    eq(documentVersion.companyFn, scope.companyFn),
    inArray(documentVersion.id, versionIds),
  ));
  const byId = new Map(versions.map((version) => [version.id, version]));
  const totalBytes = versions.reduce((total, version) => total + version.sizeBytes, 0);
  if (versions.length !== versionIds.length || totalBytes > MAX_PACK_SOURCE_BYTES) {
    return fail(
      'company_receipt_pack_source_unavailable',
      totalBytes > MAX_PACK_SOURCE_BYTES
        ? 'Receipt Pack source files exceed the 250 MB rendering limit.'
        : 'One or more frozen Receipt Pack document versions are unavailable.',
      totalBytes > MAX_PACK_SOURCE_BYTES ? 413 : 409,
    );
  }
  const documents: EvidencePdfDocument[] = [];
  for (const row of pack.rows) {
    const version = byId.get(row.documentVersionId)!;
    if (version.documentId !== row.documentId || version.sha256 !== row.documentSha256) {
      return fail(
        'company_receipt_pack_source_changed',
        'Frozen Receipt Pack evidence identity no longer matches its source version.',
        409,
      );
    }
    await assertDocumentScanClean(
      tx,
      scope,
      version.id,
      action === 'view' ? 'preview' : 'export',
    );
    const content = await registry.get(version.storageBackend as DocumentStorageBackend)
      .readWithin(tx, scope, version as StoredDocumentVersion);
    if (sha256(content) !== row.documentSha256) {
      return fail(
        'company_receipt_pack_source_changed',
        'Frozen Receipt Pack evidence content failed integrity verification.',
        409,
      );
    }
    documents.push({
      fileName: row.originalFileName,
      mimeType: version.mimeType,
      sha256: version.sha256,
      content,
    });
  }
  const content = await renderCompanyReceiptPackPdf(pack, documents);
  return {
    pack,
    accessPurpose: accessPurpose(action),
    fileName: `company-receipt-pack-${pack.filters.dateFrom}-${pack.filters.dateTo}.pdf`,
    mimeType: 'application/pdf' as const,
    content,
    sha256: sha256(content),
  };
}
