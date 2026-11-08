CREATE TABLE "app_settings" (
	"id" smallint PRIMARY KEY DEFAULT 1 NOT NULL,
	"business_name" text DEFAULT 'Nabur Moment' NOT NULL,
	"address" text,
	"phone" text,
	"email" text,
	"instagram" text,
	"bank_name" text DEFAULT 'BCA' NOT NULL,
	"bank_number" text,
	"bank_holder" text,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_by" text,
	CONSTRAINT "app_settings_single_row" CHECK ("app_settings"."id" = 1)
);
--> statement-breakpoint
ALTER TABLE "app_settings" ADD CONSTRAINT "app_settings_updated_by_user_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
-- The single settings row; the owner fills in address, contacts and the BCA account in the admin
INSERT INTO "app_settings" ("id") VALUES (1) ON CONFLICT DO NOTHING;
