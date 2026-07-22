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
    'work_center', 'manufacturing_bom', 'bom_version', 'bom_component',
    'manufacturing_routing', 'routing_operation',
    'work_order', 'work_order_material', 'work_order_operation',
    'mrp_run', 'mrp_suggestion',
    'quality_inspection_plan', 'quality_inspection_plan_item',
    'quality_inspection', 'quality_inspection_result',
    'quality_ncr', 'quality_corrective_action',
    'customer', 'invoice', 'sales_order', 'sales_order_line',
    'sales_enquiry', 'sales_quotation', 'sales_quotation_line',
    'sales_delivery', 'sales_delivery_line',
    'sales_return', 'sales_return_line', 'sales_credit_note', 'sales_credit_note_line',
    'sales_debit_note',
    'sales_price_list', 'sales_price_list_line', 'sales_discount_rule',
    'sales_credit_profile',
    'account', 'gl_entry',
    'goods_receipt', 'purchase_order', 'purchase_order_line',
    'purchase_requisition', 'purchase_requisition_line',
    'purchase_rfq', 'purchase_rfq_line', 'purchase_rfq_supplier',
    'supplier', 'supplier_invoice', 'supplier_quotation', 'supplier_quotation_line',
    'bank_receipt', 'payment_voucher', 'payment_voucher_line',
    'activity', 'opportunity', 'contact',
    'asset', 'depreciation_run', 'depreciation_run_line',
    'employee', 'leave_request',
    'project', 'progress_claim',
    'service_contract', 'service_ticket',
    'payroll_run', 'payroll_run_line',
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
