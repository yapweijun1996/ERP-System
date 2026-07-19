// Straight-line depreciation math. Unlike inventory/decimal.ts's roundedMoneyUnits
// (quantity × unit-cost = money), this is a division problem: depreciable amount
// spread evenly over the useful life in months. The recurring monthly amount uses
// floor division; the caller is responsible for capping the final period at whatever
// remains so the asset never depreciates below its residual value (remainder
// absorption happens at the run-line level, not here).
import { fixedUnits, fixedString } from '../inventory/decimal';

export function straightLineMonthly(
  cost: string | number,
  residualValue: string | number,
  usefulLifeYears: number,
): string {
  const costCents = fixedUnits(cost, 2);
  const residualCents = fixedUnits(residualValue, 2);
  const depreciableCents = costCents - residualCents;
  const totalMonths = BigInt(Math.max(1, Math.round(usefulLifeYears * 12)));
  if (depreciableCents <= 0n) return '0.00';
  const monthlyCents = depreciableCents / totalMonths;
  return fixedString(monthlyCents, 2);
}
