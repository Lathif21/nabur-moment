CREATE TABLE "page_section" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"page" text NOT NULL,
	"key" text NOT NULL,
	"sort" smallint NOT NULL,
	"draft" jsonb NOT NULL,
	"draft_visible" boolean DEFAULT true NOT NULL,
	"published" jsonb,
	"visible" boolean DEFAULT true NOT NULL,
	"published_at" timestamp with time zone,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_by" text,
	CONSTRAINT "page_section_page_key" UNIQUE("page","key")
);
--> statement-breakpoint
ALTER TABLE "page_section" ADD CONSTRAINT "page_section_updated_by_user_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;