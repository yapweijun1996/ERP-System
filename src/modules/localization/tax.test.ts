import Decimal from 'decimal.js';
import { describe, expect, it } from 'vitest';
import { resolveTaxPostingProfile } from './tax';

describe('resolveTaxPostingProfile', () => {
  it('keeps standard-rated GST recoverable with Decimal precision', () => {
    const profile = resolveTaxPostingProfile({
      taxRegime: 'GST',
      taxClassification: 'gst_standard',
      inputTaxRecoverablePct: '100.0000',
    }, new Decimal('10.80'));

    expect(profile?.recoverableInputTax.toFixed(2)).toBe('10.80');
    expect(profile?.nonRecoverableTax.toFixed(2)).toBe('0.00');
  });

  it.each([
    ['gst_zero_rated', '0.00'],
    ['gst_exempt', '0.00'],
    ['sst_exempt', '0.00'],
  ] as const)('requires zero tax for %s', (taxClassification, taxAmount) => {
    const profile = resolveTaxPostingProfile({
      taxRegime: taxClassification.startsWith('gst_') ? 'GST' : 'SST',
      taxClassification,
      inputTaxRecoverablePct: '0.0000',
    }, taxAmount);

    expect(profile?.recoverableInputTax.toFixed(2)).toBe('0.00');
    expect(resolveTaxPostingProfile({
      taxRegime: taxClassification.startsWith('gst_') ? 'GST' : 'SST',
      taxClassification,
      inputTaxRecoverablePct: '0.0000',
    }, '0.01')).toBeNull();
  });

  it('treats Malaysian service tax as non-recoverable by default', () => {
    const profile = resolveTaxPostingProfile({
      taxRegime: 'SST',
      taxClassification: 'sst_service',
      inputTaxRecoverablePct: '0.0000',
    }, '8.00');

    expect(profile?.recoverableInputTax.toFixed(2)).toBe('0.00');
    expect(profile?.nonRecoverableTax.toFixed(2)).toBe('8.00');
  });

  it('allows positive SST recovery only for explicit deductible classification', () => {
    const profile = resolveTaxPostingProfile({
      taxRegime: 'SST',
      taxClassification: 'sst_deductible',
      inputTaxRecoverablePct: '50.0000',
    }, '8.00');

    expect(profile?.recoverableInputTax.toFixed(2)).toBe('4.00');
    expect(profile?.nonRecoverableTax.toFixed(2)).toBe('4.00');
    expect(resolveTaxPostingProfile({
      taxRegime: 'SST',
      taxClassification: 'sst_service',
      inputTaxRecoverablePct: '50.0000',
    }, '8.00')).toBeNull();
  });

  it('fails closed for legacy unclassified rules and regime mismatches', () => {
    expect(resolveTaxPostingProfile({
      taxRegime: 'GST',
      taxClassification: 'unclassified',
      inputTaxRecoverablePct: '100.0000',
    }, '9.00')).toBeNull();
    expect(resolveTaxPostingProfile({
      taxRegime: 'MY',
      taxClassification: 'gst_standard',
      inputTaxRecoverablePct: '100.0000',
    }, '9.00')).toBeNull();
  });
});
