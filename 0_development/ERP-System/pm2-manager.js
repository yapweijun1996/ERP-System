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
function loadConfig() {
  if (!fs.existsSync(CONFIG_PATH)) return null;
  try {
    const raw = fs.readFileSync(CONFIG_PATH, 'utf8');
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return null;
    if (!Array.isArray(parsed.targets)) return null;
    const targets = parsed.targets
      .filter((t) => t && typeof t === 'object' && typeof t.name === 'string')
      .map((t) => ({
        name: t.name,
        startArgs: Array.isArray(t.startArgs) ? t.startArgs.map(String) : null,
      }));
    const resurrectOnEmpty = parsed.resurrectOnStartAllWhenEmpty !== false;
    return { targets, resurrectOnEmpty };
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
  return { type: 'unknown', input };
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
  const defaultTargets = [
    { name: 'ERP-backend', startArgs: null },
    { name: 'ERP-frontend', startArgs: null },
  ];
  const targets = config?.targets?.length ? config.targets : defaultTargets;
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
      renderSimpleMenu({ rows, lastMessage, clearScreen });
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
