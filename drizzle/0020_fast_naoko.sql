CREATE TABLE "contact" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "contact_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"master_fn" text NOT NULL,
	"company_fn" text NOT NULL,
	"customer_id" bigint NOT NULL,
	"name" text NOT NULL,
	"role" text NOT NULL,
	"email" text,
	"phone" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "activity" ALTER COLUMN "opportunity_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "customer" ADD COLUMN "industry" text;--> statement-breakpoint
ALTER TABLE "customer" ADD COLUMN "owner_user_id" bigint;--> statement-breakpoint
ALTER TABLE "activity" ADD COLUMN "customer_id" bigint;--> statement-breakpoint
ALTER TABLE "contact" ADD CONSTRAINT "contact_customer_id_customer_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customer"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_contact_customer" ON "contact" USING btree ("master_fn","company_fn","customer_id");--> statement-breakpoint
ALTER TABLE "customer" ADD CONSTRAINT "customer_owner_user_id_app_user_user_id_fk" FOREIGN KEY ("owner_user_id") REFERENCES "public"."app_user"("user_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "activity" ADD CONSTRAINT "activity_customer_id_customer_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customer"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_activity_customer" ON "activity" USING btree ("master_fn","company_fn","customer_id","occurred_at");--> statement-breakpoint
ALTER TABLE "activity" ADD CONSTRAINT "ck_activity_target" CHECK ("activity"."opportunity_id" is not null or "activity"."customer_id" is not null);