CREATE TABLE "user_company_role" (
	"user_id" bigint NOT NULL,
	"company_fn" text NOT NULL,
	"role_id" bigint NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "user_company_role_user_id_company_fn_role_id_pk" PRIMARY KEY("user_id","company_fn","role_id")
);
--> statement-breakpoint
ALTER TABLE "app_user" ALTER COLUMN "email" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "app_user" ADD COLUMN "username" text;--> statement-breakpoint
WITH normalized AS (
	SELECT
		"user_id",
		"master_fn",
		lower(regexp_replace(split_part(coalesce("email", ''), '@', 1), '[^a-zA-Z0-9._-]+', '-', 'g')) AS base
	FROM "app_user"
), ranked AS (
	SELECT
		"user_id",
		CASE
			WHEN length(base) >= 3
				AND row_number() OVER (PARTITION BY "master_fn", base ORDER BY "user_id") = 1
				THEN left(base, 64)
			WHEN length(base) >= 3
				THEN left(base, 52) || '-' || "user_id"::text
			ELSE 'user-' || "user_id"::text
		END AS migrated_username
	FROM normalized
)
UPDATE "app_user"
SET "username" = ranked.migrated_username
FROM ranked
WHERE "app_user"."user_id" = ranked."user_id"
	AND "app_user"."username" IS NULL;--> statement-breakpoint
ALTER TABLE "app_user" ALTER COLUMN "username" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "master" ADD COLUMN "login_code" text;--> statement-breakpoint
WITH normalized AS (
	SELECT
		"master_fn",
		upper(regexp_replace("master_fn", '[^a-zA-Z0-9-]+', '-', 'g')) AS base
	FROM "master"
), ranked AS (
	SELECT
		"master_fn",
		CASE
			WHEN length(base) BETWEEN 3 AND 32
				AND row_number() OVER (PARTITION BY base ORDER BY "master_fn") = 1
				THEN base
			ELSE 'ORG-' || left(md5("master_fn"), 12)
		END AS migrated_login_code
	FROM normalized
)
UPDATE "master"
SET "login_code" = ranked.migrated_login_code
FROM ranked
WHERE "master"."master_fn" = ranked."master_fn"
	AND "master"."login_code" IS NULL;--> statement-breakpoint
ALTER TABLE "master" ALTER COLUMN "login_code" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "user_company_role" ADD CONSTRAINT "user_company_role_user_id_app_user_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."app_user"("user_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_company_role" ADD CONSTRAINT "user_company_role_company_fn_company_company_fn_fk" FOREIGN KEY ("company_fn") REFERENCES "public"."company"("company_fn") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_company_role" ADD CONSTRAINT "user_company_role_role_id_role_role_id_fk" FOREIGN KEY ("role_id") REFERENCES "public"."role"("role_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_company_role" ADD CONSTRAINT "fk_user_company_role_membership" FOREIGN KEY ("user_id","company_fn") REFERENCES "public"."user_company"("user_id","company_fn") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
INSERT INTO "user_company_role" ("user_id", "company_fn", "role_id", "created_at", "updated_at")
SELECT "user_id", "company_fn", "role_id", "created_at", "updated_at"
FROM "user_company"
ON CONFLICT ("user_id", "company_fn", "role_id") DO NOTHING;--> statement-breakpoint
CREATE INDEX "idx_user_company_role_company" ON "user_company_role" USING btree ("company_fn","user_id");--> statement-breakpoint
CREATE INDEX "idx_user_company_role_role" ON "user_company_role" USING btree ("role_id");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_user_master_username" ON "app_user" USING btree ("master_fn","username");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_master_login_code" ON "master" USING btree ("login_code");
