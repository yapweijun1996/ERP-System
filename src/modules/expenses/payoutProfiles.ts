import { and, desc, eq } from 'drizzle-orm';
import type { DB } from '../../data/db';
import type { Scope } from '../../data/repo';
import {
  employee,
  employeePayoutProfile,
  employeePayoutProfileEvent,
} from '../../data/schema';

export interface EncryptedPayoutEnvelope {
  v: 1;
  alg: 'A256GCM';
  iv: string;
  ciphertext: string;
  tag: string;
}

export interface PayoutDetailsInput {
  bankCountry: string;
  currency: string;
  bankCode: string;
  bankName: string;
  accountHolderName: string;
  accountNumber: string;
  swiftBic?: string | null;
}

export interface PayoutDetails {
  v: 1;
  bankCountry: string;
  currency: string;
  bankCode: string;
  bankName: string;
  accountHolderName: string;
  accountNumber: string;
  swiftBic: string | null;
}

export class PayoutProfileError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly status = 409,
    public readonly details?: Record<string, string>,
  ) {
    super(message);
    this.name = 'PayoutProfileError';
  }
}

function field(
  value: string | null | undefined,
  key: string,
  label: string,
  min: number,
  max: number,
): string {
  const result = value?.trim() ?? '';
  if (result.length < min || result.length > max) {
    throw new PayoutProfileError(
      'payout_profile_invalid',
      `${label} must contain ${min}–${max} characters.`,
      422,
      { [key]: `${label} must contain ${min}–${max} characters.` },
    );
  }
  return result;
}

function normalizeDetails(input: PayoutDetailsInput): PayoutDetails {
  const bankCountry = input.bankCountry.trim().toUpperCase();
  const currency = input.currency.trim().toUpperCase();
  const bankCode = field(input.bankCode, 'bankCode', 'Bank code', 2, 20).toUpperCase();
  const bankName = field(input.bankName, 'bankName', 'Bank name', 2, 120);
  const accountHolderName = field(
    input.accountHolderName,
    'accountHolderName',
    'Account holder name',
    2,
    160,
  ).replace(/\s+/g, ' ');
  const accountNumber = input.accountNumber.trim().replace(/[\s-]+/g, '').toUpperCase();
  const swiftBic = input.swiftBic?.trim().toUpperCase() || null;
  if (!/^[A-Z]{2}$/.test(bankCountry)) {
    throw new PayoutProfileError(
      'payout_profile_invalid',
      'Bank country must be a two-letter country code.',
      422,
      { bankCountry: 'Use a two-letter country code.' },
    );
  }
  if (!/^[A-Z]{3}$/.test(currency)) {
    throw new PayoutProfileError(
      'payout_profile_invalid',
      'Currency must be a three-letter currency code.',
      422,
      { currency: 'Use a three-letter currency code.' },
    );
  }
  if (!/^[A-Z0-9]{4,34}$/.test(accountNumber)) {
    throw new PayoutProfileError(
      'payout_profile_invalid',
      'Account number must contain 4–34 letters or digits.',
      422,
      { accountNumber: 'Use 4–34 letters or digits.' },
    );
  }
  if (swiftBic && !/^[A-Z0-9]{8}(?:[A-Z0-9]{3})?$/.test(swiftBic)) {
    throw new PayoutProfileError(
      'payout_profile_invalid',
      'SWIFT/BIC must contain 8 or 11 letters or digits.',
      422,
      { swiftBic: 'Use an 8- or 11-character SWIFT/BIC.' },
    );
  }
  return {
    v: 1,
    bankCountry,
    currency,
    bankCode,
    bankName,
    accountHolderName,
    accountNumber,
    swiftBic,
  };
}

function maskWord(value: string): string {
  if (value.length <= 1) return '•';
  return `${value[0]}${'•'.repeat(Math.min(value.length - 1, 6))}`;
}

function maskHolder(value: string): string {
  return value.split(/\s+/).filter(Boolean).map(maskWord).join(' ');
}

function maskAccount(value: string): string {
  return `${'•'.repeat(Math.min(Math.max(value.length - 4, 4), 12))}${value.slice(-4)}`;
}

function assertEnvelope(value: EncryptedPayoutEnvelope): void {
  if (
    value?.v !== 1
    || value.alg !== 'A256GCM'
    || !value.iv
    || !value.ciphertext
    || !value.tag
  ) {
    throw new PayoutProfileError(
      'payout_encryption_failed',
      'Payout details could not be encrypted.',
      503,
    );
  }
}

function maskedProfile(profile: typeof employeePayoutProfile.$inferSelect) {
  return {
    id: profile.id,
    employeeId: profile.employeeId,
    bankCountry: profile.bankCountry,
    currency: profile.currency,
    bankCode: profile.bankCode,
    bankName: profile.bankName,
    accountHolderMasked: profile.accountHolderMasked,
    accountNumberMasked: profile.accountNumberMasked,
    verificationStatus: profile.verificationStatus,
    version: profile.version,
    verifiedByUserId: profile.verifiedByUserId,
    verifiedAt: profile.verifiedAt,
    verificationReason: profile.verificationReason,
    verificationInvalidatedAt: profile.verificationInvalidatedAt,
    verificationInvalidatedReason: profile.verificationInvalidatedReason,
    createdAt: profile.createdAt,
    updatedAt: profile.updatedAt,
  };
}

async function employeeForUser(
  tx: DB,
  scope: Scope,
  userId: number,
) {
  const [owner] = await tx.select().from(employee).where(and(
    eq(employee.masterFn, scope.masterFn),
    eq(employee.companyFn, scope.companyFn),
    eq(employee.userId, userId),
    eq(employee.isActive, true),
  )).limit(1);
  if (!owner) {
    throw new PayoutProfileError(
      'employee_identity_missing',
      'This account is not linked to an active employee in the current company.',
      409,
    );
  }
  return owner;
}

async function profileForEmployee(
  tx: DB,
  scope: Scope,
  employeeId: number,
  lock = false,
) {
  const query = tx.select().from(employeePayoutProfile).where(and(
    eq(employeePayoutProfile.masterFn, scope.masterFn),
    eq(employeePayoutProfile.companyFn, scope.companyFn),
    eq(employeePayoutProfile.employeeId, employeeId),
  )).limit(1);
  const [profile] = lock ? await query.for('update') : await query;
  if (!profile) {
    throw new PayoutProfileError(
      'payout_profile_not_found',
      'Payout profile is unavailable.',
      404,
    );
  }
  return profile;
}

export async function readOwnMaskedPayoutProfileWithin(
  tx: DB,
  scope: Scope,
  ownerUserId: number,
) {
  const owner = await employeeForUser(tx, scope, ownerUserId);
  const [profile] = await tx.select().from(employeePayoutProfile).where(and(
    eq(employeePayoutProfile.masterFn, scope.masterFn),
    eq(employeePayoutProfile.companyFn, scope.companyFn),
    eq(employeePayoutProfile.employeeId, owner.id),
  )).limit(1);
  return {
    employee: {
      id: owner.id,
      employeeNo: owner.employeeNo,
      fullName: owner.fullName,
      department: owner.department,
    },
    profile: profile ? maskedProfile(profile) : null,
  };
}

export async function listMaskedPayoutProfilesWithin(
  tx: DB,
  scope: Scope,
) {
  const rows = await tx.select({
    profile: employeePayoutProfile,
    employee: {
      id: employee.id,
      employeeNo: employee.employeeNo,
      fullName: employee.fullName,
      department: employee.department,
      jobTitle: employee.jobTitle,
      isActive: employee.isActive,
    },
  }).from(employeePayoutProfile).innerJoin(employee, and(
    eq(employee.masterFn, scope.masterFn),
    eq(employee.companyFn, scope.companyFn),
    eq(employee.id, employeePayoutProfile.employeeId),
  )).where(and(
    eq(employeePayoutProfile.masterFn, scope.masterFn),
    eq(employeePayoutProfile.companyFn, scope.companyFn),
  )).orderBy(desc(employeePayoutProfile.updatedAt), desc(employeePayoutProfile.id)).limit(200);
  return rows.map((row) => ({
    employee: row.employee,
    profile: maskedProfile(row.profile),
  }));
}

export async function upsertOwnPayoutProfileWithin(
  tx: DB,
  scope: Scope,
  ownerUserId: number,
  expectedVersion: number | null,
  input: PayoutDetailsInput,
  encrypt: (
    plaintext: string,
  ) => EncryptedPayoutEnvelope | Promise<EncryptedPayoutEnvelope>,
  now = new Date(),
) {
  const owner = await employeeForUser(tx, scope, ownerUserId);
  const details = normalizeDetails(input);
  const envelope = await encrypt(JSON.stringify(details));
  assertEnvelope(envelope);
  const [existing] = await tx.select().from(employeePayoutProfile).where(and(
    eq(employeePayoutProfile.masterFn, scope.masterFn),
    eq(employeePayoutProfile.companyFn, scope.companyFn),
    eq(employeePayoutProfile.employeeId, owner.id),
  )).limit(1).for('update');
  if (existing && expectedVersion !== existing.version) {
    throw new PayoutProfileError(
      'payout_profile_version_conflict',
      'The payout profile changed before this update.',
      409,
    );
  }
  if (!existing && expectedVersion != null) {
    throw new PayoutProfileError(
      'payout_profile_version_conflict',
      'A new payout profile must not supply an existing version.',
      409,
    );
  }
  const values = {
    bankCountry: details.bankCountry,
    currency: details.currency,
    bankCode: details.bankCode,
    bankName: details.bankName,
    accountHolderMasked: maskHolder(details.accountHolderName),
    accountNumberMasked: maskAccount(details.accountNumber),
    detailsEnvelope: envelope,
    verificationStatus: 'unverified',
    verifiedByUserId: null,
    verifiedAt: null,
    verificationReason: null,
    verificationInvalidatedAt: existing?.verificationStatus === 'verified' ? now : null,
    verificationInvalidatedReason: existing?.verificationStatus === 'verified'
      ? 'Payout details changed after verification.'
      : null,
    updatedByUserId: ownerUserId,
    updatedAt: now,
  };
  const [profile] = existing
    ? await tx.update(employeePayoutProfile).set({
      ...values,
      version: existing.version + 1,
    }).where(and(
      eq(employeePayoutProfile.masterFn, scope.masterFn),
      eq(employeePayoutProfile.companyFn, scope.companyFn),
      eq(employeePayoutProfile.id, existing.id),
      eq(employeePayoutProfile.version, existing.version),
    )).returning()
    : await tx.insert(employeePayoutProfile).values({
      ...scope,
      ...values,
      employeeId: owner.id,
      version: 1,
      createdByUserId: ownerUserId,
      createdAt: now,
    }).returning();
  if (!profile) {
    throw new PayoutProfileError(
      'payout_profile_version_conflict',
      'The payout profile changed before this update.',
      409,
    );
  }
  await tx.insert(employeePayoutProfileEvent).values({
    ...scope,
    profileId: profile.id,
    employeeId: owner.id,
    actorUserId: ownerUserId,
    eventType: existing ? 'updated' : 'created',
    profileVersion: profile.version,
    reason: existing?.verificationStatus === 'verified'
      ? 'Verified payout details were replaced and require verification again.'
      : null,
    metadata: {
      changedFields: [
        'bankCountry',
        'currency',
        'bankCode',
        'bankName',
        'accountHolderName',
        'accountNumber',
        'swiftBic',
      ],
      verificationInvalidated: existing?.verificationStatus === 'verified',
    },
    occurredAt: now,
  });
  return maskedProfile(profile);
}

export async function verifyPayoutProfileWithin(
  tx: DB,
  scope: Scope,
  actorUserId: number,
  employeeId: number,
  expectedVersion: number,
  reasonValue: string,
  now = new Date(),
) {
  const reason = field(reasonValue, 'reason', 'Verification reason', 3, 500);
  const [owner] = await tx.select().from(employee).where(and(
    eq(employee.masterFn, scope.masterFn),
    eq(employee.companyFn, scope.companyFn),
    eq(employee.id, employeeId),
    eq(employee.isActive, true),
  )).limit(1);
  if (!owner) {
    throw new PayoutProfileError('employee_not_found', 'Employee is unavailable.', 404);
  }
  if (owner.userId === actorUserId) {
    throw new PayoutProfileError(
      'payout_profile_self_verification_forbidden',
      'An employee cannot verify their own payout profile.',
      403,
    );
  }
  const existing = await profileForEmployee(tx, scope, employeeId, true);
  if (existing.version !== expectedVersion) {
    throw new PayoutProfileError(
      'payout_profile_version_conflict',
      'The payout profile changed before verification.',
      409,
    );
  }
  if (existing.verificationStatus === 'verified') {
    return { profile: maskedProfile(existing), replayed: true };
  }
  const [profile] = await tx.update(employeePayoutProfile).set({
    verificationStatus: 'verified',
    verifiedByUserId: actorUserId,
    verifiedAt: now,
    verificationReason: reason,
    verificationInvalidatedAt: null,
    verificationInvalidatedReason: null,
    version: existing.version + 1,
    updatedByUserId: actorUserId,
    updatedAt: now,
  }).where(and(
    eq(employeePayoutProfile.masterFn, scope.masterFn),
    eq(employeePayoutProfile.companyFn, scope.companyFn),
    eq(employeePayoutProfile.id, existing.id),
    eq(employeePayoutProfile.version, existing.version),
  )).returning();
  if (!profile) {
    throw new PayoutProfileError(
      'payout_profile_version_conflict',
      'The payout profile changed before verification.',
      409,
    );
  }
  await tx.insert(employeePayoutProfileEvent).values({
    ...scope,
    profileId: profile.id,
    employeeId,
    actorUserId,
    eventType: 'verified',
    profileVersion: profile.version,
    reason,
    metadata: { verificationStatus: 'verified' },
    occurredAt: now,
  });
  return { profile: maskedProfile(profile), replayed: false };
}

export async function revealPayoutProfileWithin(
  tx: DB,
  scope: Scope,
  actorUserId: number,
  employeeId: number,
  purposeValue: string,
  decrypt: (
    envelope: EncryptedPayoutEnvelope,
  ) => string | Promise<string>,
  now = new Date(),
) {
  const purpose = field(purposeValue, 'purpose', 'Reveal purpose', 3, 500);
  const profile = await profileForEmployee(tx, scope, employeeId, true);
  let details: PayoutDetails;
  try {
    const plaintext = await decrypt(profile.detailsEnvelope as EncryptedPayoutEnvelope);
    details = JSON.parse(plaintext) as PayoutDetails;
  } catch {
    throw new PayoutProfileError(
      'payout_profile_decryption_failed',
      'Payout details could not be revealed.',
      503,
    );
  }
  if (
    details?.v !== 1
    || !details.bankCountry
    || !details.currency
    || !details.bankCode
    || !details.bankName
    || !details.accountHolderName
    || !details.accountNumber
  ) {
    throw new PayoutProfileError(
      'payout_profile_decryption_failed',
      'Payout details could not be revealed.',
      503,
    );
  }
  await tx.insert(employeePayoutProfileEvent).values({
    ...scope,
    profileId: profile.id,
    employeeId,
    actorUserId,
    eventType: 'revealed',
    profileVersion: profile.version,
    reason: purpose,
    metadata: { access: 'sensitive_reveal' },
    occurredAt: now,
  });
  return {
    profile: maskedProfile(profile),
    details,
    purpose,
    revealedAt: now,
  };
}

export async function readVerifiedPayoutProfileWithin(
  tx: DB,
  scope: Scope,
  employeeId: number,
) {
  const profile = await profileForEmployee(tx, scope, employeeId);
  if (profile.verificationStatus !== 'verified') {
    throw new PayoutProfileError(
      'payout_profile_unverified',
      'A verified payout profile is required.',
      409,
    );
  }
  return profile;
}
