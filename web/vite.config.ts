import { defineConfig } from 'vite';

const dataMode = process.env.VITE_DATA_MODE === 'api' ? 'api' : 'demo';

export default defineConfig({
  plugins: [{
    name: 'erp-data-mode-entry',
    transformIndexHtml: {
      order: 'pre',
      handler(html) {
        if (dataMode !== 'api') return html;
        return html.replace(
          /\s*<script type="module" src="\/src\/erp-demo-runtime\.ts"><\/script>/,
          '',
        );
      },
    },
  }],
  base: process.env.GITHUB_PAGES === 'true'
    ? `/${process.env.GITHUB_REPOSITORY?.split('/')[1] ?? 'ERP-System'}/`
    : './',
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
