// Shared error type for the crm module (createOpportunity.ts,
// convertOpportunityToSalesOrder.ts) — same shape as purchasing/errors.ts's
// InvalidPurchaseOrderStateError, kept as its own class per module.
export class InvalidOpportunityStateError extends Error {
  constructor(message: string) { super(message); this.name = 'InvalidOpportunityStateError'; }
}
