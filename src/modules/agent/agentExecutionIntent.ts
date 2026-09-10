import { createHash } from 'node:crypto';
import { appendAudit } from '../../api/audit';
import {
  CompanyReceiptPackError,
  normalizeCompanyReceiptPackFilters,
  normalizeCompanyReceiptPackKey,
  normalizeCompanyReceiptPackLocale,
  createCompanyReceiptPackFromSelectionWithin,
  readCompanyReceiptPackByKeyWithin,
  selectCompanyReceiptPackWithin,
} from '../expenses/companyReceiptPack';
import { createAgentExecutionIntentCommands } from './agentExecutionIntentCommands';

export * from './agentExecutionIntentCommands';

/** Server facade preserves existing imports and supplies Node/server dependencies. */
export const {
  prepareAgentExecutionIntentWithin,
  readAgentExecutionIntentWithin,
  approveAgentExecutionIntentWithin,
  rejectAgentExecutionIntentWithin,
  cancelAgentExecutionIntentWithin,
  verifyAgentExecutionIntentWithin,
  executeAgentReceiptPackWithin,
  executeStoredAgentReceiptPackWithin,
} = createAgentExecutionIntentCommands({
  sha256: (value) => createHash('sha256').update(value).digest('hex'),
  appendAudit,
  isPackError: (error) => error instanceof CompanyReceiptPackError,
  normalizeCompanyReceiptPackFilters,
  normalizeCompanyReceiptPackKey,
  normalizeCompanyReceiptPackLocale,
  createCompanyReceiptPackFromSelectionWithin,
  readCompanyReceiptPackByKeyWithin,
  selectCompanyReceiptPackWithin,
});
