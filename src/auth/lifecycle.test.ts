import { describe, expect, it } from 'vitest';
import { and, eq, isNull } from 'drizzle-orm';
import { seedDemo } from '../data/seed';
import {
  appSession,
  appUser,
  master,
  outboxEvent,
  role,
  userInvitation,
} from '../data/schema';
import { freshDb } from '../test/helpers';
import { createSession, getSession } from './session';
import {
  acceptInvitation,
  confirmPasswordReset,
  createInvitation,
  requestPasswordReset,
} from './lifecycle';
import { decryptToken, type EncryptedToken } from './tokenCrypto';

const tokenEncryptionKey = Buffer.alloc(32, 3);
const options = { tokenEncryptionKey, publicUrl: 'https://erp.example.test' };

describe('invitation and password reset lifecycle', () => {
  it('rejects cross-master roles and expired invitation tokens', async () => {
    const db = await freshDb();
    await seedDemo(db);
    const [admin] = await db.select().from(appUser).where(eq(appUser.email, 'admin@acme.co'));
    await db.insert(master).values({ masterFn: 'OTHER-M', name: 'Other Master' });
    const [otherRole] = await db.insert(role).values({
      masterFn: 'OTHER-M',
      name: 'Other Role',
    }).returning({ roleId: role.roleId });
    const session = {
      userId: admin.userId,
      masterFn: admin.masterFn,
      activeCompanyFn: 'C-SG',
      email: admin.email,
      fullName: admin.fullName,
    };
    await expect(createInvitation(db, session, {
      email: 'cross-tenant@example.test',
      roleId: otherRole.roleId,
    }, 'cross-master', options)).rejects.toMatchObject({ code: 'invalid_role' });

    const [viewerRole] = await db.select().from(role).where(eq(role.name, 'Viewer'));
    const issuedAt = new Date('2026-01-01T00:00:00.000Z');
    const invitation = await createInvitation(db, session, {
      email: 'expired@example.test',
      roleId: viewerRole.roleId,
    }, 'expired-invite', options, issuedAt);
    const [event] = await db.select().from(outboxEvent)
      .where(eq(outboxEvent.aggregateId, String(invitation.id)));
    const token = decryptToken(
      (event.payload as { token: EncryptedToken }).token,
      tokenEncryptionKey,
    );
    await expect(acceptInvitation(db, {
      token,
      fullName: 'Expired User',
      password: 'new-password',
    }, 'expired-accept', new Date('2026-01-04T00:00:01.000Z')))
      .rejects.toMatchObject({ code: 'invitation_invalid' });
  });

  it('creates an encrypted invitation and accepts it only once', async () => {
    const db = await freshDb();
    await seedDemo(db);
    const [admin] = await db.select().from(appUser).where(eq(appUser.email, 'admin@acme.co'));
    const [viewerRole] = await db.select().from(role).where(eq(role.name, 'Viewer'));
    const invitation = await createInvitation(db, {
      userId: admin.userId,
      masterFn: admin.masterFn,
      activeCompanyFn: 'C-SG',
      email: admin.email,
      fullName: admin.fullName,
    }, {
      email: 'new.user@example.test',
      roleId: viewerRole.roleId,
    }, 'invite-test', options);

    const [stored] = await db.select().from(userInvitation)
      .where(eq(userInvitation.id, invitation.id));
    const [event] = await db.select().from(outboxEvent)
      .where(eq(outboxEvent.aggregateId, String(invitation.id)));
    const token = decryptToken(
      (event.payload as { token: EncryptedToken }).token,
      tokenEncryptionKey,
    );
    expect(stored.tokenHash).not.toContain(token);
    expect(JSON.stringify(event.payload)).not.toContain(token);

    const accepted = await acceptInvitation(db, {
      token,
      fullName: 'New User',
      password: 'new-password',
      language: 'vi',
    }, 'accept-test');
    expect(accepted.email).toBe('new.user@example.test');
    const [created] = await db.select().from(appUser)
      .where(eq(appUser.userId, accepted.userId));
    expect(created).toMatchObject({ fullName: 'New User', language: 'vi' });
    await expect(acceptInvitation(db, {
      token,
      fullName: 'Replay',
      password: 'new-password',
    }, 'accept-replay')).rejects.toMatchObject({ code: 'invitation_invalid' });
  });

  it('resets a known user without exposing unknown users and revokes sessions', async () => {
    const db = await freshDb();
    await seedDemo(db);
    const [admin] = await db.select().from(appUser).where(eq(appUser.email, 'admin@acme.co'));
    const session = await createSession(db, {
      userId: admin.userId,
      masterFn: admin.masterFn,
      activeCompanyFn: 'C-SG',
      email: admin.email,
      fullName: admin.fullName,
    });
    await requestPasswordReset(db, 'missing@example.test', 'missing-reset', options);
    expect(await db.select().from(outboxEvent)).toHaveLength(0);

    await requestPasswordReset(db, admin.email, 'reset-test', options);
    const [event] = await db.select().from(outboxEvent)
      .where(eq(outboxEvent.topic, 'auth.password-reset.requested'));
    const token = decryptToken(
      (event.payload as { token: EncryptedToken }).token,
      tokenEncryptionKey,
    );
    await confirmPasswordReset(db, token, 'changed-password', 'confirm-test');
    expect(await getSession(db, session.sessionId)).toBeNull();
    const activeSessions = await db.select().from(appSession).where(and(
      eq(appSession.userId, admin.userId),
      isNull(appSession.revokedAt),
    ));
    expect(activeSessions).toHaveLength(0);
    await expect(confirmPasswordReset(
      db,
      token,
      'changed-password',
      'confirm-replay',
    )).rejects.toMatchObject({ code: 'reset_invalid' });
  });
});
