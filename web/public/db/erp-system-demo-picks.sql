-- Canonical browser-demo warehouse pick fixture.
-- Idempotent and data-derived: product/warehouse/bin IDs are resolved from the
-- canonical seed instead of copied from a prototype object.
DO $$
DECLARE
  v_pick_id bigint;
  v_warehouse_id bigint;
  v_bin_id bigint;
  v_widget_id bigint;
  v_gadget_id bigint;
  v_widget_line_id bigint;
  v_gadget_line_id bigint;
BEGIN
  IF EXISTS (
    SELECT 1 FROM warehouse_pick
    WHERE master_fn = 'M1' AND company_fn = 'C-SG' AND doc_no = 'PICK-1'
  ) THEN
    RETURN;
  END IF;

  SELECT id INTO v_warehouse_id FROM warehouse
  WHERE master_fn = 'M1' AND company_fn = 'C-SG' AND code = 'WH-SALES';
  SELECT id INTO v_bin_id FROM warehouse_bin
  WHERE master_fn = 'M1' AND company_fn = 'C-SG'
    AND warehouse_id = v_warehouse_id AND code = 'DEFAULT';
  SELECT id INTO v_widget_id FROM product
  WHERE master_fn = 'M1' AND company_fn = 'C-SG' AND sku = 'SG-WIDGET';
  SELECT id INTO v_gadget_id FROM product
  WHERE master_fn = 'M1' AND company_fn = 'C-SG' AND sku = 'SG-GADGET';

  IF v_warehouse_id IS NULL OR v_bin_id IS NULL
     OR v_widget_id IS NULL OR v_gadget_id IS NULL THEN
    RAISE EXCEPTION 'Canonical warehouse pick fixture prerequisites are missing';
  END IF;

  INSERT INTO warehouse_pick (
    master_fn, company_fn, doc_no, status, version, warehouse_id,
    priority, assignee, pick_date
  ) VALUES (
    'M1', 'C-SG', 'PICK-1', 'open', 1, v_warehouse_id,
    'high', 'Admin', CURRENT_DATE
  ) RETURNING id INTO v_pick_id;

  INSERT INTO warehouse_pick_line (
    master_fn, company_fn, pick_id, line_no, product_id, bin_id,
    required_qty, picked_qty, uom
  ) VALUES (
    'M1', 'C-SG', v_pick_id, 1, v_widget_id, v_bin_id, 4, 0, 'unit'
  ) RETURNING id INTO v_widget_line_id;

  INSERT INTO warehouse_pick_line (
    master_fn, company_fn, pick_id, line_no, product_id, bin_id,
    required_qty, picked_qty, uom
  ) VALUES (
    'M1', 'C-SG', v_pick_id, 2, v_gadget_id, v_bin_id, 2, 0, 'box'
  ) RETURNING id INTO v_gadget_line_id;

  INSERT INTO stock_reservation (
    master_fn, company_fn, pick_id, pick_line_id, product_id,
    warehouse_id, bin_id, qty, status
  ) VALUES
    ('M1', 'C-SG', v_pick_id, v_widget_line_id, v_widget_id,
     v_warehouse_id, v_bin_id, 4, 'active'),
    ('M1', 'C-SG', v_pick_id, v_gadget_line_id, v_gadget_id,
     v_warehouse_id, v_bin_id, 2, 'active');
END $$;
