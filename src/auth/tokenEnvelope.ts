export interface EncryptedToken {
  v: 1;
  alg: 'A256GCM';
  iv: string;
  ciphertext: string;
  tag: string;
}

function decodedByteLength(value: string): number {
  return Math.floor(value.length * 6 / 8);
}

/**
 * Validate the persisted encrypted-token envelope without importing server-only
 * crypto APIs. This keeps format validation reusable from browser-safe code.
 */
export function isEncryptedToken(value: unknown): value is EncryptedToken {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const candidate = value as Partial<EncryptedToken>;
  const keys = Object.keys(value);
  const exactKeys = ['v', 'alg', 'iv', 'ciphertext', 'tag'];
  if (keys.length !== exactKeys.length || exactKeys.some((key) => !keys.includes(key))) return false;
  if (
    candidate.v !== 1
    || candidate.alg !== 'A256GCM'
    || typeof candidate.iv !== 'string'
    || typeof candidate.ciphertext !== 'string'
    || typeof candidate.tag !== 'string'
    || !/^[A-Za-z0-9_-]+$/.test(candidate.iv)
    || !/^[A-Za-z0-9_-]*$/.test(candidate.ciphertext)
    || !/^[A-Za-z0-9_-]+$/.test(candidate.tag)
    || candidate.iv.length % 4 === 1
    || candidate.ciphertext.length % 4 === 1
    || candidate.tag.length % 4 === 1
  ) return false;
  return decodedByteLength(candidate.iv) === 12
    && decodedByteLength(candidate.tag) === 16;
}
