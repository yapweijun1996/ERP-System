# 权限管理系统 - 完整解决方案

## ✅ 已完成的工作

### 1. 后端 API (`server/src/routes/admin.js`)
创建了完整的权限管理 API：
- `GET /api/admin/roles` - 获取所有角色
- `GET /api/admin/permissions` - 获取所有权限
- `POST /api/admin/roles/:roleId/permissions` - 更新角色权限
- `GET /api/admin/users` - 获取所有用户
- `POST /api/admin/users/:userId/roles` - 更新用户角色

### 2. 自动权限分配 (`server/src/services/authService.js`)
修复了 `registerTenant` 函数：
```javascript
// 新注册的 admin 会自动获得所有权限（除了 PLATFORM_ADMIN）
await query(
    `INSERT INTO role_permissions (role_id, permission_id)
     SELECT $1, id FROM permissions WHERE code != 'PLATFORM_ADMIN'
     ON CONFLICT DO NOTHING`,
    [roleId]
);
```

### 3. 前端 API 客户端 (`api/admin.ts`)
创建了类型安全的 API 客户端，包含：
- Role, Permission, User 接口定义
- 所有 admin 操作的方法

### 4. Web UI (`pages/hr/RoleManagement.tsx`)
完整的权限管理界面：
- ✅ 查看所有角色和权限
- ✅ 编辑角色权限（勾选/取消勾选）
- ✅ 保存更改到数据库
- ✅ 查看用户角色分配
- ✅ 实时刷新数据

## 🎯 解决的核心问题

### 问题：新注册用户没有权限
**原因**：`registerTenant` 函数创建了 admin role，但没有分配任何权限

**解决方案**：
1. ✅ 修改 `authService.js`，自动为新 admin 分配所有权限
2. ✅ 创建 Web UI，让 superadmin 可以管理权限
3. ✅ 无需手动执行 SQL

## 📝 使用方法

### 新用户注册（自动获得权限）
```bash
# 1. 重建数据库
cd .database
./setup.sh

# 2. 注册新用户
# 前端：访问注册页面
# 后端会自动为新 admin 分配所有权限
```

### 通过 Web UI 管理权限
```bash
# 1. 登录为 superadmin
# 2. 访问 Role Management 页面
# 3. 选择角色
# 4. 勾选/取消勾选权限
# 5. 点击 "Save Changes"
```

## 🔄 测试流程

1. **删除现有数据库**
   ```bash
   dropdb nexus_erp
   ```

2. **重新创建数据库**
   ```bash
   cd .database
   ./setup.sh
   ```

3. **注册新 superadmin**
   - 访问注册页面
   - 填写信息并注册

4. **验证权限**
   - 登录后应该能访问所有模块
   - Master Data, HR, Settings 等都应该可用

5. **使用 Web UI 管理**
   - 访问 Role Management 页面
   - 查看和编辑权限

## ⚠️ 重要说明

### 自动权限分配
- ✅ **新注册用户**：自动获得所有权限
- ✅ **Seed data 用户**：已在 SQL 中配置权限
- ❌ **现有用户**：需要通过 Web UI 手动分配

### 权限层级
- `PLATFORM_ADMIN`：只有平台超级管理员才有
- 其他权限：所有 tenant admin 都自动获得

## 📦 文件清单

### 新增文件
1. `server/src/routes/admin.js` - Admin API 路由
2. `api/admin.ts` - 前端 API 客户端
3. `.database/migrations/004_fix_admin_permissions.sql` - 迁移脚本（可选）

### 修改文件
1. `server/src/services/authService.js` - 添加自动权限分配
2. `server/src/index.js` - 注册 admin 路由
3. `pages/hr/RoleManagement.tsx` - 完整重写 UI

## 🚀 下一步

现在您可以：
1. ✅ 重建数据库并注册新用户（会自动获得权限）
2. ✅ 使用 Web UI 管理现有用户的权限
3. ✅ 无需再手动执行 SQL 脚本

所有权限管理都通过 Web UI 完成！
