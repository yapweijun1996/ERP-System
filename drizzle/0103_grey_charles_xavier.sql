ALTER TABLE "document_extraction" DROP CONSTRAINT "ck_document_extraction_status";--> statement-breakpoint
ALTER TABLE "document_scan_job" DROP CONSTRAINT "ck_document_scan_job_status";--> statement-breakpoint
DROP INDEX "idx_outbox_pending";--> statement-breakpoint
DROP INDEX "idx_outbox_lease";--> statement-breakpoint
ALTER TABLE "outbox_event" ADD COLUMN "dead_lettered_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "document_extraction" ADD COLUMN "dead_lettered_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "document_scan_job" ADD COLUMN "dead_lettered_at" timestamp with time zone;--> statement-breakpoint
CREATE INDEX "idx_outbox_pending" ON "outbox_event" USING btree ("delivered_at","dead_lettered_at","available_at","id");--> statement-breakpoint
CREATE INDEX "idx_outbox_lease" ON "outbox_event" USING btree ("delivered_at","dead_lettered_at","locked_at","available_at","id");--> statement-breakpoint
ALTER TABLE "document_extraction" ADD CONSTRAINT "ck_document_extraction_status" CHECK ("document_extraction"."status" in ('queued','extracting','succeeded','failed','unavailable','dead_letter'));--> statement-breakpoint
ALTER TABLE "document_scan_job" ADD CONSTRAINT "ck_document_scan_job_status" CHECK ("document_scan_job"."status" in ('queued','scanning','clean','infected','indeterminate','unavailable','dead_letter'));