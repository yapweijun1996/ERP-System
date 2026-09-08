import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { resolvePublicBasePath, resolveViteBasePath } from './public-base-path.mjs';
import { renderNginxConfig } from './write-nginx-config.mjs';

const root = process.cwd();

describe('public deployment path configuration', () => {
  it('uses relative root assets when no public URL is configured', () => {
    expect(resolvePublicBasePath()).toBe('/');
    expect(resolveViteBasePath()).toBe('./');
  });

  it('derives a slash-terminated subpath for Vite and nginx', async () => {
    const publicBasePath = resolvePublicBasePath('https://gmb01.xyz/erp');
    expect(publicBasePath).toBe('/erp/');
    expect(resolveViteBasePath('https://gmb01.xyz/erp')).toBe('/erp/');

    const template = await readFile(path.join(root, 'web', 'nginx.conf.template'), 'utf8');
    const rendered = renderNginxConfig(template, publicBasePath);
    expect(rendered).toContain('location = /erp {');
    expect(rendered).toContain('return 308 /erp/;');
    expect(rendered).toContain('location ^~ /erp/ {');
    expect(rendered).toContain('rewrite ^/erp/(.*)$ /$1 last;');
  });

  it('does not add a mount rewrite for a root deployment', async () => {
    const template = await readFile(path.join(root, 'web', 'nginx.conf.template'), 'utf8');
    const rendered = renderNginxConfig(template, '/');
    expect(rendered).not.toContain('__ERP_PUBLIC_PREFIX_LOCATIONS__');
    expect(rendered).not.toContain('location ^~');
  });

  it('rejects unsafe or ambiguous public URLs', () => {
    for (const value of [
      'ftp://erp.example.test',
      'https://user:password@erp.example.test',
      'https://erp.example.test/erp?preview=true',
      'https://erp.example.test/erp#section',
      'not-a-url',
      'https://erp.example.test/erp;bad',
    ]) {
      expect(() => resolvePublicBasePath(value)).toThrow();
    }
  });
});
