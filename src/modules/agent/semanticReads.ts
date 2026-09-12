import { and, eq } from 'drizzle-orm';
import type { DB } from '../../data/db';
import type { Scope } from '../../data/repo';
import { company } from '../../data/schema';
import { listCompanyReceiptsWithin } from '../expenses/companyReceipt';
import {
  summarizeCompanyReceipts,
  validateCompanyReceiptSemanticQuery,
  type CompanyReceiptSemanticQuery,
  type CompanyReceiptSemanticResult,
  type CompanyReceiptSemanticRow,
  type SemanticVisibility,
} from './semanticContracts';

export const SEMANTIC_RECEIPT_PAGE_SIZE = 100;
export const SEMANTIC_RECEIPT_MAX_ROWS = 5000;

export interface AuthorizedSemanticReceiptContext {
  readonly scope: Scope;
  readonly actorUserId: number;
  readonly visibility: SemanticVisibility;
}

export interface CompanyReceiptSemanticReadInput {
  readonly dateFrom: string;
  readonly dateTo: string;
  readonly asOf?: Date | string;
}

export class SemanticReadError extends Error {
  constructor(
    public readonly code: 'semantic_company_not_found'
      | 'semantic_permission_denied'
      | 'semantic_result_too_large',
    message: string,
    public readonly status: 403 | 404 | 413,
  ) {
    super(message);
    this.name = 'SemanticReadError';
  }
}

type ReceiptProjection = Awaited<ReturnType<typeof listCompanyReceiptsWithin>>[number];

function toSemanticRow(row: ReceiptProjection, scope: Scope): CompanyReceiptSemanticRow {
  return {
    id: row.id,
    masterFn: scope.masterFn,
    companyFn: scope.companyFn,
    uploaderUserId: row.uploaderUserId,
    transactionDate: row.transactionDate,
    amount: String(row.amount),
    currencyCode: row.currency,
    status: row.status as CompanyReceiptSemanticRow['status'],
    version: row.version,
    documentId: row.documentId,
    documentVersionId: row.documentVersionId,
  };
}

/**
 * Read the S1 semantic contract through the existing G01 receipt.search
 * selection boundary. The service returns only the fixed semantic field
 * projection; tenant scope and visibility are resolved before model context is
 * constructed, and the page/row bounds fail closed instead of widening reads.
 */
export async function readCompanyReceiptSemanticSummaryWithin(
  exec: DB,
  context: AuthorizedSemanticReceiptContext,
  input: CompanyReceiptSemanticReadInput,
): Promise<CompanyReceiptSemanticResult> {
  const [companyRow] = await exec.select({ timeZone: company.timeZone })
    .from(company)
    .where(and(
      eq(company.masterFn, context.scope.masterFn),
      eq(company.companyFn, context.scope.companyFn),
    ))
    .limit(1);
  if (!companyRow) {
    throw new SemanticReadError(
      'semantic_company_not_found',
      'The active Company is not available for semantic retrieval.',
      404,
    );
  }

  const query: CompanyReceiptSemanticQuery = {
    scope: context.scope,
    actorUserId: context.actorUserId,
    visibility: context.visibility,
    timeZone: companyRow.timeZone,
    dateFrom: input.dateFrom,
    dateTo: input.dateTo,
    asOf: input.asOf ?? new Date(),
  };
  const asOf = validateCompanyReceiptSemanticQuery(query);
  let afterId: number | null = null;
  let fetched = 0;
  const rows: CompanyReceiptSemanticRow[] = [];

  while (true) {
    const page = await listCompanyReceiptsWithin(exec, context.scope, context.actorUserId, {
      limit: SEMANTIC_RECEIPT_PAGE_SIZE,
      afterId,
      visibility: context.visibility,
      dateFrom: input.dateFrom,
      dateTo: input.dateTo,
    });
    const selected = page.slice(0, SEMANTIC_RECEIPT_PAGE_SIZE);
    if (selected.length === 0) break;
    fetched += selected.length;
    if (fetched > SEMANTIC_RECEIPT_MAX_ROWS) {
      throw new SemanticReadError(
        'semantic_result_too_large',
        `The semantic result exceeds the ${SEMANTIC_RECEIPT_MAX_ROWS}-row bound; narrow the date range.`,
        413,
      );
    }
    rows.push(...selected.map((row) => toSemanticRow(row, context.scope)));
    if (page.length <= SEMANTIC_RECEIPT_PAGE_SIZE) break;
    afterId = selected[selected.length - 1]?.id ?? null;
    if (afterId == null) break;
  }

  return summarizeCompanyReceipts(rows, { ...query, asOf });
}
