CREATE TABLE "master_admin_account" (
	"master_fn" text NOT NULL,
	"user_id" bigint NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "master_admin_account_master_fn_user_id_pk" PRIMARY KEY("master_fn","user_id")
);
--> statement-breakpoint
CREATE TABLE "platform_idempotency" (
	"platform_principal_id" bigint NOT NULL,
	"operation" text NOT NULL,
	"idempotency_key" text NOT NULL,
	"request_hash" text NOT NULL,
	"response_status" integer,
	"response_body" jsonb,
	"completed_at" timestamp with time zone,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "platform_idempotency_platform_principal_id_operation_idempotency_key_pk" PRIMARY KEY("platform_principal_id","operation","idempotency_key")
);
--> statement-breakpoint
ALTER TABLE "master_admin_account" ADD CONSTRAINT "master_admin_account_master_fn_master_master_fn_fk" FOREIGN KEY ("master_fn") REFERENCES "public"."master"("master_fn") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "master_admin_account" ADD CONSTRAINT "master_admin_account_user_id_app_user_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."app_user"("user_id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "platform_idempotency" ADD CONSTRAINT "platform_idempotency_platform_principal_id_platform_principal_principal_id_fk" FOREIGN KEY ("platform_principal_id") REFERENCES "public"."platform_principal"("principal_id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
CREATE UNIQUE INDEX "uq_master_admin_account_master" ON "master_admin_account" USING btree ("master_fn");
--> statement-breakpoint
CREATE INDEX "idx_master_admin_account_user" ON "master_admin_account" USING btree ("user_id");
--> statement-breakpoint
CREATE INDEX "idx_platform_idempotency_expiry" ON "platform_idempotency" USING btree ("expires_at");
--> statement-breakpoint
-- Backfill the expanded tenant-provisioning authority for existing Platform
-- Superadmins. Support roles intentionally receive no commercial tenant rights.
INSERT INTO "platform_role_permission" (
	"platform_role_id", "permission_key", "created_at", "updated_at"
)
SELECT role_row."platform_role_id", permission_row."permission_key", now(), now()
FROM "platform_role" role_row
CROSS JOIN (
	VALUES
		('platform.modules.read'),
		('platform.modules.manage'),
		('platform.tenants.read'),
		('platform.tenants.manage'),
		('platform.simulation.manage')
) AS permission_row("permission_key")
WHERE role_row."code" = 'platform_superadmin'
ON CONFLICT ("platform_role_id", "permission_key") DO NOTHING;
