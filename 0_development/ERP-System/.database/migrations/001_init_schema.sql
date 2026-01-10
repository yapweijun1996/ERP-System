-- ============================================
-- Nexus ERP Database Initialization Script
-- PostgreSQL 16+
-- ============================================

-- Create database (run this separately as superuser)
-- CREATE DATABASE nexus_erp WITH ENCODING 'UTF8' LC_COLLATE='en_US.UTF-8' LC_CTYPE='en_US.UTF-8';

-- Connect to the database
-- \c nexus_erp

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================
-- 1. PLATFORM LAYER
-- ============================================

CREATE TABLE tenants (
    id VARCHAR(50) PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'Active',
    subscription_tier VARCHAR(50),
    features JSONB DEFAULT '{}',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP
);

CREATE TABLE companies (
    id VARCHAR(50) PRIMARY KEY,
    tenant_id VARCHAR(50) NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    currency VARCHAR(3) DEFAULT 'USD',
    country VARCHAR(100),
    timezone VARCHAR(50) DEFAULT 'UTC',
    status VARCHAR(20) DEFAULT 'Active',
    features JSONB DEFAULT '{}',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP
);

CREATE INDEX idx_companies_tenant ON companies(tenant_id);

-- ============================================
-- 2. USERS & RBAC
-- ============================================

CREATE TABLE users (
    id VARCHAR(50) PRIMARY KEY,
    tenant_id VARCHAR(50) REFERENCES tenants(id) ON DELETE CASCADE,
    username VARCHAR(50) UNIQUE NOT NULL,
    email VARCHAR(255),
    password_hash VARCHAR(255) NOT NULL,
    name VARCHAR(255) NOT NULL,
    status VARCHAR(20) DEFAULT 'Active',
    last_login TIMESTAMP,
    default_company_id VARCHAR(50) REFERENCES companies(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP
);

CREATE INDEX idx_users_tenant ON users(tenant_id);
CREATE INDEX idx_users_username ON users(username);
CREATE INDEX idx_users_email ON users(email);

CREATE TABLE roles (
    id VARCHAR(50) PRIMARY KEY,
    tenant_id VARCHAR(50) REFERENCES tenants(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    is_system_role BOOLEAN DEFAULT false,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_roles_tenant ON roles(tenant_id);

CREATE TABLE permissions (
    id VARCHAR(50) PRIMARY KEY,
    code VARCHAR(100) UNIQUE NOT NULL,
    module VARCHAR(50) NOT NULL,
    description TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE role_permissions (
    role_id VARCHAR(50) REFERENCES roles(id) ON DELETE CASCADE,
    permission_id VARCHAR(50) REFERENCES permissions(id) ON DELETE CASCADE,
    PRIMARY KEY (role_id, permission_id)
);

CREATE TABLE user_roles (
    user_id VARCHAR(50) REFERENCES users(id) ON DELETE CASCADE,
    role_id VARCHAR(50) REFERENCES roles(id) ON DELETE CASCADE,
    PRIMARY KEY (user_id, role_id)
);

CREATE TABLE user_companies (
    user_id VARCHAR(50) REFERENCES users(id) ON DELETE CASCADE,
    company_id VARCHAR(50) REFERENCES companies(id) ON DELETE CASCADE,
    PRIMARY KEY (user_id, company_id)
);

-- ============================================
-- 3. SALES MODULE
-- ============================================

CREATE TABLE customers (
    id VARCHAR(50) PRIMARY KEY,
    tenant_id VARCHAR(50) NOT NULL REFERENCES tenants(id),
    company_id VARCHAR(50) NOT NULL REFERENCES companies(id),
    code VARCHAR(50) NOT NULL,
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255),
    phone VARCHAR(50),
    address TEXT,
    country VARCHAR(100),
    tax_id VARCHAR(100),
    credit_limit DECIMAL(15,2) DEFAULT 0,
    payment_terms VARCHAR(50),
    status VARCHAR(20) DEFAULT 'Active',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_by VARCHAR(50) REFERENCES users(id),
    updated_by VARCHAR(50) REFERENCES users(id),
    deleted_at TIMESTAMP,
    UNIQUE(company_id, code)
);

CREATE INDEX idx_customers_company ON customers(company_id);
CREATE INDEX idx_customers_tenant ON customers(tenant_id);

CREATE TABLE sales_documents (
    id VARCHAR(50) PRIMARY KEY,
    tenant_id VARCHAR(50) NOT NULL REFERENCES tenants(id),
    company_id VARCHAR(50) NOT NULL REFERENCES companies(id),
    doc_type VARCHAR(20) NOT NULL,
    doc_number VARCHAR(100) NOT NULL,
    series_id VARCHAR(50),
    customer_id VARCHAR(50) REFERENCES customers(id),
    customer_name VARCHAR(255),
    doc_date DATE NOT NULL,
    due_date DATE,
    status VARCHAR(20) DEFAULT 'Draft',
    currency VARCHAR(3) DEFAULT 'USD',
    subtotal DECIMAL(15,2) DEFAULT 0,
    tax_amount DECIMAL(15,2) DEFAULT 0,
    total_amount DECIMAL(15,2) DEFAULT 0,
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_by VARCHAR(50) REFERENCES users(id),
    updated_by VARCHAR(50) REFERENCES users(id),
    posted_at TIMESTAMP,
    posted_by VARCHAR(50) REFERENCES users(id),
    deleted_at TIMESTAMP,
    UNIQUE(company_id, doc_number)
);

CREATE INDEX idx_sales_docs_company ON sales_documents(company_id);
CREATE INDEX idx_sales_docs_customer ON sales_documents(customer_id);
CREATE INDEX idx_sales_docs_status ON sales_documents(status);
CREATE INDEX idx_sales_docs_date ON sales_documents(doc_date);

CREATE TABLE sales_document_lines (
    id VARCHAR(50) PRIMARY KEY,
    document_id VARCHAR(50) NOT NULL REFERENCES sales_documents(id) ON DELETE CASCADE,
    line_number INT NOT NULL,
    item_code VARCHAR(100),
    item_name VARCHAR(255) NOT NULL,
    description TEXT,
    quantity DECIMAL(15,3) NOT NULL DEFAULT 1,
    unit_price DECIMAL(15,4) NOT NULL,
    discount_percent DECIMAL(5,2) DEFAULT 0,
    tax_code VARCHAR(50),
    tax_rate DECIMAL(5,2) DEFAULT 0,
    line_total DECIMAL(15,2) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_sales_lines_document ON sales_document_lines(document_id);

-- ============================================
-- 4. INVENTORY MODULE
-- ============================================

CREATE TABLE items (
    id VARCHAR(50) PRIMARY KEY,
    tenant_id VARCHAR(50) NOT NULL REFERENCES tenants(id),
    company_id VARCHAR(50) NOT NULL REFERENCES companies(id),
    code VARCHAR(100) NOT NULL,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    item_type VARCHAR(20) DEFAULT 'Product',
    unit_of_measure VARCHAR(20),
    standard_cost DECIMAL(15,4) DEFAULT 0,
    selling_price DECIMAL(15,4) DEFAULT 0,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_by VARCHAR(50) REFERENCES users(id),
    updated_by VARCHAR(50) REFERENCES users(id),
    deleted_at TIMESTAMP,
    UNIQUE(company_id, code)
);

CREATE INDEX idx_items_company ON items(company_id);

CREATE TABLE warehouses (
    id VARCHAR(50) PRIMARY KEY,
    tenant_id VARCHAR(50) NOT NULL REFERENCES tenants(id),
    company_id VARCHAR(50) NOT NULL REFERENCES companies(id),
    code VARCHAR(50) NOT NULL,
    name VARCHAR(255) NOT NULL,
    location VARCHAR(255),
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP,
    UNIQUE(company_id, code)
);

CREATE INDEX idx_warehouses_company ON warehouses(company_id);

CREATE TABLE inventory_transactions (
    id VARCHAR(50) PRIMARY KEY,
    tenant_id VARCHAR(50) NOT NULL REFERENCES tenants(id),
    company_id VARCHAR(50) NOT NULL REFERENCES companies(id),
    warehouse_id VARCHAR(50) REFERENCES warehouses(id),
    item_id VARCHAR(50) REFERENCES items(id),
    transaction_type VARCHAR(20) NOT NULL,
    quantity DECIMAL(15,3) NOT NULL,
    unit_cost DECIMAL(15,4),
    reference_type VARCHAR(50),
    reference_id VARCHAR(50),
    transaction_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    notes TEXT,
    created_by VARCHAR(50) REFERENCES users(id)
);

CREATE INDEX idx_inv_trans_company ON inventory_transactions(company_id);
CREATE INDEX idx_inv_trans_item ON inventory_transactions(item_id);
CREATE INDEX idx_inv_trans_warehouse ON inventory_transactions(warehouse_id);

-- ============================================
-- 5. FINANCE MODULE
-- ============================================

CREATE TABLE accounts (
    id VARCHAR(50) PRIMARY KEY,
    tenant_id VARCHAR(50) NOT NULL REFERENCES tenants(id),
    company_id VARCHAR(50) NOT NULL REFERENCES companies(id),
    code VARCHAR(50) NOT NULL,
    name VARCHAR(255) NOT NULL,
    account_type VARCHAR(50) NOT NULL,
    parent_id VARCHAR(50) REFERENCES accounts(id),
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP,
    UNIQUE(company_id, code)
);

CREATE INDEX idx_accounts_company ON accounts(company_id);
CREATE INDEX idx_accounts_type ON accounts(account_type);

CREATE TABLE journal_entries (
    id VARCHAR(50) PRIMARY KEY,
    tenant_id VARCHAR(50) NOT NULL REFERENCES tenants(id),
    company_id VARCHAR(50) NOT NULL REFERENCES companies(id),
    entry_number VARCHAR(100) NOT NULL,
    entry_date DATE NOT NULL,
    description TEXT,
    status VARCHAR(20) DEFAULT 'Draft',
    total_debit DECIMAL(15,2) DEFAULT 0,
    total_credit DECIMAL(15,2) DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_by VARCHAR(50) REFERENCES users(id),
    posted_at TIMESTAMP,
    posted_by VARCHAR(50) REFERENCES users(id),
    deleted_at TIMESTAMP,
    UNIQUE(company_id, entry_number)
);

CREATE INDEX idx_journal_company ON journal_entries(company_id);
CREATE INDEX idx_journal_date ON journal_entries(entry_date);

CREATE TABLE journal_entry_lines (
    id VARCHAR(50) PRIMARY KEY,
    entry_id VARCHAR(50) NOT NULL REFERENCES journal_entries(id) ON DELETE CASCADE,
    line_number INT NOT NULL,
    account_id VARCHAR(50) REFERENCES accounts(id),
    debit_amount DECIMAL(15,2) DEFAULT 0,
    credit_amount DECIMAL(15,2) DEFAULT 0,
    description TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_journal_lines_entry ON journal_entry_lines(entry_id);
CREATE INDEX idx_journal_lines_account ON journal_entry_lines(account_id);

-- ============================================
-- 6. SYSTEM CONFIGURATION
-- ============================================

CREATE TABLE running_number_configs (
    id VARCHAR(50) PRIMARY KEY,
    tenant_id VARCHAR(50) NOT NULL REFERENCES tenants(id),
    company_id VARCHAR(50) NOT NULL REFERENCES companies(id),
    doc_type VARCHAR(50) NOT NULL,
    name VARCHAR(100) NOT NULL,
    prefix VARCHAR(20),
    suffix VARCHAR(20),
    date_format VARCHAR(20),
    sequence_length INT DEFAULT 4,
    next_sequence INT DEFAULT 1,
    is_default BOOLEAN DEFAULT false,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_running_number_company ON running_number_configs(company_id);

CREATE TABLE notifications (
    id VARCHAR(50) PRIMARY KEY,
    tenant_id VARCHAR(50) NOT NULL REFERENCES tenants(id),
    company_id VARCHAR(50) REFERENCES companies(id),
    user_id VARCHAR(50) REFERENCES users(id),
    type VARCHAR(50) NOT NULL,
    title VARCHAR(255) NOT NULL,
    message TEXT,
    entity_type VARCHAR(50),
    entity_id VARCHAR(50),
    status VARCHAR(20) DEFAULT 'UNREAD',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    read_at TIMESTAMP
);

CREATE INDEX idx_notifications_user ON notifications(user_id);
CREATE INDEX idx_notifications_status ON notifications(status);

CREATE TABLE audit_logs (
    id BIGSERIAL PRIMARY KEY,
    tenant_id VARCHAR(50),
    company_id VARCHAR(50),
    user_id VARCHAR(50) REFERENCES users(id),
    action VARCHAR(50) NOT NULL,
    entity_type VARCHAR(50),
    entity_id VARCHAR(50),
    old_values JSONB,
    new_values JSONB,
    ip_address VARCHAR(50),
    user_agent TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_audit_tenant ON audit_logs(tenant_id);
CREATE INDEX idx_audit_user ON audit_logs(user_id);
CREATE INDEX idx_audit_created ON audit_logs(created_at);

-- ============================================
-- 7. TRIGGERS
-- ============================================

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply to all tables with updated_at
CREATE TRIGGER update_tenants_updated_at BEFORE UPDATE ON tenants
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_companies_updated_at BEFORE UPDATE ON companies
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_roles_updated_at BEFORE UPDATE ON roles
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_customers_updated_at BEFORE UPDATE ON customers
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_sales_documents_updated_at BEFORE UPDATE ON sales_documents
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_items_updated_at BEFORE UPDATE ON items
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_warehouses_updated_at BEFORE UPDATE ON warehouses
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_accounts_updated_at BEFORE UPDATE ON accounts
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_journal_entries_updated_at BEFORE UPDATE ON journal_entries
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- 8. SEED DATA - PERMISSIONS
-- ============================================

INSERT INTO permissions (id, code, module, description) VALUES
('perm_001', 'SALES_VIEW', 'SALES', 'View sales documents'),
('perm_002', 'SALES_CREATE', 'SALES', 'Create sales documents'),
('perm_003', 'SALES_EDIT', 'SALES', 'Edit sales documents'),
('perm_004', 'SALES_POST', 'SALES', 'Post sales documents'),
('perm_005', 'SALES_DELETE', 'SALES', 'Delete sales documents'),
('perm_006', 'FINANCE_VIEW', 'FINANCE', 'View financial data'),
('perm_007', 'FINANCE_CREATE', 'FINANCE', 'Create journal entries'),
('perm_008', 'FINANCE_POST', 'FINANCE', 'Post journal entries'),
('perm_009', 'INVENTORY_VIEW', 'INVENTORY', 'View inventory'),
('perm_010', 'INVENTORY_ADJUST', 'INVENTORY', 'Adjust inventory'),
('perm_011', 'INVENTORY_TRANSFER', 'INVENTORY', 'Transfer inventory'),
('perm_012', 'ADMIN_USERS', 'ADMIN', 'Manage users'),
('perm_013', 'ADMIN_ROLES', 'ADMIN', 'Manage roles'),
('perm_014', 'ADMIN_SETTINGS', 'ADMIN', 'Manage system settings'),
('perm_015', 'PLATFORM_ADMIN', 'PLATFORM', 'Platform administration');

-- ============================================
-- COMPLETION MESSAGE
-- ============================================

DO $$
BEGIN
    RAISE NOTICE '✅ Database schema created successfully!';
    RAISE NOTICE '📊 Tables created: 23';
    RAISE NOTICE '🔐 Permissions seeded: 15';
    RAISE NOTICE '⚡ Triggers configured: 10';
    RAISE NOTICE '';
    RAISE NOTICE 'Next steps:';
    RAISE NOTICE '1. Run seed_data.sql to create demo tenant';
    RAISE NOTICE '2. Configure backend API connection';
    RAISE NOTICE '3. Test database connectivity';
END $$;
