# Nexus ERP - PostgreSQL 数据库设计

## 概览

本文档定义了 Nexus ERP 系统的 PostgreSQL 数据库架构,支持多租户 SaaS 架构。

## 数据库信息

- **数据库名称**: `nexus_erp`
- **PostgreSQL 版本**: 16.10+
- **字符集**: UTF8
- **时区**: UTC

---

## 架构设计原则

### 1. 多租户隔离
- 使用 `client_id` 和 `company_id` 实现数据隔离
- 所有业务表包含租户标识符
- Row-Level Security (RLS) 策略保护数据

### 2. 审计追踪
- 所有表包含 `created_at`, `updated_at`, `created_by`, `updated_by`
- 使用触发器自动更新时间戳

### 3. 软删除
- 关键业务表使用 `deleted_at` 实现软删除
- 保留历史数据用于审计

---

## 核心表结构

### 1. 平台层 (Platform Layer)

#### `tenants` - 租户/客户
```sql
CREATE TABLE tenants (
    id VARCHAR(50) PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'Active', -- Active, Onboarding, Suspended, Cancelled
    subscription_tier VARCHAR(50),
    features JSONB DEFAULT '{}',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP
);
```

#### `companies` - 公司/法人实体
```sql
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
```

---

### 2. 用户与权限 (RBAC)

#### `users` - 用户账户
```sql
CREATE TABLE users (
    id VARCHAR(50) PRIMARY KEY,
    tenant_id VARCHAR(50) REFERENCES tenants(id) ON DELETE CASCADE,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    name VARCHAR(255) NOT NULL,
    status VARCHAR(20) DEFAULT 'Active', -- Active, Inactive, Suspended
    last_login TIMESTAMP,
    default_company_id VARCHAR(50) REFERENCES companies(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP
);

CREATE INDEX idx_users_tenant ON users(tenant_id);
CREATE INDEX idx_users_email ON users(email);
```

#### `roles` - 角色定义
```sql
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
```

#### `permissions` - 权限定义
```sql
CREATE TABLE permissions (
    id VARCHAR(50) PRIMARY KEY,
    code VARCHAR(100) UNIQUE NOT NULL, -- e.g., SALES_CREATE, FINANCE_VIEW
    module VARCHAR(50) NOT NULL,
    description TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

#### `role_permissions` - 角色权限关联
```sql
CREATE TABLE role_permissions (
    role_id VARCHAR(50) REFERENCES roles(id) ON DELETE CASCADE,
    permission_id VARCHAR(50) REFERENCES permissions(id) ON DELETE CASCADE,
    PRIMARY KEY (role_id, permission_id)
);
```

#### `user_roles` - 用户角色关联
```sql
CREATE TABLE user_roles (
    user_id VARCHAR(50) REFERENCES users(id) ON DELETE CASCADE,
    role_id VARCHAR(50) REFERENCES roles(id) ON DELETE CASCADE,
    PRIMARY KEY (user_id, role_id)
);
```

#### `user_companies` - 用户公司访问权限
```sql
CREATE TABLE user_companies (
    user_id VARCHAR(50) REFERENCES users(id) ON DELETE CASCADE,
    company_id VARCHAR(50) REFERENCES companies(id) ON DELETE CASCADE,
    PRIMARY KEY (user_id, company_id)
);
```

---

### 3. 销售模块 (Sales)

#### `customers` - 客户主数据
```sql
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
```

#### `sales_documents` - 销售单据 (Quote, Order, Invoice)
```sql
CREATE TABLE sales_documents (
    id VARCHAR(50) PRIMARY KEY,
    tenant_id VARCHAR(50) NOT NULL REFERENCES tenants(id),
    company_id VARCHAR(50) NOT NULL REFERENCES companies(id),
    doc_type VARCHAR(20) NOT NULL, -- QUOTE, ORDER, INVOICE, DELIVERY
    doc_number VARCHAR(100) NOT NULL,
    series_id VARCHAR(50),
    customer_id VARCHAR(50) REFERENCES customers(id),
    customer_name VARCHAR(255),
    doc_date DATE NOT NULL,
    due_date DATE,
    status VARCHAR(20) DEFAULT 'Draft', -- Draft, Posted, Approved, Cancelled
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
```

#### `sales_document_lines` - 销售单据明细
```sql
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
```

---

### 4. 库存模块 (Inventory)

#### `items` - 物料主数据
```sql
CREATE TABLE items (
    id VARCHAR(50) PRIMARY KEY,
    tenant_id VARCHAR(50) NOT NULL REFERENCES tenants(id),
    company_id VARCHAR(50) NOT NULL REFERENCES companies(id),
    code VARCHAR(100) NOT NULL,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    item_type VARCHAR(20) DEFAULT 'Product', -- Product, Service, Asset
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
```

#### `warehouses` - 仓库
```sql
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
```

#### `inventory_transactions` - 库存交易
```sql
CREATE TABLE inventory_transactions (
    id VARCHAR(50) PRIMARY KEY,
    tenant_id VARCHAR(50) NOT NULL REFERENCES tenants(id),
    company_id VARCHAR(50) NOT NULL REFERENCES companies(id),
    warehouse_id VARCHAR(50) REFERENCES warehouses(id),
    item_id VARCHAR(50) REFERENCES items(id),
    transaction_type VARCHAR(20) NOT NULL, -- IN, OUT, ADJUST, TRANSFER
    quantity DECIMAL(15,3) NOT NULL,
    unit_cost DECIMAL(15,4),
    reference_type VARCHAR(50), -- SALES_ORDER, PURCHASE_ORDER, ADJUSTMENT
    reference_id VARCHAR(50),
    transaction_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    notes TEXT,
    created_by VARCHAR(50) REFERENCES users(id)
);

CREATE INDEX idx_inv_trans_company ON inventory_transactions(company_id);
CREATE INDEX idx_inv_trans_item ON inventory_transactions(item_id);
CREATE INDEX idx_inv_trans_warehouse ON inventory_transactions(warehouse_id);
```

---

### 5. 财务模块 (Finance)

#### `accounts` - 会计科目表
```sql
CREATE TABLE accounts (
    id VARCHAR(50) PRIMARY KEY,
    tenant_id VARCHAR(50) NOT NULL REFERENCES tenants(id),
    company_id VARCHAR(50) NOT NULL REFERENCES companies(id),
    code VARCHAR(50) NOT NULL,
    name VARCHAR(255) NOT NULL,
    account_type VARCHAR(50) NOT NULL, -- Asset, Liability, Equity, Revenue, Expense
    parent_id VARCHAR(50) REFERENCES accounts(id),
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP,
    UNIQUE(company_id, code)
);

CREATE INDEX idx_accounts_company ON accounts(company_id);
CREATE INDEX idx_accounts_type ON accounts(account_type);
```

#### `journal_entries` - 会计分录
```sql
CREATE TABLE journal_entries (
    id VARCHAR(50) PRIMARY KEY,
    tenant_id VARCHAR(50) NOT NULL REFERENCES tenants(id),
    company_id VARCHAR(50) NOT NULL REFERENCES companies(id),
    entry_number VARCHAR(100) NOT NULL,
    entry_date DATE NOT NULL,
    description TEXT,
    status VARCHAR(20) DEFAULT 'Draft', -- Draft, Posted, Reversed
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
```

#### `journal_entry_lines` - 分录明细
```sql
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
```

---

### 6. 系统配置

#### `running_number_configs` - 单据编号规则
```sql
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
```

#### `notifications` - 系统通知
```sql
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
    status VARCHAR(20) DEFAULT 'UNREAD', -- UNREAD, READ, ARCHIVED
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    read_at TIMESTAMP
);

CREATE INDEX idx_notifications_user ON notifications(user_id);
CREATE INDEX idx_notifications_status ON notifications(status);
```

#### `audit_logs` - 审计日志
```sql
CREATE TABLE audit_logs (
    id BIGSERIAL PRIMARY KEY,
    tenant_id VARCHAR(50),
    company_id VARCHAR(50),
    user_id VARCHAR(50) REFERENCES users(id),
    action VARCHAR(50) NOT NULL, -- CREATE, UPDATE, DELETE, LOGIN, LOGOUT
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
```

---

## 触发器和函数

### 自动更新时间戳
```sql
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- 应用到所有需要的表
CREATE TRIGGER update_tenants_updated_at BEFORE UPDATE ON tenants
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_companies_updated_at BEFORE UPDATE ON companies
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ... (其他表类似)
```

---

## 初始数据种子

### 系统权限
```sql
INSERT INTO permissions (id, code, module, description) VALUES
('perm_001', 'SALES_VIEW', 'SALES', 'View sales documents'),
('perm_002', 'SALES_CREATE', 'SALES', 'Create sales documents'),
('perm_003', 'SALES_EDIT', 'SALES', 'Edit sales documents'),
('perm_004', 'SALES_POST', 'SALES', 'Post sales documents'),
('perm_005', 'FINANCE_VIEW', 'FINANCE', 'View financial data'),
('perm_006', 'FINANCE_POST', 'FINANCE', 'Post journal entries'),
('perm_007', 'INVENTORY_VIEW', 'INVENTORY', 'View inventory'),
('perm_008', 'INVENTORY_ADJUST', 'INVENTORY', 'Adjust inventory'),
('perm_009', 'ADMIN_USERS', 'ADMIN', 'Manage users'),
('perm_010', 'ADMIN_SETTINGS', 'ADMIN', 'Manage system settings');
```

---

## 性能优化建议

1. **分区表**: 对于大数据量表(如 `audit_logs`, `inventory_transactions`),考虑按时间分区
2. **物化视图**: 为复杂报表创建物化视图
3. **连接池**: 使用 pgBouncer 或应用层连接池
4. **定期维护**: 设置 VACUUM 和 ANALYZE 自动任务

---

## 安全建议

1. **Row-Level Security**: 启用 RLS 确保租户数据隔离
2. **加密**: 敏感字段使用 pgcrypto 加密
3. **备份**: 每日自动备份,保留 30 天
4. **SSL**: 强制使用 SSL 连接

---

## 迁移策略

1. 使用版本化迁移脚本 (见 `migrations/` 目录)
2. 每个迁移包含 UP 和 DOWN 脚本
3. 在生产环境应用前在测试环境验证
