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
    'customer', 'invoice', 'sales_order', 'sales_order_approval', 'sales_order_line',
    'sales_enquiry', 'sales_quotation', 'sales_quotation_line',
    'sales_delivery', 'sales_delivery_line',
    'sales_return', 'sales_return_line', 'sales_credit_note', 'sales_credit_note_line',
    'sales_debit_note',
    'sales_price_list', 'sales_price_list_line', 'sales_discount_rule',
    'sales_credit_profile',
    'sales_commission_plan', 'sales_commission_run', 'sales_commission_line',
    'sales_commission_source',
    'account', 'gl_entry', 'journal_header', 'journal_line',
    'bank_statement', 'bank_statement_line',
    'goods_receipt', 'purchase_order', 'purchase_order_approval', 'purchase_order_line',
    'purchase_requisition', 'purchase_requisition_line',
    'purchase_rfq', 'purchase_rfq_line', 'purchase_rfq_supplier',
    'purchase_return', 'purchase_return_line',
    'supplier', 'supplier_invoice', 'supplier_quotation', 'supplier_quotation_line',
    'supplier_credit_note', 'supplier_credit_note_line', 'supplier_debit_note',
    'supplier_price_list', 'supplier_price_list_line',
    'landed_cost', 'landed_cost_line',
    'bank_receipt', 'payment_voucher', 'payment_voucher_line',
    'activity', 'opportunity', 'contact',
    'asset', 'depreciation_run', 'depreciation_run_line',
    'employee', 'employee_activation_secret', 'employee_account_handoff',
    'employee_hierarchy_scope', 'working_calendar', 'working_calendar_version',
    'calendar_holiday', 'leave_type', 'leave_policy_version', 'leave_balance_entry',
    'leave_request', 'leave_request_revision', 'leave_request_event', 'leave_evidence',
    'leave_cancellation_request',
    'approval_policy', 'approval_policy_version', 'approval_policy_step',
    'approval_instance', 'approval_instance_step', 'approval_decision',
    'approval_instance_event', 'approval_delegation', 'approval_capacity_snapshot',
    'leave_capacity_rule',
    'calendar_outbound_connection', 'calendar_outbound_event',
    'managed_document', 'document_version', 'document_blob', 'document_file_location',
    'project', 'progress_claim', 'project_time_entry',
    'service_contract', 'service_ticket',
    'payroll_run', 'payroll_run_line', 'payroll_leave_source', 'payroll_run_leave_source',
    'app_notification',
    'integration_connector',
    'company_policy',
    'document_sequence',
    'accounting_period',
    'financial_statement_account_map',
    'budget_version', 'budget_line',
    'consolidation_rate',
    'report_job', 'report_artifact',
    'api_idempotency',
    'import_job', 'import_job_row', 'import_row_error'
  ];
BEGIN
  FOREACH table_name IN ARRAY company_tables LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', table_name);
    EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY', table_name);
    EXECUTE format('DROP POLICY IF EXISTS tenant_scope ON %I', table_name);
    EXECUTE format(
      'CREATE POLICY tenant_scope ON %I
       USING (
         (
           master_fn = current_setting(''app.master_fn'', true)
           AND company_fn = current_setting(''app.company_fn'', true)
         )
         OR (
           %L
           AND current_setting(''app.reporting_worker'', true) = ''on''
         )
       )
       WITH CHECK (
         (
           master_fn = current_setting(''app.master_fn'', true)
           AND company_fn = current_setting(''app.company_fn'', true)
         )
         OR (
           %L
           AND current_setting(''app.reporting_worker'', true) = ''on''
         )
       )',
      table_name,
      table_name IN ('report_job', 'report_artifact'),
      table_name IN ('report_job', 'report_artifact')
    );
  END LOOP;
END $$;

-- master, company, app_user, role, role_permission, app_session, user_company,
-- user_company_role, user_invitation, password_reset_token, auth_rate_limit, outbox_event and
-- audit_log are security/configuration/worker
-- infrastructure accessed before/around a tenant transaction. They are not
-- exposed through generic resources and require separately restricted grants on
-- the API database role. audit_log remains insert/select only to that role.

COMMIT;
