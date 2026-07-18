-- PostgreSQL production-only tenant isolation.
-- Apply after Drizzle migrations and run the API as a non-superuser,
-- non-BYPASSRLS role. The API sets app.master_fn/app.company_fn with
-- SET LOCAL (via set_config(..., true)) inside every business transaction.
-- PGlite does not apply this file.

BEGIN;

DO $$
DECLARE
  table_name text;
  company_tables text[] := ARRAY[
    'tax_rule',
    'product', 'stock_level', 'stock_movement', 'warehouse',
    'warehouse_bin', 'inventory_lot', 'inventory_serial', 'stock_location_balance',
    'inventory_adjustment', 'inventory_adjustment_line',
    'stock_transfer', 'stock_transfer_line',
    'warehouse_pick', 'warehouse_pick_line', 'stock_reservation',
    'customer', 'invoice', 'sales_order', 'sales_order_line',
    'account', 'gl_entry',
    'goods_receipt', 'purchase_order', 'purchase_order_line',
    'supplier', 'supplier_invoice',
    'activity', 'opportunity',
    'api_idempotency'
  ];
BEGIN
  FOREACH table_name IN ARRAY company_tables LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', table_name);
    EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY', table_name);
    EXECUTE format('DROP POLICY IF EXISTS tenant_scope ON %I', table_name);
    EXECUTE format(
      'CREATE POLICY tenant_scope ON %I
       USING (
         master_fn = current_setting(''app.master_fn'', true)
         AND company_fn = current_setting(''app.company_fn'', true)
       )
       WITH CHECK (
         master_fn = current_setting(''app.master_fn'', true)
         AND company_fn = current_setting(''app.company_fn'', true)
       )',
      table_name
    );
  END LOOP;
END $$;

-- master, company, app_user, role, role_permission, app_session, user_company,
-- user_invitation, password_reset_token, auth_rate_limit, outbox_event and
-- audit_log are security/configuration/worker
-- infrastructure accessed before/around a tenant transaction. They are not
-- exposed through generic resources and require separately restricted grants on
-- the API database role. audit_log remains insert/select only to that role.

COMMIT;
