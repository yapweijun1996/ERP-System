#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import readline from 'node:readline/promises';

import { getProcessList, pm2 } from './pm2-manager.pm2.js';
import {
  buildRowsFromTargets,
  startAll,
  stopAll,
  restartAll,
} from './pm2-manager.logic.js';
import { renderSimpleMenu } from './pm2-manager.ui.js';

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

const CONFIG_PATH = path.join(process.cwd(), 'pm2-manager.config.json');

function parseModeArg(argv) {
  const args = Array.isArray(argv) ? argv : [];
  const idx = args.indexOf('--mode');
  if (idx >= 0 && args[idx + 1]) return String(args[idx + 1]).trim();
  return null;
}

function loadConfig() {
  if (!fs.existsSync(CONFIG_PATH)) return null;
  try {
    const raw = fs.readFileSync(CONFIG_PATH, 'utf8');
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return null;

    const normalizeTargets = (list) =>
      (Array.isArray(list) ? list : [])
        .filter((t) => t && typeof t === 'object' && typeof t.name === 'string')
        .map((t) => ({
          name: t.name,
          url: t.url,
          preStart: Array.isArray(t.preStart) ? t.preStart.map(String) : null,
          startArgs: Array.isArray(t.startArgs) ? t.startArgs.map(String) : null,
        }));

    const profiles =
      parsed.profiles && typeof parsed.profiles === 'object' ? parsed.profiles : null;
    const targets = Array.isArray(parsed.targets) ? normalizeTargets(parsed.targets) : null;

    const resurrectOnEmpty = parsed.resurrectOnStartAllWhenEmpty !== false;
    return { targets, profiles, resurrectOnEmpty };
  } catch {
    return null;
  }
}

const ROOT = process.cwd();

async function confirm(question) {
  let ans = '';
  try {
    ans = await rl.question(`${question} (y/N): `);
  } catch {
    return false;
  }
  ans = ans.trim().toLowerCase();
  return ans === 'y' || ans === 'yes';
}

async function safeQuestion(prompt) {
  try {
    return await rl.question(prompt);
  } catch {
    return null;
  }
}

function parseMainInput(raw) {
  const input = raw.trim();
  if (!input) return { type: 'refresh' };
  const lower = input.toLowerCase();
  if (['q', 'quit', 'exit', '退出'].includes(lower)) return { type: 'quit' };
  if (lower === 'a') return { type: 'startAll' };
  if (lower === 's') return { type: 'stopAll' };
  if (lower === 'r') return { type: 'restartAll' };
  if (lower === 'd') return { type: 'deleteAll' };
  if (lower === 'm') return { type: 'toggleMode' };
  return { type: 'unknown', input };
}

function getTargetsForMode(config, mode) {
  const m = String(mode || '').trim().toLowerCase();
  const profiles = config?.profiles;
  if (profiles && typeof profiles === 'object') {
    const selected = profiles[m] || profiles.prod || profiles.dev || null;
    if (Array.isArray(selected) && selected.length) return selected;
  }
  if (Array.isArray(config?.targets) && config.targets.length) return config.targets;
  return null;
}

async function main() {
  try {
    await pm2(['-v']);
  } catch {
    console.error('找不到 pm2 指令。请先安装：npm i -g pm2');
    process.exit(1);
  }

  // 主循环
  const config = loadConfig();
  let mode =
    parseModeArg(process.argv) ||
    String(process.env.PM2_MANAGER_MODE || '').trim() ||
    'prod';
  mode = String(mode).trim().toLowerCase();
  const defaultTargets = [
    { name: 'ERP-backend', startArgs: null },
    { name: 'ERP-frontend', startArgs: null },
  ];
  const selectedTargets = getTargetsForMode(config, mode);
  let targets = selectedTargets?.length ? selectedTargets : defaultTargets;
  let lastMessage = '';
  const clearScreen = true;

  while (true) {
    let processes = [];
    try {
      processes = await getProcessList();
    } catch (e) {
      console.error('读取 PM2 列表失败：', e?.message || e);
      process.exit(1);
    }

    const rows = buildRowsFromTargets(targets, processes);
    try {
      renderSimpleMenu({ rows, lastMessage, clearScreen, mode });
      const answer = await safeQuestion('> ');
      if (answer === null) break;
      const cmd = parseMainInput(answer);

      if (cmd.type === 'quit') break;
      if (cmd.type === 'refresh') {
        // do nothing
      } else if (cmd.type === 'startAll') {
        await startAll({ config, targets, rows, configPath: CONFIG_PATH });
        lastMessage = 'start all';
      } else if (cmd.type === 'stopAll') {
        await stopAll(targets);
        lastMessage = 'stop all';
      } else if (cmd.type === 'restartAll') {
        await restartAll(targets);
        lastMessage = 'restart all';
      } else if (cmd.type === 'deleteAll') {
        const ok = await confirm('确认 delete all（只移除本工具列出的进程）？');
        if (ok) {
          for (const t of targets) {
            try {
              await pm2(['delete', t.name]);
            } catch {
              // ignore
            }
          }
          lastMessage = 'delete all';
        } else {
          lastMessage = '已取消 delete all';
        }
      } else if (cmd.type === 'unknown') {
          lastMessage = `未知指令：${cmd.input}（只支持 a/s/d/q）`;
      } else if (cmd.type === 'toggleMode') {
        mode = mode === 'dev' ? 'prod' : 'dev';
        const nextTargets = getTargetsForMode(config, mode);
        targets = nextTargets?.length ? nextTargets : defaultTargets;
        lastMessage = `切换为 ${mode}（如需切换启动命令：请先 d delete all，再 a start all）`;
      }
    } catch (e) {
      console.log('执行失败：', e?.message || e);
      lastMessage = `失败：${e?.message || e}`;
      await safeQuestion('回车继续...');
    }
  }

  rl.close();
}

await main();
