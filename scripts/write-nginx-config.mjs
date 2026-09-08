#!/usr/bin/env node
import { readFile, writeFile } from 'node:fs/promises';
import { resolvePublicBasePath } from './public-base-path.mjs';

const [templatePath, outputPath] = process.argv.slice(2);

function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function renderNginxConfig(template, publicBasePath = resolvePublicBasePath()) {
  const marker = '__ERP_PUBLIC_PREFIX_LOCATIONS__';
  if ((template.match(new RegExp(marker, 'g')) || []).length !== 1) {
    throw new Error(`nginx template must include exactly one ${marker} marker.`);
  }

  if (publicBasePath === '/') return template.replace(marker, '');

  const mountPath = publicBasePath.slice(0, -1);
  const mountPattern = escapeRegex(mountPath);
  const locations = `
  # Cloudflare tunnel routing preserves the public path. Rewrite this known
  # mount once, then let the root API/static locations own the request.
  location = ${mountPath} {
    return 308 ${publicBasePath};
  }

  location ^~ ${publicBasePath} {
    rewrite ^${mountPattern}/(.*)$ /$1 last;
  }
`;
  return template.replace(marker, locations);
}

async function main() {
  if (!templatePath || !outputPath) {
    throw new Error('Usage: write-nginx-config.mjs <template-path> <output-path>');
  }
  const template = await readFile(templatePath, 'utf8');
  const rendered = renderNginxConfig(template);
  await writeFile(outputPath, rendered, 'utf8');
}

if (import.meta.url === new URL(`file://${process.argv[1]}`).href) {
  main().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
