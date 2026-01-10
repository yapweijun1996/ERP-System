# 🚀 PostgreSQL 集成快速开始指南

## 📋 概览

本指南将帮助您将 Nexus ERP 从前端原型转换为连接真实 PostgreSQL 数据库的全栈应用。

---

## ✅ 环境检查

您的环境已就绪:
- ✅ Node.js: v23.10.0
- ✅ npm: 10.9.2
- ✅ PostgreSQL: 16.10 (Homebrew)
- ✅ PostgreSQL 18 正在运行

---

## 📂 项目结构

```
ERP-System/
├── .database/                  # 数据库相关文件
│   ├── DATABASE_DESIGN.md     # 数据库架构设计文档
│   ├── setup.sh               # 数据库设置脚本
│   └── migrations/            # SQL 迁移脚本
│       ├── 001_init_schema.sql
│       └── 002_seed_data.sql
├── server/                     # 后端 API 服务器
│   ├── package.json
│   ├── .env                   # 环境配置(自动生成)
│   └── src/
│       ├── index.js           # 服务器入口
│       ├── db/
│       │   └── index.js       # 数据库连接池
│       └── routes/            # API 路由
│           ├── auth.js        # 认证
│           ├── tenants.js     # 租户管理
│           ├── companies.js   # 公司管理
│           ├── users.js       # 用户管理
│           └── sales.js       # 销售模块
└── (前端文件...)
```

---

## 🔧 步骤 1: 设置数据库

### 选项 A: 使用自动化脚本 (推荐)

```bash
cd .database
chmod +x setup.sh
./setup.sh
```

脚本会引导您:
1. 检查 PostgreSQL 状态
2. 选择创建新数据库或使用现有数据库
3. 运行迁移脚本
4. 加载演示数据(可选)
5. 生成 `.env` 配置文件

### 选项 B: 手动设置

```bash
# 1. 创建数据库
createdb nexus_erp

# 2. 运行迁移
psql -d nexus_erp -f .database/migrations/001_init_schema.sql

# 3. 加载演示数据(可选)
psql -d nexus_erp -f .database/migrations/002_seed_data.sql

# 4. 手动创建 server/.env 文件
```

---

## 🔧 步骤 2: 安装后端依赖

```bash
cd server
npm install
```

这将安装:
- `express` - Web 框架
- `pg` - PostgreSQL 客户端
- `bcryptjs` - 密码加密
- `jsonwebtoken` - JWT 认证
- `cors`, `helmet`, `morgan` - 中间件

---

## 🔧 步骤 3: 配置环境变量

编辑 `server/.env` 文件:

```env
# Database Configuration
DB_HOST=localhost
DB_PORT=5432
DB_NAME=nexus_erp
DB_USER=yapweijun
DB_PASSWORD=

# Server Configuration
PORT=3001
NODE_ENV=development

# JWT Secret
JWT_SECRET=<自动生成的密钥>

# CORS
CORS_ORIGIN=http://localhost:5173
```

---

## 🔧 步骤 4: 启动后端服务器

```bash
cd server
npm run dev
```

您应该看到:

```
╔════════════════════════════════════════╗
║     Nexus ERP API Server Started      ║
╚════════════════════════════════════════╝

🚀 Server running on: http://localhost:3001
📊 Environment: development
🗄️  Database: nexus_erp
🌐 CORS enabled for: http://localhost:5173
```

---

## 🔧 步骤 5: 测试 API

### 健康检查
```bash
curl http://localhost:3001/health
```

### 登录测试
```bash
curl -X POST http://localhost:3001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "alice@techflow.com",
    "password": "password"
  }'
```

### 获取销售单据
```bash
curl http://localhost:3001/api/sales/documents?companyId=comp-us-001
```

---

## 🔧 步骤 6: 更新前端连接 API

### 6.1 创建 API 客户端

创建 `src/api/client.js`:

```javascript
const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

export const apiClient = {
  async request(endpoint, options = {}) {
    const token = localStorage.getItem('auth_token');
    
    const config = {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...(token && { Authorization: `Bearer ${token}` }),
        ...options.headers,
      },
    };

    const response = await fetch(`${API_BASE_URL}${endpoint}`, config);
    
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'API request failed');
    }
    
    return response.json();
  },

  get(endpoint) {
    return this.request(endpoint);
  },

  post(endpoint, data) {
    return this.request(endpoint, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  put(endpoint, data) {
    return this.request(endpoint, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  },

  delete(endpoint) {
    return this.request(endpoint, {
      method: 'DELETE',
    });
  },
};
```

### 6.2 更新登录逻辑

修改 `context/AppContext.tsx` 中的 `login` 函数:

```typescript
const login = useCallback(async (email: string, pass: string): Promise<boolean> => {
  try {
    const response = await apiClient.post('/api/auth/login', {
      email,
      password: pass
    });
    
    // 保存 token
    localStorage.setItem('auth_token', response.token);
    
    // 更新用户状态
    setCurrentUser(response.user);
    setIsAuthenticated(true);
    
    // 设置上下文
    if (response.user.roles.some(r => r.name === 'Platform Administrator')) {
      setViewLevel('PLATFORM');
    } else {
      setSelectedClientId(response.user.tenantId);
      setSelectedCompanyId(response.user.defaultCompanyId);
      setViewLevel('COMPANY');
    }
    
    return true;
  } catch (error) {
    console.error('Login failed:', error);
    return false;
  }
}, []);
```

### 6.3 创建 `.env.local`

在项目根目录创建 `.env.local`:

```env
VITE_API_URL=http://localhost:3001
```

---

## 📊 演示数据

如果您加载了种子数据,可以使用以下账户登录:

| 角色 | 邮箱 | 密码 | 权限 |
|------|------|------|------|
| 平台管理员 | super@nexuserp.io | password | 全部权限 |
| 租户管理员 | alice@techflow.com | password | 租户全部权限 |
| 销售经理 | bob@techflow.com | password | 销售模块 |
| 财务经理 | carol@techflow.com | password | 财务模块 |

---

## 🔍 验证步骤

### 1. 检查数据库连接
```bash
psql -d nexus_erp -c "SELECT COUNT(*) FROM tenants;"
```

### 2. 检查 API 服务器
```bash
curl http://localhost:3001/health
```

### 3. 测试登录
```bash
curl -X POST http://localhost:3001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email": "alice@techflow.com", "password": "password"}'
```

### 4. 启动前端
```bash
npm run dev
```

访问 http://localhost:5173 并尝试登录。

---

## 🐛 常见问题

### 问题 1: PostgreSQL 连接失败

**错误**: `connection to server on socket "/tmp/.s.PGSQL.5432" failed`

**解决**:
```bash
# 检查 PostgreSQL 状态
brew services list | grep postgresql

# 启动 PostgreSQL
brew services start postgresql@18
```

### 问题 2: 数据库不存在

**错误**: `database "nexus_erp" does not exist`

**解决**:
```bash
createdb nexus_erp
cd .database
psql -d nexus_erp -f migrations/001_init_schema.sql
```

### 问题 3: CORS 错误

**错误**: `Access to fetch at 'http://localhost:3001' from origin 'http://localhost:5173' has been blocked by CORS`

**解决**: 检查 `server/.env` 中的 `CORS_ORIGIN` 设置:
```env
CORS_ORIGIN=http://localhost:5173
```

### 问题 4: JWT 认证失败

**错误**: `Invalid token`

**解决**: 确保前端在请求时包含 token:
```javascript
headers: {
  'Authorization': `Bearer ${token}`
}
```

---

## 📚 下一步

1. **实现更多 API 端点**
   - 创建/更新/删除操作
   - 库存管理 API
   - 财务模块 API

2. **添加认证中间件**
   - 保护需要认证的路由
   - 实现权限检查

3. **优化性能**
   - 添加数据库索引
   - 实现缓存策略
   - 使用连接池优化

4. **部署准备**
   - 配置生产环境变量
   - 设置 SSL/TLS
   - 配置反向代理 (Nginx)

---

## 📖 参考文档

- [数据库架构设计](.database/DATABASE_DESIGN.md)
- [PostgreSQL 官方文档](https://www.postgresql.org/docs/)
- [Express.js 文档](https://expressjs.com/)
- [Node-postgres 文档](https://node-postgres.com/)

---

## 💡 提示

- 使用 `npm run dev` 启动开发服务器(带自动重启)
- 使用 `npm start` 启动生产服务器
- 查看 `server/src/index.js` 中的所有可用 API 端点
- 数据库迁移脚本位于 `.database/migrations/`

---

**祝您开发顺利! 🎉**
