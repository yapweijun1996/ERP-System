import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

export async function pm2(args) {
  const { stdout, stderr } = await execFileAsync('pm2', args, {
    encoding: 'utf8',
    maxBuffer: 10 * 1024 * 1024,
  });
  return { stdout: stdout.trim(), stderr: stderr.trim() };
}

export async function getProcessList() {
  const { stdout } = await pm2(['jlist']);
  if (!stdout) return [];
  try {
    const parsed = JSON.parse(stdout);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function statusLabel(proc) {
  const env = proc?.pm2_env || {};
  const status = env.status || 'unknown';
  const name = env.name || proc.name || 'unknown';
  const id = env.pm_id ?? proc.pm_id ?? '?';
  return { status, name, id };
}

