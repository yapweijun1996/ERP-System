ALTER TABLE "audit_log" ADD COLUMN "agent_principal_id" bigint;--> statement-breakpoint
ALTER TABLE "audit_log" ADD COLUMN "delegator_user_id" bigint;--> statement-breakpoint
ALTER TABLE "audit_log" ADD CONSTRAINT "audit_log_agent_principal_id_agent_principal_id_fk" FOREIGN KEY ("agent_principal_id") REFERENCES "public"."agent_principal"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_log" ADD CONSTRAINT "audit_log_delegator_user_id_app_user_user_id_fk" FOREIGN KEY ("delegator_user_id") REFERENCES "public"."app_user"("user_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_audit_agent_activity" ON "audit_log" USING btree ("agent_principal_id","occurred_at","id");--> statement-breakpoint
CREATE INDEX "idx_audit_delegator_activity" ON "audit_log" USING btree ("delegator_user_id","occurred_at","id");