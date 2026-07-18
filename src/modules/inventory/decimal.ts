export function fixedUnits(value: string | number, scale = 4): bigint {
  const text = String(value).trim();
  const match = /^(-?)(\d+)(?:\.(\d+))?$/.exec(text);
  if (!match || (match[3]?.length ?? 0) > scale) {
    throw new RangeError(`Invalid decimal value '${text}'`);
  }
  const fraction = (match[3] ?? '').padEnd(scale, '0');
  const units = BigInt(match[2]) * (10n ** BigInt(scale)) + BigInt(fraction || '0');
  return match[1] ? -units : units;
}

export function fixedString(units: bigint, scale = 4): string {
  const negative = units < 0n;
  const absolute = negative ? -units : units;
  const divisor = 10n ** BigInt(scale);
  const whole = absolute / divisor;
  const fraction = String(absolute % divisor).padStart(scale, '0');
  return `${negative ? '-' : ''}${whole}.${fraction}`;
}

export function roundedMoneyUnits(quantityUnits: bigint, costUnits: bigint): bigint {
  const raw = quantityUnits * costUnits; // 4dp × 4dp = 8dp
  const negative = raw < 0n;
  const absolute = negative ? -raw : raw;
  const cents = (absolute + 500_000n) / 1_000_000n;
  return negative ? -cents : cents;
}

export function moneyString(cents: bigint): string {
  return fixedString(cents, 2);
}
