import { and, eq } from 'drizzle-orm';
import type { DB } from '../../data/db';
import { company, companyProfile } from '../../data/schema';
import { appendAudit } from '../../api/audit';

export interface CompanyProfileScope { masterFn: string; companyFn: string }
export interface CompanyProfileActor { userId: number; requestId: string }

export class CompanyProfileError extends Error {
  constructor(public readonly code: string, message: string) { super(message); }
}

export interface UpdateCompanyProfileInput {
  name: unknown;
  registrationNo: unknown;
  taxNo: unknown;
  addressLine1: unknown;
  addressLine2: unknown;
  city: unknown;
  region: unknown;
  postalCode: unknown;
  logoDataUrl?: unknown;
  expectedVersion: unknown;
}

const LOGO_MAX_BYTES = 256 * 1024;

function profileText(value: unknown, field: string, max: number, required = false): string {
  if (typeof value !== 'string') throw new CompanyProfileError('invalid_profile', `${field} must be text.`);
  const normalized = value.trim();
  const hasControlCharacter = Array.from(normalized).some((character) => {
    const code = character.charCodeAt(0);
    return code < 32 || code === 127;
  });
  if ((required && !normalized) || normalized.length > max || hasControlCharacter) {
    throw new CompanyProfileError('invalid_profile', `${field} is invalid or too long.`);
  }
  return normalized;
}

function validatedLogo(value: unknown): string | null {
  if (value === null) return null;
  if (typeof value !== 'string') throw new CompanyProfileError('invalid_logo', 'Logo must be an image or null.');
  const match = /^data:image\/(png|jpeg|webp);base64,([A-Za-z0-9+/=]+)$/.exec(value);
  if (!match || !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(match[2])) {
    throw new CompanyProfileError('invalid_logo', 'Logo must be a PNG, JPEG or WebP image.');
  }
  const encoded = match[2];
  const byteLength = encoded.length / 4 * 3 - (encoded.endsWith('==') ? 2 : encoded.endsWith('=') ? 1 : 0);
  if (byteLength < 12 || byteLength > LOGO_MAX_BYTES) {
    throw new CompanyProfileError('invalid_logo_size', 'Logo must be at most 256 KiB.');
  }
  let bytes: string;
  try { bytes = atob(encoded); } catch {
    throw new CompanyProfileError('invalid_logo', 'Logo image data is invalid.');
  }
  const starts = (...values: number[]) => values.every((byte, index) => bytes.charCodeAt(index) === byte);
  const valid = match[1] === 'png'
    ? starts(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a)
    : match[1] === 'jpeg'
      ? starts(0xff, 0xd8, 0xff)
      : starts(0x52, 0x49, 0x46, 0x46)
        && bytes.slice(8, 12) === 'WEBP';
  if (!valid) throw new CompanyProfileError('invalid_logo', 'Logo bytes do not match the image type.');
  return value;
}

export async function readCompanyProfileWithin(exec: DB, scope: CompanyProfileScope) {
  const [tenant] = await exec.select({
    companyFn: company.companyFn,
    name: company.name,
    country: company.country,
    currency: company.currency,
    taxRegime: company.taxRegime,
    locale: company.locale,
    fiscalYearStart: company.fiscalYearStart,
  }).from(company).where(and(
    eq(company.masterFn, scope.masterFn), eq(company.companyFn, scope.companyFn),
  )).limit(1);
  if (!tenant) throw new CompanyProfileError('company_not_found', 'Active company not found.');
  const [profile] = await exec.select().from(companyProfile).where(and(
    eq(companyProfile.masterFn, scope.masterFn), eq(companyProfile.companyFn, scope.companyFn),
  )).limit(1);
  return {
    ...tenant,
    registrationNo: profile?.registrationNo ?? '',
    taxNo: profile?.taxNo ?? '',
    addressLine1: profile?.addressLine1 ?? '',
    addressLine2: profile?.addressLine2 ?? '',
    city: profile?.city ?? '',
    region: profile?.region ?? '',
    postalCode: profile?.postalCode ?? '',
    logoDataUrl: profile?.logoDataUrl ?? null,
    profileVersion: profile?.version ?? 0,
  };
}

export async function updateCompanyProfileWithin(
  exec: DB, scope: CompanyProfileScope, actor: CompanyProfileActor, input: UpdateCompanyProfileInput,
) {
  const values = {
    name: profileText(input.name, 'Company name', 160, true),
    registrationNo: profileText(input.registrationNo, 'Registration number', 80),
    taxNo: profileText(input.taxNo, 'Tax number', 80),
    addressLine1: profileText(input.addressLine1, 'Address line 1', 160),
    addressLine2: profileText(input.addressLine2, 'Address line 2', 160),
    city: profileText(input.city, 'City', 100),
    region: profileText(input.region, 'State or region', 100),
    postalCode: profileText(input.postalCode, 'Postal code', 20),
  };
  const { name, ...profileValues } = values;
  const expectedVersion = input.expectedVersion;
  if (!Number.isSafeInteger(expectedVersion) || (expectedVersion as number) < 0) {
    throw new CompanyProfileError('invalid_profile_version', 'Profile version must be a non-negative integer.');
  }
  const [tenant] = await exec.select({ name: company.name }).from(company).where(and(
    eq(company.masterFn, scope.masterFn), eq(company.companyFn, scope.companyFn),
  )).limit(1).for('update');
  if (!tenant) throw new CompanyProfileError('company_not_found', 'Active company not found.');
  const [before] = await exec.select().from(companyProfile).where(and(
    eq(companyProfile.masterFn, scope.masterFn), eq(companyProfile.companyFn, scope.companyFn),
  )).limit(1);
  if ((before?.version ?? 0) !== expectedVersion) {
    throw new CompanyProfileError('profile_version_conflict', 'Company profile changed. Reload before saving.');
  }
  const logoDataUrl = input.logoDataUrl === undefined
    ? before?.logoDataUrl ?? null
    : validatedLogo(input.logoDataUrl);
  const version = (before?.version ?? 0) + 1;
  if (tenant.name !== name) {
    await exec.update(company).set({ name, updatedAt: new Date() }).where(and(
      eq(company.masterFn, scope.masterFn), eq(company.companyFn, scope.companyFn),
    ));
  }
  if (before) {
    await exec.update(companyProfile).set({ ...profileValues, logoDataUrl, version, updatedAt: new Date() })
      .where(and(eq(companyProfile.masterFn, scope.masterFn), eq(companyProfile.companyFn, scope.companyFn)));
  } else {
    await exec.insert(companyProfile).values({ ...scope, ...profileValues, logoDataUrl, version });
  }
  const safeBefore = before ? {
    name: tenant.name, registrationNo: before.registrationNo, taxNo: before.taxNo,
    addressLine1: before.addressLine1, addressLine2: before.addressLine2,
    city: before.city, region: before.region, postalCode: before.postalCode,
    logoPresent: Boolean(before.logoDataUrl), version: before.version,
  } : { name: tenant.name, version: 0 };
  await appendAudit(exec, {
    ...scope, actorUserId: actor.userId, requestId: actor.requestId,
    entity: 'company_profile', entityId: scope.companyFn, action: 'update',
    before: safeBefore,
    after: { ...values, logoPresent: Boolean(logoDataUrl), version },
  });
  return readCompanyProfileWithin(exec, scope);
}
