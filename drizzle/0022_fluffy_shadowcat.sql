CREATE TABLE "master_module" (
	"master_fn" text NOT NULL,
	"module_key" text NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "master_module_master_fn_module_key_pk" PRIMARY KEY("master_fn","module_key")
);
--> statement-breakpoint
CREATE INDEX "idx_master_module_master" ON "master_module" USING btree ("master_fn");