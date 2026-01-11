# 生产部署（简版）

这份文档只保留“需要经常同步”的关键点；具体 Nginx/Cloudflare/机器配置请按你的实际环境维护。

## 建议的最小架构

- PostgreSQL：本机或托管
- 后端：`server/`（Node.js + Express）
- 前端：Vite build 输出静态文件（或用 Vite dev 仅用于开发）
- 反向代理：Nginx（可选）
- 进程管理：PM2（或 systemd）

## 关键配置点

- 后端端口：来自 `server/.env` 的 `PORT`（你当前使用 `6601`）
- CORS：`server/.env` 的 `CORS_ORIGIN` 需要匹配你的前端域名/端口
- JWT：生产环境必须设置强随机 `JWT_SECRET`
- 多库：若开启 `DB_REQUIRE_COMPANY_DB_MAP=true`，生产环境要维护好 `DB_COMPANY_DB_MAP`

