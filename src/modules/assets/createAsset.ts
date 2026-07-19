// Fixed Assets — register a new asset. Plain insert, no line items, mirroring
// createOpportunity.ts's shape: nothing here needs a multi-step transaction.
import { fixedUnits } from '../inventory/decimal';
import type { DB } from '../../data/db';
import type { Scope } from '../../data/repo';
import { asset, ASSET_CATEGORIES } from '../../data/schema';

export class InvalidAssetStateError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'InvalidAssetStateError';
  }
}

export interface CreateAssetInput {
  assetNo: string;
  name: string;
  category: string;
  location?: string | null;
  acquisitionDate: string; // YYYY-MM-DD
  cost: string | number;
  residualValue: string | number;
  usefulLifeYears: number;
}

export async function createAssetWithin(exec: DB, scope: Scope, input: CreateAssetInput) {
  if (!input.assetNo?.trim()) throw new InvalidAssetStateError('assetNo is required');
  if (!input.name?.trim()) throw new InvalidAssetStateError('name is required');
  if (!ASSET_CATEGORIES.includes(input.category as typeof ASSET_CATEGORIES[number])) {
    throw new InvalidAssetStateError(`category must be one of: ${ASSET_CATEGORIES.join(', ')}`);
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.acquisitionDate)) {
    throw new InvalidAssetStateError('acquisitionDate must be YYYY-MM-DD');
  }
  const costCents = fixedUnits(input.cost, 2);
  const residualCents = fixedUnits(input.residualValue, 2);
  if (costCents < 0n) throw new InvalidAssetStateError('cost must be non-negative');
  if (residualCents < 0n || residualCents > costCents) {
    throw new InvalidAssetStateError('residualValue must be between 0 and cost');
  }
  if (!Number.isFinite(input.usefulLifeYears) || input.usefulLifeYears <= 0) {
    throw new InvalidAssetStateError('usefulLifeYears must be a positive number');
  }

  const [row] = await exec.insert(asset).values({
    masterFn: scope.masterFn,
    companyFn: scope.companyFn,
    assetNo: input.assetNo.trim(),
    name: input.name.trim(),
    category: input.category,
    location: input.location?.trim() || null,
    acquisitionDate: input.acquisitionDate,
    cost: String(input.cost),
    residualValue: String(input.residualValue),
    usefulLifeYears: Math.round(input.usefulLifeYears),
    accumulatedDepreciation: '0',
    status: 'in_use',
  }).returning({ id: asset.id });
  return { id: row.id };
}

export function createAsset(db: DB, scope: Scope, input: CreateAssetInput) {
  return db.transaction((tx) => createAssetWithin(tx, scope, input));
}
