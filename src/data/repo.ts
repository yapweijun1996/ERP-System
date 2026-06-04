// Minimal tenant-scoped query layer. Written ONCE against `DB`; runs on both adapters.
// Conventions (docs/SCALABILITY.md): explicit columns (no SELECT *), tenant-scoped by
// master_fn + company_fn, bounded with LIMIT, keyset-ready ordering.
import { and, eq, desc, lte, gt, isNull, or } from 'drizzle-orm';
import type { DB } from './db';
import { company, product, taxRule } from './schema';

export interface Scope {
  masterFn: string;
  companyFn: string;
}

/** Companies under a master (tenant root). */
export function listCompanies(db: DB, masterFn: string) {
  return db
    .select({ companyFn: company.companyFn, name: company.name, country: company.country, taxRegime: company.taxRegime })
    .from(company)
    .where(eq(company.masterFn, masterFn))
    .orderBy(company.companyFn);
}

/** Products in a tenant, explicit columns, bounded. */
export function listProducts(db: DB, scope: Scope, limit = 50) {
  return db
    .select({ id: product.id, sku: product.sku, name: product.name, uom: product.uom })
    .from(product)
    .where(and(eq(product.masterFn, scope.masterFn), eq(product.companyFn, scope.companyFn)))
    .orderBy(desc(product.id))
    .limit(limit);
}

/** Write path: add a product, return the generated id. */
export async function addProduct(db: DB, scope: Scope, sku: string, name: string, uom = 'unit') {
  const rows = await db
    .insert(product)
    .values({ masterFn: scope.masterFn, companyFn: scope.companyFn, sku, name, uom })
    .returning({ id: product.id, sku: product.sku });
  return rows[0];
}

/**
 * Effective-dated tax lookup — the rate valid on `onDate` (YYYY-MM-DD), not "today".
 * Proves the localization model: historical documents reproduce their historical rate.
 */
export async function getEffectiveTaxRate(db: DB, scope: Scope, taxCode: string, onDate: string) {
  const rows = await db
    .select({ rate: taxRule.rate, code: taxRule.taxCode, validFrom: taxRule.validFrom })
    .from(taxRule)
    .where(
      and(
        eq(taxRule.masterFn, scope.masterFn),
        eq(taxRule.companyFn, scope.companyFn),
        eq(taxRule.taxCode, taxCode),
        lte(taxRule.validFrom, onDate),
        or(isNull(taxRule.validTo), gt(taxRule.validTo, onDate)),
      ),
    )
    .orderBy(desc(taxRule.validFrom))
    .limit(1);
  return rows[0] ?? null;
}
