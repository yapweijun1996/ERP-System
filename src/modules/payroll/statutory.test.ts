import { describe, it, expect } from 'vitest';
import { computeStatutoryContributions } from './statutory';

describe('computeStatutoryContributions', () => {
  it('SG: applies CPF employee/employer rates + SDL, zero income tax withholding', () => {
    const res = computeStatutoryContributions('SG', '5000.00');
    expect(res.employeeStatutoryDeduction).toBe('1000.00'); // 20%
    expect(res.employerStatutoryContribution).toBe('850.00'); // 17%
    expect(res.employerAdditionalContribution).toBe('12.50'); // 0.25% SDL approx
    expect(res.incomeTaxDeduction).toBe('0.00'); // SG does not withhold monthly income tax
    expect(res.netPay).toBe('4000.00'); // 5000 - 1000 - 0
  });

  it('MY: applies EPF employee/employer rates + SOCSO/EIS + approximate PCB', () => {
    const res = computeStatutoryContributions('MY', '5000.00');
    expect(res.employeeStatutoryDeduction).toBe('550.00'); // 11%
    expect(res.employerStatutoryContribution).toBe('600.00'); // 12%
    expect(res.employerAdditionalContribution).toBe('107.50'); // 2.15% SOCSO+EIS approx
    expect(res.incomeTaxDeduction).toBe('150.00'); // 3% PCB approx
    expect(res.netPay).toBe('4300.00'); // 5000 - 550 - 150
  });

  it('scales correctly for a different base salary', () => {
    const res = computeStatutoryContributions('MY', '3800.00');
    expect(res.employeeStatutoryDeduction).toBe('418.00'); // 11% of 3800
    expect(res.netPay).toBe('3268.00'); // 3800 - 418 - 114
  });

  it('rejects an unconfigured country', () => {
    expect(() => computeStatutoryContributions('TH' as never, '5000.00')).toThrow(RangeError);
  });
});
