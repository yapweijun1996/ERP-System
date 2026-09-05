export interface ProductionRlsCoverage {
  schemaTables: string[];
  tenantScopedTables: string[];
  rlsTables: string[];
  explicitExemptions: string[];
  missingTenantTables: string[];
  unknownRlsTables: string[];
  malformedRlsTables: string[];
  unknownExemptions: string[];
  nonTenantExemptions: string[];
  conflictingExemptions: string[];
  duplicateRlsTables: string[];
  duplicateExemptions: string[];
}

/**
 * Parse the generated cumulative PostgreSQL schema enough to identify table
 * names and columns. The generated file contains both CREATE TABLE statements
 * and later ALTER TABLE ADD/DROP COLUMN statements.
 */
export function parseSchemaTables(sql: string): Map<string, Set<string>> {
  const tables = new Map<string, Set<string>>();
  const createTable = /CREATE TABLE (?:IF NOT EXISTS )?"([^"]+)"\s*\(([\s\S]*?)\n\);/g;
  let match: RegExpExecArray | null;

  while ((match = createTable.exec(sql))) {
    const [, tableName, body] = match;
    const columns = new Set<string>();
    for (const rawLine of body.split('\n')) {
      const line = rawLine.trim().replace(/,$/, '');
      const column = line.match(/^"([^"]+)"\s+.+$/);
      if (column && !line.startsWith('CONSTRAINT')) columns.add(column[1]);
    }
    tables.set(tableName, columns);
  }

  const addColumn = /ALTER TABLE "([^"]+)" ADD COLUMN (?:IF NOT EXISTS )?"([^"]+)"/g;
  while ((match = addColumn.exec(sql))) {
    const [, tableName, columnName] = match;
    const columns = tables.get(tableName);
    if (!columns) {
      throw new Error(`Schema adds a column to unknown table "${tableName}".`);
    }
    columns.add(columnName);
  }

  const dropColumn = /ALTER TABLE "([^"]+)" DROP COLUMN (?:IF EXISTS )?"([^"]+)"/g;
  while ((match = dropColumn.exec(sql))) {
    const [, tableName, columnName] = match;
    tables.get(tableName)?.delete(columnName);
  }

  return tables;
}

export function parseProductionRlsTables(sql: string): string[] {
  const block = sql.match(/company_tables\s+text\[\]\s*:=\s*ARRAY\[([\s\S]*?)\n\s*\];/);
  if (!block) throw new Error('Could not find the company_tables array in production-rls.sql.');
  return [...block[1].matchAll(/'([^']+)'/g)].map((entry) => entry[1]);
}

/**
 * These markers are deliberately kept in the production overlay itself. A
 * tenant-keyed infrastructure/control-plane table may be excluded, but the
 * exclusion must be explicit and reviewable next to the RLS policy.
 */
export function parseProductionRlsExemptions(sql: string): string[] {
  return [...sql.matchAll(/^\s*--\s*RLS_EXEMPT_TABLES:\s*(.+)$/gm)]
    .flatMap((entry) => entry[1].split(/[\s,]+/).filter(Boolean));
}

function duplicateNames(names: string[]): string[] {
  return [...new Set(names.filter((name, index) => names.indexOf(name) !== index))];
}

export function analyzeProductionRlsCoverage(
  schemaSql: string,
  rlsSql: string,
): ProductionRlsCoverage {
  const schema = parseSchemaTables(schemaSql);
  const schemaTables = [...schema.keys()];
  const tenantScopedTables = schemaTables.filter((tableName) => {
    const columns = schema.get(tableName)!;
    return columns.has('master_fn') && columns.has('company_fn');
  });
  const rlsTables = parseProductionRlsTables(rlsSql);
  const explicitExemptions = parseProductionRlsExemptions(rlsSql);
  const tenantScopedSet = new Set(tenantScopedTables);
  const rlsSet = new Set(rlsTables);
  const exemptionSet = new Set(explicitExemptions);

  return {
    schemaTables,
    tenantScopedTables,
    rlsTables,
    explicitExemptions,
    missingTenantTables: tenantScopedTables.filter(
      (tableName) => !rlsSet.has(tableName) && !exemptionSet.has(tableName),
    ),
    unknownRlsTables: rlsTables.filter((tableName) => !schema.has(tableName)),
    malformedRlsTables: rlsTables.filter(
      (tableName) => schema.has(tableName) && !tenantScopedSet.has(tableName),
    ),
    unknownExemptions: explicitExemptions.filter((tableName) => !schema.has(tableName)),
    nonTenantExemptions: explicitExemptions.filter(
      (tableName) => schema.has(tableName) && !tenantScopedSet.has(tableName),
    ),
    conflictingExemptions: explicitExemptions.filter((tableName) => rlsSet.has(tableName)),
    duplicateRlsTables: duplicateNames(rlsTables),
    duplicateExemptions: duplicateNames(explicitExemptions),
  };
}

export function productionRlsCoverageErrors(coverage: ProductionRlsCoverage): string[] {
  const errors: string[] = [];
  if (coverage.schemaTables.length === 0) errors.push('no schema tables were parsed');
  if (coverage.rlsTables.length === 0) errors.push('the production RLS table list is empty');
  if (coverage.missingTenantTables.length) {
    errors.push(`tenant-keyed tables missing from RLS: ${coverage.missingTenantTables.join(', ')}`);
  }
  if (coverage.unknownRlsTables.length) {
    errors.push(`RLS lists tables absent from the generated schema: ${coverage.unknownRlsTables.join(', ')}`);
  }
  if (coverage.malformedRlsTables.length) {
    errors.push(`RLS lists tables without both tenant keys: ${coverage.malformedRlsTables.join(', ')}`);
  }
  if (coverage.unknownExemptions.length) {
    errors.push(`RLS exemptions are absent from the generated schema: ${coverage.unknownExemptions.join(', ')}`);
  }
  if (coverage.nonTenantExemptions.length) {
    errors.push(`RLS exemptions must have both tenant keys: ${coverage.nonTenantExemptions.join(', ')}`);
  }
  if (coverage.conflictingExemptions.length) {
    errors.push(`RLS exemptions are also listed for policy application: ${coverage.conflictingExemptions.join(', ')}`);
  }
  if (coverage.duplicateRlsTables.length) {
    errors.push(`RLS table list contains duplicates: ${coverage.duplicateRlsTables.join(', ')}`);
  }
  if (coverage.duplicateExemptions.length) {
    errors.push(`RLS exemption list contains duplicates: ${coverage.duplicateExemptions.join(', ')}`);
  }
  return errors;
}
