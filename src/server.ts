// Production process bootstrap. HTTP behavior lives in createApp() so the same
// app can be exercised against PGlite and PostgreSQL without opening a port.
import { createApp } from './api/app';
import { createPostgresDb } from './data/db';

const port = Number(process.env.PORT) || 3000;
const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  console.error('[erp-system-api] DATABASE_URL is required. Example:');
  console.error('  DATABASE_URL=postgres://user:pass@localhost:5432/erp_system npm run server');
  process.exit(1);
}

const db = await createPostgresDb(databaseUrl);
const app = createApp(db, {
  // Local Docker runs over HTTP; real TLS deployments must set COOKIE_SECURE=true.
  secureCookies: process.env.COOKIE_SECURE === 'true',
  trustProxy: process.env.TRUST_PROXY === 'true',
  tokenEncryptionKey: process.env.ERP_TOKEN_ENCRYPTION_KEY,
  publicUrl: process.env.ERP_PUBLIC_URL,
  setupToken: process.env.ERP_SETUP_TOKEN,
});

app.listen(port, () => {
  console.log(`[erp-system-api] listening on :${port} — durable auth + canonical API ready`);
});
