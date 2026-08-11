ALTER TABLE "platform_principal" ADD COLUMN "password_hash" text;
--> statement-breakpoint
CREATE TABLE "platform_simulation_session" (
	"simulation_id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "platform_simulation_session_simulation_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"platform_session_hash" text NOT NULL,
	"platform_principal_id" bigint NOT NULL,
	"target_user_id" bigint NOT NULL,
	"master_fn" text NOT NULL,
	"company_fn" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"revoked_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "platform_simulation_session" ADD CONSTRAINT "platform_simulation_session_platform_session_hash_platform_session_token_hash_fk" FOREIGN KEY ("platform_session_hash") REFERENCES "public"."platform_session"("token_hash") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "platform_simulation_session" ADD CONSTRAINT "platform_simulation_session_platform_principal_id_platform_principal_principal_id_fk" FOREIGN KEY ("platform_principal_id") REFERENCES "public"."platform_principal"("principal_id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "platform_simulation_session" ADD CONSTRAINT "platform_simulation_session_target_user_id_app_user_user_id_fk" FOREIGN KEY ("target_user_id") REFERENCES "public"."app_user"("user_id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "platform_simulation_session" ADD CONSTRAINT "platform_simulation_session_master_fn_master_master_fn_fk" FOREIGN KEY ("master_fn") REFERENCES "public"."master"("master_fn") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "platform_simulation_session" ADD CONSTRAINT "platform_simulation_session_company_fn_company_company_fn_fk" FOREIGN KEY ("company_fn") REFERENCES "public"."company"("company_fn") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "platform_simulation_session" ADD CONSTRAINT "fk_platform_simulation_company_master" FOREIGN KEY ("master_fn","company_fn") REFERENCES "public"."company"("master_fn","company_fn") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
CREATE UNIQUE INDEX "uq_platform_simulation_active_session" ON "platform_simulation_session" USING btree ("platform_session_hash") WHERE "platform_simulation_session"."revoked_at" is null;
--> statement-breakpoint
CREATE INDEX "idx_platform_simulation_principal_window" ON "platform_simulation_session" USING btree ("platform_principal_id","expires_at","revoked_at");
--> statement-breakpoint
CREATE INDEX "idx_platform_simulation_target_window" ON "platform_simulation_session" USING btree ("master_fn","company_fn","target_user_id","expires_at","revoked_at");
