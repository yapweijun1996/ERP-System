ALTER TABLE "document_processing_policy" DROP CONSTRAINT "ck_document_processing_policy_vision_provider";--> statement-breakpoint
ALTER TABLE "document_processing_policy" DROP CONSTRAINT "ck_document_processing_policy_vision_config";--> statement-breakpoint
ALTER TABLE "document_processing_policy" ADD COLUMN "vision_base_url" text;--> statement-breakpoint
ALTER TABLE "document_processing_policy" ADD COLUMN "vision_model" text;--> statement-breakpoint
ALTER TABLE "document_processing_policy" ADD COLUMN "vision_credential_required" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "document_processing_policy" ADD CONSTRAINT "ck_document_processing_policy_vision_provider" CHECK ("document_processing_policy"."vision_provider" is null
      or "document_processing_policy"."vision_provider" in ('openai', 'google', 'openai_compatible'));--> statement-breakpoint
ALTER TABLE "document_processing_policy" ADD CONSTRAINT "ck_document_processing_policy_vision_config" CHECK (("document_processing_policy"."extraction_provider" = 'local_ocr'
      and "document_processing_policy"."vision_provider" is null
      and "document_processing_policy"."vision_region" is null
      and "document_processing_policy"."vision_retention_days" is null
      and "document_processing_policy"."vision_base_url" is null
      and "document_processing_policy"."vision_model" is null)
      or ("document_processing_policy"."extraction_provider" = 'byok_vision'
        and char_length("document_processing_policy"."vision_provider") > 0
        and char_length("document_processing_policy"."vision_region") between 2 and 80
        and "document_processing_policy"."vision_retention_days" between 0 and 365
        and (("document_processing_policy"."vision_provider" in ('openai', 'google')
            and "document_processing_policy"."vision_base_url" is null and "document_processing_policy"."vision_model" is null
            and "document_processing_policy"."vision_credential_required" = true)
          or ("document_processing_policy"."vision_provider" = 'openai_compatible'
            and char_length("document_processing_policy"."vision_base_url") between 8 and 500
            and char_length("document_processing_policy"."vision_model") between 1 and 160))));