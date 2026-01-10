# Nexus ERP - PostgreSQL 集成版本

> **完整的 ERP 系统** - 从原型到生产就绪

[![Status](https://img.shields.io/badge/Status-Production_Ready-green)]()
[![Stack](https://img.shields.io/badge/Stack-React_19_•_Node.js_•_PostgreSQL-blue)]()
[![Database](https://img.shields.io/badge/Database-PostgreSQL_16+-orange)]()

---

## 🎯 项目概览

Nexus ERP 是一个**全栈企业资源规划系统**,支持多租户 SaaS 架构,现已集成真实的 PostgreSQL 数据库。

### ✨ 核心特性

- 🏢 **多租户架构** - Platform → Tenant → Company 三层隔离
- 🗄️ **PostgreSQL 数据库** - 23 张表,完整的关系型数据库设计
- 🔐 **RBAC 权限系统** - 角色和权限管理
- 🎨 **数据库设置向导** - 首次使用自动引导配置
- 📊 **完整业务模块** - 销售、库存、财务、HR
- 🔒 **JWT 认证** - 安全的用户认证系统
- 🚀 **生产就绪** - PM2 + Nginx + Cloudflare Tunnel

---

## 📦 技术栈

### 前端
- **React 19** - 现代化 UI 框架
- **TypeScript** - 类型安全
- **Tailwind CSS** - 实用优先的 CSS 框架
- **Vite** - 快速的构建工具
- **Recharts** - 数据可视化

### 后端
- **Node.js** v23.10.0 - JavaScript 运行时
- **Express** v4.21.2 - Web 框架
- **PostgreSQL** 16.10+ - 关系型数据库
- **node-postgres (pg)** - 数据库驱动
- **bcryptjs** - 密码加密
- **jsonwebtoken** - JWT 认证

### 部署
- **PM2** - 进程管理器
- **Nginx** - 反向代理
- **Cloudflare Tunnel** - 安全的远程访问

---

## 🚀 快速开始

### 前置要求

- Node.js v23+ 
- PostgreSQL 16+
- npm 10+

### 1. 克隆项目

```bash
git clone <repository-url>
cd ERP-System/0_development/ERP-System
```

### 2. 启动后端服务器

```bash
cd server
npm install
npm run dev
```

服务器将运行在 `http://localhost:3001`

### 3. 启动前端应用

```bash
# 在项目根目录
npm install
npm run dev
```

应用将运行在 `http://localhost:3000`

### 4. 首次使用 - 数据库设置向导

访问 `http://localhost:3000/`,您会看到**数据库设置向导**:

1. 选择 **"创建新数据库"**
2. 数据库名称: `nexus_erp` (默认)
3. ✅ 勾选 **"加载演示数据"**
4. 点击 **"创建数据库"**
5. 等待创建完成(约 5-10 秒)

### 5. 登录

使用演示账户:
- **邮箱**: `alice@techflow.com`
- **密码**: `password`

---

## 📚 文档

### 核心文档
- **[数据库设计](.database/DATABASE_DESIGN.md)** - 完整的数据库架构
- **[快速开始](.database/QUICKSTART.md)** - 详细的设置指南
- **[设置向导](.database/SETUP_WIZARD_GUIDE.md)** - 数据库设置向导使用说明
- **[生产部署](.database/PRODUCTION_DEPLOYMENT.md)** - Mac Mini + Cloudflare Tunnel 部署方案

### 数据库
- **23 张表** - 租户、公司、用户、角色、权限、销售、库存、财务
- **自动迁移** - SQL 脚本位于 `.database/migrations/`
- **演示数据** - 包含示例租户、用户和业务数据

---

## 🗄️ 数据库架构

### 核心表

#### 平台层
- `tenants` - 租户/客户
- `companies` - 公司/法人实体

#### 用户与权限
- `users` - 用户账户
- `roles` - 角色定义
- `permissions` - 权限定义
- `role_permissions` - 角色权限关联
- `user_roles` - 用户角色关联

#### 业务模块
- `customers` - 客户主数据
- `sales_documents` - 销售单据
- `items` - 物料主数据
- `warehouses` - 仓库
- `accounts` - 会计科目表
- `journal_entries` - 会计分录

查看 [DATABASE_DESIGN.md](.database/DATABASE_DESIGN.md) 了解完整架构。

---

## 🔧 开发

### 目录结构

```
ERP-System/
├── .database/                  # 数据库相关
│   ├── DATABASE_DESIGN.md     # 数据库设计文档
│   ├── QUICKSTART.md          # 快速开始指南
│   ├── SETUP_WIZARD_GUIDE.md  # 设置向导指南
│   ├── PRODUCTION_DEPLOYMENT.md # 生产部署指南
│   ├── setup.sh               # 数据库设置脚本
│   └── migrations/            # SQL 迁移脚本
│
├── server/                     # 后端 API
│   ├── src/
│   │   ├── index.js           # 服务器入口
│   │   ├── db/                # 数据库连接
│   │   └── routes/            # API 路由
│   ├── package.json
│   ├── ecosystem.config.js    # PM2 配置
│   └── .env                   # 环境变量
│
├── components/                 # React 组件
│   ├── Setup/                 # 数据库设置向导
│   ├── Layout/                # 布局组件
│   └── UI/                    # UI 组件
│
├── pages/                      # 页面组件
├── context/                    # React Context
├── types/                      # TypeScript 类型
└── App.tsx                     # 应用入口
```

### 可用脚本

#### 前端
```bash
npm run dev      # 开发服务器
npm run build    # 生产构建
npm run preview  # 预览生产版本
```

#### 后端
```bash
cd server
npm run dev      # 开发模式 (nodemon)
npm start        # 生产模式
```

#### 数据库
```bash
cd .database
./setup.sh       # 交互式数据库设置
```

---

## 🔐 演示账户

| 角色 | 邮箱 | 密码 | 权限 |
|------|------|------|------|
| 平台管理员 | super@nexuserp.io | password | 全部权限 |
| 租户管理员 | alice@techflow.com | password | 租户全部权限 |
| 销售经理 | bob@techflow.com | password | 销售模块 |
| 财务经理 | carol@techflow.com | password | 财务模块 |

---

## 📡 API 端点

### 认证
- `POST /api/auth/login` - 用户登录
- `POST /api/auth/register` - 用户注册
- `GET /api/auth/me` - 获取当前用户

### 数据库设置
- `GET /api/setup/status` - 检查数据库状态
- `GET /api/setup/databases` - 列出可用数据库
- `POST /api/setup/create-database` - 创建新数据库
- `POST /api/setup/use-database` - 使用现有数据库

### 业务模块
- `GET /api/tenants` - 租户列表
- `GET /api/companies` - 公司列表
- `GET /api/users` - 用户列表
- `GET /api/sales/documents` - 销售单据
- `GET /api/sales/customers` - 客户列表

查看 `http://localhost:3001/api` 获取完整 API 文档。

---

## 🚀 生产部署

### 快速测试

```bash
# 1. 构建前端
npm run build

# 2. 预览
npm run preview

# 3. 启动生产后端
cd server
NODE_ENV=production npm start
```

### 完整部署 (Mac Mini + Cloudflare Tunnel)

查看 [PRODUCTION_DEPLOYMENT.md](.database/PRODUCTION_DEPLOYMENT.md) 获取完整指南,包括:

- ✅ PM2 进程管理
- ✅ Nginx 反向代理
- ✅ Cloudflare Tunnel 配置
- ✅ SSL/HTTPS 设置
- ✅ 数据库备份
- ✅ 监控和日志

---

## 🔒 安全

### 已实现
- ✅ bcrypt 密码哈希
- ✅ JWT token 认证
- ✅ RBAC 权限系统
- ✅ CORS 保护
- ✅ Helmet 安全头
- ✅ SQL 注入防护 (参数化查询)
- ✅ 审计日志

### 生产环境建议
- 🔐 使用强 JWT Secret
- 🔐 启用 HTTPS (Cloudflare Tunnel)
- 🔐 限制 CORS 源
- 🔐 实施 Rate Limiting
- 🔐 定期数据库备份
- 🔐 使用环境变量管理敏感信息

---

## 🐛 故障排除

### 后端服务器无法启动
```bash
# 检查端口占用
lsof -i :3001

# 检查 PostgreSQL
brew services list | grep postgresql
brew services start postgresql@18
```

### 数据库连接失败
```bash
# 测试连接
psql -d nexus_erp -c "SELECT 1"

# 检查配置
cat server/.env
```

### CORS 错误
确保后端 CORS 配置包含前端地址:
```javascript
// server/src/index.js
const allowedOrigins = [
    'http://localhost:3000',
    'http://localhost:5173'
];
```

---

## 📈 性能

### 当前性能
- ⚡ 前端构建: ~3秒
- ⚡ 首次加载: <2秒
- ⚡ API 响应: <100ms
- 📦 生产包大小: ~1MB (gzipped: ~263KB)

### 优化建议
- 使用代码分割减小包大小
- 启用 Nginx 缓存
- 使用 PM2 集群模式
- 实施数据库索引优化

---

## 🤝 贡献

欢迎贡献!请遵循以下步骤:

1. Fork 项目
2. 创建功能分支 (`git checkout -b feature/AmazingFeature`)
3. 提交更改 (`git commit -m 'Add some AmazingFeature'`)
4. 推送到分支 (`git push origin feature/AmazingFeature`)
5. 开启 Pull Request

---

## 📄 许可证

MIT License - 详见 LICENSE 文件

---

## 🙏 致谢

- React 团队 - 优秀的 UI 框架
- PostgreSQL 社区 - 强大的数据库
- Cloudflare - 安全的 Tunnel 服务
- Tailwind CSS - 实用的 CSS 框架

---

## 📞 支持

- 📧 Email: support@nexuserp.io
- 📚 文档: [.database/](.database/)
- 🐛 问题: GitHub Issues

---

**Built with ❤️ for modern enterprises**

*最后更新: 2026-01-10*