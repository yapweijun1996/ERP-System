import { formatBytes, formatDuration } from './pm2-manager.format.js';
import { getProcessList, pm2, statusLabel } from './pm2-manager.pm2.js';
import { actionHint } from './pm2-manager.ui.js';

export function buildRowsFromTargets(targets, processes) {
  const byName = new Map();
  const nameCount = new Map();
  for (const p of processes) {
    const { name } = statusLabel(p);
    nameCount.set(name, (nameCount.get(name) || 0) + 1);
    if (!byName.has(name)) byName.set(name, p);
  }

  return targets.map((t) => {
    const proc = byName.get(t.name);
    const hasStartArgs = !!(t.startArgs && t.startArgs.length);
    if (!proc) {
      return {
        name: t.name,
        status: 'missing',
        id: null,
        uptime: '-',
        restarts: '-',
        cpu: '-',
        mem: '-',
        hint: actionHint({ status: 'missing', hasStartArgs }),
        hasStartArgs,
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
      uptime: uptimeMs ? formatDuration(uptimeMs) : '-',
      restarts: String(restarts),
      cpu,
      mem,
      hint: actionHint({ status, hasStartArgs }),
      hasStartArgs,
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
    await pm2(target.startArgs);
    return { ok: true, msg: null };
  }
  console.log(`无法启动：${target.name}（未配置 startArgs）`);
  console.log(`请在 ${configPath} 里为它加入 startArgs。`);
  return { ok: false, msg: `未配置 startArgs：${target.name}` };
}

export async function startAll({ config, targets, rows, configPath }) {
  if (config?.resurrectOnEmpty && rows.every((r) => r.status === 'missing')) {
    try {
      await pm2(['resurrect']);
    } catch {
      // ignore
    }
  }

  const refreshed = await getProcessList();
  const refreshedRows = buildRowsFromTargets(targets, refreshed);
  for (let i = 0; i < targets.length; i++) {
    await startTarget({ target: targets[i], row: refreshedRows[i], configPath });
  }
}

export async function stopAll(targets) {
  for (const t of targets) {
    try {
      await pm2(['stop', t.name]);
    } catch {
      // ignore
    }
  }
}

export async function restartAll(targets) {
  for (const t of targets) {
    try {
      await pm2(['restart', t.name]);
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
