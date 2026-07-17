// Shared error types for the purchasing module (createPurchaseOrder.ts,
// receiveGoods.ts, postSupplierInvoice.ts) — same shape as sales/confirmOrder.ts's
// PostingError, kept as its own class per module rather than a cross-module import.
export class PostingError extends Error {
  constructor(message: string) { super(message); this.name = 'PostingError'; }
}

/** Thrown when a PO is not in a state that allows the requested action (e.g.
 *  receiving goods against a PO that was already received, or invoicing a PO
 *  that hasn't been received yet). */
export class InvalidPurchaseOrderStateError extends Error {
  constructor(message: string) { super(message); this.name = 'InvalidPurchaseOrderStateError'; }
}
