ALTER TABLE "master_module" ADD COLUMN "default_company_allocated" boolean DEFAULT false NOT NULL;
--> statement-breakpoint
ALTER TABLE "master_module" ADD COLUMN "version" integer DEFAULT 1 NOT NULL;
--> statement-breakpoint
ALTER TABLE "company_module" ADD COLUMN "version" integer DEFAULT 1 NOT NULL;
--> statement-breakpoint
ALTER TABLE "master_module" ADD CONSTRAINT "ck_master_module_version" CHECK ("master_module"."version" > 0);
--> statement-breakpoint
ALTER TABLE "company_module" ADD CONSTRAINT "ck_company_module_version" CHECK ("company_module"."version" > 0);
--> statement-breakpoint
INSERT INTO "master_module" (
  "master_fn", "module_key", "enabled", "default_company_allocated", "version"
)
SELECT target."master_fn", catalog."module_key",
       coalesce(bool_or(allocation."enabled"), false),
       coalesce(bool_or(allocation."enabled"), false), 1
FROM "master" target
CROSS JOIN (VALUES
  ('sales'), ('purchasing'), ('crm'), ('inventory'), ('warehouse'),
  ('manufacturing'), ('quality'), ('finance'), ('hr'), ('payroll'),
  ('project'), ('service'), ('asset'), ('workflow'), ('bi'), ('integration'),
  ('expenses_tax')
) AS catalog("module_key")
LEFT JOIN "company_module" allocation
  ON allocation."master_fn" = target."master_fn"
 AND allocation."module_key" = catalog."module_key"
GROUP BY target."master_fn", catalog."module_key"
ON CONFLICT ("master_fn", "module_key") DO UPDATE SET
  "enabled" = excluded."enabled",
  "default_company_allocated" = excluded."default_company_allocated",
  "version" = "master_module"."version" + 1,
  "updated_at" = now();
