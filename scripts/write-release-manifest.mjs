#!/usr/bin/env node

import { createHash, randomBytes } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { lstat, open, readdir, readFile, rename, stat, unlink } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const manifestName = 'release.json';

function gitRevision() {
  try {
    return execFileSync('git', ['rev-parse', 'HEAD'], {
      cwd: process.cwd(),
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim() || 'unknown';
  } catch {
    return 'unknown';
  }
}

function releaseValue(...values) {
  return values.find((value) => typeof value === 'string' && value.trim())?.trim() ?? null;
}

async function collectFiles(directory, prefix = '') {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];
  for (const entry of entries.sort((left, right) => left.name.localeCompare(right.name))) {
    const relativePath = prefix ? path.join(prefix, entry.name) : entry.name;
    const absolutePath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      files.push(...await collectFiles(absolutePath, relativePath));
    } else if (entry.isFile()) {
      files.push(relativePath.split(path.sep).join('/'));
    }
  }
  return files;
}

async function fileDigest(absolutePath) {
  const content = await readFile(absolutePath);
  return {
    bytes: content.byteLength,
    sha256: createHash('sha256').update(content).digest('hex'),
  };
}

async function assertSafeTarget(targetPath) {
  let existing;
  try {
    existing = await lstat(targetPath);
  } catch (error) {
    if (error?.code === 'ENOENT') return;
    throw error;
  }

  if (existing.isSymbolicLink()) {
    throw new Error(`Release manifest target must not be a symbolic link: ${targetPath}`);
  }
  if (!existing.isFile()) {
    throw new Error(`Release manifest target must be a regular file: ${targetPath}`);
  }
}

const unsupportedDirectorySyncErrors = new Set(['EBADF', 'EISDIR', 'EINVAL', 'ENOTSUP', 'EOPNOTSUPP']);

async function syncDirectory(directory) {
  let handle;
  try {
    handle = await open(directory, 'r');
  } catch (error) {
    if (unsupportedDirectorySyncErrors.has(error?.code)) return;
    throw error;
  }

  try {
    await handle.sync();
  } catch (error) {
    if (!unsupportedDirectorySyncErrors.has(error?.code)) throw error;
  } finally {
    await handle.close();
  }
}

async function writeAtomicText(targetPath, content, beforeRename) {
  const directory = path.dirname(targetPath);
  await assertSafeTarget(targetPath);
  const temporaryPath = path.join(
    directory,
    `.${path.basename(targetPath)}.${process.pid}.${randomBytes(16).toString('hex')}.tmp`,
  );
  let handle;
  let renamed = false;

  try {
    handle = await open(temporaryPath, 'wx', 0o600);
    await handle.writeFile(content, 'utf8');
    await handle.chmod(0o600);
    await handle.sync();
    await handle.close();
    handle = undefined;

    if (beforeRename) await beforeRename(temporaryPath);
    await assertSafeTarget(targetPath);
    await rename(temporaryPath, targetPath);
    renamed = true;
    await syncDirectory(directory);
  } catch (error) {
    if (handle) await handle.close().catch(() => undefined);
    if (!renamed) {
      try {
        await unlink(temporaryPath);
      } catch (cleanupError) {
        if (cleanupError?.code !== 'ENOENT') {
          throw new AggregateError(
            [error, cleanupError],
            'Could not clean up release manifest temporary file.',
            { cause: cleanupError },
          );
        }
      }
    }
    throw error;
  }
}

export async function writeReleaseManifest(
  outputDirectory,
  { environment = process.env, now = new Date(), beforeRename } = {},
) {
  const outputRoot = path.resolve(outputDirectory);
  const rootStats = await stat(outputRoot).catch(() => null);
  if (!rootStats?.isDirectory()) {
    throw new Error(`Release output directory does not exist: ${outputRoot}`);
  }

  const files = (await collectFiles(outputRoot)).filter((file) => file !== manifestName);
  const assets = [];
  for (const file of files) {
    assets.push({ path: file, ...(await fileDigest(path.join(outputRoot, file))) });
  }

  const manifest = {
    schemaVersion: 1,
    revision: releaseValue(environment.RELEASE_COMMIT, environment.ERP_RELEASE_COMMIT) ?? gitRevision(),
    repository: releaseValue(environment.RELEASE_REPOSITORY, environment.GITHUB_REPOSITORY),
    workflowRunId: releaseValue(environment.RELEASE_WORKFLOW_RUN_ID, environment.GITHUB_RUN_ID),
    builtAt: releaseValue(environment.RELEASE_BUILT_AT) ?? now.toISOString(),
    dataMode: releaseValue(environment.RELEASE_DATA_MODE, environment.VITE_DATA_MODE),
    fileCount: assets.length,
    files: assets,
  };

  await writeAtomicText(
    path.join(outputRoot, manifestName),
    `${JSON.stringify(manifest, null, 2)}\n`,
    beforeRename,
  );
  return manifest;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const outputRoot = path.resolve(process.argv[2] ?? 'web/dist');
  try {
    const manifest = await writeReleaseManifest(outputRoot);
    console.log(`Release manifest written: ${manifestName} (${manifest.revision}, ${manifest.fileCount} files)`);
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}
