import { and, eq, sql } from 'drizzle-orm';
import type { DB } from '../../data/db';
import type { Scope } from '../../data/repo';
import { withTenantTransaction } from '../../data/tenantTransaction';
import {
  companyReceiptPack,
  companyReceiptPackGovernanceEvent,
  companyReceiptPackPurgeRequest,
  companyReceiptPackTombstone,
} from '../../data/schema';

export class CompanyReceiptPackGovernanceError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly status = 409,
  ) {
    super(message);
    this.name = 'CompanyReceiptPackGovernanceError';
  }
}

async function hash(value: string): Promise<string> {
  const digest = await globalThis.crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(value),
  );
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
}

function reasonText(value: unknown, label: string): string {
  const reason = typeof value === 'string' ? value.trim() : '';
  if (!reason || reason.length < 3 || reason.length > 1000) {
    throw new CompanyReceiptPackGovernanceError(
      `company_receipt_pack_${label}_invalid`,
      `A ${label.replaceAll('_', ' ')} of 3–1000 characters is required.`,
      422,
    );
  }
  return reason;
}

function conflict(code: string, message: string): never {
  throw new CompanyReceiptPackGovernanceError(code, message, 409);
}

async function lockedPack(exec: DB, scope: Scope, packId: number) {
  const [pack] = await exec.select().from(companyReceiptPack).where(and(
    eq(companyReceiptPack.masterFn, scope.masterFn),
    eq(companyReceiptPack.companyFn, scope.companyFn),
    eq(companyReceiptPack.id, packId),
  )).limit(1).for('update');
  if (!pack) {
    throw new CompanyReceiptPackGovernanceError(
      'company_receipt_pack_missing',
      'Receipt Pack is unavailable in the active Company.',
      404,
    );
  }
  return pack;
}

async function appendEvent(
  exec: DB,
  scope: Scope,
  input: Omit<typeof companyReceiptPackGovernanceEvent.$inferInsert, 'masterFn' | 'companyFn'>,
) {
  await exec.insert(companyReceiptPackGovernanceEvent).values({ ...scope, ...input });
}

export async function setCompanyReceiptPackLegalHoldWithin(
  exec: DB,
  scope: Scope,
  actorUserId: number,
  packId: number,
  expectedVersion: number,
  legalHold: boolean,
  reasonValue: unknown,
) {
  const reason = reasonText(reasonValue, 'legal_hold_reason');
  const pack = await lockedPack(exec, scope, packId);
  if (pack.recordVersion !== expectedVersion) {
    return conflict(
      'company_receipt_pack_record_version_conflict',
      'Receipt Pack governance state changed before this action.',
    );
  }
  if (pack.legalHold === legalHold) return pack;
  const [updated] = await exec.update(companyReceiptPack).set({
    legalHold,
    recordVersion: sql`${companyReceiptPack.recordVersion} + 1`,
  }).where(and(
    eq(companyReceiptPack.masterFn, scope.masterFn),
    eq(companyReceiptPack.companyFn, scope.companyFn),
    eq(companyReceiptPack.id, pack.id),
    eq(companyReceiptPack.recordVersion, expectedVersion),
  )).returning();
  if (!updated) {
    return conflict(
      'company_receipt_pack_record_version_conflict',
      'Receipt Pack governance state changed before this action.',
    );
  }
  await appendEvent(exec, scope, {
    packId: pack.id,
    eventType: legalHold ? 'legal_hold_set' : 'legal_hold_released',
    fromLegalHold: pack.legalHold,
    toLegalHold: legalHold,
    reason,
    actorUserId,
    recordVersion: updated.recordVersion,
  });
  return updated;
}

export async function initiateCompanyReceiptPackPurgeWithin(
  exec: DB,
  scope: Scope,
  actorUserId: number,
  packId: number,
  reasonValue: unknown,
  now = new Date(),
) {
  const reason = reasonText(reasonValue, 'purge_reason');
  const pack = await lockedPack(exec, scope, packId);
  if (pack.legalHold) {
    throw new CompanyReceiptPackGovernanceError(
      'company_receipt_pack_legal_hold',
      'Legal hold blocks permanent Receipt Pack purge.',
    );
  }
  if (pack.retentionUntil.getTime() > now.getTime()) {
    throw new CompanyReceiptPackGovernanceError(
      'company_receipt_pack_retention_active',
      'Receipt Pack retention has not expired.',
    );
  }
  const [existing] = await exec.select({ id: companyReceiptPackPurgeRequest.id })
    .from(companyReceiptPackPurgeRequest)
    .where(and(
      eq(companyReceiptPackPurgeRequest.masterFn, scope.masterFn),
      eq(companyReceiptPackPurgeRequest.companyFn, scope.companyFn),
      eq(companyReceiptPackPurgeRequest.packId, pack.id),
    )).limit(1);
  if (existing) {
    throw new CompanyReceiptPackGovernanceError(
      'company_receipt_pack_purge_request_exists',
      'This Receipt Pack already has a purge request.',
    );
  }
  const [request] = await exec.insert(companyReceiptPackPurgeRequest).values({
    ...scope,
    packId: pack.id,
    packKeyHash: await hash(pack.packKey),
    sourceSha256: pack.sourceSha256,
    retentionUntil: pack.retentionUntil,
    initiatedByUserId: actorUserId,
    initiatedAt: now,
    createdAt: now,
    updatedAt: now,
  }).returning();
  await appendEvent(exec, scope, {
    packId: pack.id,
    eventType: 'purge_requested',
    reason,
    actorUserId,
    recordVersion: pack.recordVersion,
  });
  return request;
}

export async function reviewCompanyReceiptPackPurgeWithin(
  exec: DB,
  scope: Scope,
  reviewerUserId: number,
  requestId: number,
  expectedVersion: number,
  decision: 'approve' | 'reject',
  reasonValue: unknown,
  now = new Date(),
) {
  const reason = reasonText(reasonValue, 'purge_review_reason');
  const [request] = await exec.select().from(companyReceiptPackPurgeRequest).where(and(
    eq(companyReceiptPackPurgeRequest.masterFn, scope.masterFn),
    eq(companyReceiptPackPurgeRequest.companyFn, scope.companyFn),
    eq(companyReceiptPackPurgeRequest.id, requestId),
  )).limit(1).for('update');
  if (!request) {
    throw new CompanyReceiptPackGovernanceError(
      'company_receipt_pack_purge_request_missing',
      'Receipt Pack purge request is unavailable.',
      404,
    );
  }
  if (request.status !== 'pending_finance' || request.version !== expectedVersion) {
    return conflict(
      'company_receipt_pack_purge_request_conflict',
      'Receipt Pack purge request is no longer pending at this version.',
    );
  }
  if (request.initiatedByUserId === reviewerUserId) {
    throw new CompanyReceiptPackGovernanceError(
      'company_receipt_pack_purge_two_person_required',
      'Purge review must be performed by a different user.',
      403,
    );
  }
  const pack = await lockedPack(exec, scope, request.packId);
  if (decision === 'approve') {
    if (pack.legalHold) {
      throw new CompanyReceiptPackGovernanceError(
        'company_receipt_pack_legal_hold',
        'Legal hold blocks permanent Receipt Pack purge.',
      );
    }
    if (pack.retentionUntil.getTime() > now.getTime()) {
      throw new CompanyReceiptPackGovernanceError(
        'company_receipt_pack_retention_active',
        'Receipt Pack retention has not expired.',
      );
    }
  }
  const [updated] = await exec.update(companyReceiptPackPurgeRequest).set({
    status: decision === 'approve' ? 'approved' : 'rejected',
    reviewedByUserId: reviewerUserId,
    reviewReason: reason,
    reviewedAt: now,
    version: sql`${companyReceiptPackPurgeRequest.version} + 1`,
    updatedAt: now,
  }).where(and(
    eq(companyReceiptPackPurgeRequest.id, request.id),
    eq(companyReceiptPackPurgeRequest.version, expectedVersion),
  )).returning();
  if (!updated) {
    return conflict(
      'company_receipt_pack_purge_request_conflict',
      'Receipt Pack purge request changed before this review was recorded.',
    );
  }
  await appendEvent(exec, scope, {
    packId: pack.id,
    eventType: decision === 'approve' ? 'purge_approved' : 'purge_rejected',
    reason,
    actorUserId: reviewerUserId,
    recordVersion: pack.recordVersion,
  });
  return updated;
}

export async function executeCompanyReceiptPackPurge(
  db: DB,
  scope: Scope,
  actorUserId: number,
  packId: number,
  requestId: number,
  expectedVersion: number,
  now = new Date(),
) {
  return withTenantTransaction(db, scope, async (tx) => {
    const [request] = await tx.select().from(companyReceiptPackPurgeRequest).where(and(
      eq(companyReceiptPackPurgeRequest.masterFn, scope.masterFn),
      eq(companyReceiptPackPurgeRequest.companyFn, scope.companyFn),
      eq(companyReceiptPackPurgeRequest.id, requestId),
    )).limit(1).for('update');
    if (!request || request.status !== 'approved'
      || request.version !== expectedVersion
      || request.packId !== packId
      || !request.reviewedByUserId) {
      return conflict(
        'company_receipt_pack_purge_request_conflict',
        'An approved, separately reviewed Receipt Pack purge request is required.',
      );
    }
    const pack = await lockedPack(tx, scope, request.packId);
    if (pack.legalHold) {
      throw new CompanyReceiptPackGovernanceError(
        'company_receipt_pack_legal_hold',
        'Legal hold blocks permanent Receipt Pack purge.',
      );
    }
    if (pack.retentionUntil.getTime() > now.getTime()) {
      throw new CompanyReceiptPackGovernanceError(
        'company_receipt_pack_retention_active',
        'Receipt Pack retention has not expired.',
      );
    }
    if (request.sourceSha256 !== pack.sourceSha256
      || request.packKeyHash !== await hash(pack.packKey)
      || request.retentionUntil.getTime() !== pack.retentionUntil.getTime()) {
      throw new CompanyReceiptPackGovernanceError(
        'company_receipt_pack_purge_integrity_changed',
        'Receipt Pack facts changed after purge initiation.',
      );
    }
    const [tombstone] = await tx.insert(companyReceiptPackTombstone).values({
      ...scope,
      purgeRequestId: request.id,
      originalPackId: pack.id,
      packKeyHash: request.packKeyHash,
      createdByHash: await hash(`${scope.masterFn}\0${scope.companyFn}\0${pack.createdByUserId}`),
      sourceSha256: pack.sourceSha256,
      visibility: pack.visibility,
      locale: pack.locale,
      rowCount: pack.rowCount,
      documentCount: pack.documentCount,
      retentionUntil: pack.retentionUntil,
      createdAt: pack.createdAt,
      initiatedByUserId: request.initiatedByUserId,
      reviewedByUserId: request.reviewedByUserId,
      executedByUserId: actorUserId,
      purgedAt: now,
    }).returning();
    await tx.execute(sql`
      select set_config('app.company_receipt_pack_governance_delete', 'on', true)
    `);
    await tx.delete(companyReceiptPack).where(and(
      eq(companyReceiptPack.masterFn, scope.masterFn),
      eq(companyReceiptPack.companyFn, scope.companyFn),
      eq(companyReceiptPack.id, pack.id),
    ));
    const [executed] = await tx.update(companyReceiptPackPurgeRequest).set({
      status: 'executed',
      executedByUserId: actorUserId,
      executedAt: now,
      version: sql`${companyReceiptPackPurgeRequest.version} + 1`,
      updatedAt: now,
    }).where(and(
      eq(companyReceiptPackPurgeRequest.id, request.id),
      eq(companyReceiptPackPurgeRequest.version, expectedVersion),
    )).returning();
    if (!executed) {
      return conflict(
        'company_receipt_pack_purge_request_conflict',
        'Receipt Pack purge request changed during execution.',
      );
    }
    return { request: executed, tombstone };
  });
}

export async function readCompanyReceiptPackTombstoneWithin(
  exec: DB,
  scope: Scope,
  requestId: number,
) {
  const [tombstone] = await exec.select().from(companyReceiptPackTombstone).where(and(
    eq(companyReceiptPackTombstone.masterFn, scope.masterFn),
    eq(companyReceiptPackTombstone.companyFn, scope.companyFn),
    eq(companyReceiptPackTombstone.purgeRequestId, requestId),
  )).limit(1);
  if (!tombstone) {
    throw new CompanyReceiptPackGovernanceError(
      'company_receipt_pack_tombstone_missing',
      'Receipt Pack purge tombstone is unavailable.',
      404,
    );
  }
  return tombstone;
}
