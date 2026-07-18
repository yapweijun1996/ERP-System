import { createPostgresDb } from './data/db';
import { runMaintenance } from './maintenance';
import { parseTokenEncryptionKey } from './auth/tokenCrypto';
import {
  createSmtpTransportFromEnv,
  processOutboxBatch,
} from './worker/outbox';

const databaseUrl = process.env.DATABASE_URL;
const encryptionKey = process.env.ERP_TOKEN_ENCRYPTION_KEY;
if (!databaseUrl || !encryptionKey) {
  console.error('[erp-worker] DATABASE_URL and ERP_TOKEN_ENCRYPTION_KEY are required');
  process.exit(1);
}

const db = await createPostgresDb(databaseUrl);
const transport = createSmtpTransportFromEnv();
const tokenEncryptionKey = parseTokenEncryptionKey(encryptionKey);
const workerId = process.env.WORKER_ID ?? `erp-worker-${process.pid}`;
const pollMs = Math.max(500, Number(process.env.OUTBOX_POLL_MS) || 5000);
let lastMaintenanceAt = 0;

async function tick(): Promise<void> {
  const result = await processOutboxBatch(db, transport, {
    tokenEncryptionKey,
    workerId,
  });
  if (result.claimed > 0) {
    console.log(`[erp-worker] claimed=${result.claimed} delivered=${result.delivered} failed=${result.failed}`);
  }
  if (Date.now() - lastMaintenanceAt >= 60 * 60 * 1000) {
    console.log('[erp-worker] maintenance', await runMaintenance(db));
    lastMaintenanceAt = Date.now();
  }
}

console.log(`[erp-worker] started as ${workerId}`);
for (;;) {
  try {
    await tick();
  } catch (error) {
    console.error('[erp-worker] tick failed', error);
  }
  await new Promise((resolve) => setTimeout(resolve, pollMs));
}
