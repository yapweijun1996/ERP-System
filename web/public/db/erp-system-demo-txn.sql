-- ============================================================
-- ERP-System canonical demo transaction (SQL form of the
-- src/demo.ts runSalesScenario valid order, executing the same
-- steps as src/modules/sales/confirmOrder.ts):
--   confirm SO-1 → effective-dated tax snapshot per line →
--   lock + deduct stock (WH-SALES) → stock movements →
--   invoice INV-SO-1 → balanced GL (Dr AR / Cr Revenue / Cr GST).
-- One DO block = one implicit transaction: any failure (e.g.
-- insufficient stock) rolls the ENTIRE chain back.
-- Expected result: net 110.00 + GST 9.90 = 119.90, stock 95/97.
-- ============================================================

DO $$
DECLARE
  v_customer_id  bigint;
  v_warehouse_id bigint;
  v_order_id     bigint;
  v_delivery_id  bigint;
  v_invoice_id   bigint;
  v_product_id   bigint;
  v_available    numeric;
  v_rate         numeric(6,3);
  v_line_net     numeric(18,2);
  v_line_tax     numeric(18,2);
  v_net          numeric(18,2) := 0;
  v_tax          numeric(18,2) := 0;
  v_total        numeric(18,2);
  v_line_no      integer := 0;
  v_line         record;
  v_ar bigint; v_rev bigint; v_out bigint;
BEGIN
  SELECT id INTO v_customer_id FROM customer
    WHERE master_fn = 'M1' AND company_fn = 'C-SG' AND code = 'CUST1';
  SELECT id INTO v_warehouse_id FROM warehouse
    WHERE master_fn = 'M1' AND company_fn = 'C-SG' AND code = 'WH-SALES';

  -- 1. Header (totals filled in after lines) — confirmOrder.ts step 1.
  INSERT INTO sales_order (master_fn, company_fn, doc_no, customer_id, status, order_date, currency)
    VALUES ('M1', 'C-SG', 'SO-1', v_customer_id, 'confirmed', DATE '2024-06-01', 'SGD')
    RETURNING id INTO v_order_id;
  INSERT INTO sales_delivery (master_fn, company_fn, doc_no, order_id, status, delivery_date)
    VALUES ('M1', 'C-SG', 'DO-SO-1', v_order_id, 'draft', DATE '2024-06-01')
    RETURNING id INTO v_delivery_id;

  -- 2. Lines: tax snapshot, stock lock + deduct, movement — confirmOrder.ts step 2.
  FOR v_line IN
    SELECT * FROM (VALUES
      ('SG-WIDGET', 5::numeric, 10::numeric, 'SR'),
      ('SG-GADGET', 3::numeric, 20::numeric, 'SR')
    ) AS t(sku, qty, unit_price, tax_code)
  LOOP
    v_line_no := v_line_no + 1;
    SELECT id INTO v_product_id FROM product
      WHERE master_fn = 'M1' AND company_fn = 'C-SG' AND sku = v_line.sku;

    -- Effective-dated tax lookup: the rate valid ON the order date (repo.getEffectiveTaxRate).
    SELECT rate INTO v_rate FROM tax_rule
      WHERE master_fn = 'M1' AND company_fn = 'C-SG' AND tax_code = v_line.tax_code
        AND valid_from <= DATE '2024-06-01'
        AND (valid_to IS NULL OR valid_to > DATE '2024-06-01')
      ORDER BY valid_from DESC LIMIT 1;
    IF v_rate IS NULL THEN
      RAISE EXCEPTION 'No tax rule for % on 2024-06-01', v_line.tax_code;
    END IF;

    v_line_net := round(v_line.qty * v_line.unit_price, 2);
    v_line_tax := round(v_line_net * v_rate / 100, 2);

    INSERT INTO sales_order_line (master_fn, company_fn, order_id, line_no, product_id,
                                  qty, unit_price, net_amount, tax_code, tax_rate, tax_amount)
      VALUES ('M1', 'C-SG', v_order_id, v_line_no, v_product_id,
              v_line.qty, v_line.unit_price, v_line_net, v_line.tax_code, v_rate, v_line_tax);

    -- Row lock + insufficient-stock guard (stock.issueStockWithin semantics).
    SELECT qty INTO v_available FROM stock_level
      WHERE master_fn = 'M1' AND company_fn = 'C-SG'
        AND product_id = v_product_id AND warehouse_id = v_warehouse_id
      FOR UPDATE;
    IF v_available IS NULL OR v_available < v_line.qty THEN
      RAISE EXCEPTION 'Insufficient stock for %: have %, need %',
        v_line.sku, coalesce(v_available, 0), v_line.qty;  -- → whole DO block rolls back
    END IF;

    UPDATE stock_level SET qty = qty - v_line.qty, updated_at = now()
      WHERE master_fn = 'M1' AND company_fn = 'C-SG'
        AND product_id = v_product_id AND warehouse_id = v_warehouse_id;

    INSERT INTO stock_movement (master_fn, company_fn, product_id, warehouse_id,
                                qty, direction, ref_type, ref_id)
      VALUES ('M1', 'C-SG', v_product_id, v_warehouse_id,
              v_line.qty, 'out', 'sales_delivery', v_delivery_id);

    v_net := v_net + v_line_net;
    v_tax := v_tax + v_line_tax;
  END LOOP;

  -- 3. Finalize header totals.
  v_total := v_net + v_tax;
  UPDATE sales_order
    SET net_amount = v_net, tax_amount = v_tax, total_amount = v_total, updated_at = now()
    WHERE id = v_order_id;

  -- 4. Invoice.
  INSERT INTO invoice (master_fn, company_fn, doc_no, order_id, customer_id, status,
                       invoice_date, currency, net_amount, tax_amount, total_amount)
    VALUES ('M1', 'C-SG', 'INV-SO-1', v_order_id, v_customer_id, 'unpaid',
            DATE '2024-06-01', 'SGD', v_net, v_tax, v_total)
    RETURNING id INTO v_invoice_id;

  INSERT INTO sales_delivery_line (
    master_fn, company_fn, delivery_id, line_no, order_line_id,
    product_id, warehouse_id, delivered_qty
  )
  SELECT 'M1', 'C-SG', v_delivery_id, sol.line_no, sol.id,
         sol.product_id, v_warehouse_id, sol.qty
    FROM sales_order_line sol
   WHERE sol.master_fn = 'M1' AND sol.company_fn = 'C-SG'
     AND sol.order_id = v_order_id
   ORDER BY sol.line_no;
  UPDATE sales_delivery
     SET invoice_id = v_invoice_id, status = 'delivered', version = 2, updated_at = now()
   WHERE id = v_delivery_id;

  -- 5. Balanced double-entry ledger: Dr AR, Cr Revenue, Cr GST Output.
  SELECT id INTO v_ar  FROM account WHERE master_fn = 'M1' AND company_fn = 'C-SG' AND code = '1100';
  SELECT id INTO v_rev FROM account WHERE master_fn = 'M1' AND company_fn = 'C-SG' AND code = '4000';
  SELECT id INTO v_out FROM account WHERE master_fn = 'M1' AND company_fn = 'C-SG' AND code = '2200';
  IF v_ar IS NULL OR v_rev IS NULL OR v_out IS NULL THEN
    RAISE EXCEPTION 'Chart of accounts not configured';
  END IF;

  INSERT INTO gl_entry (master_fn, company_fn, journal_ref, account_id, debit, credit, memo) VALUES
    ('M1', 'C-SG', 'INV-SO-1', v_ar,  v_total, 0,       'AR'),
    ('M1', 'C-SG', 'INV-SO-1', v_rev, 0,       v_net,   'Revenue'),
    ('M1', 'C-SG', 'INV-SO-1', v_out, 0,       v_tax,   'Output tax');
END $$;

-- ============================================================
-- Purchasing chain (SQL form of src/demo.ts runPurchasingScenario,
-- executing the same steps as src/modules/purchasing/createPurchaseOrder.ts
-- + receiveGoods.ts + postSupplierInvoice.ts):
--   create PO-1 (open) -> receive into WH-SALES (stock IN, PO ->
--   received) -> post SINV-1 (balanced GL: Dr Inventory + Dr Input
--   Tax = Cr Accounts Payable).
-- One DO block = one implicit transaction.
-- Expected result: net 120.00 + GST 10.80 = 130.80, SG-WIDGET
-- stock +20 (WH-SALES reused -- inventory screens aggregate
-- on-hand across warehouses, so this is visibly the same stock
-- the sales chain already deducted from).
-- ============================================================

DO $$
DECLARE
  v_supplier_id  bigint;
  v_warehouse_id bigint;
  v_po_id        bigint;
  v_receipt_id   bigint;
  v_product_id   bigint;
  v_rate         numeric(6,3);
  v_net          numeric(18,2);
  v_tax          numeric(18,2);
  v_total        numeric(18,2);
  v_qty          numeric := 20;
  v_unit_cost    numeric := 6;
  v_inv bigint; v_intax bigint; v_ap bigint;
BEGIN
  SELECT id INTO v_supplier_id FROM supplier
    WHERE master_fn = 'M1' AND company_fn = 'C-SG' AND code = 'SUPP1';
  SELECT id INTO v_warehouse_id FROM warehouse
    WHERE master_fn = 'M1' AND company_fn = 'C-SG' AND code = 'WH-SALES';
  SELECT id INTO v_product_id FROM product
    WHERE master_fn = 'M1' AND company_fn = 'C-SG' AND sku = 'SG-WIDGET';

  -- 1. createPurchaseOrder.ts: header + one line, effective-dated tax snapshot.
  SELECT rate INTO v_rate FROM tax_rule
    WHERE master_fn = 'M1' AND company_fn = 'C-SG' AND tax_code = 'SR'
      AND valid_from <= DATE '2024-06-01'
      AND (valid_to IS NULL OR valid_to > DATE '2024-06-01')
    ORDER BY valid_from DESC LIMIT 1;
  IF v_rate IS NULL THEN
    RAISE EXCEPTION 'No tax rule for SR on 2024-06-01';
  END IF;
  v_net := round(v_qty * v_unit_cost, 2);
  v_tax := round(v_net * v_rate / 100, 2);
  v_total := v_net + v_tax;

  INSERT INTO purchase_order (master_fn, company_fn, doc_no, supplier_id, status,
                              order_date, currency, net_amount, tax_amount, total_amount)
    VALUES ('M1', 'C-SG', 'PO-1', v_supplier_id, 'open',
            DATE '2024-06-01', 'SGD', v_net, v_tax, v_total)
    RETURNING id INTO v_po_id;

  INSERT INTO purchase_order_line (master_fn, company_fn, order_id, line_no, product_id,
                                   qty, unit_cost, net_amount, tax_code, tax_rate, tax_amount)
    VALUES ('M1', 'C-SG', v_po_id, 1, v_product_id,
            v_qty, v_unit_cost, v_net, 'SR', v_rate, v_tax);

  -- 2. receiveGoods.ts: stock IN (upsert -- this is the first-ever stock_level row
  --    for SG-WIDGET at WH-SALES that was created via a PURCHASE rather than the
  --    sales fixture above, so ON CONFLICT DO UPDATE adds onto the existing 95/97
  --    balance instead of overwriting it), one movement, PO -> 'received'.
  INSERT INTO goods_receipt (master_fn, company_fn, doc_no, order_id, warehouse_id, received_date)
    VALUES ('M1', 'C-SG', 'GR-1', v_po_id, v_warehouse_id, DATE '2024-06-05')
    RETURNING id INTO v_receipt_id;

  INSERT INTO stock_level (master_fn, company_fn, product_id, warehouse_id, qty)
    VALUES ('M1', 'C-SG', v_product_id, v_warehouse_id, v_qty)
    ON CONFLICT (master_fn, company_fn, product_id, warehouse_id)
    DO UPDATE SET qty = stock_level.qty + v_qty, updated_at = now();

  INSERT INTO stock_movement (master_fn, company_fn, product_id, warehouse_id,
                              qty, direction, ref_type, ref_id)
    VALUES ('M1', 'C-SG', v_product_id, v_warehouse_id, v_qty, 'in', 'goods_receipt', v_receipt_id);

  UPDATE purchase_order SET status = 'received', updated_at = now() WHERE id = v_po_id;

  -- 3. postSupplierInvoice.ts: Dr Inventory, Dr Input Tax, Cr Accounts Payable.
  SELECT id INTO v_inv   FROM account WHERE master_fn = 'M1' AND company_fn = 'C-SG' AND code = '1400';
  SELECT id INTO v_intax FROM account WHERE master_fn = 'M1' AND company_fn = 'C-SG' AND code = '1200';
  SELECT id INTO v_ap    FROM account WHERE master_fn = 'M1' AND company_fn = 'C-SG' AND code = '2100';
  IF v_inv IS NULL OR v_intax IS NULL OR v_ap IS NULL THEN
    RAISE EXCEPTION 'Purchasing chart of accounts not configured';
  END IF;

  INSERT INTO supplier_invoice (master_fn, company_fn, doc_no, order_id, supplier_id, status,
                                invoice_date, currency, net_amount, tax_amount, total_amount)
    VALUES ('M1', 'C-SG', 'SINV-1', v_po_id, v_supplier_id, 'unpaid',
            DATE '2024-06-06', 'SGD', v_net, v_tax, v_total);

  INSERT INTO gl_entry (master_fn, company_fn, journal_ref, account_id, debit, credit, memo) VALUES
    ('M1', 'C-SG', 'SINV-1', v_inv,   v_net, 0,     'Inventory'),
    ('M1', 'C-SG', 'SINV-1', v_intax, v_tax, 0,     'Input tax'),
    ('M1', 'C-SG', 'SINV-1', v_ap,    0,     v_total, 'AP');
END $$;

-- ============================================================
-- CRM chain (SQL form of src/demo.ts runCrmScenario, executing the
-- same steps as src/modules/crm/createOpportunity.ts +
-- convertOpportunityToSalesOrder.ts): create OPP-2 (separate from
-- the seed's own still-open OPP-1) -> convert it, composing
-- confirmOrder's own steps with the opportunity's stage update in
-- one transaction. The seed's OPP-1 stays untouched/negotiation so
-- the pipeline board has an in-flight deal to show; this converted
-- OPP-2 gives the "Won" column a real example on first load, the
-- same way SO-1/PO-1 are pre-processed examples for Sales/Purchasing.
-- Expected result: net 50.00 + GST 4.50 = 54.50, SG-WIDGET stock -5
-- (WH-SALES reused, same as the purchasing block above).
-- ============================================================

DO $$
DECLARE
  v_customer_id  bigint;
  v_owner_id     bigint;
  v_warehouse_id bigint;
  v_product_id   bigint;
  v_opp_id       bigint;
  v_order_id     bigint;
  v_available    numeric;
  v_rate         numeric(6,3);
  v_net          numeric(18,2);
  v_tax          numeric(18,2);
  v_total        numeric(18,2);
  v_qty          numeric := 5;
  v_unit_price   numeric := 10;
  v_ar bigint; v_rev bigint; v_out bigint;
BEGIN
  SELECT id INTO v_customer_id FROM customer
    WHERE master_fn = 'M1' AND company_fn = 'C-SG' AND code = 'CUST1';
  SELECT user_id INTO v_owner_id FROM app_user
    WHERE master_fn = 'M1' AND email = 'admin@acme.co';
  SELECT id INTO v_warehouse_id FROM warehouse
    WHERE master_fn = 'M1' AND company_fn = 'C-SG' AND code = 'WH-SALES';
  SELECT id INTO v_product_id FROM product
    WHERE master_fn = 'M1' AND company_fn = 'C-SG' AND sku = 'SG-WIDGET';

  -- 1. createOpportunity.ts: a second opportunity, deliberately not the seed's OPP-1.
  INSERT INTO opportunity (master_fn, company_fn, doc_no, customer_id, title, value, currency, stage, probability, close_date, owner_user_id)
    VALUES ('M1', 'C-SG', 'OPP-2', v_customer_id, 'Widget resupply deal', 65, 'SGD', 'negotiation', 70, DATE '2024-06-10', v_owner_id)
    RETURNING id INTO v_opp_id;

  -- 2. convertOpportunityToSalesOrder.ts: confirmOrder's own steps, composed
  --    with the opportunity's stage update, in this SAME transaction.
  SELECT rate INTO v_rate FROM tax_rule
    WHERE master_fn = 'M1' AND company_fn = 'C-SG' AND tax_code = 'SR'
      AND valid_from <= DATE '2024-06-01'
      AND (valid_to IS NULL OR valid_to > DATE '2024-06-01')
    ORDER BY valid_from DESC LIMIT 1;
  IF v_rate IS NULL THEN
    RAISE EXCEPTION 'No tax rule for SR on 2024-06-01';
  END IF;
  v_net := round(v_qty * v_unit_price, 2);
  v_tax := round(v_net * v_rate / 100, 2);
  v_total := v_net + v_tax;

  INSERT INTO sales_order (master_fn, company_fn, doc_no, customer_id, status, order_date, currency, net_amount, tax_amount, total_amount)
    VALUES ('M1', 'C-SG', 'SO-CRM-1', v_customer_id, 'confirmed', DATE '2024-06-01', 'SGD', v_net, v_tax, v_total)
    RETURNING id INTO v_order_id;

  INSERT INTO sales_order_line (master_fn, company_fn, order_id, line_no, product_id, qty, unit_price, net_amount, tax_code, tax_rate, tax_amount)
    VALUES ('M1', 'C-SG', v_order_id, 1, v_product_id, v_qty, v_unit_price, v_net, 'SR', v_rate, v_tax);

  SELECT qty INTO v_available FROM stock_level
    WHERE master_fn = 'M1' AND company_fn = 'C-SG'
      AND product_id = v_product_id AND warehouse_id = v_warehouse_id
    FOR UPDATE;
  IF v_available IS NULL OR v_available < v_qty THEN
    RAISE EXCEPTION 'Insufficient stock for SG-WIDGET: have %, need %', coalesce(v_available, 0), v_qty;
  END IF;
  UPDATE stock_level SET qty = qty - v_qty, updated_at = now()
    WHERE master_fn = 'M1' AND company_fn = 'C-SG'
      AND product_id = v_product_id AND warehouse_id = v_warehouse_id;
  INSERT INTO stock_movement (master_fn, company_fn, product_id, warehouse_id, qty, direction, ref_type, ref_id)
    VALUES ('M1', 'C-SG', v_product_id, v_warehouse_id, v_qty, 'out', 'sales_order', v_order_id);

  INSERT INTO invoice (master_fn, company_fn, doc_no, order_id, customer_id, status, invoice_date, currency, net_amount, tax_amount, total_amount)
    VALUES ('M1', 'C-SG', 'INV-SO-CRM-1', v_order_id, v_customer_id, 'unpaid', DATE '2024-06-01', 'SGD', v_net, v_tax, v_total);

  SELECT id INTO v_ar  FROM account WHERE master_fn = 'M1' AND company_fn = 'C-SG' AND code = '1100';
  SELECT id INTO v_rev FROM account WHERE master_fn = 'M1' AND company_fn = 'C-SG' AND code = '4000';
  SELECT id INTO v_out FROM account WHERE master_fn = 'M1' AND company_fn = 'C-SG' AND code = '2200';
  IF v_ar IS NULL OR v_rev IS NULL OR v_out IS NULL THEN
    RAISE EXCEPTION 'Chart of accounts not configured';
  END IF;
  INSERT INTO gl_entry (master_fn, company_fn, journal_ref, account_id, debit, credit, memo) VALUES
    ('M1', 'C-SG', 'INV-SO-CRM-1', v_ar,  v_total, 0,     'AR'),
    ('M1', 'C-SG', 'INV-SO-CRM-1', v_rev, 0,       v_net, 'Revenue'),
    ('M1', 'C-SG', 'INV-SO-CRM-1', v_out, 0,       v_tax, 'Output tax');

  -- 3. Mark the opportunity won and link the resulting order.
  UPDATE opportunity SET stage = 'won', order_id = v_order_id, updated_at = now() WHERE id = v_opp_id;
END $$;
-- Rebuild warehouse-location projections after all demo transactions have
-- established their final aggregate stock quantities. Migration backfills run
-- before seed data on a fresh browser database, so the fixture must reconcile
-- these projections once seeding is complete.
INSERT INTO "warehouse_bin" (
  "master_fn",
  "company_fn",
  "warehouse_id",
  "code",
  "name",
  "is_system",
  "is_active",
  "created_at"
)
SELECT
  warehouse."master_fn",
  warehouse."company_fn",
  warehouse."id",
  'DEFAULT',
  'Default',
  true,
  true,
  CURRENT_TIMESTAMP
FROM "warehouse"
ON CONFLICT ("master_fn", "company_fn", "warehouse_id", "code") DO NOTHING;

INSERT INTO "stock_location_balance" (
  "master_fn",
  "company_fn",
  "product_id",
  "warehouse_id",
  "bin_id",
  "tracking_key",
  "qty",
  "updated_at"
)
SELECT
  stock_level."master_fn",
  stock_level."company_fn",
  stock_level."product_id",
  stock_level."warehouse_id",
  warehouse_bin."id",
  'none',
  stock_level."qty",
  CURRENT_TIMESTAMP
FROM "stock_level"
JOIN "product"
  ON product."id" = stock_level."product_id"
 AND product."master_fn" = stock_level."master_fn"
 AND product."company_fn" = stock_level."company_fn"
JOIN "warehouse_bin"
  ON warehouse_bin."warehouse_id" = stock_level."warehouse_id"
 AND warehouse_bin."master_fn" = stock_level."master_fn"
 AND warehouse_bin."company_fn" = stock_level."company_fn"
 AND warehouse_bin."code" = 'DEFAULT'
WHERE product."tracking_type" = 'none'
ON CONFLICT (
  "master_fn",
  "company_fn",
  "product_id",
  "warehouse_id",
  "bin_id",
  "tracking_key"
) DO UPDATE SET
  "qty" = excluded."qty",
  "updated_at" = excluded."updated_at";

UPDATE "stock_movement"
SET "bin_id" = warehouse_bin."id"
FROM "warehouse_bin"
WHERE "stock_movement"."bin_id" IS NULL
  AND warehouse_bin."warehouse_id" = "stock_movement"."warehouse_id"
  AND warehouse_bin."master_fn" = "stock_movement"."master_fn"
  AND warehouse_bin."company_fn" = "stock_movement"."company_fn"
  AND warehouse_bin."code" = 'DEFAULT';
