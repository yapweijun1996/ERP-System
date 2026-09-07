import { mkdtemp, readFile, readdir, rm, symlink, writeFile, lstat, mkdir, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { writeReleaseManifest } from './write-release-manifest.mjs';

const temporaryRoots: string[] = [];
const environment = {
  RELEASE_COMMIT: 'test-release-commit',
  RELEASE_REPOSITORY: 'example/erp-system',
  RELEASE_WORKFLOW_RUN_ID: '12345',
  RELEASE_DATA_MODE: 'demo',
};

async function createOutputDirectory() {
  const directory = await mkdtemp(path.join(tmpdir(), 'erp-release-manifest-'));
  temporaryRoots.push(directory);
  return directory;
}

async function temporaryManifestFiles(directory: string) {
  return (await readdir(directory)).filter((entry) => entry.startsWith('.release.json.') && entry.endsWith('.tmp'));
}

afterEach(async () => {
  await Promise.all(temporaryRoots.splice(0).map((directory) => rm(directory, { recursive: true, force: true })));
});

describe('writeReleaseManifest', () => {
  it('writes and replaces a private manifest with deterministic asset evidence', async () => {
    const directory = await createOutputDirectory();
    const assetPath = path.join(directory, 'index.html');
    const manifestPath = path.join(directory, 'release.json');
    await writeFile(assetPath, 'first asset\n', 'utf8');

    const first = await writeReleaseManifest(directory, {
      environment,
      now: new Date('2026-09-08T00:00:00.000Z'),
    });
    expect(first).toMatchObject({
      revision: 'test-release-commit',
      repository: 'example/erp-system',
      workflowRunId: '12345',
      builtAt: '2026-09-08T00:00:00.000Z',
      dataMode: 'demo',
      fileCount: 1,
    });
    expect(JSON.parse(await readFile(manifestPath, 'utf8')).files).toHaveLength(1);
    expect((await stat(manifestPath)).mode & 0o777).toBe(0o600);
    expect(await temporaryManifestFiles(directory)).toEqual([]);

    await writeFile(assetPath, 'replacement asset\n', 'utf8');
    await writeReleaseManifest(directory, {
      environment,
      now: new Date('2026-09-08T00:01:00.000Z'),
    });
    const replaced = JSON.parse(await readFile(manifestPath, 'utf8'));
    expect(replaced.builtAt).toBe('2026-09-08T00:01:00.000Z');
    expect(replaced.files[0].bytes).toBe(Buffer.byteLength('replacement asset\n'));
    expect((await stat(manifestPath)).mode & 0o777).toBe(0o600);
    expect(await temporaryManifestFiles(directory)).toEqual([]);
  });

  it('preserves the existing manifest and cleans up after a pre-rename failure', async () => {
    const directory = await createOutputDirectory();
    await writeFile(path.join(directory, 'index.html'), 'asset\n', 'utf8');
    await writeReleaseManifest(directory, { environment });
    const manifestPath = path.join(directory, 'release.json');
    const before = await readFile(manifestPath, 'utf8');

    await expect(writeReleaseManifest(directory, {
      environment: { ...environment, RELEASE_COMMIT: 'must-not-land' },
      beforeRename: async () => {
        throw new Error('injected pre-rename failure');
      },
    })).rejects.toThrow('injected pre-rename failure');

    expect(await readFile(manifestPath, 'utf8')).toBe(before);
    expect(await temporaryManifestFiles(directory)).toEqual([]);
  });

  it('rejects a symbolic-link manifest target without touching its destination', async () => {
    const directory = await createOutputDirectory();
    await writeFile(path.join(directory, 'index.html'), 'asset\n', 'utf8');
    const destinationPath = path.join(directory, 'destination.json');
    const manifestPath = path.join(directory, 'release.json');
    await writeFile(destinationPath, 'keep this file\n', 'utf8');
    await symlink(destinationPath, manifestPath);

    await expect(writeReleaseManifest(directory, { environment })).rejects.toThrow('symbolic link');
    expect(await readFile(destinationPath, 'utf8')).toBe('keep this file\n');
    expect((await lstat(manifestPath)).isSymbolicLink()).toBe(true);
    expect(await temporaryManifestFiles(directory)).toEqual([]);
  });

  it('rejects a non-file manifest target', async () => {
    const directory = await createOutputDirectory();
    await writeFile(path.join(directory, 'index.html'), 'asset\n', 'utf8');
    await mkdir(path.join(directory, 'release.json'));

    await expect(writeReleaseManifest(directory, { environment })).rejects.toThrow('regular file');
    expect(await temporaryManifestFiles(directory)).toEqual([]);
  });
});
