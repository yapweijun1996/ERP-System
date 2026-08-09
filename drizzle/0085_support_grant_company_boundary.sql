CREATE UNIQUE INDEX "uq_company_master_company" ON "company" USING btree ("master_fn","company_fn");--> statement-breakpoint
ALTER TABLE "support_access_grant" ADD CONSTRAINT "fk_support_access_grant_company_master" FOREIGN KEY ("master_fn","company_fn") REFERENCES "public"."company"("master_fn","company_fn") ON DELETE no action ON UPDATE no action;
