import type { DB } from '../../data/db';
import { accountingPeriod, companyPolicy, documentSequence, integrationConnector } from '../../data/schema';

export async function createDefaultControlPlane(
  exec: DB,
  scope: { masterFn: string; companyFn: string },
  country: 'SG' | 'MY',
) {
  const now = new Date();
  const year = now.getUTCFullYear();
  const month = now.getUTCMonth();
  const startDate = `${year}-${String(month + 1).padStart(2, '0')}-01`;
  const endDate = new Date(Date.UTC(year, month + 1, 0)).toISOString().slice(0, 10);
  const label = new Intl.DateTimeFormat('en', { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(now);
  await exec.insert(companyPolicy).values({
    ...scope, dateFormat: country === 'MY' ? 'DD/MM/YYYY' : 'YYYY-MM-DD',
    negativeStockPolicy: 'block', approvalThreshold: '0.00', sessionTimeoutMinutes: 30,
  });
  await exec.insert(documentSequence).values([
    { ...scope, documentType: 'sales_order', prefix: 'SO', nextNumber: 1, padding: 4, resetPolicy: 'yearly' },
    { ...scope, documentType: 'sales_invoice', prefix: 'INV', nextNumber: 1, padding: 4, resetPolicy: 'yearly' },
    { ...scope, documentType: 'purchase_order', prefix: 'PO', nextNumber: 1, padding: 4, resetPolicy: 'yearly' },
    { ...scope, documentType: 'journal_entry', prefix: 'JE', nextNumber: 1, padding: 4, resetPolicy: 'yearly' },
  ]);
  await exec.insert(accountingPeriod).values({
    ...scope, fiscalYear: year, periodNo: month + 1, label, startDate, endDate, status: 'open',
  });
  await exec.insert(integrationConnector).values({
    ...scope, connectorKey: 'customer-csv', displayName: 'Customer CSV import',
    category: 'Data import', direction: 'inbound', schedule: 'manual',
    status: 'connected', health: 'healthy', credentialRequired: false, enabled: true,
  });
  await exec.insert(integrationConnector).values({
    ...scope, connectorKey: 'document-vision', displayName: 'Document Vision (BYOK)',
    category: 'Document processing', direction: 'outbound', schedule: 'realtime',
    status: 'setup', health: 'unknown', credentialRequired: true, enabled: false,
  });
}
