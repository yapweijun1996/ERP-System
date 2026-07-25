import { describe, expect, it } from 'vitest';
import { appUser, master } from '../data/schema';
import { freshDb } from '../test/helpers';
import {
  isValidOrganizationCode,
  isValidUsername,
  normalizeOrganizationCode,
  normalizeUsername,
  usernameFromEmail,
} from './identifiers';

describe('organization login identifiers', () => {
  it('normalizes organization codes and usernames deterministically', () => {
    expect(normalizeOrganizationCode(' acme-sg ')).toBe('ACME-SG');
    expect(normalizeUsername(' Employee.1001 ')).toBe('employee.1001');
    expect(isValidOrganizationCode('ACME-SG')).toBe(true);
    expect(isValidOrganizationCode('A')).toBe(false);
    expect(isValidUsername('employee.1001')).toBe(true);
    expect(isValidUsername('Employee 1001')).toBe(false);
  });

  it('derives a migration-safe username from an email local part', () => {
    expect(usernameFromEmail('Admin.User@example.test')).toBe('admin.user');
    expect(usernameFromEmail('++@example.test')).toBe('user-account');
  });

  it('allows the same username in different organizations but rejects local duplicates', async () => {
    const db = await freshDb();
    await db.insert(master).values([
      { masterFn: 'M-A', loginCode: 'ORG-A', name: 'Organization A' },
      { masterFn: 'M-B', loginCode: 'ORG-B', name: 'Organization B' },
    ]);
    await db.insert(appUser).values([
      { masterFn: 'M-A', username: 'employee', passwordHash: 'test-hash' },
      { masterFn: 'M-B', username: 'employee', passwordHash: 'test-hash' },
    ]);
    await expect(db.insert(appUser).values({
      masterFn: 'M-A',
      username: 'employee',
      passwordHash: 'test-hash',
    })).rejects.toThrow();
    await expect(db.insert(master).values({
      masterFn: 'M-C',
      loginCode: 'ORG-A',
      name: 'Organization C',
    })).rejects.toThrow();
  });
});
