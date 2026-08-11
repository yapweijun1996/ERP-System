import { readdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { defineConfig, transformWithEsbuild, type ResolvedConfig } from 'vite';

function minifyLegacyAssets(){
  let resolvedConfig: ResolvedConfig;
  return {
    name: 'erp-minify-legacy-assets',
    apply: 'build' as const,
    configResolved(config: ResolvedConfig){
      resolvedConfig = config;
    },
    async closeBundle(){
      if(!resolvedConfig) return;
      const publicAssetsDir = path.join(resolvedConfig.publicDir, 'assets');
      const outputAssetsDir = path.resolve(resolvedConfig.root, resolvedConfig.build.outDir, 'assets');
      const entries = await readdir(publicAssetsDir, { withFileTypes: true });
      const legacyFiles = entries
        .filter((entry) => entry.isFile() && entry.name.endsWith('.js'))
        .map((entry) => entry.name);

      await Promise.all(legacyFiles.map(async (fileName) => {
        const outputPath = path.join(outputAssetsDir, fileName);
        const source = await readFile(outputPath, 'utf8');
        const result = await transformWithEsbuild(source, outputPath, {
          loader: 'js',
          minify: true,
          legalComments: 'eof',
          sourcemap: false,
          target: 'esnext',
        });
        await writeFile(outputPath, result.code, 'utf8');
      }));
    },
  };
}

const dataMode = process.env.VITE_DATA_MODE === 'api' ? 'api' : 'demo';

export default defineConfig({
  plugins: [minifyLegacyAssets(), {
    name: 'erp-data-mode-entry',
    transformIndexHtml: {
      order: 'pre',
      handler(html) {
        if (dataMode !== 'api') return html;
        return html.replace(
          /\s*<script type="module" src="\/src\/erp-demo-runtime\.ts"><\/script>/,
          '',
        ).replace(
          /\s*<script src="(?:%BASE_URL%|\.\/)assets\/erp-system-data-adapter\.js[^>]*><\/script>/,
          '',
        );
      },
    },
  }],
  base: process.env.GITHUB_PAGES === 'true'
    ? `/${process.env.GITHUB_REPOSITORY?.split('/')[1] ?? 'ERP-System'}/`
    : './',
  // PGlite loads these files through URL-relative WASM/data imports. Keeping
  // the package out of dependency pre-bundling lets Vite preserve those URLs
  // instead of serving the SPA fallback as a tiny HTML "asset" in dev.
  assetsInclude: ['**/*.wasm', '**/*.data'],
  optimizeDeps: dataMode === 'demo'
    ? { exclude: ['@electric-sql/pglite'] }
    : undefined,
  server: {
    fs: {
      allow: ['..'],
    },
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
  },
});
