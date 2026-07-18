-- Fictional, idempotent canonical RMA used by the Demo/API-equivalent UI.
DO $$
DECLARE
  v_delivery_id bigint;
  v_invoice_id bigint;
  v_warehouse_id bigint;
  v_delivery_line_id bigint;
  v_order_line_id bigint;
  v_product_id bigint;
  v_return_id bigint;
  v_price numeric;
  v_rate numeric;
  v_net numeric;
  v_tax numeric;
BEGIN
  IF EXISTS (
    SELECT 1 FROM sales_return
     WHERE master_fn = 'M1' AND company_fn = 'C-SG' AND doc_no = 'RMA-DEMO-1'
  ) THEN
    RETURN;
  END IF;
  SELECT delivery.id, delivery.invoice_id
    INTO v_delivery_id, v_invoice_id
    FROM sales_delivery delivery
   WHERE delivery.master_fn = 'M1' AND delivery.company_fn = 'C-SG'
     AND delivery.status = 'delivered'
   ORDER BY delivery.id LIMIT 1;
  SELECT line.id, line.order_line_id, line.product_id, line.warehouse_id
    INTO v_delivery_line_id, v_order_line_id, v_product_id, v_warehouse_id
    FROM sales_delivery_line line
   WHERE line.master_fn = 'M1' AND line.company_fn = 'C-SG'
     AND line.delivery_id = v_delivery_id
   ORDER BY line.line_no LIMIT 1;
  SELECT unit_price, tax_rate INTO v_price, v_rate
    FROM sales_order_line WHERE id = v_order_line_id;
  v_net := round(v_price, 2);
  v_tax := round(v_net * v_rate / 100, 2);
  INSERT INTO sales_return (
    master_fn, company_fn, doc_no, delivery_id, invoice_id, warehouse_id,
    status, return_date, reason
  ) VALUES (
    'M1', 'C-SG', 'RMA-DEMO-1', v_delivery_id, v_invoice_id, v_warehouse_id,
    'requested', DATE '2026-07-19', 'Fictional demo packaging damage'
  ) RETURNING id INTO v_return_id;
  INSERT INTO sales_return_line (
    master_fn, company_fn, return_id, line_no, delivery_line_id, product_id,
    qty, unit_price, net_amount, tax_code, tax_rate, tax_amount
  ) VALUES (
    'M1', 'C-SG', v_return_id, 1, v_delivery_line_id, v_product_id,
    1, v_price, v_net, 'SR', v_rate, v_tax
  );
END $$;
