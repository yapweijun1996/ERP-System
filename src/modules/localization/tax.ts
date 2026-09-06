import Decimal from 'decimal.js';

export const TAX_CLASSIFICATIONS = [
  'gst_standard',
  'gst_zero_rated',
  'gst_exempt',
  'sst_sales',
  'sst_service',
  'sst_deductible',
  'sst_exempt',
] as const;

export type TaxClassification = typeof TAX_CLASSIFICATIONS[number];
export type TaxRegime = 'GST' | 'SST';

export interface TaxRuleFacts {
  taxRegime: string;
  taxClassification: string | null | undefined;
  inputTaxRecoverablePct: string | number | null | undefined;
}

export interface TaxPostingProfile {
  taxRegime: TaxRegime;
  taxClassification: TaxClassification;
  inputTaxRecoverablePct: Decimal;
  recoverableInputTax: Decimal;
  nonRecoverableTax: Decimal;
}

/**
 * Resolve the accounting treatment from governed tax facts. An unclassified
 * or regime-incompatible rule returns null so callers can fail closed instead
 * of inferring tax behavior from a code such as `SR` or `SV`.
 */
export function resolveTaxPostingProfile(
  rule: TaxRuleFacts,
  taxAmount: Decimal.Value,
): TaxPostingProfile | null {
  const regime = rule.taxRegime.trim().toUpperCase();
  const classification = rule.taxClassification?.trim() as TaxClassification | undefined;
  if ((regime !== 'GST' && regime !== 'SST')
    || !classification
    || !TAX_CLASSIFICATIONS.includes(classification)) {
    return null;
  }
  if ((regime === 'GST' && !classification.startsWith('gst_'))
    || (regime === 'SST' && !classification.startsWith('sst_'))) {
    return null;
  }

  let recoverablePct: Decimal;
  let tax: Decimal;
  try {
    recoverablePct = new Decimal(rule.inputTaxRecoverablePct ?? 0);
    tax = new Decimal(taxAmount);
  } catch {
    return null;
  }
  if (!recoverablePct.isFinite() || recoverablePct.lt(0) || recoverablePct.gt(100)
    || !tax.isFinite() || tax.lt(0)) {
    return null;
  }

  const zeroTaxClassification = classification === 'gst_zero_rated'
    || classification === 'gst_exempt'
    || classification === 'sst_exempt';
  if (zeroTaxClassification && !tax.isZero()) return null;
  // SST is non-recoverable by default. A positive percentage is allowed only
  // for an explicitly governed deduction classification, never for sales or
  // service tax merely because a generic Input Tax account exists.
  if (regime === 'SST'
    && recoverablePct.gt(0)
    && classification !== 'sst_deductible') {
    return null;
  }

  const recoverableInputTax = tax.mul(recoverablePct).div(100).toDecimalPlaces(2);
  return {
    taxRegime: regime,
    taxClassification: classification,
    inputTaxRecoverablePct: recoverablePct,
    recoverableInputTax,
    nonRecoverableTax: tax.minus(recoverableInputTax),
  };
}
