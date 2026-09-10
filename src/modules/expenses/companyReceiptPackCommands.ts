import { and, eq, lt, or, desc } from 'drizzle-orm';
import type { DB } from '../../data/db';
import type { Scope } from '../../data/repo';
import { companyReceiptPack, companyReceiptPackTombstone } from '../../data/schema';
import type { CompanyReceiptReadVisibility } from './companyReceipt';
import type {
  CompanyReceiptPackFacts, CompanyReceiptPackFilters, CompanyReceiptPackLineFacts, CompanyReceiptPackTotal,
} from './companyReceiptPackPdf';
import {
  normalizeCompanyReceiptPackFilters as normalizeSelectionFilters,
  selectCompanyReceiptPackSelectionWithin,
  type CompanyReceiptPackSelection,
} from './companyReceiptPackSelection';
export type { CompanyReceiptPackSelection } from './companyReceiptPackSelection';

export type CompanyReceiptPackAction = 'view' | 'download' | 'print';
export type CompanyReceiptPackAccessPurpose =
  | 'receipt_pack_preview'
  | 'receipt_pack_original_evidence_export';
export type CompanyReceiptPackLocale = 'en' | 'ms' | 'zh' | 'ja' | 'vi';

export class CompanyReceiptPackError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly status = 422,
  ) {
    super(message);
    this.name = 'CompanyReceiptPackError';
  }
}

export interface CreateCompanyReceiptPackInput {
  packKey: unknown;
  search?: unknown;
  dateFrom?: unknown;
  dateTo?: unknown;
  locale?: unknown;
}

export interface CreateCompanyReceiptPackFromSelectionInput {
  packKey: string;
  locale: CompanyReceiptPackLocale;
  selection: CompanyReceiptPackSelection;
}

/** Share Pack persistence and selection across Node and browser hashing bindings. */
export function createCompanyReceiptPackCommands(sha256: (value: string) => string | Promise<string>) {
  function fail(code: string, message: string, status = 422): never {
    throw new CompanyReceiptPackError(code, message, status);
  }

  function normalizeCompanyReceiptPackKey(value: unknown): string {
    const key = typeof value === 'string' ? value.trim() : '';
    if (!/^[A-Za-z0-9][A-Za-z0-9._:-]{7,127}$/.test(key)) {
      return fail(
        'company_receipt_pack_key_invalid',
        'A stable Receipt Pack key of 8–128 safe characters is required.',
      );
    }
    return key;
  }

  function normalizeCompanyReceiptPackFilters(input: {
    search?: unknown;
    dateFrom?: unknown;
    dateTo?: unknown;
  }): CompanyReceiptPackFilters {
    return normalizeSelectionFilters(input, fail);
  }

  function normalizeCompanyReceiptPackLocale(value: unknown): 'en' | 'ms' | 'zh' | 'ja' | 'vi' {
    return ['en', 'ms', 'zh', 'ja', 'vi'].includes(String(value))
      ? String(value) as 'en' | 'ms' | 'zh' | 'ja' | 'vi'
      : 'en';
  }

  function packProjection(row: typeof companyReceiptPack.$inferSelect): CompanyReceiptPackFacts & {
    visibility: CompanyReceiptReadVisibility;
    createdByUserId: number;
    retentionUntil: Date;
    legalHold: boolean;
    recordVersion: number;
  } {
    return {
      id: row.id,
      packKey: row.packKey,
      visibility: row.visibility as CompanyReceiptReadVisibility,
      locale: row.locale,
      filters: row.filters as CompanyReceiptPackFilters,
      rows: row.rows as CompanyReceiptPackLineFacts[],
      totals: row.totals as CompanyReceiptPackTotal[],
      sourceSha256: row.sourceSha256,
      rowCount: row.rowCount,
      documentCount: row.documentCount,
      retentionUntil: row.retentionUntil,
      legalHold: row.legalHold,
      recordVersion: row.recordVersion,
      createdByUserId: row.createdByUserId,
      createdAt: row.createdAt,
    };
  }

  function sameFilters(value: unknown, expected: CompanyReceiptPackFilters): boolean {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
    const stored = value as Partial<CompanyReceiptPackFilters>;
    return stored.search === expected.search
      && stored.dateFrom === expected.dateFrom
      && stored.dateTo === expected.dateTo;
  }

  async function findCompanyReceiptPackWithin(
    tx: DB,
    scope: Scope,
    packKey: string,
  ) {
    const [row] = await tx.select().from(companyReceiptPack).where(and(
      eq(companyReceiptPack.masterFn, scope.masterFn),
      eq(companyReceiptPack.companyFn, scope.companyFn),
      eq(companyReceiptPack.packKey, packKey),
    )).limit(1);
    return row;
  }

  function replayOrConflict(
    row: typeof companyReceiptPack.$inferSelect,
    actorUserId: number,
    visibility: CompanyReceiptReadVisibility,
    locale: 'en' | 'ms' | 'zh' | 'ja' | 'vi',
    filters: CompanyReceiptPackFilters,
  ) {
    const same = row.createdByUserId === actorUserId
      && row.visibility === visibility
      && row.locale === locale
      && sameFilters(row.filters, filters);
    if (!same) {
      return fail(
        'company_receipt_pack_key_conflict',
        'This Receipt Pack key was already used for different selection facts.',
        409,
      );
    }
    return { pack: packProjection(row), replayed: true };
  }

  /**
   * A Pack is an immutable snapshot, but its frozen visibility is not a
   * permanent authorization grant. Company snapshots require a current
   * read_company decision; own snapshots may be read by either own or company
   * visibility. This same decision controls original-evidence export.
   */
  function canAccessSnapshot(
    snapshotVisibility: CompanyReceiptReadVisibility,
    currentVisibility: CompanyReceiptReadVisibility,
  ): boolean {
    return snapshotVisibility === 'own' || currentVisibility === 'company';
  }

  /**
   * Select the exact facts that a Pack would freeze without inserting a Pack.
   * Keep this query shared by preparation and creation so an adapter cannot
   * silently widen the selection or calculate a different digest.
   */
  async function selectCompanyReceiptPackWithin(
    tx: DB,
    scope: Scope,
    actorUserId: number,
    visibility: CompanyReceiptReadVisibility,
    filters: CompanyReceiptPackFilters,
    options: { lockRows?: boolean } = {},
  ): Promise<CompanyReceiptPackSelection> {
    return selectCompanyReceiptPackSelectionWithin(
      tx,
      scope,
      actorUserId,
      visibility,
      filters,
      sha256,
      options,
      fail,
    );
  }

  async function assertPackKeyNotPurgedWithin(
    tx: DB,
    scope: Scope,
    packKey: string,
  ): Promise<void> {
    const [purgedKey] = await tx.select({ id: companyReceiptPackTombstone.id })
      .from(companyReceiptPackTombstone)
      .where(and(
        eq(companyReceiptPackTombstone.masterFn, scope.masterFn),
        eq(companyReceiptPackTombstone.companyFn, scope.companyFn),
        eq(companyReceiptPackTombstone.packKeyHash, await sha256(packKey)),
      ))
      .limit(1);
    if (purgedKey) {
      return fail(
        'company_receipt_pack_key_purged',
        'This Receipt Pack key was permanently purged and cannot be reused.',
        410,
      );
    }
  }

  /**
   * Inspect a Pack key using the same actor/visibility/filter replay contract as
   * creation. The Agent execution boundary uses this before revalidating live
   * source rows so a committed Pack can be replayed even after source correction.
   */
  async function readCompanyReceiptPackByKeyWithin(
    tx: DB,
    scope: Scope,
    actorUserId: number,
    visibility: CompanyReceiptReadVisibility,
    input: {
      packKey: unknown;
      locale: unknown;
      filters: CompanyReceiptPackFilters;
    },
  ) {
    const packKey = normalizeCompanyReceiptPackKey(input.packKey);
    const locale = normalizeCompanyReceiptPackLocale(input.locale);
    await assertPackKeyNotPurgedWithin(tx, scope, packKey);
    const existing = await findCompanyReceiptPackWithin(tx, scope, packKey);
    return existing
      ? replayOrConflict(existing, actorUserId, visibility, locale, input.filters)
      : null;
  }

  /**
   * Insert exactly the already-reviewed selection. This command deliberately
   * does not run a new selection query; callers that use it for Agent execution
   * must establish the reviewed-facts and concurrency guard first.
   */
  async function createCompanyReceiptPackFromSelectionWithin(
    tx: DB,
    scope: Scope,
    actorUserId: number,
    visibility: CompanyReceiptReadVisibility,
    input: CreateCompanyReceiptPackFromSelectionInput,
    now = new Date(),
  ) {
    const packKey = normalizeCompanyReceiptPackKey(input.packKey);
    await assertPackKeyNotPurgedWithin(tx, scope, packKey);
    const existing = await findCompanyReceiptPackWithin(tx, scope, packKey);
    if (existing) {
      return replayOrConflict(
        existing,
        actorUserId,
        visibility,
        input.locale,
        input.selection.filters,
      );
    }
    const [created] = await tx.insert(companyReceiptPack).values({
      ...scope,
      packKey,
      visibility,
      locale: input.locale,
      filters: input.selection.filters,
      rows: input.selection.rows,
      totals: input.selection.totals,
      sourceSha256: input.selection.sourceSha256,
      rowCount: input.selection.rowCount,
      documentCount: input.selection.documentCount,
      retentionUntil: input.selection.retentionUntil,
      createdByUserId: actorUserId,
      createdAt: now,
    }).onConflictDoNothing({
      target: [companyReceiptPack.masterFn, companyReceiptPack.companyFn, companyReceiptPack.packKey],
    }).returning();
    if (!created) {
      const raced = await findCompanyReceiptPackWithin(tx, scope, packKey);
      if (!raced) {
        return fail(
          'company_receipt_pack_conflict_unresolved',
          'The Receipt Pack key was claimed concurrently but its snapshot is unavailable.',
          409,
        );
      }
      return replayOrConflict(
        raced,
        actorUserId,
        visibility,
        input.locale,
        input.selection.filters,
      );
    }
    return { pack: packProjection(created), replayed: false };
  }

  async function createCompanyReceiptPackWithin(
    tx: DB,
    scope: Scope,
    actorUserId: number,
    visibility: CompanyReceiptReadVisibility,
    input: CreateCompanyReceiptPackInput,
    now = new Date(),
  ) {
    const packKey = normalizeCompanyReceiptPackKey(input.packKey);
    const filters = normalizeCompanyReceiptPackFilters(input);
    const locale = normalizeCompanyReceiptPackLocale(input.locale);
    await assertPackKeyNotPurgedWithin(tx, scope, packKey);
    const existing = await findCompanyReceiptPackWithin(tx, scope, packKey);
    if (existing) {
      return replayOrConflict(existing, actorUserId, visibility, locale, filters);
    }
    const selection = await selectCompanyReceiptPackWithin(
      tx,
      scope,
      actorUserId,
      visibility,
      filters,
    );
    return createCompanyReceiptPackFromSelectionWithin(tx, scope, actorUserId, visibility, {
      packKey,
      locale,
      selection,
    }, now);
  }

  async function listCompanyReceiptPacksWithin(
    tx: DB,
    scope: Scope,
    actorUserId: number,
    currentVisibility: CompanyReceiptReadVisibility,
    input: { limit: number; afterId?: number | null },
  ) {
    const predicates = [
      eq(companyReceiptPack.masterFn, scope.masterFn),
      eq(companyReceiptPack.companyFn, scope.companyFn),
      eq(companyReceiptPack.createdByUserId, actorUserId),
      currentVisibility === 'company'
        ? or(eq(companyReceiptPack.visibility, 'own'), eq(companyReceiptPack.visibility, 'company'))!
        : eq(companyReceiptPack.visibility, 'own'),
    ];
    if (input.afterId != null) predicates.push(lt(companyReceiptPack.id, input.afterId));
    const rows = await tx.select().from(companyReceiptPack)
      .where(and(...predicates))
      .orderBy(desc(companyReceiptPack.createdAt), desc(companyReceiptPack.id))
      .limit(input.limit + 1);
    return rows.map(packProjection);
  }

  async function readCompanyReceiptPackWithin(
    tx: DB,
    scope: Scope,
    actorUserId: number,
    currentVisibility: CompanyReceiptReadVisibility,
    packId: number,
  ) {
    const [row] = await tx.select().from(companyReceiptPack).where(and(
      eq(companyReceiptPack.masterFn, scope.masterFn),
      eq(companyReceiptPack.companyFn, scope.companyFn),
      eq(companyReceiptPack.id, packId),
      eq(companyReceiptPack.createdByUserId, actorUserId),
    )).limit(1);
    if (!row) {
      return fail(
        'company_receipt_pack_not_found',
        'Receipt Pack is unavailable for the signed-in user and active Company.',
        404,
      );
    }
    if (!canAccessSnapshot(row.visibility as CompanyReceiptReadVisibility, currentVisibility)) {
      return fail(
        'company_receipt_pack_not_found',
        'Receipt Pack is unavailable for the signed-in user and active Company.',
        404,
      );
    }
    return packProjection(row);
  }


  return { normalizeCompanyReceiptPackKey, normalizeCompanyReceiptPackFilters, normalizeCompanyReceiptPackLocale, selectCompanyReceiptPackWithin, readCompanyReceiptPackByKeyWithin, createCompanyReceiptPackFromSelectionWithin, createCompanyReceiptPackWithin, listCompanyReceiptPacksWithin, readCompanyReceiptPackWithin };
}
