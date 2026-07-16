import { describe, it, expect } from 'vitest';
import { createSession, getSession, destroySession, parseCookies } from './session';

describe('session store', () => {
  it('creates a session and retrieves it by id', () => {
    const id = createSession({ userId: 1, masterFn: 'M1', email: 'a@b.com', fullName: 'A' });
    expect(getSession(id)).toEqual({ userId: 1, masterFn: 'M1', email: 'a@b.com', fullName: 'A' });
  });

  it('returns null for an unknown or undefined session id', () => {
    expect(getSession('nonexistent')).toBeNull();
    expect(getSession(undefined)).toBeNull();
  });

  it('destroySession removes the session', () => {
    const id = createSession({ userId: 2, masterFn: 'M1', email: 'b@b.com', fullName: null });
    destroySession(id);
    expect(getSession(id)).toBeNull();
  });

  it('generates a different id for each session', () => {
    const a = createSession({ userId: 3, masterFn: 'M1', email: 'c@b.com', fullName: null });
    const b = createSession({ userId: 4, masterFn: 'M1', email: 'd@b.com', fullName: null });
    expect(a).not.toBe(b);
  });
});

describe('parseCookies', () => {
  it('parses a standard cookie header', () => {
    expect(parseCookies('a=1; b=2; c=3')).toEqual({ a: '1', b: '2', c: '3' });
  });

  it('URL-decodes cookie values', () => {
    expect(parseCookies('name=hello%20world')).toEqual({ name: 'hello world' });
  });

  it('returns an empty object for an undefined or empty header', () => {
    expect(parseCookies(undefined)).toEqual({});
    expect(parseCookies('')).toEqual({});
  });

  it('ignores malformed segments without a value', () => {
    expect(parseCookies('a=1; justakey; b=2')).toEqual({ a: '1', b: '2' });
  });
});
