# Nexus ERP（ERP-System）

全栈 ERP：前端（Vite + React）+ 后端（Node.js + Express）+ PostgreSQL。

后端支持“按 companyKey 切换数据库”的多库模式：同一套 API，可按请求把 SQL 路由到不同数据库。

## 目录结构

- 前端：仓库根目录（`npm run dev`）
- 后端：`server/`（入口 `server/src/index.js`）
- 数据库：`.database/`（迁移 `./.database/migrations/`）
- 进程管理：`pm2-manager.js` + `pm2-manager.config.json`

## 启动（开发）

### 1) 后端

```bash
cd server
npm install
npm run dev
```

- 端口：`server/.env` 的 `PORT`（当前默认 `6601`；若未设置则回退 `3001`）
- 健康检查：`GET /health`
- API 信息：`GET /api`

### 2) 前端

```bash
npm install
npm run dev
```

- Vite 默认端口通常是 `5173`

## 启动（pm2-manager）

```bash
node pm2-manager.js
```

- `ERP-backend`：用 `--cwd server` 启动，所以会读取 `server/.env`
- `ERP-frontend`：按配置运行在 `6600`（`--host 0.0.0.0 --port 6600`）

## 多库/多公司（companyKey）

companyKey 用于选择数据库，来源优先级：

1. JWT（`companyKey/companyId`）
2. Header `x-company-id`
3. Query `?company=...`

映射配置在 `server/.env`：

```env
DB_COMPANY_DB_MAP={"vantajas":"v1_20260110_vantajas_active"}
DB_REQUIRE_COMPANY_DB_MAP=true
```

严格模式（`DB_REQUIRE_COMPANY_DB_MAP=true`）下：除公开接口外，`/api/*` 必须带 companyKey 且能映射到数据库名。

## 登录（必须带 companyKey）

```bash
curl -X POST "http://localhost:6601/api/auth/login?company=vantajas" \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"..."}'
```

## 演示账号（seed 数据）

`002_seed_data.sql` 会创建 demo 数据，常见账号：

- `alice@techflow.com` / `password`
- `bob@techflow.com` / `password`
- `carol@techflow.com` / `password`
- `super@nexuserp.io` / `password`

## 文档

- 后端运行/鉴权/CSRF/多库：`server/README.md`
- 数据库迁移与初始化：`.database/README.md`

