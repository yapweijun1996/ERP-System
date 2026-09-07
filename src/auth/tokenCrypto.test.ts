import { describe, expect, it } from 'vitest';
import {
  decryptToken,
  encryptToken,
  hashOpaqueToken,
  isEncryptedToken,
  newOpaqueToken,
  parseTokenEncryptionKey,
} from './tokenCrypto';

describe('auth token encryption', () => {
  it('hashes storage tokens and encrypts delivery tokens with AES-GCM', () => {
    const token = newOpaqueToken();
    const key = parseTokenEncryptionKey(Buffer.alloc(32, 7).toString('base64'));
    const encrypted = encryptToken(token, key);
    expect(JSON.stringify(encrypted)).not.toContain(token);
    expect(hashOpaqueToken(token)).not.toContain(token);
    expect(decryptToken(encrypted, key)).toBe(token);
  });

  it('rejects invalid keys and authentication tags', () => {
    expect(() => parseTokenEncryptionKey('short')).toThrow('32-byte');
    const encrypted = encryptToken('secret', Buffer.alloc(32, 1));
    expect(() => decryptToken(encrypted, Buffer.alloc(32, 2))).toThrow();
  });

  it('accepts only the exact v1 AES-GCM envelope shape and lengths', () => {
    const encrypted = encryptToken('secret', Buffer.alloc(32, 3));
    expect(isEncryptedToken(encrypted)).toBe(true);
    expect(isEncryptedToken({ ...encrypted, secret: 'plaintext' })).toBe(false);
    expect(isEncryptedToken({ ...encrypted, iv: 'not-an-iv' })).toBe(false);
    expect(isEncryptedToken({ ...encrypted, tag: encrypted.tag.slice(0, -1) })).toBe(false);
  });
});
