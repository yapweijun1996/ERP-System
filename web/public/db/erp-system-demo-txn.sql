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
              v_line.qty, 'out', 'sales_order', v_order_id);

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
            DATE '2024-06-01', 'SGD', v_net, v_tax, v_total);

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
