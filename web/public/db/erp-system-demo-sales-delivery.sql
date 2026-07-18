-- Backfill fulfilment proof for persistent demo databases that confirmed
-- orders before migration 0013 introduced canonical delivery documents.
INSERT INTO sales_delivery (
  master_fn, company_fn, doc_no, order_id, invoice_id,
  status, version, delivery_date
)
SELECT so.master_fn, so.company_fn, 'DO-' || so.doc_no, so.id, inv.id,
       'delivered', 2, so.order_date
  FROM sales_order so
  JOIN invoice inv
    ON inv.master_fn = so.master_fn
   AND inv.company_fn = so.company_fn
   AND inv.order_id = so.id
 WHERE so.status = 'confirmed'
ON CONFLICT (master_fn, company_fn, order_id) DO NOTHING;

INSERT INTO sales_delivery_line (
  master_fn, company_fn, delivery_id, line_no, order_line_id,
  product_id, warehouse_id, delivered_qty
)
SELECT sol.master_fn, sol.company_fn, delivery.id, sol.line_no, sol.id,
       sol.product_id,
       COALESCE(
         (
           SELECT movement.warehouse_id
             FROM stock_movement movement
            WHERE movement.master_fn = sol.master_fn
              AND movement.company_fn = sol.company_fn
              AND movement.product_id = sol.product_id
              AND movement.ref_type = 'sales_order'
              AND movement.ref_id = sol.order_id
            ORDER BY movement.id
            LIMIT 1
         ),
         (
           SELECT wh.id
             FROM warehouse wh
            WHERE wh.master_fn = sol.master_fn
              AND wh.company_fn = sol.company_fn
            ORDER BY wh.id
            LIMIT 1
         )
       ),
       sol.qty
  FROM sales_order_line sol
  JOIN sales_delivery delivery
    ON delivery.master_fn = sol.master_fn
   AND delivery.company_fn = sol.company_fn
   AND delivery.order_id = sol.order_id
 WHERE NOT EXISTS (
   SELECT 1
     FROM sales_delivery_line existing
    WHERE existing.master_fn = sol.master_fn
      AND existing.company_fn = sol.company_fn
      AND existing.delivery_id = delivery.id
      AND existing.line_no = sol.line_no
 );
