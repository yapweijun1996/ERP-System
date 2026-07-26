import { createHash } from 'node:crypto';
import Decimal from 'decimal.js';
import {
  and,
  asc,
  desc,
  eq,
  inArray,
  lte,
} from 'drizzle-orm';
import type { DB } from '../../data/db';
import type { Scope } from '../../data/repo';
import {
  company,
  taxEvidenceArtifact,
  taxEvidencePack,
  taxEvidencePackLegalHoldEvent,
  taxEvidenceReportJob,
  taxEvidenceRetentionPolicy,
  taxEvidenceSnapshot,
  taxEvidenceSnapshotDocument,
  taxEvidenceSnapshotLine,
} from '../../data/schema';
import { TaxEvidenceError } from './taxEvidence';

const statutoryYears: Record<string, number> = {
  SG: 5,
  MY: 7,
};

function sha256(value: string | Uint8Array): string {
  return createHash('sha256').update(value).digest('hex');
}

function stableKey(value: string, label: string): string {
  const normalized = value?.trim() ?? '';
  if (
    normalized.length < 8
    || normalized.length > 128
    || !/^[A-Za-z0-9][A-Za-z0-9._:-]{7,127}$/.test(normalized)
  ) {
    throw new TaxEvidenceError(
      'tax_evidence_governance_invalid',
      `${label} must be a stable 8–128 character key.`,
    );
  }
  return normalized;
}

function validDate(value: string, label: string): string {
  const normalized = value?.trim() ?? '';
  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(normalized)
    || new Date(`${normalized}T00:00:00.000Z`).toISOString().slice(0, 10)
      !== normalized
  ) {
    throw new TaxEvidenceError(
      'tax_evidence_governance_invalid',
      `${label} must use a valid YYYY-MM-DD date.`,
    );
  }
  return normalized;
}

function reason(value: string | undefined, label: string): string {
  const normalized = value?.trim() ?? '';
  if (normalized.length < 3 || normalized.length > 1_000) {
    throw new TaxEvidenceError(
      'tax_evidence_governance_invalid',
      `${label} must contain 3–1,000 characters.`,
    );
  }
  return normalized;
}

function same(left: unknown, right: unknown): boolean {
  return JSON.stringify(left) === JSON.stringify(right);
}

function retentionDeadline(periodEnd: string, years: number): Date {
  const deadline = new Date(`${periodEnd}T23:59:59.999Z`);
  deadline.setUTCFullYear(deadline.getUTCFullYear() + years);
  return deadline;
}

async function companyCountryWithin(tx: DB, scope: Scope): Promise<string> {
  const [row] = await tx.select({ country: company.country }).from(company).where(and(
    eq(company.masterFn, scope.masterFn),
    eq(company.companyFn, scope.companyFn),
  )).limit(1);
  if (!row) {
    throw new TaxEvidenceError(
      'tax_evidence_company_not_found',
      'The active legal entity is unavailable.',
      404,
    );
  }
  return row.country.toUpperCase();
}

function statutoryMinimum(countryCode: string): number {
  return statutoryYears[countryCode] ?? 5;
}

export async function configureTaxEvidenceRetentionPolicyWithin(
  tx: DB,
  scope: Scope,
  actorUserId: number,
  input: {
    policyKey: string;
    effectiveFrom: string;
    companyRetentionYears: number;
  },
  now = new Date(),
) {
  const policyKey = stableKey(input.policyKey, 'Policy key');
  const effectiveFrom = validDate(input.effectiveFrom, 'Effective date');
  const countryCode = await companyCountryWithin(tx, scope);
  const minimum = statutoryMinimum(countryCode);
  if (
    !Number.isSafeInteger(input.companyRetentionYears)
    || input.companyRetentionYears < minimum
    || input.companyRetentionYears > 50
  ) {
    throw new TaxEvidenceError(
      'tax_evidence_retention_invalid',
      `Company retention must be ${minimum}–50 whole years for ${countryCode}.`,
    );
  }
  const [existing] = await tx.select().from(taxEvidenceRetentionPolicy).where(and(
    eq(taxEvidenceRetentionPolicy.masterFn, scope.masterFn),
    eq(taxEvidenceRetentionPolicy.companyFn, scope.companyFn),
    eq(taxEvidenceRetentionPolicy.policyKey, policyKey),
  )).limit(1);
  const expected = {
    effectiveFrom,
    countryCode,
    statutoryMinimumYears: minimum,
    companyRetentionYears: input.companyRetentionYears,
    createdByUserId: actorUserId,
  };
  if (existing) {
    if (!same({
      effectiveFrom: existing.effectiveFrom,
      countryCode: existing.countryCode,
      statutoryMinimumYears: existing.statutoryMinimumYears,
      companyRetentionYears: existing.companyRetentionYears,
      createdByUserId: existing.createdByUserId,
    }, expected)) {
      throw new TaxEvidenceError(
        'tax_evidence_retention_key_conflict',
        'Policy key already exists with different facts.',
        409,
      );
    }
    return { policy: existing, replayed: true };
  }
  const [latest] = await tx.select({
    versionNo: taxEvidenceRetentionPolicy.versionNo,
  }).from(taxEvidenceRetentionPolicy).where(and(
    eq(taxEvidenceRetentionPolicy.masterFn, scope.masterFn),
    eq(taxEvidenceRetentionPolicy.companyFn, scope.companyFn),
  )).orderBy(desc(taxEvidenceRetentionPolicy.versionNo)).limit(1);
  const [policy] = await tx.insert(taxEvidenceRetentionPolicy).values({
    ...scope,
    policyKey,
    versionNo: (latest?.versionNo ?? 0) + 1,
    ...expected,
    createdAt: now,
  }).returning();
  return { policy, replayed: false };
}

async function retentionForPeriodWithin(
  tx: DB,
  scope: Scope,
  periodEnd: string,
) {
  const countryCode = await companyCountryWithin(tx, scope);
  const minimum = statutoryMinimum(countryCode);
  const [policy] = await tx.select().from(taxEvidenceRetentionPolicy).where(and(
    eq(taxEvidenceRetentionPolicy.masterFn, scope.masterFn),
    eq(taxEvidenceRetentionPolicy.companyFn, scope.companyFn),
    eq(taxEvidenceRetentionPolicy.countryCode, countryCode),
    lte(taxEvidenceRetentionPolicy.effectiveFrom, periodEnd),
  )).orderBy(
    desc(taxEvidenceRetentionPolicy.effectiveFrom),
    desc(taxEvidenceRetentionPolicy.versionNo),
  ).limit(1);
  const companyRetentionYears = Math.max(
    minimum,
    policy?.companyRetentionYears ?? minimum,
  );
  return {
    countryCode,
    statutoryMinimumYears: minimum,
    companyRetentionYears,
    retentionUntil: retentionDeadline(periodEnd, companyRetentionYears),
    policyId: policy?.id ?? null,
  };
}

type FrozenLine = typeof taxEvidenceSnapshotLine.$inferSelect;
type FrozenDocument = typeof taxEvidenceSnapshotDocument.$inferSelect;

function keyedDifference<T>(
  previous: T[],
  current: T[],
  key: (value: T) => string,
  digest: (value: T) => string,
) {
  const before = new Map(previous.map((value) => [key(value), value]));
  const after = new Map(current.map((value) => [key(value), value]));
  const added: string[] = [];
  const removed: string[] = [];
  const changed: Array<{ key: string; beforeSha256: string; afterSha256: string }> = [];
  for (const [valueKey, value] of after) {
    const prior = before.get(valueKey);
    if (!prior) added.push(valueKey);
    else if (digest(prior) !== digest(value)) {
      changed.push({
        key: valueKey,
        beforeSha256: digest(prior),
        afterSha256: digest(value),
      });
    }
  }
  for (const valueKey of before.keys()) {
    if (!after.has(valueKey)) removed.push(valueKey);
  }
  return {
    added: added.sort(),
    removed: removed.sort(),
    changed: changed.sort((left, right) => left.key.localeCompare(right.key)),
  };
}

async function snapshotFactsWithin(tx: DB, scope: Scope, snapshotId: number) {
  const [snapshot] = await tx.select().from(taxEvidenceSnapshot).where(and(
    eq(taxEvidenceSnapshot.masterFn, scope.masterFn),
    eq(taxEvidenceSnapshot.companyFn, scope.companyFn),
    eq(taxEvidenceSnapshot.id, snapshotId),
  )).limit(1);
  if (!snapshot) {
    throw new TaxEvidenceError(
      'tax_evidence_snapshot_not_found',
      'Tax evidence snapshot is unavailable.',
      404,
    );
  }
  const [lines, documents] = await Promise.all([
    tx.select().from(taxEvidenceSnapshotLine).where(and(
      eq(taxEvidenceSnapshotLine.masterFn, scope.masterFn),
      eq(taxEvidenceSnapshotLine.companyFn, scope.companyFn),
      eq(taxEvidenceSnapshotLine.snapshotId, snapshotId),
    )).orderBy(asc(taxEvidenceSnapshotLine.ordinal)),
    tx.select().from(taxEvidenceSnapshotDocument).where(and(
      eq(taxEvidenceSnapshotDocument.masterFn, scope.masterFn),
      eq(taxEvidenceSnapshotDocument.companyFn, scope.companyFn),
      eq(taxEvidenceSnapshotDocument.snapshotId, snapshotId),
    )).orderBy(asc(taxEvidenceSnapshotDocument.id)),
  ]);
  return { snapshot, lines, documents };
}

function periodEnd(snapshot: typeof taxEvidenceSnapshot.$inferSelect): string {
  const value = (snapshot.filters as { endDate?: unknown }).endDate;
  return validDate(String(value ?? ''), 'Snapshot end date');
}

function snapshotTotals(snapshot: typeof taxEvidenceSnapshot.$inferSelect) {
  return {
    rowCount: snapshot.rowCount,
    documentCount: snapshot.documentCount,
    originalGross: snapshot.originalGross,
    baseExpense: snapshot.baseExpense,
    baseInputTax: snapshot.baseInputTax,
    baseGross: snapshot.baseGross,
  };
}

function totalDifference(
  previous: typeof taxEvidenceSnapshot.$inferSelect | null,
  current: typeof taxEvidenceSnapshot.$inferSelect,
) {
  const decimal = (
    currentValue: string,
    previousValue: string | undefined,
  ) => new Decimal(currentValue).minus(previousValue ?? 0).toFixed(2);
  return {
    rowCount: current.rowCount - (previous?.rowCount ?? 0),
    documentCount: current.documentCount - (previous?.documentCount ?? 0),
    originalGross: decimal(current.originalGross, previous?.originalGross),
    baseExpense: decimal(current.baseExpense, previous?.baseExpense),
    baseInputTax: decimal(current.baseInputTax, previous?.baseInputTax),
    baseGross: decimal(current.baseGross, previous?.baseGross),
  };
}

export async function sealTaxEvidencePackWithin(
  tx: DB,
  scope: Scope,
  actorUserId: number,
  input: {
    packKey: string;
    reportJobId: number;
    supersedesPackId?: number;
    correctionReason?: string;
  },
  now = new Date(),
) {
  const packKey = stableKey(input.packKey, 'Pack key');
  const [existingByJob] = await tx.select().from(taxEvidencePack).where(and(
    eq(taxEvidencePack.masterFn, scope.masterFn),
    eq(taxEvidencePack.companyFn, scope.companyFn),
    eq(taxEvidencePack.reportJobId, input.reportJobId),
  )).limit(1);
  if (existingByJob) {
    const suppliedReason = input.correctionReason == null
      ? null
      : reason(input.correctionReason, 'Correction reason');
    if (
      existingByJob.packKey !== packKey
      || existingByJob.supersedesPackId !== (input.supersedesPackId ?? null)
      || existingByJob.sealedByUserId !== actorUserId
      || existingByJob.correctionReason !== suppliedReason
    ) {
      throw new TaxEvidenceError(
        'tax_evidence_pack_job_conflict',
        'This report job was already sealed with different facts.',
        409,
      );
    }
    return { pack: existingByJob, replayed: true };
  }
  const [job] = await tx.select().from(taxEvidenceReportJob).where(and(
    eq(taxEvidenceReportJob.masterFn, scope.masterFn),
    eq(taxEvidenceReportJob.companyFn, scope.companyFn),
    eq(taxEvidenceReportJob.id, input.reportJobId),
  )).limit(1);
  if (!job || job.status !== 'succeeded' || !job.artifactSetSha256) {
    throw new TaxEvidenceError(
      'tax_evidence_pack_job_incomplete',
      'A successful complete tax evidence report job is required.',
      409,
    );
  }
  const artifacts = await tx.select().from(taxEvidenceArtifact).where(and(
    eq(taxEvidenceArtifact.masterFn, scope.masterFn),
    eq(taxEvidenceArtifact.companyFn, scope.companyFn),
    eq(taxEvidenceArtifact.jobId, job.id),
  )).orderBy(asc(taxEvidenceArtifact.id));
  if (
    artifacts.length !== 6
    || artifacts.some((artifact) =>
      sha256(artifact.content) !== artifact.sha256
      || artifact.content.byteLength !== artifact.sizeBytes)
    || sha256(artifacts
      .map((artifact) => `${artifact.artifactType}:${artifact.sha256}`)
      .join('\n')) !== job.artifactSetSha256
  ) {
    throw new TaxEvidenceError(
      'tax_evidence_pack_integrity_failed',
      'The completed artifact set failed integrity verification.',
      409,
    );
  }
  const current = await snapshotFactsWithin(tx, scope, job.snapshotId);
  const [latest] = await tx.select().from(taxEvidencePack).where(and(
    eq(taxEvidencePack.masterFn, scope.masterFn),
    eq(taxEvidencePack.companyFn, scope.companyFn),
    eq(taxEvidencePack.packKey, packKey),
  )).orderBy(desc(taxEvidencePack.versionNo)).limit(1).for('update');
  if (!latest && input.supersedesPackId != null) {
    throw new TaxEvidenceError(
      'tax_evidence_pack_chain_conflict',
      'An initial pack cannot supersede another version.',
      409,
    );
  }
  if (!latest && input.correctionReason != null) {
    throw new TaxEvidenceError(
      'tax_evidence_pack_chain_conflict',
      'An initial pack cannot provide a correction reason.',
      409,
    );
  }
  if (latest && input.supersedesPackId !== latest.id) {
    throw new TaxEvidenceError(
      'tax_evidence_pack_chain_conflict',
      'A correction must supersede the latest sealed version.',
      409,
    );
  }
  const correctionReason = latest
    ? reason(input.correctionReason, 'Correction reason')
    : null;
  const previous = latest
    ? await snapshotFactsWithin(tx, scope, latest.snapshotId)
    : null;
  if (previous?.snapshot.sourceSha256 === current.snapshot.sourceSha256) {
    throw new TaxEvidenceError(
      'tax_evidence_pack_no_difference',
      'A correction requires a different immutable evidence snapshot.',
      409,
    );
  }
  const lineDiff = keyedDifference<FrozenLine>(
    previous?.lines ?? [],
    current.lines,
    (row) => String(row.postingId),
    (row) => row.factsSha256,
  );
  const documentDiff = keyedDifference<FrozenDocument>(
    previous?.documents ?? [],
    current.documents,
    (row) => String(row.documentVersionId),
    (row) => row.sha256,
  );
  const retention = await retentionForPeriodWithin(
    tx,
    scope,
    periodEnd(current.snapshot),
  );
  const differenceManifest = {
    schemaVersion: 1,
    packKey,
    versionNo: (latest?.versionNo ?? 0) + 1,
    supersedesPackId: latest?.id ?? null,
    previousSourceSha256: previous?.snapshot.sourceSha256 ?? null,
    currentSourceSha256: current.snapshot.sourceSha256,
    lines: lineDiff,
    documents: documentDiff,
    totalsBefore: previous ? snapshotTotals(previous.snapshot) : null,
    totalsAfter: snapshotTotals(current.snapshot),
    totalDifference: totalDifference(previous?.snapshot ?? null, current.snapshot),
    artifacts: artifacts.map((artifact) => ({
      artifactType: artifact.artifactType,
      sha256: artifact.sha256,
      sizeBytes: artifact.sizeBytes,
    })),
  };
  const differenceManifestSha256 = sha256(JSON.stringify(differenceManifest));
  const envelope = {
    packKey,
    versionNo: (latest?.versionNo ?? 0) + 1,
    snapshotId: current.snapshot.id,
    reportJobId: job.id,
    supersedesPackId: latest?.id ?? null,
    sourceSha256: current.snapshot.sourceSha256,
    artifactSetSha256: job.artifactSetSha256,
    differenceManifestSha256,
    countryCode: retention.countryCode,
    statutoryMinimumYears: retention.statutoryMinimumYears,
    companyRetentionYears: retention.companyRetentionYears,
    retentionUntil: retention.retentionUntil.toISOString(),
    correctionReason,
    sealedByUserId: actorUserId,
    sealedAt: now.toISOString(),
  };
  const [pack] = await tx.insert(taxEvidencePack).values({
    ...scope,
    ...envelope,
    retentionUntil: retention.retentionUntil,
    sealedAt: now,
    differenceManifest,
    packSha256: sha256(JSON.stringify(envelope)),
  }).returning();
  return { pack, replayed: false };
}

async function packWithin(tx: DB, scope: Scope, packId: number) {
  const [pack] = await tx.select().from(taxEvidencePack).where(and(
    eq(taxEvidencePack.masterFn, scope.masterFn),
    eq(taxEvidencePack.companyFn, scope.companyFn),
    eq(taxEvidencePack.id, packId),
  )).limit(1);
  if (!pack) {
    throw new TaxEvidenceError(
      'tax_evidence_pack_not_found',
      'Tax evidence pack is unavailable.',
      404,
    );
  }
  return pack;
}

export async function recordTaxEvidencePackLegalHoldWithin(
  tx: DB,
  scope: Scope,
  actorUserId: number,
  packId: number,
  input: {
    eventKey: string;
    action: 'placed' | 'released';
    reason: string;
  },
  now = new Date(),
) {
  await packWithin(tx, scope, packId);
  if (!['placed', 'released'].includes(input.action)) {
    throw new TaxEvidenceError(
      'tax_evidence_governance_invalid',
      'Legal-hold action must be placed or released.',
    );
  }
  const eventKey = stableKey(input.eventKey, 'Legal-hold event key');
  const eventReason = reason(input.reason, 'Legal-hold reason');
  const [existing] = await tx.select().from(taxEvidencePackLegalHoldEvent).where(and(
    eq(taxEvidencePackLegalHoldEvent.masterFn, scope.masterFn),
    eq(taxEvidencePackLegalHoldEvent.companyFn, scope.companyFn),
    eq(taxEvidencePackLegalHoldEvent.packId, packId),
    eq(taxEvidencePackLegalHoldEvent.eventKey, eventKey),
  )).limit(1);
  if (existing) {
    if (
      existing.action !== input.action
      || existing.reason !== eventReason
      || existing.actorUserId !== actorUserId
    ) {
      throw new TaxEvidenceError(
        'tax_evidence_hold_key_conflict',
        'Legal-hold event key already exists with different facts.',
        409,
      );
    }
    return { event: existing, replayed: true };
  }
  const [latest] = await tx.select().from(taxEvidencePackLegalHoldEvent).where(and(
    eq(taxEvidencePackLegalHoldEvent.masterFn, scope.masterFn),
    eq(taxEvidencePackLegalHoldEvent.companyFn, scope.companyFn),
    eq(taxEvidencePackLegalHoldEvent.packId, packId),
  )).orderBy(
    desc(taxEvidencePackLegalHoldEvent.occurredAt),
    desc(taxEvidencePackLegalHoldEvent.id),
  ).limit(1);
  const isHeld = latest?.action === 'placed';
  if ((input.action === 'placed') === isHeld) {
    throw new TaxEvidenceError(
      'tax_evidence_hold_state_conflict',
      isHeld ? 'This pack is already under legal hold.' : 'This pack is not under legal hold.',
      409,
    );
  }
  const [event] = await tx.insert(taxEvidencePackLegalHoldEvent).values({
    ...scope,
    packId,
    eventKey,
    action: input.action,
    reason: eventReason,
    actorUserId,
    occurredAt: now,
  }).returning();
  return { event, replayed: false };
}

export async function assessTaxEvidencePackPurgeWithin(
  tx: DB,
  scope: Scope,
  packId: number,
  now = new Date(),
) {
  const pack = await packWithin(tx, scope, packId);
  const chain = await tx.select({ id: taxEvidencePack.id }).from(taxEvidencePack)
    .where(and(
      eq(taxEvidencePack.masterFn, scope.masterFn),
      eq(taxEvidencePack.companyFn, scope.companyFn),
      eq(taxEvidencePack.packKey, pack.packKey),
    ));
  const latestByPack = new Map<number, typeof taxEvidencePackLegalHoldEvent.$inferSelect>();
  if (chain.length) {
    const chainIds = new Set(chain.map((row) => row.id));
    const events = await tx.select().from(taxEvidencePackLegalHoldEvent).where(and(
      eq(taxEvidencePackLegalHoldEvent.masterFn, scope.masterFn),
      eq(taxEvidencePackLegalHoldEvent.companyFn, scope.companyFn),
      inArray(taxEvidencePackLegalHoldEvent.packId, [...chainIds]),
    )).orderBy(
      asc(taxEvidencePackLegalHoldEvent.occurredAt),
      asc(taxEvidencePackLegalHoldEvent.id),
    );
    for (const event of events) {
      if (chainIds.has(event.packId)) latestByPack.set(event.packId, event);
    }
  }
  const activeHold = [...latestByPack.values()].find((event) => event.action === 'placed');
  const retentionActive = pack.retentionUntil.getTime() > now.getTime();
  return {
    packId: pack.id,
    packKey: pack.packKey,
    versionNo: pack.versionNo,
    eligible: !retentionActive && !activeHold,
    retentionUntil: pack.retentionUntil,
    retentionActive,
    legalHoldActive: Boolean(activeHold),
    blockingLegalHoldPackId: activeHold?.packId ?? null,
    basis: {
      countryCode: pack.countryCode,
      statutoryMinimumYears: pack.statutoryMinimumYears,
      companyRetentionYears: pack.companyRetentionYears,
    },
  };
}

export async function readTaxEvidencePackWithin(
  tx: DB,
  scope: Scope,
  packId: number,
) {
  const pack = await packWithin(tx, scope, packId);
  const versions = await tx.select().from(taxEvidencePack).where(and(
    eq(taxEvidencePack.masterFn, scope.masterFn),
    eq(taxEvidencePack.companyFn, scope.companyFn),
    eq(taxEvidencePack.packKey, pack.packKey),
  )).orderBy(asc(taxEvidencePack.versionNo));
  const purge = await assessTaxEvidencePackPurgeWithin(tx, scope, pack.id);
  return { pack, versions, purge };
}
