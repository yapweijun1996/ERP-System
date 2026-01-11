# 数据库结构概览（以迁移为准）

本项目的数据库结构以 `.database/migrations/001_init_schema.sql` 为唯一事实来源。

## 当前表数量

迁移脚本当前创建 20 张表（你也可以在数据库里用 `\\dt` 查看）。

## 核心层次

- 平台/租户层：`tenants`、`companies`
- 用户与权限（RBAC）：`users`、`roles`、`permissions`、`role_permissions`、`user_roles`、`user_companies`
- 销售：`customers`、`sales_documents`、`sales_document_lines`、`running_number_configs`
- 库存：`items`、`warehouses`、`inventory_transactions`
- 财务：`accounts`、`journal_entries`、`journal_entry_lines`
- 其他：`audit_logs`、`notifications`

## 设计要点（当前实现）

- 多租户：业务表使用 `tenant_id`（不是 `client_id`）
- 软删除：多张业务表使用 `deleted_at`
- `updated_at`：迁移脚本内置统一 trigger 自动维护

