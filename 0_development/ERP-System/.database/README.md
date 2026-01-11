# .database（PostgreSQL 迁移与初始化）

本目录包含 PostgreSQL 的迁移脚本与初始化工具，用于给后端提供 schema + demo 数据。

## 内容

- 迁移脚本：`.database/migrations/`
  - `001_init_schema.sql`：创建表结构（当前创建 20 张表）
  - `002_seed_data.sql`：演示数据（demo tenant/company/users 等）
  - `003_add_username_to_users.sql`：补充迁移
- 初始化脚本：`.database/setup.sh`

## 推荐流程

```bash
cd .database
chmod +x setup.sh
./setup.sh
```

## 多库模式提醒

后端如果开启严格映射（`DB_REQUIRE_COMPANY_DB_MAP=true`），你需要维护：

- `server/.env` 的 `DB_COMPANY_DB_MAP`（companyKey -> databaseName）

否则业务接口会因为无法映射数据库而返回 400。

## 详细说明（短文档）

- `.database/docs/quickstart.md`
- `.database/docs/setup-wizard.md`
- `.database/docs/database-design.md`
- `.database/docs/production-deployment.md`

