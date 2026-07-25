const ORGANIZATION_CODE = /^[A-Z0-9][A-Z0-9-]{2,31}$/;
const USERNAME = /^[a-z0-9][a-z0-9._-]{2,63}$/;

export function normalizeOrganizationCode(value: string): string {
  return value.trim().toUpperCase();
}

export function isValidOrganizationCode(value: string): boolean {
  return ORGANIZATION_CODE.test(normalizeOrganizationCode(value));
}

export function normalizeUsername(value: string): string {
  return value.trim().toLowerCase();
}

export function isValidUsername(value: string): boolean {
  return USERNAME.test(normalizeUsername(value));
}

export function usernameFromEmail(email: string): string {
  const local = email.trim().toLowerCase().split('@')[0] ?? '';
  const normalized = local
    .replace(/[^a-z0-9._-]+/g, '-')
    .replace(/^[^a-z0-9]+/, '')
    .slice(0, 64);
  if (isValidUsername(normalized)) return normalized;
  return `user-${normalized || 'account'}`.slice(0, 64);
}
