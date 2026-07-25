import { createPostgresDb } from './data/db';
import { runMaintenance } from './maintenance';
import { parseTokenEncryptionKey } from './auth/tokenCrypto';
import {
  createSmtpTransportFromEnv,
  processOutboxBatch,
} from './worker/outbox';
import { processReportJobBatch } from './modules/reporting/reportJobs';
import {
  createGenericCalendarDriverFromEnv,
  processCalendarOutboundBatch,
} from './modules/hr/calendarSync';
import { processDocumentJobBatch } from './modules/documents/processing';
import {
  createHttpByokVisionExtractor,
  createHttpLocalOcrExtractor,
  createHttpMalwareScanner,
} from './modules/documents/processingDrivers';

const databaseUrl = process.env.DATABASE_URL;
const encryptionKey = process.env.ERP_TOKEN_ENCRYPTION_KEY;
if (!databaseUrl) {
  console.error('[erp-worker] DATABASE_URL is required');
  process.exit(1);
}

const db = await createPostgresDb(databaseUrl);
const mailEnabled = Boolean(encryptionKey && process.env.SMTP_HOST && process.env.SMTP_FROM);
const transport = mailEnabled ? createSmtpTransportFromEnv() : null;
const tokenEncryptionKey = encryptionKey ? parseTokenEncryptionKey(encryptionKey) : null;
const calendarEnabled = Boolean(process.env.CALENDAR_OUTBOUND_URL);
const calendarDriver = calendarEnabled ? createGenericCalendarDriverFromEnv() : null;
const documentScanner = process.env.DOCUMENT_SCANNER_URL
  ? createHttpMalwareScanner(process.env.DOCUMENT_SCANNER_URL)
  : undefined;
const localOcr = process.env.DOCUMENT_LOCAL_OCR_URL
  ? createHttpLocalOcrExtractor(process.env.DOCUMENT_LOCAL_OCR_URL)
  : undefined;
const vision = process.env.DOCUMENT_VISION_GATEWAY_URL
  ? createHttpByokVisionExtractor(process.env.DOCUMENT_VISION_GATEWAY_URL)
  : undefined;
const workerId = process.env.WORKER_ID ?? `erp-worker-${process.pid}`;
const pollMs = Math.max(500, Number(process.env.OUTBOX_POLL_MS) || 5000);
let lastMaintenanceAt = 0;

async function tick(): Promise<void> {
  if (transport && tokenEncryptionKey) {
    const result = await processOutboxBatch(db, transport, {
      tokenEncryptionKey,
      workerId,
    });
    if (result.claimed > 0) {
      console.log(`[erp-worker] outbox claimed=${result.claimed} delivered=${result.delivered} failed=${result.failed}`);
    }
  }
  const reports = await processReportJobBatch(db, { workerId });
  if (reports.claimed > 0) {
    console.log(`[erp-worker] reports claimed=${reports.claimed} succeeded=${reports.succeeded} failed=${reports.failed}`);
  }
  const documents = await processDocumentJobBatch(db, {
    workerId,
    scanner: documentScanner,
    localOcr,
    vision,
    credentialEncryptionKey: tokenEncryptionKey ?? undefined,
  });
  if (documents.scansClaimed > 0 || documents.extractionsClaimed > 0) {
    console.log(
      `[erp-worker] documents scans=${documents.scansClaimed} clean=${documents.clean}`
      + ` blocked=${documents.blocked} extractions=${documents.extractionsClaimed}`
      + ` extracted=${documents.extracted} failed=${documents.failed}`,
    );
  }
  if (calendarDriver) {
    const calendar = await processCalendarOutboundBatch(
      db,
      { generic: calendarDriver },
      { workerId },
    );
    if (calendar.claimed > 0) {
      console.log(
        `[erp-worker] calendar claimed=${calendar.claimed} delivered=${calendar.delivered}`
        + ` failed=${calendar.failed} superseded=${calendar.superseded}`,
      );
    }
  }
  if (Date.now() - lastMaintenanceAt >= 60 * 60 * 1000) {
    console.log('[erp-worker] maintenance', await runMaintenance(db));
    lastMaintenanceAt = Date.now();
  }
}

console.log(
  `[erp-worker] started as ${workerId}; email=${mailEnabled ? 'enabled' : 'disabled'};`
  + ` reports=enabled; calendar=${calendarEnabled ? 'enabled' : 'disabled'};`
  + ` scanner=${documentScanner ? 'enabled' : 'fail-closed'};`
  + ` local-ocr=${localOcr ? 'enabled' : 'unavailable'};`
  + ` vision=${vision ? 'enabled' : 'unavailable'}`,
);
for (;;) {
  try {
    await tick();
  } catch (error) {
    console.error('[erp-worker] tick failed', error);
  }
  await new Promise((resolve) => setTimeout(resolve, pollMs));
}
