import { beforeEach, describe, expect, it } from 'vitest';
import type { DB } from '../data/db';
import { seedDemo } from '../data/seed';
import { salesEnquiry, salesEnquiryLine, salesQuotation, salesQuotationLine } from '../data/schema';
import { freshDb } from '../test/helpers';
import {
  InvalidResourceQueryError,
  UnknownResourceError,
  getResource,
  listResource,
} from './resources';

describe('canonical API resources', () => {
  let db: DB;
  const scope = { masterFn: 'M1', companyFn: 'C-SG' };

  beforeEach(async () => {
    db = await freshDb();
    await seedDemo(db);
  });

  it('lists a tenant-scoped resource with bounded keyset pagination', async () => {
    const first = await listResource(db, scope, 'inventory/products', { limit: 1 });
    expect(first.data).toHaveLength(1);
    expect(first.meta.nextCursor).toEqual(expect.any(String));
    expect(first.meta.nextCursor).not.toBe(String((first.data[0] as { id: number }).id));

    const second = await listResource(db, scope, 'inventory/products', {
      limit: 1000,
      cursor: first.meta.nextCursor,
    });
    expect(second.data).toHaveLength(1);
    expect(second.meta.nextCursor).toBeNull();
    expect((second.data[0] as { id: number }).id).toBeGreaterThan(
      (first.data[0] as { id: number }).id,
    );
  });

  it('never crosses company scope', async () => {
    const sg = await listResource(db, scope, 'inventory/products');
    const my = await listResource(
      db,
      { masterFn: 'M1', companyFn: 'C-MY' },
      'inventory/products',
    );
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- listResource's row type isn't worth reconstructing just to read .sku in a test
    expect(sg.data.map((row: any) => row.sku)).toEqual(['SG-WIDGET', 'SG-GADGET']);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- see above
    expect(my.data.map((row: any) => row.sku)).toEqual(['MY-WIDGET']);
  });

  it('registers the warehouse resource required by canonical inventory screens', async () => {
    const result = await listResource(db, scope, 'inventory/warehouses');
    expect(result).toEqual({ data: [], meta: { nextCursor: null } });
  });

  it('gets one row only inside the requested tenant', async () => {
    const sg = await listResource(db, scope, 'inventory/products', { limit: 1 });
    const id = (sg.data[0] as { id: number }).id;
    expect((await getResource(db, scope, 'inventory/products', id))?.data).toMatchObject({
      id,
      masterFn: 'M1',
      companyFn: 'C-SG',
    });
    expect(await getResource(
      db,
      { masterFn: 'M1', companyFn: 'C-MY' },
      'inventory/products',
      id,
    )).toBeNull();
  });

  it('allows only declared filters and sort order', async () => {
    await expect(listResource(db, scope, 'inventory/products', { status: 'draft' }))
      .rejects.toBeInstanceOf(InvalidResourceQueryError);
    await expect(listResource(db, scope, 'inventory/products', { sort: 'name' }))
      .rejects.toBeInstanceOf(InvalidResourceQueryError);
    await expect(listResource(db, scope, 'inventory/products', { search: 'Widget' }))
      .rejects.toThrow('unsupported filter(s): search');
    await expect(listResource(db, scope, 'unknown/things'))
      .rejects.toBeInstanceOf(UnknownResourceError);
    await expect(listResource(db, scope, 'inventory/products', { cursor: '1' }))
      .rejects.toThrow('cursor is invalid');
  });

  it('filters linked quotations by their tenant-scoped enquiry id', async () => {
    const customers = await listResource(db, scope, 'sales/customers', { limit: 1 });
    const customerId = (customers.data[0] as { id: number }).id;
    const [first, second] = await db.insert(salesEnquiry).values([
      {
        ...scope,
        docNo: 'ENQ-RESOURCE-1',
        customerId,
        subject: 'First resource filter enquiry',
        channel: 'web',
        estimatedValue: '100.00',
        currency: 'SGD',
        ownerName: 'Resource Test',
        enquiryDate: '2026-07-22',
      },
      {
        ...scope,
        docNo: 'ENQ-RESOURCE-2',
        customerId,
        subject: 'Second resource filter enquiry',
        channel: 'email',
        estimatedValue: '200.00',
        currency: 'SGD',
        ownerName: 'Resource Test',
        enquiryDate: '2026-07-22',
      },
    ]).returning();
    const [firstQuotation, secondQuotation] = await db.insert(salesQuotation).values([
      {
        ...scope,
        docNo: 'Q-RESOURCE-1',
        customerId,
        enquiryId: first.id,
        quoteDate: '2026-07-22',
        validUntil: '2026-08-22',
        currency: 'SGD',
        probability: '50',
      },
      {
        ...scope,
        docNo: 'Q-RESOURCE-2',
        customerId,
        enquiryId: second.id,
        quoteDate: '2026-07-22',
        validUntil: '2026-08-22',
        currency: 'SGD',
        probability: '50',
      },
    ]).returning();
    await db.insert(salesQuotationLine).values([
      {
        ...scope,
        quotationId: firstQuotation.id,
        lineNo: 1,
        lineType: 'non_stock',
        productId: null,
        description: 'First service',
        uom: 'job',
        qty: '1',
        unitPrice: '100',
        netAmount: '100',
        taxCode: 'SR',
        taxRate: '9',
        taxAmount: '9',
      },
      {
        ...scope,
        quotationId: secondQuotation.id,
        lineNo: 1,
        lineType: 'non_stock',
        productId: null,
        description: 'Second service',
        uom: 'job',
        qty: '1',
        unitPrice: '200',
        netAmount: '200',
        taxCode: 'SR',
        taxRate: '9',
        taxAmount: '18',
      },
    ]);

    const result = await listResource(db, scope, 'sales/quotations', {
      limit: 100,
      enquiryId: first.id,
    });
    expect(result.data).toHaveLength(1);
    expect(result.data[0]).toMatchObject({ docNo: 'Q-RESOURCE-1', enquiryId: first.id });
    const lineResult = await listResource(db, scope, 'sales/quotation-lines', {
      limit: 100,
      quotationId: firstQuotation.id,
    });
    expect(lineResult.data).toHaveLength(1);
    expect(lineResult.data[0]).toMatchObject({
      quotationId: firstQuotation.id,
      description: 'First service',
    });
    await expect(listResource(db, scope, 'sales/quotations', { enquiryId: 0 }))
      .rejects.toThrow('enquiryId must be a positive integer');
    await expect(listResource(db, scope, 'sales/quotation-lines', { quotationId: 0 }))
      .rejects.toThrow('quotationId must be a positive integer');
  });

  it('filters canonical enquiry rows by their parent document', async () => {
    const customers = await listResource(db, scope, 'sales/customers', { limit: 1 });
    const products = await listResource(db, scope, 'inventory/products', { limit: 1 });
    const customerId = (customers.data[0] as { id: number }).id;
    const productId = (products.data[0] as { id: number }).id;
    const [first, second] = await db.insert(salesEnquiry).values([
      { ...scope, docNo: 'ENQ-LINE-1', customerId, subject: 'First', channel: 'direct', currency: 'SGD', ownerName: 'Resource Test', enquiryDate: '2026-08-03' },
      { ...scope, docNo: 'ENQ-LINE-2', customerId, subject: 'Second', channel: 'direct', currency: 'SGD', ownerName: 'Resource Test', enquiryDate: '2026-08-03' },
    ]).returning();
    await db.insert(salesEnquiryLine).values([
      { ...scope, enquiryId: first.id, lineNo: 1, productId, description: 'First item', qty: '1', estimatedUnitPrice: '10' },
      { ...scope, enquiryId: second.id, lineNo: 1, productId, description: 'Second item', qty: '2', estimatedUnitPrice: '20' },
    ]);
    const result = await listResource(db, scope, 'sales/enquiry-lines', {
      limit: 100,
      enquiryId: first.id,
    });
    expect(result.data).toHaveLength(1);
    expect(result.data[0]).toMatchObject({ enquiryId: first.id, productId });
  });
});
