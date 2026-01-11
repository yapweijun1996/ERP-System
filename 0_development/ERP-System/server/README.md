# Server（后端）运行与配置说明

本目录是 Nexus ERP 后端（Express + PostgreSQL）。

## 1) 环境变量（.env）

后端入口 `src/index.js` 会执行 `dotenv.config()`，默认读取“进程当前工作目录（cwd）”下的 `.env`。

因此：
- 用 `pm2` / `pm2-manager` 启动时，如果带 `--cwd server`，就会读取 `server/.env`
- 用 `cd server` 后再 `node src/index.js` / `npm start`，同样会读取 `server/.env`

`server/.env` 里常用项：
- `PORT`：API 端口（你现在是 `6601`）
- `DB_HOST` `DB_PORT` `DB_NAME` `DB_USER` `DB_PASSWORD`
- `DB_COMPANY_DB_MAP`：公司 -> 数据库名映射（JSON 字符串）
- `DB_REQUIRE_COMPANY_DB_MAP=true`：强制要求 company 映射存在（更严格的多库隔离）
- `JWT_SECRET`：JWT 密钥（生产环境务必替换成强随机值）
- `CORS_ORIGIN`：允许的前端来源

## 2) 如何启动（开发 / 生产）

### 开发（推荐）
在 `server/`：
- `npm run dev`（nodemon）

### 生产/常驻（PM2 管控）
在仓库根目录使用 `pm2-manager`（本项目自带的管理器）：
- `node pm2-manager.js`
- 选择 `a` start all / `r` restart all / `s` stop all / `d` delete all

注意：`pm2-manager.config.json` 里后端是通过 `pm2 start src/index.js --name ERP-backend --cwd server` 启动的，所以会自动读取 `server/.env`。

## 3) companyId / 多公司数据库切换

后端有按请求切换数据库的中间件（`src/middleware/companyDbContext.js`）：
- 优先从 JWT token 里的 `companyId`
- 其次从请求头 `x-company-id`
- 再其次从 URL query `?company=...`

当 `DB_REQUIRE_COMPANY_DB_MAP=true`：
- 除了公开接口（如 `/api/auth/login`、`/api/auth/register` 等），其余 `/api/*` 请求必须带 company 标识
- 且 companyId 必须能在 `DB_COMPANY_DB_MAP` 中找到映射

## 4) 登录方式（Bearer JWT / Cookie JWT）与 CSRF

后端同时支持两种方式携带 JWT：
- Bearer：请求头 `Authorization: Bearer <token>`（不需要 CSRF）
- Cookie：登录时由后端下发 `httpOnly` cookie（需要 CSRF）

### Cookie 模式如何开启
登录时加 query：
- `POST /api/auth/login?company=xxx&cookie=true`

或在 `server/.env` 设置默认启用：
- `AUTH_USE_COOKIE=true`

登录成功后：
- 后端会设置 `AUTH_COOKIE_NAME`（默认 `auth_token`，httpOnly）
- 同时设置 `CSRF_COOKIE_NAME`（默认 `csrf_token`，可被前端读取）
- 返回体里会带 `csrfToken`（方便前端首次拿到）

### CSRF 如何带
当你使用 Cookie 模式时，所有写操作（POST/PUT/PATCH/DELETE）需要：
- 请求头 `x-csrf-token: <csrf_token_cookie_value>`

后端采用 double-submit：校验 header 值必须等于 cookie 值。

### 登出（清理 Cookie）
- `POST /api/auth/logout`

## 4) 常见排查

- 端口不对：检查 `server/.env` 的 `PORT`
- CORS 被拒：检查根目录前端来源是否在 `server/.env` 的 `CORS_ORIGIN`，或 `src/index.js` 的 `allowedOrigins`
- DB 报 schema/table 不存在：确认 `DB_COMPANY_DB_MAP` 指到的数据库已跑过 `.database/migrations`
