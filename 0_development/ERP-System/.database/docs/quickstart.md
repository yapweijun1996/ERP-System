# 快速开始（数据库 + 后端）

目标：把 PostgreSQL 准备好，并让后端能连上正确的数据库。

## 1) 前置条件

- 已安装 PostgreSQL（本机 `psql` 可用）
- Node.js + npm

## 2) 初始化数据库（推荐用脚本）

```bash
cd .database
chmod +x setup.sh
./setup.sh
```

脚本会用迁移文件：

- `.database/migrations/001_init_schema.sql`
- `.database/migrations/002_seed_data.sql`

## 3) 配置后端（server/.env）

后端会读取 `server/.env`（pm2 启动时带 `--cwd server`）。

常用字段：

```env
DB_HOST=localhost
DB_PORT=5432
DB_USER=your_user
DB_PASSWORD=
PORT=6601

# 多库映射（严格模式建议开启）
DB_COMPANY_DB_MAP={"vantajas":"v1_20260110_vantajas_active"}
DB_REQUIRE_COMPANY_DB_MAP=true
```

## 4) 启动后端

```bash
cd server
npm install
npm run dev
```

健康检查：

```bash
curl http://localhost:6601/health
```

## 5) 登录要带 companyKey

companyKey 用于选择数据库：

```bash
curl -X POST "http://localhost:6601/api/auth/login?company=vantajas" \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"..."}'
```

