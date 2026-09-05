#!/usr/bin/env node
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  analyzeProductionRlsCoverage,
  productionRlsCoverageErrors,
} from '../src/security/productionRlsCoverage';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const schemaPath = path.join(root, 'web', 'public', 'db', 'erp-system-schema.sql');
const rlsPath = path.join(root, 'deploy', 'sql', 'production-rls.sql');

const coverage = analyzeProductionRlsCoverage(
  readFileSync(schemaPath, 'utf8'),
  readFileSync(rlsPath, 'utf8'),
);
const errors = productionRlsCoverageErrors(coverage);

if (errors.length) {
  console.error(`Production RLS coverage check failed (${errors.length} issue${errors.length === 1 ? '' : 's'}):`);
  for (const error of errors) console.error(`- ${error}`);
  process.exitCode = 1;
} else {
  console.log([
    `Production RLS coverage OK: ${coverage.rlsTables.length} policy tables`,
    `${coverage.explicitExemptions.length} explicit infrastructure exemptions`,
    `${coverage.schemaTables.length} generated schema tables`,
  ].join('; '));
}
