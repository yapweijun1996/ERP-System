---
name: js-current-datetime
description: JavaScript 获取当前日期时间/时间戳的速查与生成代码（Node.js/浏览器）。Use when you need "current date time" in JavaScript: Date.now(), new Date(), ISO string, epoch ms/s, timezone formatting, Intl.DateTimeFormat.
---

# js-current-datetime

生成“当前日期时间”的 JavaScript 代码片段，并按需求选择输出格式（ISO、epoch、local、指定时区）。

## 快速片段（直接复制）

### 1) ISO 8601（UTC，最稳定）

```js
new Date().toISOString(); // e.g. "2026-01-10T12:34:56.789Z"
```

### 2) Epoch 时间戳

```js
Date.now(); // 毫秒 number
Math.floor(Date.now() / 1000); // 秒 number
```

### 3) 本地可读时间（受系统/浏览器影响）

```js
new Date().toLocaleString("zh-CN"); // e.g. "2026/1/10 20:34:56"
```

### 4) 指定时区（不改系统时区）

```js
new Date().toLocaleString("zh-CN", { timeZone: "Asia/Shanghai" });
```

### 5) 可控格式（推荐用 Intl）

```js
new Intl.DateTimeFormat("zh-CN", {
  dateStyle: "medium",
  timeStyle: "medium",
  hour12: false,
  timeZone: "Asia/Shanghai",
}).format(new Date());
```

## 常见选择建议

- 需要“可比对/可存储/跨时区一致” → 用 `toISOString()`（UTC）。
- 需要“排序/计算” → 用 `Date.now()`（epoch ms）。
- 需要“给人看” → 用 `Intl.DateTimeFormat(...)`（显式指定 `timeZone`）。

## 可执行脚本（Node.js）

如需直接在终端输出当前时间，运行：

```bash
node codex-skills/js-current-datetime/scripts/now.mjs --json
node codex-skills/js-current-datetime/scripts/now.mjs --tz Asia/Shanghai
node codex-skills/js-current-datetime/scripts/now.mjs --iso
node codex-skills/js-current-datetime/scripts/now.mjs --epoch-ms
```

参数说明（可组合）：

- `--iso`：输出 ISO 8601（UTC）
- `--epoch-ms` / `--epoch-s`：输出 epoch
- `--local`：输出本地 `toLocaleString`
- `--tz <IANA>`：指定时区（如 `Asia/Shanghai`）
- `--locale <tag>`：指定 locale（默认 `zh-CN`）
- `--json`：以 JSON 输出（包含 `iso`、`epochMs`、`epochS`、`local`）

