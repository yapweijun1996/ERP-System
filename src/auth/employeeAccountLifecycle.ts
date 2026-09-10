import { randomBytes } from 'node:crypto';
import type { DB } from '../data/db';
import { hashPassword } from './password';
import {
  decryptToken,
  encryptToken,
  type EncryptedToken,
} from './tokenCrypto';
import {
  activeEmployeeSecret,
  createEmployeeAccount,
  resetEmployeeAccount,
  type EmployeeAccountScope,
} from '../modules/hr/employeeAccount';

const TEMPORARY_CREDENTIAL_TTL_MS = 7 * 24 * 60 * 60 * 1000;

function temporaryPassword(): string {
  return `Aria-${randomBytes(24).toString('base64url')}!`;
}

export function generateEmployeeCredential(encryptionKey: Buffer) {
  const password = temporaryPassword();
  return {
    passwordHash: hashPassword(password),
    credentialEnvelope: encryptToken(password, encryptionKey),
    expiresAt: new Date(Date.now() + TEMPORARY_CREDENTIAL_TTL_MS),
  };
}

export async function provisionEmployeeAccount(
  db: DB,
  scope: EmployeeAccountScope,
  input: { employeeId: number; username: string; actorUserId: number; requestId?: string },
  encryptionKey: Buffer,
) {
  return createEmployeeAccount(db, scope, {
    ...input,
    ...generateEmployeeCredential(encryptionKey),
  });
}

export async function resetEmployeeTemporaryPassword(
  db: DB,
  scope: EmployeeAccountScope,
  input: { employeeId: number; actorUserId: number; requestId?: string },
  encryptionKey: Buffer,
) {
  return resetEmployeeAccount(db, scope, {
    ...input,
    ...generateEmployeeCredential(encryptionKey),
  });
}

export async function revealEmployeeTemporaryPassword(
  db: DB,
  scope: EmployeeAccountScope,
  employeeId: number,
  encryptionKey: Buffer,
) {
  const secret = await activeEmployeeSecret(db, scope, employeeId);
  return {
    temporaryPassword: decryptToken(secret.credentialEnvelope as EncryptedToken, encryptionKey),
    purpose: secret.purpose,
    generation: secret.generation,
    expiresAt: secret.expiresAt,
    userId: secret.userId,
  };
}
