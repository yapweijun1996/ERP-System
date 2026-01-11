# 数据库设置向导（后端 /api/setup）

后端提供一组不需要登录的 setup API（路径前缀 `/api/setup`），用于：

- 检查数据库状态
- 列出可用数据库
- 创建数据库（依赖本机 `createdb/psql` 可执行）
- 初始化 schema / seed

## 常用接口

- `GET /api/setup/status`
- `GET /api/setup/databases`
- `POST /api/setup/create-database`
- `POST /api/setup/use-database`
- `POST /api/setup/init-schema?company=<companyKey>`
- `POST /api/setup/complete-onboarding?company=<companyKey>`

## 重要说明（多库模式）

当你开启 `DB_REQUIRE_COMPANY_DB_MAP=true`：

- 业务接口会强制要求 companyKey，并且必须能映射到数据库名
- 你需要维护 `DB_COMPANY_DB_MAP`（例如把 `vantajas` 映射到实际数据库名）

`init-schema` / `complete-onboarding` 会按 `companyKey -> databaseName` 选择数据库执行。

