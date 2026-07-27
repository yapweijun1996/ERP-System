# EPIC-059 中文摘要

英文权威规格见
[EMPLOYEE_ACCESS_DEMO_AND_ONBOARDING.md](../EMPLOYEE_ACCESS_DEMO_AND_ONBOARDING.md)。

本 Epic 把“新增员工”升级为一次完成员工资料、直属经理、登录身份、公司角色、
数据范围、请假期初及初始密码的向导。最终启用是单一事务；任一步失败都会回滚。
同一组织的既有用户名会关联到新公司，不会重复建立身份。初始密码只保存哈希，
首次使用或七天后失效，并强制首次登录改密。正式环境不提供 impersonation。

权限改为公司级：12 个只读岗位模板可复制为公司自定义角色；多个角色合并 Allow，
数据范围取本人、团队、部门、全公司中的最宽范围。没有 owner、部门或 reporting line
可验证时默认拒绝。侧栏、搜索、快捷新增、按钮及敏感字段按有效权限隐藏，API 仍是
最终 403/404 边界。模块状态也改为公司级，并按集中依赖图启用或关闭。

大型 Demo 与小型测试 fixture 已分离。新 Demo 首次启动会验证 SHA-256 后原子载入
固定于 2026-07-27 的 SG/MY 企业数据包：12 个真实权限人物、至少 100 名员工、
约 200 个客户、100 个供应商、500 个物料及正好 10,000 笔活动、库存与平衡总账
记录。既有 IndexedDB 不会被静默覆盖；重置必须明确确认。

企业 Demo 数据包现为 manifest v2，并直接拥有完整 12 个身份，不再依赖小型测试
fixture 间接提供 Superadmin 与 Viewer。`Avery Tan · Superadmin` 同时属于 SG/MY，
固定显示在人物切换器第一位，可进入全部设置与模块启用控制；其他人物会显示其真实
岗位，不会再全部误标成 Viewer。旧 IndexedDB 确认升级后会保留既有业务数据并补齐身份。

正式 PostgreSQL 严禁 Demo seed。setup token 只建立组织、首家公司和
Superadmin，之后依序完成公司/税务、财年/科目、仓库、模块、角色、员工账号、
导入、期初核对、UAT 与受审计 Go Live。Go Live 前普通员工不能登录或写交易。
CSV/XLSX 统一经过服务器预检；错误必须为零、警告须确认，提交时整批成功或整批回滚。

实体手机仍由 TASK-017 保持 blocked；375px 模拟视口不视为真机通过。

## 完成交付证据（2026-07-27）

EPIC-059 与 Phase 41 已完成。最终验证为 518 项测试通过、1 项预期跳过、零失败；
232 张表一致，PGlite/PostgreSQL 业务证明及 PostgreSQL 强制 RLS 通过；双构建、
桌面/375px smoke、122 路由 × 五语言 × 两视口全部通过。Staff、权限、Demo 重置、
CSV 导入和 Go Live 关键 UI 在 Chromium、Firefox、WebKit 均通过且没有页面错误。

最新版 Chromium 首次载入大型 Demo 为 8.905 秒；十个常用页面/报表共 30 次样本
p95 为 38.7 毫秒，均低于计划预算。正式 seed 在缺少明确 Demo 标记或数据库非空时
会在写入前拒绝。EPIC-058 的 TASK-141–149 现已全部修复完成；实体手机 TASK-017
继续 blocked，不能以 375px 模拟器结果代替。
