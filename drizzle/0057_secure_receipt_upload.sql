ALTER TABLE "document_version" ADD COLUMN "page_count" integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE "document_version" ADD CONSTRAINT "ck_document_version_page_count" CHECK ("document_version"."page_count" > 0);--> statement-breakpoint
INSERT INTO "role_permission" ("master_fn", "role_id", "permission_key", "allowed")
SELECT "master_fn", "role_id", 'employee.receipts.write', true
FROM "role"
WHERE "name" IN ('Employee', 'Manager')
ON CONFLICT ("role_id", "permission_key") DO NOTHING;
