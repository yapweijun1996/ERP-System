ALTER TABLE "company_receipt" ADD COLUMN "evidence_sha256" text;--> statement-breakpoint
UPDATE "company_receipt" receipt
SET "evidence_sha256" = version."sha256"
FROM "document_version" version
WHERE version."master_fn" = receipt."master_fn"
  AND version."company_fn" = receipt."company_fn"
  AND version."id" = receipt."document_version_id";--> statement-breakpoint
ALTER TABLE "company_receipt" ALTER COLUMN "evidence_sha256" SET NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "uq_company_receipt_evidence_hash" ON "company_receipt" USING btree ("master_fn","company_fn","evidence_sha256");--> statement-breakpoint
ALTER TABLE "company_receipt" ADD CONSTRAINT "ck_company_receipt_evidence_hash" CHECK (char_length("company_receipt"."evidence_sha256") = 64 and "company_receipt"."evidence_sha256" ~ '^[0-9a-f]{64}$');
