CREATE TABLE "addon" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"price" bigint NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"show_on_site" boolean DEFAULT true NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"position" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "faq_item" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"question" text NOT NULL,
	"answer" text NOT NULL,
	"visible" boolean DEFAULT true NOT NULL,
	"position" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "list_publish" (
	"list" text PRIMARY KEY NOT NULL,
	"data" jsonb NOT NULL,
	"published_at" timestamp with time zone DEFAULT now() NOT NULL,
	"published_by" text
);
--> statement-breakpoint
CREATE TABLE "package_category" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"position" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "package" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"category_id" uuid NOT NULL,
	"name" text NOT NULL,
	"price" bigint NOT NULL,
	"inclusions" text[] DEFAULT '{}' NOT NULL,
	"note" text DEFAULT '' NOT NULL,
	"image_media_id" uuid,
	"featured" boolean DEFAULT false NOT NULL,
	"visible" boolean DEFAULT true NOT NULL,
	"position" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "testimonial" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"quote" text NOT NULL,
	"event_label" text DEFAULT '' NOT NULL,
	"photo_media_id" uuid,
	"visible" boolean DEFAULT true NOT NULL,
	"position" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "list_publish" ADD CONSTRAINT "list_publish_published_by_user_id_fk" FOREIGN KEY ("published_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "package" ADD CONSTRAINT "package_category_id_package_category_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."package_category"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "package" ADD CONSTRAINT "package_image_media_id_media_id_fk" FOREIGN KEY ("image_media_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "testimonial" ADD CONSTRAINT "testimonial_photo_media_id_media_id_fk" FOREIGN KEY ("photo_media_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "package_category_idx" ON "package" USING btree ("category_id");--> statement-breakpoint
ALTER TABLE "booking" ADD CONSTRAINT "booking_package_id_package_id_fk" FOREIGN KEY ("package_id") REFERENCES "public"."package"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "booking_addon" ADD CONSTRAINT "booking_addon_addon_id_addon_id_fk" FOREIGN KEY ("addon_id") REFERENCES "public"."addon"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
-- Dummy categories the owner renames or replaces (docs/02-DATA-MODEL.md → package_category)
INSERT INTO "package_category" ("name", "position") VALUES ('Wedding', 'a0'), ('Lamaran / Engagement', 'a1'), ('Prewedding', 'a2'), ('Event', 'a3');
