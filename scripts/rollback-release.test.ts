import { spawnSync } from 'node:child_process';
import { chmod, copyFile, mkdtemp, mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const scriptPath = path.join(process.cwd(), 'deploy', 'rollback-release.sh');
const images = {
  ERP_ROLLBACK_API_IMAGE: 'erp-system-api@sha256:' + 'a'.repeat(64),
  ERP_ROLLBACK_WEB_IMAGE: 'erp-system-web@sha256:' + 'b'.repeat(64),
  ERP_ROLLBACK_CALENDAR_IMAGE: 'erp-system-calendar-worker@sha256:' + 'c'.repeat(64),
};

function run(args: string[], env: Record<string, string> = {}) {
  return spawnSync(scriptPath, args, {
    cwd: process.cwd(),
    encoding: 'utf8',
    env: { ...process.env, ...env },
  });
}

describe('rollback-release.sh', () => {
  it('plans application-only rollback without requiring Docker or .env', () => {
    const result = run(['--plan'], images);
    expect(result.status).toBe(0);
    expect(result.stderr).toBe('');
    expect(JSON.parse(result.stdout)).toEqual({
      status: 'planned',
      services: ['api', 'web', 'calendar-worker'],
      database: 'unchanged',
      volumes: 'unchanged',
      healthPath: 'web->nginx->api /health',
    });
  });

  it('rejects unsafe image references before any Docker call', () => {
    const result = run(['--plan'], { ...images, ERP_ROLLBACK_API_IMAGE: 'erp/api old' });
    expect(result.status).toBe(2);
    expect(result.stdout).toBe('');
    expect(result.stderr).toContain('api rollback image reference contains unsafe characters');
  });

  it('rejects mutable image tags before any Docker call', () => {
    const result = run(['--plan'], { ...images, ERP_ROLLBACK_API_IMAGE: 'erp-system-api:previous' });
    expect(result.status).toBe(2);
    expect(result.stdout).toBe('');
    expect(result.stderr).toContain('api rollback image reference must be an immutable sha256 digest');
  });

  it('requires explicit confirmation before container mutation', () => {
    const result = run([], { ...images, CONFIRM_RELEASE_ROLLBACK: 'NO' });
    expect(result.status).toBe(2);
    expect(result.stdout).toBe('');
    expect(result.stderr).toContain('CONFIRM_RELEASE_ROLLBACK=YES');
  });

  it('executes only the application services and removes the temporary override', async () => {
    const testRoot = await mkdtemp(path.join(os.tmpdir(), 'erp-rollback-test-'));
    const deployDir = path.join(testRoot, 'deploy');
    const fakeDocker = path.join(testRoot, 'docker');
    const logPath = path.join(testRoot, 'docker.log');
    const tempDir = path.join(testRoot, 'tmp');
    await mkdir(deployDir);
    await mkdir(tempDir);
    await copyFile(scriptPath, path.join(deployDir, 'rollback-release.sh'));
    await chmod(path.join(deployDir, 'rollback-release.sh'), 0o755);
    await writeFile(path.join(testRoot, '.env'), '');
    await writeFile(fakeDocker, [
      '#!/bin/sh',
      'printf "%s\\n" "$*" >> "$FAKE_DOCKER_LOG"',
      'if [ "$1" = image ] && [ "$2" = inspect ]; then exit 0; fi',
      'exit 0',
      '',
    ].join('\n'));
    await chmod(fakeDocker, 0o755);

    try {
      const result = spawnSync(path.join(deployDir, 'rollback-release.sh'), [], {
        cwd: testRoot,
        encoding: 'utf8',
        env: {
          ...process.env,
          PATH: `${testRoot}${path.delimiter}${process.env.PATH ?? ''}`,
          TMPDIR: tempDir,
          FAKE_DOCKER_LOG: logPath,
          CONFIRM_RELEASE_ROLLBACK: 'YES',
          ...images,
        },
      });
      expect(result.status).toBe(0);
      expect(result.stderr).toBe('');
      expect(result.stdout).toContain('Application rollback is healthy');
      const log = await readFile(logPath, 'utf8');
      const upLine = log.split('\n').find(line => line.includes(' up '));
      expect(upLine).toBeDefined();
      expect(upLine).toContain('--no-build --force-recreate --no-deps api web calendar-worker');
      expect(upLine).not.toContain(' db ');
      expect(await readdir(tempDir)).toHaveLength(0);
    } finally {
      await rm(testRoot, { recursive: true, force: true });
    }
  });
});
