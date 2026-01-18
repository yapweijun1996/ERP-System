import { formatBytes, formatDuration } from './pm2-manager.format.js';
import { getProcessList, pm2, statusLabel } from './pm2-manager.pm2.js';
import { actionHint } from './pm2-manager.ui.js';
import fs from 'node:fs';
import { spawn } from 'node:child_process';

function fileExists(p) {
  try {
    return fs.existsSync(p);
  } catch {
    return false;
  }
}

function runShell(command, cwd = process.cwd()) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, {
      cwd,
      stdio: 'inherit',
      shell: true,
    });
    child.on('error', reject);
    child.on('close', (code) => {
      if (code === 0) resolve();
      else reject(new Error(`Command failed (${code}): ${command}`));
    });
  });
}

async function runPreStart(target) {
  const cmds = Array.isArray(target?.preStart) ? target.preStart : [];
  if (cmds.length === 0) return;

  for (const cmd of cmds) {
    const normalized = String(cmd || '').trim();
    if (!normalized) continue;

    // Avoid re-building if production assets already exist.
    if (normalized === 'npm run build' && fileExists('dist/index.html')) continue;
    await runShell(normalized);
  }
}

export function buildRowsFromTargets(targets, processes) {
  const byName = new Map();
  const nameCount = new Map();
  const nameIds = new Map();
  for (const p of processes) {
    const { name } = statusLabel(p);
    nameCount.set(name, (nameCount.get(name) || 0) + 1);
    const { id } = statusLabel(p);
    const ids = nameIds.get(name) || [];
    ids.push(id);
    nameIds.set(name, ids);
    if (!byName.has(name)) byName.set(name, p);
  }

  return targets.map((t) => {
    const proc = byName.get(t.name);
    const hasStartArgs = !!(t.startArgs && t.startArgs.length);
    const matchIds = nameIds.get(t.name) || [];
    const matchCount = matchIds.length;
    if (!proc) {
      return {
        name: t.name,
        status: 'missing',
        id: null,
        matchIds,
        matchCount,
        uptime: '-',
        restarts: '-',
        cpu: '-',
        mem: '-',
        hint: actionHint({ status: 'missing', hasStartArgs }),
        hasStartArgs,
        url: t.url || '-',
        note: null,
      };
    }
    const env = proc?.pm2_env || {};
    const monit = proc?.monit || {};
    const { status, name, id } = statusLabel(proc);
    const uptimeMs = env.pm_uptime ? Date.now() - Number(env.pm_uptime) : null;
    const restarts = env.restart_time ?? '-';
    const cpu = Number.isFinite(monit.cpu) ? `${Math.round(monit.cpu)}%` : '-';
    const mem = Number.isFinite(monit.memory) ? formatBytes(monit.memory) : '-';
    const count = nameCount.get(name) || 0;
    return {
      name,
      status,
      id,
      matchIds,
      matchCount: count,
      uptime: uptimeMs ? formatDuration(uptimeMs) : '-',
      restarts: String(restarts),
      cpu,
      mem,
      hint: actionHint({ status, hasStartArgs }),
      hasStartArgs,
      url: t.url || '-',
      note:
        count > 1
          ? `PM2 内同名进程有 ${count} 个；本工具仅显示/操作其中一个（建议改成唯一 name）`
          : null,
    };
  });
}

export async function startTarget({ target, row, configPath }) {
  if (row.status === 'online' || row.status === 'launching') return { ok: true, msg: null };
  if (target.startArgs && target.startArgs.length > 0) {
    await runPreStart(target);
    await pm2(target.startArgs);
    return { ok: true, msg: null };
  }
  console.log(`无法启动：${target.name}（未配置 startArgs）`);
  console.log(`请在 ${configPath} 里为它加入 startArgs。`);
  return { ok: false, msg: `未配置 startArgs：${target.name}` };
}

export async function startAll({ config, targets, rows, configPath, confirmResurrect }) {
  if (config?.resurrectOnEmpty && rows.every((r) => r.status === 'missing')) {
    const ok = typeof confirmResurrect === 'function' ? await confirmResurrect() : false;
    if (ok) {
      try {
        await pm2(['resurrect']);
      } catch {
        // ignore
      }
    }
  }

  const refreshed = await getProcessList();
  const refreshedRows = buildRowsFromTargets(targets, refreshed);
  for (let i = 0; i < targets.length; i++) {
    await startTarget({ target: targets[i], row: refreshedRows[i], configPath });
  }
}

export async function stopAll({ targets, rows, confirmOnDuplicateName }) {
  for (let i = 0; i < targets.length; i++) {
    const t = targets[i];
    const row = rows?.[i];
    const matchCount = Number(row?.matchCount || 0);
    if (matchCount > 1) {
      const ok = confirmOnDuplicateName ? await confirmOnDuplicateName(t.name, matchCount) : false;
      if (!ok) continue;
    }
    const selector = row?.id != null ? String(row.id) : t.name;
    try {
      await pm2(['stop', selector]);
    } catch {
      // ignore
    }
  }
}

export async function restartAll({ targets, rows, confirmOnDuplicateName }) {
  for (let i = 0; i < targets.length; i++) {
    const t = targets[i];
    const row = rows?.[i];
    const matchCount = Number(row?.matchCount || 0);
    if (matchCount > 1) {
      const ok = confirmOnDuplicateName ? await confirmOnDuplicateName(t.name, matchCount) : false;
      if (!ok) continue;
    }
    const selector = row?.id != null ? String(row.id) : t.name;
    try {
      await pm2(['restart', selector]);
    } catch {
      // ignore
    }
  }
}

export async function showLogs(targetName, lines = 50) {
  const n = Number(lines);
  const safeLines = Number.isFinite(n) && n > 0 && n <= 2000 ? String(Math.floor(n)) : '50';
  try {
    const { stdout, stderr } = await pm2([
      'logs',
      targetName,
      '--lines',
      safeLines,
      '--nostream',
    ]);
    if (stdout) console.log(stdout);
    if (stderr) console.log(stderr);
  } catch {
    try {
      const { stdout, stderr } = await pm2(['logs', targetName, '--lines', safeLines]);
      if (stdout) console.log(stdout);
      if (stderr) console.log(stderr);
    } catch (e) {
      console.log('读取日志失败：', e?.message || e);
    }
  }
}
