-- ============================================
-- Seed Data for Demo Tenant
-- Creates a sample tenant with users and basic data
-- ============================================

-- 1. Create Demo Tenant
INSERT INTO tenants (id, name, status, subscription_tier, features) VALUES
('tenant-demo-001', 'TechFlow Solutions', 'Active', 'Enterprise', 
 '{"SALES": true, "FINANCE": true, "INVENTORY": true, "HR": true, "PROCUREMENT": true}'::jsonb);

-- 2. Create Demo Companies
INSERT INTO companies (id, tenant_id, name, currency, country, timezone, status, features) VALUES
('comp-us-001', 'tenant-demo-001', 'TechFlow US Branch', 'USD', 'United States', 'America/New_York', 'Active',
 '{"SALES": true, "FINANCE": true, "INVENTORY": true, "HR": true}'::jsonb),
('comp-eu-001', 'tenant-demo-001', 'TechFlow EU Branch', 'EUR', 'Germany', 'Europe/Berlin', 'Active',
 '{"SALES": true, "FINANCE": true, "INVENTORY": true}'::jsonb);

-- 3. Create System Roles
INSERT INTO roles (id, tenant_id, name, description, is_system_role) VALUES
('role-platform-admin', NULL, 'Platform Administrator', 'Full system access', true),
('role-admin-001', 'tenant-demo-001', 'Tenant Administrator', 'Full tenant access', false),
('role-sales-001', 'tenant-demo-001', 'Sales Manager', 'Sales module access', false),
('role-finance-001', 'tenant-demo-001', 'Finance Manager', 'Finance module access', false),
('role-user-001', 'tenant-demo-001', 'Standard User', 'Basic user access', false);

-- 4. Assign Permissions to Roles

-- Platform Admin (all permissions)
INSERT INTO role_permissions (role_id, permission_id)
SELECT 'role-platform-admin', id FROM permissions;

-- Tenant Admin (all except platform)
INSERT INTO role_permissions (role_id, permission_id)
SELECT 'role-admin-001', id FROM permissions WHERE code != 'PLATFORM_ADMIN';

-- Sales Manager
INSERT INTO role_permissions (role_id, permission_id)
SELECT 'role-sales-001', id FROM permissions WHERE module = 'SALES';

-- Finance Manager
INSERT INTO role_permissions (role_id, permission_id)
SELECT 'role-finance-001', id FROM permissions WHERE module = 'FINANCE';

-- Standard User (view only)
INSERT INTO role_permissions (role_id, permission_id)
SELECT 'role-user-001', id FROM permissions WHERE code LIKE '%_VIEW';

-- 5. Create Demo Users
-- Password: "password" hashed with bcrypt
-- Hash: $2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy

INSERT INTO users (id, tenant_id, email, password_hash, name, status, default_company_id) VALUES
('user-super-001', NULL, 'super@nexuserp.io', '$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy', 
 'Super Admin', 'Active', NULL),
('user-alice-001', 'tenant-demo-001', 'alice@techflow.com', '$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy',
 'Alice Johnson', 'Active', 'comp-us-001'),
('user-bob-001', 'tenant-demo-001', 'bob@techflow.com', '$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy',
 'Bob Smith', 'Active', 'comp-us-001'),
('user-carol-001', 'tenant-demo-001', 'carol@techflow.com', '$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy',
 'Carol Davis', 'Active', 'comp-us-001');

-- 6. Assign Roles to Users
INSERT INTO user_roles (user_id, role_id) VALUES
('user-super-001', 'role-platform-admin'),
('user-alice-001', 'role-admin-001'),
('user-bob-001', 'role-sales-001'),
('user-carol-001', 'role-finance-001');

-- 7. Assign Company Access
INSERT INTO user_companies (user_id, company_id) VALUES
('user-alice-001', 'comp-us-001'),
('user-alice-001', 'comp-eu-001'),
('user-bob-001', 'comp-us-001'),
('user-carol-001', 'comp-us-001');

-- 8. Create Sample Customers
INSERT INTO customers (id, tenant_id, company_id, code, name, email, phone, country, credit_limit, payment_terms, created_by) VALUES
('cust-001', 'tenant-demo-001', 'comp-us-001', 'C001', 'Acme Corporation', 'contact@acme.com', '+1-555-0100', 'United States', 50000.00, 'Net 30', 'user-alice-001'),
('cust-002', 'tenant-demo-001', 'comp-us-001', 'C002', 'Global Tech Inc', 'sales@globaltech.com', '+1-555-0200', 'United States', 75000.00, 'Net 45', 'user-alice-001'),
('cust-003', 'tenant-demo-001', 'comp-us-001', 'C003', 'Innovate Solutions', 'info@innovate.com', '+1-555-0300', 'United States', 30000.00, 'Net 30', 'user-alice-001');

-- 9. Create Sample Items
INSERT INTO items (id, tenant_id, company_id, code, name, description, item_type, unit_of_measure, standard_cost, selling_price, created_by) VALUES
('item-001', 'tenant-demo-001', 'comp-us-001', 'PROD-001', 'Enterprise Software License', 'Annual software license', 'Service', 'EA', 500.00, 1200.00, 'user-alice-001'),
('item-002', 'tenant-demo-001', 'comp-us-001', 'PROD-002', 'Professional Services', 'Consulting hours', 'Service', 'HR', 80.00, 150.00, 'user-alice-001'),
('item-003', 'tenant-demo-001', 'comp-us-001', 'PROD-003', 'Hardware Device', 'IoT sensor device', 'Product', 'EA', 45.00, 99.00, 'user-alice-001');

-- 10. Create Warehouses
INSERT INTO warehouses (id, tenant_id, company_id, code, name, location) VALUES
('wh-001', 'tenant-demo-001', 'comp-us-001', 'WH-NY', 'New York Warehouse', 'New York, NY'),
('wh-002', 'tenant-demo-001', 'comp-us-001', 'WH-CA', 'California Warehouse', 'Los Angeles, CA');

-- 11. Create Chart of Accounts
INSERT INTO accounts (id, tenant_id, company_id, code, name, account_type) VALUES
-- Assets
('acc-1000', 'tenant-demo-001', 'comp-us-001', '1000', 'Cash', 'Asset'),
('acc-1100', 'tenant-demo-001', 'comp-us-001', '1100', 'Accounts Receivable', 'Asset'),
('acc-1200', 'tenant-demo-001', 'comp-us-001', '1200', 'Inventory', 'Asset'),
-- Liabilities
('acc-2000', 'tenant-demo-001', 'comp-us-001', '2000', 'Accounts Payable', 'Liability'),
('acc-2100', 'tenant-demo-001', 'comp-us-001', '2100', 'Sales Tax Payable', 'Liability'),
-- Equity
('acc-3000', 'tenant-demo-001', 'comp-us-001', '3000', 'Owner Equity', 'Equity'),
('acc-3100', 'tenant-demo-001', 'comp-us-001', '3100', 'Retained Earnings', 'Equity'),
-- Revenue
('acc-4000', 'tenant-demo-001', 'comp-us-001', '4000', 'Sales Revenue', 'Revenue'),
('acc-4100', 'tenant-demo-001', 'comp-us-001', '4100', 'Service Revenue', 'Revenue'),
-- Expenses
('acc-5000', 'tenant-demo-001', 'comp-us-001', '5000', 'Cost of Goods Sold', 'Expense'),
('acc-5100', 'tenant-demo-001', 'comp-us-001', '5100', 'Operating Expenses', 'Expense'),
('acc-5200', 'tenant-demo-001', 'comp-us-001', '5200', 'Salaries Expense', 'Expense');

-- 12. Create Running Number Configurations
INSERT INTO running_number_configs (id, tenant_id, company_id, doc_type, name, prefix, date_format, sequence_length, next_sequence, is_default) VALUES
('rn-quote-001', 'tenant-demo-001', 'comp-us-001', 'QUOTE', 'Quote Numbering', 'QT', 'YYYYMM', 4, 1, true),
('rn-order-001', 'tenant-demo-001', 'comp-us-001', 'ORDER', 'Sales Order Numbering', 'SO', 'YYYYMM', 4, 1, true),
('rn-invoice-001', 'tenant-demo-001', 'comp-us-001', 'INVOICE', 'Invoice Numbering', 'INV', 'YYYYMM', 4, 1, true),
('rn-journal-001', 'tenant-demo-001', 'comp-us-001', 'JOURNAL', 'Journal Entry Numbering', 'JE', 'YYYYMM', 4, 1, true);

-- 13. Create Sample Sales Documents
INSERT INTO sales_documents (id, tenant_id, company_id, doc_type, doc_number, customer_id, customer_name, doc_date, status, currency, subtotal, tax_amount, total_amount, created_by) VALUES
('doc-001', 'tenant-demo-001', 'comp-us-001', 'QUOTE', 'QT202601-0001', 'cust-001', 'Acme Corporation', '2026-01-05', 'Posted', 'USD', 12000.00, 960.00, 12960.00, 'user-bob-001'),
('doc-002', 'tenant-demo-001', 'comp-us-001', 'ORDER', 'SO202601-0001', 'cust-002', 'Global Tech Inc', '2026-01-08', 'Posted', 'USD', 15000.00, 1200.00, 16200.00, 'user-bob-001'),
('doc-003', 'tenant-demo-001', 'comp-us-001', 'INVOICE', 'INV202601-0001', 'cust-003', 'Innovate Solutions', '2026-01-09', 'Posted', 'USD', 4500.00, 360.00, 4860.00, 'user-bob-001');

-- 14. Create Sales Document Lines
INSERT INTO sales_document_lines (id, document_id, line_number, item_code, item_name, quantity, unit_price, tax_rate, line_total) VALUES
('line-001', 'doc-001', 1, 'PROD-001', 'Enterprise Software License', 10, 1200.00, 8.00, 12000.00),
('line-002', 'doc-002', 1, 'PROD-002', 'Professional Services', 100, 150.00, 8.00, 15000.00),
('line-003', 'doc-003', 1, 'PROD-003', 'Hardware Device', 50, 99.00, 8.00, 4950.00),
('line-004', 'doc-003', 2, 'PROD-002', 'Professional Services', 5, 150.00, 8.00, 750.00);

-- ============================================
-- COMPLETION MESSAGE
-- ============================================

DO $$
BEGIN
    RAISE NOTICE '✅ Seed data created successfully!';
    RAISE NOTICE '';
    RAISE NOTICE '📊 Demo Data Summary:';
    RAISE NOTICE '  - Tenant: TechFlow Solutions';
    RAISE NOTICE '  - Companies: 2 (US & EU branches)';
    RAISE NOTICE '  - Users: 4';
    RAISE NOTICE '  - Customers: 3';
    RAISE NOTICE '  - Items: 3';
    RAISE NOTICE '  - Sales Documents: 3';
    RAISE NOTICE '';
    RAISE NOTICE '🔐 Demo Login Credentials:';
    RAISE NOTICE '  Platform Admin: super@nexuserp.io / password';
    RAISE NOTICE '  Tenant Admin:   alice@techflow.com / password';
    RAISE NOTICE '  Sales Manager:  bob@techflow.com / password';
    RAISE NOTICE '  Finance Manager: carol@techflow.com / password';
END $$;
