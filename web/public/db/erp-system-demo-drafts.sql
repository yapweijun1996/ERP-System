-- ============================================================
-- ERP-System demo DRAFT orders (demo-UI extra, TASK-007).
-- Two draft sales orders so the Confirm flow can be exercised
-- live in the browser:
--   SO-2  widget 5 + gadget 3   → confirmable (stock 95/97)
--   SO-3  gadget 120            → intentionally EXCEEDS stock,
--                                  confirming it must error and
--                                  roll the whole chain back
-- Drafts touch no stock, no invoice, no GL — that happens only
-- when the user confirms (see confirmOrder in the adapter).
-- Idempotent: skipped when the doc_no already exists.
-- ============================================================

DO $$
DECLARE
  v_customer_id bigint;
  v_owner_id    bigint;
  v_order_id    bigint;
  v_product_id  bigint;
  v_rate        numeric(6,3);
  v_line_net    numeric(18,2);
  v_line_tax    numeric(18,2);
  v_net         numeric(18,2);
  v_tax         numeric(18,2);
  v_line_no     integer;
  v_doc         record;
  v_line        record;
BEGIN
  SELECT id INTO v_customer_id FROM customer
    WHERE master_fn = 'M1' AND company_fn = 'C-SG' AND code = 'CUST1';
  SELECT owner_user_id INTO v_owner_id FROM customer WHERE id = v_customer_id;

  FOR v_doc IN SELECT * FROM (VALUES ('SO-2'), ('SO-3')) AS t(doc_no) LOOP
    CONTINUE WHEN EXISTS (
      SELECT 1 FROM sales_order
      WHERE master_fn = 'M1' AND company_fn = 'C-SG' AND doc_no = v_doc.doc_no);

    INSERT INTO sales_order (master_fn, company_fn, doc_no, customer_id, salesperson_user_id, status, order_date, currency)
      VALUES ('M1', 'C-SG', v_doc.doc_no, v_customer_id, v_owner_id, 'draft', DATE '2026-06-28', 'SGD')
      RETURNING id INTO v_order_id;

    v_net := 0; v_tax := 0; v_line_no := 0;
    FOR v_line IN
      SELECT * FROM (VALUES
        ('SO-2', 'SG-WIDGET',   5::numeric, 10::numeric, 'SR'),
        ('SO-2', 'SG-GADGET',   3::numeric, 20::numeric, 'SR'),
        ('SO-3', 'SG-GADGET', 120::numeric, 20::numeric, 'SR')
      ) AS t(doc_no, sku, qty, unit_price, tax_code)
      WHERE t.doc_no = v_doc.doc_no
    LOOP
      v_line_no := v_line_no + 1;
      SELECT id INTO v_product_id FROM product
        WHERE master_fn = 'M1' AND company_fn = 'C-SG' AND sku = v_line.sku;

      SELECT rate INTO v_rate FROM tax_rule
        WHERE master_fn = 'M1' AND company_fn = 'C-SG' AND tax_code = v_line.tax_code
          AND valid_from <= DATE '2026-06-28'
          AND (valid_to IS NULL OR valid_to > DATE '2026-06-28')
        ORDER BY valid_from DESC LIMIT 1;

      v_line_net := round(v_line.qty * v_line.unit_price, 2);
      v_line_tax := round(v_line_net * v_rate / 100, 2);

      INSERT INTO sales_order_line (master_fn, company_fn, order_id, line_no, product_id,
                                    qty, unit_price, net_amount, tax_code, tax_rate, tax_amount)
        VALUES ('M1', 'C-SG', v_order_id, v_line_no, v_product_id,
                v_line.qty, v_line.unit_price, v_line_net, v_line.tax_code, v_rate, v_line_tax);

      v_net := v_net + v_line_net;
      v_tax := v_tax + v_line_tax;
    END LOOP;

    UPDATE sales_order
      SET net_amount = v_net, tax_amount = v_tax, total_amount = v_net + v_tax, updated_at = now()
      WHERE id = v_order_id;
  END LOOP;
END $$;
