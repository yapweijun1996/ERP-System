# 🎯 数据库设置向导 - 使用指南

## 概览

现在当您访问 `http://localhost:5173/` 时,应用会自动检测数据库状态:

- ✅ **数据库已配置** → 直接进入应用
- ⚠️ **数据库未配置** → 显示设置向导

---

## 🚀 完整流程演示

### 步骤 1: 启动后端服务器

```bash
cd server
npm install  # 首次运行需要安装依赖
npm run dev
```

您应该看到:
```
╔════════════════════════════════════════╗
║     Nexus ERP API Server Started      ║
╚════════════════════════════════════════╝

🚀 Server running on: http://localhost:3001
```

### 步骤 2: 启动前端应用

```bash
# 在项目根目录
npm run dev
```

访问 `http://localhost:5173/`

### 步骤 3: 数据库设置向导

#### 场景 A: 首次使用(无数据库)

1. **自动检测**
   - 应用启动时自动检查数据库状态
   - 检测到未配置数据库
   - 显示设置向导

2. **选择操作**
   - **创建新数据库** - 推荐首次使用
   - **使用现有数据库** - 如果已有数据库

3. **创建新数据库**
   - 输入数据库名称(默认: `nexus_erp`)
   - 选择是否加载演示数据 ✅ 推荐勾选
   - 点击"创建数据库"
   - 等待创建完成(约 5-10 秒)
   - 自动刷新并进入应用

4. **登录**
   - 使用演示账户登录:
     - 邮箱: `alice@techflow.com`
     - 密码: `password`

#### 场景 B: 使用现有数据库

1. 在设置向导中选择"使用现有数据库"
2. 从下拉列表中选择数据库
3. 点击"使用此数据库"
4. 系统验证数据库是否有效
5. 配置成功后自动刷新

---

## 🎨 设置向导界面

### 1. 检查状态页面
```
┌─────────────────────────────┐
│   🔄 检查数据库状态...      │
│   正在连接到 PostgreSQL     │
└─────────────────────────────┘
```

### 2. 选择操作页面
```
┌──────────────────────────────────────┐
│     欢迎使用 Nexus ERP               │
│     首次使用需要配置数据库           │
│                                      │
│  ┌────────────┐  ┌────────────┐    │
│  │ 📦 创建新   │  │ ✅ 使用现有 │    │
│  │   数据库    │  │   数据库    │    │
│  └────────────┘  └────────────┘    │
└──────────────────────────────────────┘
```

### 3. 创建数据库表单
```
┌─────────────────────────────┐
│   创建新数据库              │
│                             │
│   数据库名称:               │
│   [nexus_erp________]       │
│                             │
│   ☑ 加载演示数据            │
│   包含示例租户、用户...     │
│                             │
│   [返回]  [创建数据库]      │
└─────────────────────────────┘
```

### 4. 完成页面
```
┌─────────────────────────────┐
│   ✅ 数据库已就绪!          │
│   正在启动应用...           │
└─────────────────────────────┘
```

---

## 🔧 技术实现

### 后端 API

#### 1. 检查数据库状态
```bash
GET /api/setup/status
```

响应:
```json
{
  "status": "ready" | "empty" | "not_configured" | "error",
  "message": "...",
  "database": "nexus_erp",
  "tableCount": 23
}
```

#### 2. 列出可用数据库
```bash
GET /api/setup/databases
```

响应:
```json
{
  "databases": ["analytics", "smart_ordering", "nexus_erp"]
}
```

#### 3. 创建新数据库
```bash
POST /api/setup/create-database
Content-Type: application/json

{
  "databaseName": "nexus_erp",
  "loadSeedData": true
}
```

响应:
```json
{
  "success": true,
  "message": "Database 'nexus_erp' created successfully",
  "database": "nexus_erp",
  "seedDataLoaded": true
}
```

#### 4. 使用现有数据库
```bash
POST /api/setup/use-database
Content-Type: application/json

{
  "databaseName": "nexus_erp"
}
```

### 前端组件

#### 1. DatabaseSetupGuard
- 应用启动时的守卫组件
- 检查数据库状态
- 决定是否显示设置向导

#### 2. DatabaseSetupWizard
- 完整的设置向导 UI
- 多步骤流程管理
- API 调用和错误处理

---

## 📋 工作流程图

```
用户访问 localhost:5173
         ↓
   DatabaseSetupGuard
         ↓
    检查数据库状态
    (GET /api/setup/status)
         ↓
    ┌────┴────┐
    │         │
  已配置    未配置
    │         │
    ↓         ↓
 进入应用  显示向导
            ↓
      ┌─────┴─────┐
      │           │
   创建新DB    选择现有DB
      │           │
      ↓           ↓
   输入信息    选择数据库
      │           │
      ↓           ↓
  POST create  POST use
      │           │
      └─────┬─────┘
            ↓
       更新 .env
            ↓
       刷新页面
            ↓
        进入应用
```

---

## 🎯 用户体验特点

### 1. 自动检测
- 无需手动配置
- 智能判断数据库状态
- 友好的错误提示

### 2. 可视化流程
- 清晰的步骤指引
- 实时状态反馈
- 加载动画和进度提示

### 3. 容错处理
- 网络错误提示
- 数据库连接失败处理
- 重试机制

### 4. 灵活选择
- 支持创建新数据库
- 支持使用现有数据库
- 可选加载演示数据

---

## 🐛 常见问题

### Q1: 显示"无法连接到后端服务器"

**原因**: 后端服务器未启动

**解决**:
```bash
cd server
npm run dev
```

### Q2: 创建数据库失败

**可能原因**:
1. PostgreSQL 服务未运行
2. 数据库名称已存在
3. 权限不足

**解决**:
```bash
# 检查 PostgreSQL 状态
brew services list | grep postgresql

# 启动 PostgreSQL
brew services start postgresql@18

# 检查现有数据库
psql -d postgres -c "\l"
```

### Q3: 选择现有数据库后提示"无效的数据库"

**原因**: 选择的数据库不是 Nexus ERP 数据库

**解决**: 选择正确的数据库或创建新数据库

### Q4: 设置完成后仍显示向导

**原因**: `.env` 文件未正确更新

**解决**:
```bash
# 手动检查 server/.env
cat server/.env

# 确保 DB_NAME 正确
DB_NAME=nexus_erp
```

---

## 🎨 自定义配置

### 修改默认数据库名

编辑 `components/Setup/DatabaseSetupWizard.tsx`:

```typescript
const [newDbName, setNewDbName] = useState('my_custom_db');
```

### 修改 API URL

创建 `.env.local`:

```env
VITE_API_URL=http://localhost:3001
```

### 禁用设置向导

如果您想跳过设置向导,直接在 `server/.env` 中配置:

```env
DB_NAME=nexus_erp
```

然后手动运行:
```bash
cd .database
./setup.sh
```

---

## 📊 演示数据说明

如果选择加载演示数据,将包含:

### 租户
- **TechFlow Solutions** - 示例企业

### 公司
- **TechFlow US Branch** (USD)
- **TechFlow EU Branch** (EUR)

### 用户
| 角色 | 邮箱 | 密码 |
|------|------|------|
| 平台管理员 | super@nexuserp.io | password |
| 租户管理员 | alice@techflow.com | password |
| 销售经理 | bob@techflow.com | password |
| 财务经理 | carol@techflow.com | password |

### 业务数据
- 3 个客户
- 3 个产品
- 3 个销售单据
- 完整的会计科目表
- 单据编号规则

---

## 🚀 下一步

设置完成后,您可以:

1. **登录系统** - 使用演示账户
2. **浏览功能** - 查看销售、库存、财务模块
3. **创建数据** - 添加新的客户、产品、订单
4. **测试权限** - 切换不同角色查看权限差异
5. **开发集成** - 开始连接前端到后端 API

---

**享受您的 Nexus ERP 之旅! 🎉**
