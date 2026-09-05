import { describe, expect, it } from 'vitest';
import {
  analyzeProductionRlsCoverage,
  productionRlsCoverageErrors,
} from './productionRlsCoverage';

function schemaWithTenantTables(): string {
  return [
    'CREATE TABLE IF NOT EXISTS "tenant_record" (',
    '\t"id" bigint PRIMARY KEY,',
    '\t"created_at" timestamp NOT NULL',
    ');',
    'ALTER TABLE "tenant_record" ADD COLUMN "master_fn" text NOT NULL;',
    'ALTER TABLE "tenant_record" ADD COLUMN "company_fn" text NOT NULL;',
    'CREATE TABLE "company" (',
    '\t"company_fn" text PRIMARY KEY,',
    '\t"master_fn" text NOT NULL',
    ');',
    'CREATE TABLE "app_user" (',
    '\t"master_fn" text NOT NULL',
    ');',
  ].join('\n');
}

function rlsSql(tableList: string, exemptions = 'company'): string {
  return [
    'DO $$',
    'DECLARE',
    '  company_tables text[] := ARRAY[',
    tableList,
    '  ];',
    'BEGIN',
    'END $$;',
    `-- RLS_EXEMPT_TABLES: ${exemptions}`,
  ].join('\n');
}

describe('production RLS coverage guard', () => {
  it('detects a tenant-keyed table omitted from the policy list', () => {
    const coverage = analyzeProductionRlsCoverage(schemaWithTenantTables(), rlsSql("'company'"));

    expect(coverage.tenantScopedTables).toEqual(['tenant_record', 'company']);
    expect(coverage.missingTenantTables).toEqual(['tenant_record']);
    expect(productionRlsCoverageErrors(coverage)).toContain(
      'tenant-keyed tables missing from RLS: tenant_record',
    );
  });

  it('rejects unknown, malformed and duplicate policy entries', () => {
    const coverage = analyzeProductionRlsCoverage(
      schemaWithTenantTables(),
      rlsSql("'tenant_record', 'tenant_record', 'missing_table', 'company', 'app_user'", 'company company'),
    );

    expect(coverage.unknownRlsTables).toEqual(['missing_table']);
    expect(coverage.malformedRlsTables).toEqual(['app_user']);
    expect(coverage.duplicateRlsTables).toEqual(['tenant_record']);
    expect(coverage.duplicateExemptions).toEqual(['company']);
    expect(productionRlsCoverageErrors(coverage)).toEqual(expect.arrayContaining([
      'RLS lists tables absent from the generated schema: missing_table',
      'RLS lists tables without both tenant keys: app_user',
      'RLS table list contains duplicates: tenant_record',
      'RLS exemption list contains duplicates: company',
    ]));
  });
});
