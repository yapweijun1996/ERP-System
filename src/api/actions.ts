import { ActionDispatchError, type ActionDefinition } from './actionDispatcher';
import {
  convertOpportunityToSalesOrderWithin,
  type ConvertOpportunityInput,
} from '../modules/crm/convertOpportunityToSalesOrder';

const ACTIONS: Record<string, ActionDefinition> = {
  'crm/opportunities/convert': {
    permission: 'crm.write',
    idempotency: 'required',
    audit: 'required',
    async execute(tx, scope, input) {
      const payload = input.payload as unknown as Omit<ConvertOpportunityInput, 'opportunityId'>;
      if (
        typeof payload.docNo !== 'string'
        || !payload.docNo.trim()
        || typeof payload.orderDate !== 'string'
        || !/^\d{4}-\d{2}-\d{2}$/.test(payload.orderDate)
        || !Array.isArray(payload.lines)
        || payload.lines.length === 0
        || payload.lines.some((line) =>
          !line
          || typeof line !== 'object'
          || !Number.isSafeInteger(line.productId)
          || line.productId <= 0
          || !Number.isSafeInteger(line.warehouseId)
          || line.warehouseId <= 0
          || !Number.isFinite(line.qty)
          || line.qty <= 0
          || !Number.isFinite(line.unitPrice)
          || line.unitPrice < 0
          || typeof line.taxCode !== 'string'
          || !line.taxCode)
      ) {
        throw new ActionDispatchError(
          400,
          'invalid_action_payload',
          'docNo, orderDate and at least one valid order line are required.',
        );
      }
      return convertOpportunityToSalesOrderWithin(tx, scope, {
        opportunityId: input.resourceId,
        docNo: payload.docNo,
        orderDate: payload.orderDate,
        lines: payload.lines,
      });
    },
  },
};

export function actionDefinitionFor(
  resource: string,
  action: string,
): ActionDefinition | null {
  return ACTIONS[`${resource}/${action}`] ?? null;
}
