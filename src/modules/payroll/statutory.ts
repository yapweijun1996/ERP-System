// Payroll -- per-country statutory contribution approximations (SG CPF, MY EPF/
// SOCSO/EIS/PCB). Deliberately simple flat-rate approximations, not the real
// gazetted bracket/wage-band tables (see docs/EPICS.md EPIC-026): no age-banded
// CPF tiers (employee has no date-of-birth field to key them on), no RM5,000 EPF
// employer-rate step, no progressive PCB schedule, no ordinary-wage ceiling. A
// later epic can deepen any of this without changing payrollRunLine's schema
// shape or this function's signature.
import { fixedUnits, fixedString } from '../inventory/decimal';

export type PayrollCountry = 'SG' | 'MY';

export interface StatutoryContributions {
  employeeStatutoryDeduction: string;
  incomeTaxDeduction: string;
  employerStatutoryContribution: string;
  employerAdditionalContribution: string;
  netPay: string;
}

interface CountryRates {
  employeeBps: bigint;
  employerBps: bigint;
  employerAdditionalBps: bigint;
  incomeTaxBps: bigint;
}

// Rates expressed in basis points (1/100 of a percent, so 10_000n = 100%) for
// exact integer math -- no floating-point rounding drift.
const RATES: Record<PayrollCountry, CountryRates> = {
  // Singapore CPF, age <=55 bracket only (no ordinary-wage ceiling modeled).
  // employerAdditionalBps approximates the Skills Development Levy (real SDL has
  // a S$2 floor / S$11.25 ceiling, not modeled here). Singapore does not
  // withhold monthly income tax on resident payroll the way Malaysia's PCB
  // does, so incomeTaxBps is correctly zero, not a fabricated figure.
  SG: {
    employeeBps: 2000n, employerBps: 1700n, employerAdditionalBps: 25n, incomeTaxBps: 0n,
  },
  // Malaysia EPF, below the RM5,000 employer-rate step (flat 12% modeled
  // throughout, not the real two-tier schedule). employerAdditionalBps
  // approximates combined employer-side SOCSO + EIS (both are really
  // wage-banded, not flat). incomeTaxBps approximates PCB as a flat rate, not
  // the real progressive monthly schedule.
  MY: {
    employeeBps: 1100n, employerBps: 1200n, employerAdditionalBps: 215n, incomeTaxBps: 300n,
  },
};

function applyBps(baseUnits: bigint, bps: bigint): bigint {
  return (baseUnits * bps + 5000n) / 10000n; // round half up
}

/**
 * Computes one payroll line's statutory figures from a flat base salary. Pure
 * and synchronous -- no DB access -- so it can be called identically from
 * createPayrollRunWithin (real run) and src/data/seed.ts (seeded posted runs)
 * without risking arithmetic drift between the two.
 */
export function computeStatutoryContributions(
  country: PayrollCountry,
  baseSalary: string,
): StatutoryContributions {
  const rates = RATES[country];
  if (!rates) throw new RangeError(`No statutory scheme configured for country '${country}'`);
  const baseCents = fixedUnits(baseSalary, 2);
  const employeeCents = applyBps(baseCents, rates.employeeBps);
  const employerCents = applyBps(baseCents, rates.employerBps);
  const employerAdditionalCents = applyBps(baseCents, rates.employerAdditionalBps);
  const incomeTaxCents = applyBps(baseCents, rates.incomeTaxBps);
  const netCents = baseCents - employeeCents - incomeTaxCents;
  return {
    employeeStatutoryDeduction: fixedString(employeeCents, 2),
    incomeTaxDeduction: fixedString(incomeTaxCents, 2),
    employerStatutoryContribution: fixedString(employerCents, 2),
    employerAdditionalContribution: fixedString(employerAdditionalCents, 2),
    netPay: fixedString(netCents, 2),
  };
}
