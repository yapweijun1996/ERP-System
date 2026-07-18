import { and, eq, sql } from 'drizzle-orm';
import type { DB } from '../../data/db';
import type { Scope } from '../../data/repo';
import {
  inventoryLot,
  inventorySerial,
  product,
  warehouse,
  warehouseBin,
} from '../../data/schema';

export class InventoryTrackingError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'InventoryTrackingError';
  }
}

export interface TrackingSelection {
  binId?: number;
  lotId?: number;
  serialId?: number;
}

export interface ResolvedTracking {
  trackingType: 'none' | 'lot' | 'serial';
  trackingKey: string;
  binId: number;
  lotId: number | null;
  serialId: number | null;
}

export async function ensureDefaultBinWithin(
  exec: DB,
  scope: Scope,
  warehouseId: number,
): Promise<number> {
  const [location] = await exec.select({ id: warehouse.id }).from(warehouse).where(and(
    eq(warehouse.masterFn, scope.masterFn),
    eq(warehouse.companyFn, scope.companyFn),
    eq(warehouse.id, warehouseId),
  ));
  if (!location) throw new InventoryTrackingError('Warehouse does not exist in this company');

  const [created] = await exec.insert(warehouseBin).values({
    masterFn: scope.masterFn,
    companyFn: scope.companyFn,
    warehouseId,
    code: 'DEFAULT',
    name: 'Default Bin',
    isSystem: true,
  }).onConflictDoNothing().returning({ id: warehouseBin.id });
  if (created) return created.id;
  const [existing] = await exec.select({ id: warehouseBin.id }).from(warehouseBin).where(and(
    eq(warehouseBin.masterFn, scope.masterFn),
    eq(warehouseBin.companyFn, scope.companyFn),
    eq(warehouseBin.warehouseId, warehouseId),
    eq(warehouseBin.code, 'DEFAULT'),
  ));
  if (!existing) throw new InventoryTrackingError('Default warehouse bin could not be resolved');
  return existing.id;
}

async function resolveBin(
  exec: DB,
  scope: Scope,
  warehouseId: number,
  binId?: number,
): Promise<number> {
  if (binId == null) return ensureDefaultBinWithin(exec, scope, warehouseId);
  if (!Number.isSafeInteger(binId) || binId <= 0) {
    throw new InventoryTrackingError('binId must be a positive integer');
  }
  const [bin] = await exec.select({ id: warehouseBin.id }).from(warehouseBin).where(and(
    eq(warehouseBin.masterFn, scope.masterFn),
    eq(warehouseBin.companyFn, scope.companyFn),
    eq(warehouseBin.warehouseId, warehouseId),
    eq(warehouseBin.id, binId),
    eq(warehouseBin.isActive, true),
  ));
  if (!bin) throw new InventoryTrackingError('Bin does not exist in this warehouse');
  return bin.id;
}

export async function resolveTrackingWithin(
  exec: DB,
  scope: Scope,
  input: {
    productId: number;
    warehouseId: number;
    qty: number;
    direction: 'in' | 'out';
  } & TrackingSelection,
): Promise<ResolvedTracking> {
  const [item] = await exec.select({
    id: product.id,
    trackingType: product.trackingType,
  }).from(product).where(and(
    eq(product.masterFn, scope.masterFn),
    eq(product.companyFn, scope.companyFn),
    eq(product.id, input.productId),
  ));
  if (!item) throw new InventoryTrackingError('Product does not exist in this company');
  if (!['none', 'lot', 'serial'].includes(item.trackingType)) {
    throw new InventoryTrackingError(`Unsupported tracking type '${item.trackingType}'`);
  }
  const binId = await resolveBin(exec, scope, input.warehouseId, input.binId);

  if (item.trackingType === 'none') {
    if (input.lotId != null || input.serialId != null) {
      throw new InventoryTrackingError('Untracked products cannot use lotId or serialId');
    }
    return {
      trackingType: 'none',
      trackingKey: 'none',
      binId,
      lotId: null,
      serialId: null,
    };
  }

  if (item.trackingType === 'lot') {
    if (!Number.isSafeInteger(input.lotId) || Number(input.lotId) <= 0 || input.serialId != null) {
      throw new InventoryTrackingError('Lot-tracked products require lotId and cannot use serialId');
    }
    const [lot] = await exec.select({
      id: inventoryLot.id,
      qualityStatus: inventoryLot.qualityStatus,
    }).from(inventoryLot).where(and(
      eq(inventoryLot.masterFn, scope.masterFn),
      eq(inventoryLot.companyFn, scope.companyFn),
      eq(inventoryLot.productId, input.productId),
      eq(inventoryLot.id, Number(input.lotId)),
    ));
    if (!lot) throw new InventoryTrackingError('Lot does not belong to this product');
    if (
      lot.qualityStatus === 'rejected'
      || (input.direction === 'out' && lot.qualityStatus !== 'released')
    ) {
      throw new InventoryTrackingError(
        `Lot is '${lot.qualityStatus}' and cannot be ${input.direction === 'out' ? 'issued' : 'received'}`,
      );
    }
    return {
      trackingType: 'lot',
      trackingKey: `lot:${lot.id}`,
      binId,
      lotId: lot.id,
      serialId: null,
    };
  }

  if (input.qty !== 1) {
    throw new InventoryTrackingError('Serial-tracked movements must have quantity 1');
  }
  if (!Number.isSafeInteger(input.serialId) || Number(input.serialId) <= 0) {
    throw new InventoryTrackingError('Serial-tracked products require serialId');
  }
  const [serial] = await exec.select({
    id: inventorySerial.id,
    lotId: inventorySerial.lotId,
    status: inventorySerial.status,
  }).from(inventorySerial).where(and(
    eq(inventorySerial.masterFn, scope.masterFn),
    eq(inventorySerial.companyFn, scope.companyFn),
    eq(inventorySerial.productId, input.productId),
    eq(inventorySerial.id, Number(input.serialId)),
  )).for('update');
  if (!serial) throw new InventoryTrackingError('Serial does not belong to this product');
  const expectedStatus = input.direction === 'in' ? 'registered' : 'available';
  if (serial.status !== expectedStatus) {
    throw new InventoryTrackingError(
      `Serial is '${serial.status}', expected '${expectedStatus}' for this movement`,
    );
  }
  if (serial.lotId != null) {
    const [lot] = await exec.select({ qualityStatus: inventoryLot.qualityStatus })
      .from(inventoryLot)
      .where(and(
        eq(inventoryLot.masterFn, scope.masterFn),
        eq(inventoryLot.companyFn, scope.companyFn),
        eq(inventoryLot.productId, input.productId),
        eq(inventoryLot.id, serial.lotId),
      ));
    if (
      !lot
      || lot.qualityStatus === 'rejected'
      || (input.direction === 'out' && lot.qualityStatus !== 'released')
    ) {
      throw new InventoryTrackingError('Serial lot is not released for this movement');
    }
  }
  return {
    trackingType: 'serial',
    trackingKey: `serial:${serial.id}`,
    binId,
    lotId: serial.lotId,
    serialId: serial.id,
  };
}

export interface CreateWarehouseBinInput {
  warehouseId: number;
  code: string;
  name: string;
}

export async function createWarehouseBinWithin(
  exec: DB,
  scope: Scope,
  input: CreateWarehouseBinInput,
) {
  if (!input.code?.trim() || !input.name?.trim()) {
    throw new InventoryTrackingError('Bin code and name are required');
  }
  const [location] = await exec.select({ id: warehouse.id }).from(warehouse).where(and(
    eq(warehouse.masterFn, scope.masterFn),
    eq(warehouse.companyFn, scope.companyFn),
    eq(warehouse.id, input.warehouseId),
  ));
  if (!location) throw new InventoryTrackingError('Warehouse does not exist in this company');
  const [bin] = await exec.insert(warehouseBin).values({
    masterFn: scope.masterFn,
    companyFn: scope.companyFn,
    warehouseId: input.warehouseId,
    code: input.code.trim().toUpperCase(),
    name: input.name.trim(),
  }).returning({
    id: warehouseBin.id,
    warehouseId: warehouseBin.warehouseId,
    code: warehouseBin.code,
    name: warehouseBin.name,
  });
  return bin;
}

export interface CreateInventoryLotInput {
  productId: number;
  lotNo: string;
  manufacturedDate?: string | null;
  expiryDate?: string | null;
  qualityStatus?: 'released' | 'hold';
}

export async function createInventoryLotWithin(
  exec: DB,
  scope: Scope,
  input: CreateInventoryLotInput,
) {
  if (!input.lotNo?.trim()) throw new InventoryTrackingError('lotNo is required');
  const [item] = await exec.select({ trackingType: product.trackingType }).from(product).where(and(
    eq(product.masterFn, scope.masterFn),
    eq(product.companyFn, scope.companyFn),
    eq(product.id, input.productId),
  ));
  if (!item || !['lot', 'serial'].includes(item.trackingType)) {
    throw new InventoryTrackingError('Lots require a lot- or serial-tracked product');
  }
  if (
    input.manufacturedDate
    && input.expiryDate
    && input.expiryDate < input.manufacturedDate
  ) {
    throw new InventoryTrackingError('expiryDate cannot be earlier than manufacturedDate');
  }
  const [lot] = await exec.insert(inventoryLot).values({
    masterFn: scope.masterFn,
    companyFn: scope.companyFn,
    productId: input.productId,
    lotNo: input.lotNo.trim(),
    manufacturedDate: input.manufacturedDate || null,
    expiryDate: input.expiryDate || null,
    qualityStatus: input.qualityStatus ?? 'released',
  }).returning({
    id: inventoryLot.id,
    productId: inventoryLot.productId,
    lotNo: inventoryLot.lotNo,
    qualityStatus: inventoryLot.qualityStatus,
  });
  return lot;
}

export interface RegisterInventorySerialInput {
  productId: number;
  serialNo: string;
  lotId?: number | null;
}

export async function registerInventorySerialWithin(
  exec: DB,
  scope: Scope,
  input: RegisterInventorySerialInput,
) {
  if (!input.serialNo?.trim()) throw new InventoryTrackingError('serialNo is required');
  const [item] = await exec.select({ trackingType: product.trackingType }).from(product).where(and(
    eq(product.masterFn, scope.masterFn),
    eq(product.companyFn, scope.companyFn),
    eq(product.id, input.productId),
  ));
  if (!item || item.trackingType !== 'serial') {
    throw new InventoryTrackingError('Serials can only be registered for serial-tracked products');
  }
  if (input.lotId != null) {
    const [lot] = await exec.select({ id: inventoryLot.id }).from(inventoryLot).where(and(
      eq(inventoryLot.masterFn, scope.masterFn),
      eq(inventoryLot.companyFn, scope.companyFn),
      eq(inventoryLot.productId, input.productId),
      eq(inventoryLot.id, input.lotId),
    ));
    if (!lot) throw new InventoryTrackingError('Serial lot does not belong to this product');
  }
  const [serial] = await exec.insert(inventorySerial).values({
    masterFn: scope.masterFn,
    companyFn: scope.companyFn,
    productId: input.productId,
    serialNo: input.serialNo.trim(),
    lotId: input.lotId ?? null,
  }).returning({
    id: inventorySerial.id,
    productId: inventorySerial.productId,
    serialNo: inventorySerial.serialNo,
    status: inventorySerial.status,
  });
  return serial;
}

export function createWarehouseBin(db: DB, scope: Scope, input: CreateWarehouseBinInput) {
  return db.transaction((tx) => createWarehouseBinWithin(tx, scope, input));
}

export function createInventoryLot(db: DB, scope: Scope, input: CreateInventoryLotInput) {
  return db.transaction((tx) => createInventoryLotWithin(tx, scope, input));
}

export function registerInventorySerial(
  db: DB,
  scope: Scope,
  input: RegisterInventorySerialInput,
) {
  return db.transaction((tx) => registerInventorySerialWithin(tx, scope, input));
}

export async function setSerialMovementStatus(
  exec: DB,
  serialId: number | null,
  direction: 'in' | 'out',
) {
  if (serialId == null) return;
  await exec.update(inventorySerial).set({
    status: direction === 'in' ? 'available' : 'issued',
    updatedAt: sql`now()`,
  }).where(eq(inventorySerial.id, serialId));
}
