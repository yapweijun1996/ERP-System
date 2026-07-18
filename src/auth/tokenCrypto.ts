import {
  createCipheriv,
  createDecipheriv,
  randomBytes,
} from 'node:crypto';
import { hashSecret } from './session';

export interface EncryptedToken {
  v: 1;
  alg: 'A256GCM';
  iv: string;
  ciphertext: string;
  tag: string;
}

export function newOpaqueToken(bytes = 32): string {
  return randomBytes(bytes).toString('base64url');
}

export function hashOpaqueToken(token: string): string {
  return hashSecret(token);
}

export function parseTokenEncryptionKey(value: string): Buffer {
  const trimmed = value.trim();
  const key = /^[a-f0-9]{64}$/i.test(trimmed)
    ? Buffer.from(trimmed, 'hex')
    : Buffer.from(trimmed, 'base64');
  if (key.length !== 32) {
    throw new Error('ERP_TOKEN_ENCRYPTION_KEY must be a 32-byte base64 or 64-character hex key');
  }
  return key;
}

export function encryptToken(token: string, key: Buffer): EncryptedToken {
  if (key.length !== 32) throw new Error('AES-256-GCM requires a 32-byte key');
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  const ciphertext = Buffer.concat([cipher.update(token, 'utf8'), cipher.final()]);
  return {
    v: 1,
    alg: 'A256GCM',
    iv: iv.toString('base64url'),
    ciphertext: ciphertext.toString('base64url'),
    tag: cipher.getAuthTag().toString('base64url'),
  };
}

export function decryptToken(envelope: EncryptedToken, key: Buffer): string {
  if (envelope.v !== 1 || envelope.alg !== 'A256GCM') {
    throw new Error('Unsupported encrypted token envelope');
  }
  const decipher = createDecipheriv(
    'aes-256-gcm',
    key,
    Buffer.from(envelope.iv, 'base64url'),
  );
  decipher.setAuthTag(Buffer.from(envelope.tag, 'base64url'));
  return Buffer.concat([
    decipher.update(Buffer.from(envelope.ciphertext, 'base64url')),
    decipher.final(),
  ]).toString('utf8');
}
