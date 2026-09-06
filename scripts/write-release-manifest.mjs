#!/usr/bin/env node

import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { readdir, readFile, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

const outputRoot = path.resolve(process.argv[2] ?? 'web/dist');
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

const rootStats = await stat(outputRoot).catch(() => null);
if (!rootStats?.isDirectory()) {
  console.error(`Release output directory does not exist: ${outputRoot}`);
  process.exit(1);
}

const files = (await collectFiles(outputRoot)).filter((file) => file !== manifestName);
const assets = [];
for (const file of files) {
  assets.push({ path: file, ...(await fileDigest(path.join(outputRoot, file))) });
}

const manifest = {
  schemaVersion: 1,
  revision: releaseValue(process.env.RELEASE_COMMIT, process.env.ERP_RELEASE_COMMIT) ?? gitRevision(),
  repository: releaseValue(process.env.RELEASE_REPOSITORY, process.env.GITHUB_REPOSITORY),
  workflowRunId: releaseValue(process.env.RELEASE_WORKFLOW_RUN_ID, process.env.GITHUB_RUN_ID),
  builtAt: releaseValue(process.env.RELEASE_BUILT_AT) ?? new Date().toISOString(),
  dataMode: releaseValue(process.env.RELEASE_DATA_MODE, process.env.VITE_DATA_MODE),
  fileCount: assets.length,
  files: assets,
};

await writeFile(
  path.join(outputRoot, manifestName),
  `${JSON.stringify(manifest, null, 2)}\n`,
  'utf8',
);

console.log(`Release manifest written: ${manifestName} (${manifest.revision}, ${assets.length} files)`);
