# 🚀 Nexus ERP 生产环境部署指南

## Mac Mini + Cloudflare Tunnel 部署方案

---

## 📋 架构概览

```
Internet
    ↓
Cloudflare Tunnel (cloudflared)
    ↓
Mac Mini (localhost)
    ↓
┌─────────────────────────────────┐
│  Nginx (反向代理)                │
│  ├─ Frontend (静态文件) :80     │
│  └─ Backend API :3001           │
└─────────────────────────────────┘
    ↓
PostgreSQL :5432
```

---

## 🎯 快速测试(本地生产环境)

### 1. 构建前端
```bash
npm run build
```

### 2. 预览生产版本
```bash
npm run preview
```
访问: `http://localhost:4173`

### 3. 启动生产后端
```bash
cd server
NODE_ENV=production npm start
```

---

## 🔧 完整部署步骤

### 步骤 1: 准备 Mac Mini

#### 1.1 安装必要软件
```bash
# Homebrew (如果还没安装)
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"

# Node.js (已安装 ✅)
# PostgreSQL (已安装 ✅)

# Nginx
brew install nginx

# PM2 (进程管理器)
npm install -g pm2

# Cloudflare Tunnel
brew install cloudflare/cloudflare/cloudflared
```

#### 1.2 配置 PostgreSQL
```bash
# 启动 PostgreSQL
brew services start postgresql@18

# 创建生产数据库
createdb nexus_erp_production

# 运行迁移
cd /path/to/ERP-System/.database
psql -d nexus_erp_production -f migrations/001_init_schema.sql
psql -d nexus_erp_production -f migrations/002_seed_data.sql
```

---

### 步骤 2: 配置后端

#### 2.1 创建生产环境配置
```bash
cd server
cp .env .env.production
```

编辑 `server/.env.production`:
```env
# Database
DB_HOST=localhost
DB_PORT=5432
DB_NAME=nexus_erp_production
DB_USER=yapweijun
DB_PASSWORD=

# Server
PORT=3001
NODE_ENV=production

# JWT Secret (生成新的密钥!)
JWT_SECRET=$(openssl rand -base64 32)

# CORS (Cloudflare Tunnel 域名)
CORS_ORIGIN=https://your-app.yourdomain.com
```

#### 2.2 安装生产依赖
```bash
cd server
npm install --production
```

#### 2.3 使用 PM2 启动后端
```bash
# 创建 PM2 配置文件
cat > ecosystem.config.js << 'EOF'
module.exports = {
  apps: [{
    name: 'nexus-erp-api',
    script: 'src/index.js',
    cwd: '/Users/yapweijun/Documents/GitHub/ERP-System/0_development/ERP-System/server',
    instances: 2,
    exec_mode: 'cluster',
    env_production: {
      NODE_ENV: 'production',
      PORT: 3001
    },
    error_file: './logs/err.log',
    out_file: './logs/out.log',
    log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
    merge_logs: true,
    autorestart: true,
    max_memory_restart: '1G'
  }]
};
EOF

# 启动
pm2 start ecosystem.config.js --env production

# 设置开机自启
pm2 startup
pm2 save
```

---

### 步骤 3: 配置前端

#### 3.1 构建生产版本
```bash
cd /Users/yapweijun/Documents/GitHub/ERP-System/0_development/ERP-System

# 创建 .env.production
cat > .env.production << 'EOF'
VITE_API_URL=https://your-app.yourdomain.com/api
EOF

# 构建
npm run build
```

#### 3.2 部署到 Nginx
```bash
# 创建部署目录
sudo mkdir -p /usr/local/var/www/nexus-erp
sudo cp -r dist/* /usr/local/var/www/nexus-erp/
sudo chown -R yapweijun:staff /usr/local/var/www/nexus-erp
```

---

### 步骤 4: 配置 Nginx

#### 4.1 创建 Nginx 配置
```bash
sudo nano /usr/local/etc/nginx/servers/nexus-erp.conf
```

添加以下内容:
```nginx
server {
    listen 8080;
    server_name localhost;

    # 前端静态文件
    location / {
        root /usr/local/var/www/nexus-erp;
        try_files $uri $uri/ /index.html;
        
        # 缓存策略
        location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg)$ {
            expires 1y;
            add_header Cache-Control "public, immutable";
        }
    }

    # API 代理
    location /api {
        proxy_pass http://localhost:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }

    # Gzip 压缩
    gzip on;
    gzip_vary on;
    gzip_min_length 1024;
    gzip_types text/plain text/css text/xml text/javascript 
               application/x-javascript application/xml+rss 
               application/json application/javascript;
}
```

#### 4.2 启动 Nginx
```bash
# 测试配置
sudo nginx -t

# 启动 Nginx
brew services start nginx

# 或重启
brew services restart nginx
```

---

### 步骤 5: 配置 Cloudflare Tunnel

#### 5.1 登录 Cloudflare
```bash
cloudflared tunnel login
```
这会打开浏览器,选择您的域名并授权。

#### 5.2 创建 Tunnel
```bash
# 创建 tunnel
cloudflared tunnel create nexus-erp

# 记录 Tunnel ID (会显示在输出中)
# 例如: Created tunnel nexus-erp with id abc123-def456-ghi789
```

#### 5.3 配置 Tunnel
```bash
# 创建配置文件
mkdir -p ~/.cloudflared
nano ~/.cloudflared/config.yml
```

添加以下内容:
```yaml
tunnel: nexus-erp
credentials-file: /Users/yapweijun/.cloudflared/<TUNNEL-ID>.json

ingress:
  # 主应用
  - hostname: erp.yourdomain.com
    service: http://localhost:8080
  
  # API (可选,如果需要单独域名)
  - hostname: api.yourdomain.com
    service: http://localhost:3001
  
  # 默认规则(必须)
  - service: http_status:404
```

#### 5.4 配置 DNS
```bash
# 创建 DNS 记录
cloudflared tunnel route dns nexus-erp erp.yourdomain.com
cloudflared tunnel route dns nexus-erp api.yourdomain.com  # 可选
```

#### 5.5 启动 Tunnel
```bash
# 测试运行
cloudflared tunnel run nexus-erp

# 如果正常,设置为服务
cloudflared service install

# 启动服务
sudo launchctl start com.cloudflare.cloudflared
```

---

## 🔒 安全配置

### 1. 更新后端 CORS
编辑 `server/.env.production`:
```env
CORS_ORIGIN=https://erp.yourdomain.com
```

### 2. 生成新的 JWT Secret
```bash
openssl rand -base64 32
```
将结果添加到 `server/.env.production`

### 3. PostgreSQL 安全
```sql
-- 创建专用数据库用户
CREATE USER nexus_erp_user WITH PASSWORD 'your_secure_password';
GRANT ALL PRIVILEGES ON DATABASE nexus_erp_production TO nexus_erp_user;
```

更新 `server/.env.production`:
```env
DB_USER=nexus_erp_user
DB_PASSWORD=your_secure_password
```

---

## 📊 监控和维护

### PM2 命令
```bash
# 查看状态
pm2 status

# 查看日志
pm2 logs nexus-erp-api

# 重启
pm2 restart nexus-erp-api

# 停止
pm2 stop nexus-erp-api

# 监控
pm2 monit
```

### Nginx 命令
```bash
# 测试配置
sudo nginx -t

# 重启
brew services restart nginx

# 查看日志
tail -f /usr/local/var/log/nginx/access.log
tail -f /usr/local/var/log/nginx/error.log
```

### Cloudflare Tunnel 命令
```bash
# 查看 tunnel 列表
cloudflared tunnel list

# 查看 tunnel 信息
cloudflared tunnel info nexus-erp

# 重启服务
sudo launchctl stop com.cloudflare.cloudflared
sudo launchctl start com.cloudflare.cloudflared
```

### 数据库备份
```bash
# 创建备份脚本
cat > ~/backup-db.sh << 'EOF'
#!/bin/bash
BACKUP_DIR=~/database-backups
mkdir -p $BACKUP_DIR
DATE=$(date +%Y%m%d_%H%M%S)
pg_dump nexus_erp_production > $BACKUP_DIR/nexus_erp_$DATE.sql
# 保留最近 30 天的备份
find $BACKUP_DIR -name "nexus_erp_*.sql" -mtime +30 -delete
EOF

chmod +x ~/backup-db.sh

# 添加到 crontab (每天凌晨 2 点备份)
crontab -e
# 添加: 0 2 * * * /Users/yapweijun/backup-db.sh
```

---

## 🚀 部署检查清单

### 准备阶段
- [ ] PostgreSQL 已安装并运行
- [ ] Node.js 已安装
- [ ] Nginx 已安装
- [ ] PM2 已安装
- [ ] Cloudflared 已安装

### 数据库
- [ ] 生产数据库已创建
- [ ] 迁移脚本已运行
- [ ] 数据库用户已创建
- [ ] 备份脚本已配置

### 后端
- [ ] 生产环境配置已创建
- [ ] JWT Secret 已生成
- [ ] CORS 已正确配置
- [ ] PM2 已启动
- [ ] 开机自启已设置

### 前端
- [ ] 生产构建已完成
- [ ] 静态文件已部署到 Nginx
- [ ] API URL 已正确配置

### Nginx
- [ ] 配置文件已创建
- [ ] 配置测试通过
- [ ] Nginx 已启动
- [ ] Gzip 压缩已启用

### Cloudflare Tunnel
- [ ] Tunnel 已创建
- [ ] DNS 记录已配置
- [ ] Tunnel 服务已启动
- [ ] HTTPS 可访问

### 安全
- [ ] 强密码已设置
- [ ] JWT Secret 已更新
- [ ] CORS 已限制
- [ ] 防火墙已配置(可选)

---

## 🔍 故障排除

### 问题 1: Nginx 无法启动
```bash
# 检查配置
sudo nginx -t

# 查看错误日志
tail -f /usr/local/var/log/nginx/error.log

# 检查端口占用
lsof -i :8080
```

### 问题 2: PM2 应用崩溃
```bash
# 查看日志
pm2 logs nexus-erp-api --lines 100

# 重启
pm2 restart nexus-erp-api

# 检查环境变量
pm2 env 0
```

### 问题 3: Cloudflare Tunnel 连接失败
```bash
# 检查 tunnel 状态
cloudflared tunnel info nexus-erp

# 查看日志
sudo launchctl list | grep cloudflare
sudo tail -f /Library/Logs/com.cloudflare.cloudflared.err.log
```

### 问题 4: 数据库连接失败
```bash
# 测试连接
psql -d nexus_erp_production -c "SELECT 1"

# 检查 PostgreSQL 状态
brew services list | grep postgresql
```

---

## 📈 性能优化建议

### 1. 数据库优化
```sql
-- 创建索引
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_sales_docs_company ON sales_documents(company_id);
CREATE INDEX idx_sales_docs_date ON sales_documents(doc_date);

-- 定期 VACUUM
VACUUM ANALYZE;
```

### 2. Nginx 缓存
```nginx
# 在 http 块中添加
proxy_cache_path /tmp/nginx_cache levels=1:2 keys_zone=api_cache:10m max_size=100m inactive=60m;

# 在 location /api 中添加
proxy_cache api_cache;
proxy_cache_valid 200 5m;
proxy_cache_bypass $http_cache_control;
add_header X-Cache-Status $upstream_cache_status;
```

### 3. PM2 集群模式
```javascript
// ecosystem.config.js
instances: 'max',  // 使用所有 CPU 核心
exec_mode: 'cluster'
```

---

## 🎯 访问您的应用

部署完成后:

1. **通过 Cloudflare Tunnel**: `https://erp.yourdomain.com`
2. **本地访问**: `http://localhost:8080`
3. **API 端点**: `https://erp.yourdomain.com/api`

---

## 📚 相关文档

- [Cloudflare Tunnel 文档](https://developers.cloudflare.com/cloudflare-one/connections/connect-apps/)
- [PM2 文档](https://pm2.keymetrics.io/docs/usage/quick-start/)
- [Nginx 文档](https://nginx.org/en/docs/)
- [PostgreSQL 文档](https://www.postgresql.org/docs/)

---

**部署愉快! 🚀**

如有问题,请参考故障排除部分或查看日志文件。
