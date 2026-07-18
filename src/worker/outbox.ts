import { randomUUID } from 'node:crypto';
import nodemailer from 'nodemailer';
import {
  and,
  asc,
  eq,
  inArray,
  isNull,
  lt,
  lte,
  or,
  sql,
} from 'drizzle-orm';
import type { DB } from '../data/db';
import { outboxEvent } from '../data/schema';
import {
  decryptToken,
  type EncryptedToken,
} from '../auth/tokenCrypto';

export interface MailMessage {
  to: string;
  subject: string;
  text: string;
  html: string;
}

export interface MailTransport {
  send(message: MailMessage): Promise<void>;
}

interface AuthMailPayload {
  to: string;
  template: 'user-invitation' | 'password-reset';
  token: EncryptedToken;
  actionUrl: string;
  expiresAt: string;
}

export interface OutboxWorkerOptions {
  tokenEncryptionKey: Buffer;
  workerId?: string;
  batchSize?: number;
  leaseMs?: number;
  now?: Date;
}

function isAuthMailPayload(value: unknown): value is AuthMailPayload {
  if (!value || typeof value !== 'object') return false;
  const payload = value as Partial<AuthMailPayload>;
  return typeof payload.to === 'string'
    && (payload.template === 'user-invitation' || payload.template === 'password-reset')
    && typeof payload.actionUrl === 'string'
    && typeof payload.expiresAt === 'string'
    && Boolean(payload.token && typeof payload.token === 'object');
}

function renderAuthMail(payload: AuthMailPayload, rawToken: string): MailMessage {
  // Keep bearer tokens in the URL fragment: browsers do not send fragments in
  // HTTP requests, reverse-proxy access logs or Referer headers.
  const link = `${payload.actionUrl}#token=${encodeURIComponent(rawToken)}`;
  const invitation = payload.template === 'user-invitation';
  const subject = invitation ? 'You are invited to Aria ERP' : 'Reset your Aria ERP password';
  const action = invitation ? 'Accept invitation' : 'Reset password';
  const text = `${subject}\n\n${action}: ${link}\n\nThis link expires at ${payload.expiresAt}.`;
  const html = [
    `<h1>${subject}</h1>`,
    `<p><a href="${link.replaceAll('&', '&amp;').replaceAll('"', '&quot;')}">${action}</a></p>`,
    `<p>This link expires at ${payload.expiresAt}.</p>`,
  ].join('');
  return { to: payload.to, subject, text, html };
}

async function claimBatch(
  db: DB,
  workerId: string,
  batchSize: number,
  now: Date,
  leaseMs: number,
) {
  const expiredLease = new Date(now.getTime() - leaseMs);
  return db.transaction(async (tx) => {
    const rows = await tx.select({
      id: outboxEvent.id,
      topic: outboxEvent.topic,
      payload: outboxEvent.payload,
      attempts: outboxEvent.attempts,
    }).from(outboxEvent)
      .where(and(
        isNull(outboxEvent.deliveredAt),
        lte(outboxEvent.availableAt, now),
        or(isNull(outboxEvent.lockedAt), lt(outboxEvent.lockedAt, expiredLease)),
      ))
      .orderBy(asc(outboxEvent.id))
      .limit(batchSize)
      .for('update', { skipLocked: true });
    if (rows.length === 0) return rows;
    await tx.update(outboxEvent).set({
      lockedAt: now,
      lockedBy: workerId,
      lastAttemptAt: now,
      attempts: sql`${outboxEvent.attempts} + 1`,
    }).where(inArray(outboxEvent.id, rows.map((row) => row.id)));
    return rows;
  });
}

export async function processOutboxBatch(
  db: DB,
  transport: MailTransport,
  options: OutboxWorkerOptions,
): Promise<{ claimed: number; delivered: number; failed: number }> {
  const now = options.now ?? new Date();
  const workerId = options.workerId ?? `outbox-${randomUUID()}`;
  const rows = await claimBatch(
    db,
    workerId,
    Math.min(Math.max(options.batchSize ?? 25, 1), 100),
    now,
    options.leaseMs ?? 5 * 60 * 1000,
  );
  let delivered = 0;
  let failed = 0;
  for (const row of rows) {
    try {
      if (
        !['auth.invitation.created', 'auth.password-reset.requested'].includes(row.topic)
        || !isAuthMailPayload(row.payload)
      ) {
        throw new Error(`Unsupported outbox topic or payload: ${row.topic}`);
      }
      const rawToken = decryptToken(row.payload.token, options.tokenEncryptionKey);
      await transport.send(renderAuthMail(row.payload, rawToken));
      await db.update(outboxEvent).set({
        deliveredAt: now,
        lockedAt: null,
        lockedBy: null,
        lastError: null,
        payload: {
          redacted: true,
          to: row.payload.to,
          template: row.payload.template,
          expiresAt: row.payload.expiresAt,
        },
      }).where(and(
        eq(outboxEvent.id, row.id),
        eq(outboxEvent.lockedBy, workerId),
        isNull(outboxEvent.deliveredAt),
      ));
      delivered += 1;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      const attempt = row.attempts + 1;
      const delayMs = Math.min(60 * 60 * 1000, 2 ** Math.min(attempt, 10) * 1000);
      await db.update(outboxEvent).set({
        lockedAt: null,
        lockedBy: null,
        availableAt: new Date(now.getTime() + delayMs),
        lastError: message.slice(0, 1000),
      }).where(and(
        eq(outboxEvent.id, row.id),
        eq(outboxEvent.lockedBy, workerId),
        isNull(outboxEvent.deliveredAt),
      ));
      failed += 1;
    }
  }
  return { claimed: rows.length, delivered, failed };
}

export function createSmtpTransportFromEnv(env = process.env): MailTransport {
  const host = env.SMTP_HOST;
  const from = env.SMTP_FROM;
  if (!host || !from) {
    throw new Error('SMTP_HOST and SMTP_FROM are required for the outbox worker');
  }
  const smtp = nodemailer.createTransport({
    host,
    port: Number(env.SMTP_PORT) || 587,
    secure: env.SMTP_SECURE === 'true',
    auth: env.SMTP_USER
      ? { user: env.SMTP_USER, pass: env.SMTP_PASSWORD }
      : undefined,
  });
  return {
    async send(message) {
      await smtp.sendMail({ ...message, from });
    },
  };
}
