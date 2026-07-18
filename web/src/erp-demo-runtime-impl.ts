import { PGlite, type Transaction } from '@electric-sql/pglite';
import { drizzle, type PgliteDatabase } from 'drizzle-orm/pglite';
import * as schema from '../../src/data/schema';
import type { DB } from '../../src/data/db';
import type { Scope } from '../../src/data/repo';
import {
  convertOpportunityToSalesOrderWithin,
  type ConvertOpportunityInput,
} from '../../src/modules/crm/convertOpportunityToSalesOrder';
import {
  createOpportunity,
  type CreateOpportunityInput,
} from '../../src/modules/crm/createOpportunity';
import {
  createPurchaseOrder,
  type CreatePurchaseOrderInput,
} from '../../src/modules/purchasing/createPurchaseOrder';
import {
  postSupplierInvoice,
  type PostSupplierInvoiceInput,
} from '../../src/modules/purchasing/postSupplierInvoice';
import {
  receiveGoods,
  type ReceiveGoodsInput,
} from '../../src/modules/purchasing/receiveGoods';
import {
  confirmSalesOrder,
  type ConfirmOrderInput,
} from '../../src/modules/sales/confirmOrder';

type DemoOrm = PgliteDatabase<typeof schema>;

function createOrm(client: PGlite | Transaction): DemoOrm {
  return drizzle(client as PGlite, { schema });
}

function asDomainDb(db: DemoOrm): DB {
  return db as unknown as DB;
}

export const erpDemoRuntime = Object.freeze({
  openDatabase(dataDir: string) {
    const client = new PGlite(dataDir);
    return { client, orm: createOrm(client) };
  },
  createOrm,
  commands: Object.freeze({
    confirmSalesOrder(db: DemoOrm, scope: Scope, input: ConfirmOrderInput) {
      return confirmSalesOrder(asDomainDb(db), scope, input);
    },
    createPurchaseOrder(db: DemoOrm, scope: Scope, input: CreatePurchaseOrderInput) {
      return createPurchaseOrder(asDomainDb(db), scope, input);
    },
    receiveGoods(db: DemoOrm, scope: Scope, input: ReceiveGoodsInput) {
      return receiveGoods(asDomainDb(db), scope, input);
    },
    postSupplierInvoice(db: DemoOrm, scope: Scope, input: PostSupplierInvoiceInput) {
      return postSupplierInvoice(asDomainDb(db), scope, input);
    },
    createOpportunity(db: DemoOrm, scope: Scope, input: CreateOpportunityInput) {
      return createOpportunity(asDomainDb(db), scope, input);
    },
    convertOpportunityToSalesOrderWithin(
      db: DemoOrm,
      scope: Scope,
      input: ConvertOpportunityInput,
    ) {
      return convertOpportunityToSalesOrderWithin(asDomainDb(db), scope, input);
    },
  }),
});

export type ErpDemoRuntime = typeof erpDemoRuntime;
