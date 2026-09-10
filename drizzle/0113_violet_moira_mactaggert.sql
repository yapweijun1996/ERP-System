DROP INDEX "uq_outbox_document_signal";--> statement-breakpoint
CREATE UNIQUE INDEX "uq_outbox_document_signal" ON "outbox_event" USING btree ("master_fn","company_fn","topic","aggregate_type","aggregate_id") WHERE "outbox_event"."topic" in (
    'document.scan.requested',
    'document.extraction.requested',
    'receipt.inbox.submitted',
    'agent.workflow.receipt_pack.requested'
  );