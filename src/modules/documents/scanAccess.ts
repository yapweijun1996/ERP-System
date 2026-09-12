import { and, eq } from 'drizzle-orm';
import type { DB } from '../../data/db';
import type { Scope } from '../../data/repo';
import { documentScanJob } from '../../data/schema';

export type GovernedDocumentAction = 'preview' | 'ocr' | 'submission' | 'export';

export class DocumentQuarantineError extends Error {
  readonly code = 'document_quarantined';

  constructor(
    public readonly action: GovernedDocumentAction,
    public readonly scanStatus: string,
  ) {
    super(`Document ${action} is blocked while scan status is ${scanStatus}.`);
  }
}

export async function assertDocumentScanClean(
  exec: DB,
  scope: Scope,
  versionId: number,
  action: GovernedDocumentAction,
) {
  const [scan] = await exec.select({ status: documentScanJob.status })
    .from(documentScanJob).where(and(
      eq(documentScanJob.masterFn, scope.masterFn),
      eq(documentScanJob.companyFn, scope.companyFn),
      eq(documentScanJob.versionId, versionId),
    )).limit(1);
  if (scan?.status !== 'clean') {
    throw new DocumentQuarantineError(action, scan?.status ?? 'missing');
  }
  return scan;
}
