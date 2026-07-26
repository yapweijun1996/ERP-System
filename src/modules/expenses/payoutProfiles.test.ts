import { and, eq } from 'drizzle-orm';
import { describe, expect, it } from 'vitest';
import { decryptToken, encryptToken } from '../../auth/tokenCrypto';
import {
  appUser,
  employee,
  employeePayoutProfile,
  employeePayoutProfileEvent,
} from '../../data/schema';
import { seedDemo } from '../../data/seed';
import { withTenantTransaction } from '../../data/tenantTransaction';
import { freshDb } from '../../test/helpers';
import {
  listMaskedPayoutProfilesWithin,
  readOwnMaskedPayoutProfileWithin,
  revealPayoutProfileWithin,
  upsertOwnPayoutProfileWithin,
  verifyPayoutProfileWithin,
} from './payoutProfiles';

const scope = { masterFn: 'M1', companyFn: 'C-SG' };
const key = Buffer.alloc(32, 13);
const details = {
  bankCountry: 'SG',
  currency: 'SGD',
  bankCode: 'DBSSG',
  bankName: 'DBS Bank',
  accountHolderName: 'Marcus Silva',
  accountNumber: '123456789012',
  swiftBic: 'DBSSSGSG',
};

async function setup() {
  const db = await freshDb();
  await seedDemo(db);
  const [admin] = await db.select().from(appUser).where(eq(appUser.username, 'admin'));
  const [viewer] = await db.select().from(appUser).where(eq(appUser.username, 'viewer'));
  const [owner] = await db.select().from(employee).where(and(
    eq(employee.masterFn, scope.masterFn),
    eq(employee.companyFn, scope.companyFn),
    eq(employee.userId, viewer.userId),
  ));
  return { db, admin, viewer, owner };
}

describe('encrypted employee payout profiles', () => {
  it('stores only an AES-GCM envelope plus masked facts and audits each reveal', async () => {
    const context = await setup();
    const created = await withTenantTransaction(context.db, scope, (tx) =>
      upsertOwnPayoutProfileWithin(
        tx,
        scope,
        context.viewer.userId,
        null,
        details,
        (plaintext) => encryptToken(plaintext, key),
      ));
    expect(created).toMatchObject({
      employeeId: context.owner.id,
      accountHolderMasked: 'M••••• S••••',
      accountNumberMasked: '••••••••9012',
      verificationStatus: 'unverified',
      version: 1,
    });
    expect(JSON.stringify(created)).not.toContain(details.accountNumber);
    expect(JSON.stringify(created)).not.toContain(details.accountHolderName);

    const [stored] = await context.db.select().from(employeePayoutProfile);
    expect(JSON.stringify(stored.detailsEnvelope)).not.toContain(details.accountNumber);
    expect(JSON.stringify(stored.detailsEnvelope)).not.toContain(details.accountHolderName);
    expect(decryptToken(stored.detailsEnvelope as Parameters<typeof decryptToken>[0], key))
      .toContain(details.accountNumber);

    const own = await withTenantTransaction(context.db, scope, (tx) =>
      readOwnMaskedPayoutProfileWithin(tx, scope, context.viewer.userId));
    const queue = await withTenantTransaction(context.db, scope, (tx) =>
      listMaskedPayoutProfilesWithin(tx, scope));
    const maskedProfiles = { own: own.profile, queue: queue.map((row) => row.profile) };
    expect(JSON.stringify(maskedProfiles)).not.toContain('detailsEnvelope');
    expect(JSON.stringify(maskedProfiles)).not.toContain(details.accountNumber);
    expect(JSON.stringify(maskedProfiles)).not.toContain(details.accountHolderName);

    const firstReveal = await withTenantTransaction(context.db, scope, (tx) =>
      revealPayoutProfileWithin(
        tx,
        scope,
        context.viewer.userId,
        context.owner.id,
        'Confirm my reimbursement destination.',
        (envelope) => decryptToken(envelope, key),
      ));
    expect(firstReveal.details).toMatchObject(details);
    await withTenantTransaction(context.db, scope, (tx) =>
      revealPayoutProfileWithin(
        tx,
        scope,
        context.admin.userId,
        context.owner.id,
        'Finance verification against bank evidence.',
        (envelope) => decryptToken(envelope, key),
      ));
    const revealEvents = await context.db.select().from(employeePayoutProfileEvent)
      .where(eq(employeePayoutProfileEvent.eventType, 'revealed'));
    expect(revealEvents).toHaveLength(2);
    expect(JSON.stringify(revealEvents)).not.toContain(details.accountNumber);
    await expect(context.db.update(employeePayoutProfileEvent).set({
      reason: 'Attempt to rewrite immutable history.',
    }).where(eq(employeePayoutProfileEvent.id, revealEvents[0].id))).rejects.toThrow(
      /immutable/i,
    );
  });

  it('requires independent verification and invalidates it after every modification', async () => {
    const context = await setup();
    const created = await withTenantTransaction(context.db, scope, (tx) =>
      upsertOwnPayoutProfileWithin(
        tx,
        scope,
        context.viewer.userId,
        null,
        details,
        (plaintext) => encryptToken(plaintext, key),
      ));
    await expect(withTenantTransaction(context.db, scope, (tx) =>
      verifyPayoutProfileWithin(
        tx,
        scope,
        context.viewer.userId,
        context.owner.id,
        created.version,
        'Self verification attempt.',
      ))).rejects.toMatchObject({ code: 'payout_profile_self_verification_forbidden' });

    const verified = await withTenantTransaction(context.db, scope, (tx) =>
      verifyPayoutProfileWithin(
        tx,
        scope,
        context.admin.userId,
        context.owner.id,
        created.version,
        'Matched employee-provided bank evidence.',
      ));
    expect(verified.profile).toMatchObject({
      verificationStatus: 'verified',
      version: 2,
      verifiedByUserId: context.admin.userId,
    });

    const modified = await withTenantTransaction(context.db, scope, (tx) =>
      upsertOwnPayoutProfileWithin(
        tx,
        scope,
        context.viewer.userId,
        verified.profile.version,
        { ...details, accountNumber: '998877665544' },
        (plaintext) => encryptToken(plaintext, key),
        new Date('2026-07-26T03:00:00.000Z'),
      ));
    expect(modified).toMatchObject({
      verificationStatus: 'unverified',
      version: 3,
      verifiedByUserId: null,
      verificationInvalidatedReason: 'Payout details changed after verification.',
    });
    expect(modified.verificationInvalidatedAt).not.toBeNull();

    await expect(withTenantTransaction(context.db, scope, (tx) =>
      revealPayoutProfileWithin(
        tx,
        scope,
        context.admin.userId,
        context.owner.id,
        'Attempt with wrong encryption key.',
        (envelope) => decryptToken(envelope, Buffer.alloc(32, 99)),
      ))).rejects.toMatchObject({ code: 'payout_profile_decryption_failed' });
  });
});
