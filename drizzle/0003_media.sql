CREATE TYPE "public"."embed_provider" AS ENUM('instagram', 'tiktok', 'youtube');--> statement-breakpoint
CREATE TYPE "public"."media_kind" AS ENUM('image', 'video', 'embed');--> statement-breakpoint
CREATE TYPE "public"."media_status" AS ENUM('pending', 'ready');--> statement-breakpoint
CREATE TABLE "media" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"kind" "media_kind" NOT NULL,
	"bucket" text,
	"key" text,
	"variants" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"poster_key" text,
	"filename" text,
	"mime" text,
	"bytes" integer,
	"width" integer,
	"height" integer,
	"duration_s" integer,
	"alt" text DEFAULT '' NOT NULL,
	"focal_x" real DEFAULT 0.5 NOT NULL,
	"focal_y" real DEFAULT 0.5 NOT NULL,
	"embed_provider" "embed_provider",
	"embed_url" text,
	"uploaded_by" text,
	"status" "media_status" DEFAULT 'pending' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "media_focal_range" CHECK ("media"."focal_x" between 0 and 1 and "media"."focal_y" between 0 and 1),
	CONSTRAINT "media_kind_fields" CHECK (("media"."kind" = 'embed' and "media"."embed_url" is not null and "media"."embed_provider" is not null)
				or ("media"."kind" <> 'embed' and "media"."key" is not null and "media"."bucket" is not null))
);
--> statement-breakpoint
CREATE TABLE "media_usage" (
	"media_id" uuid NOT NULL,
	"owner_type" text NOT NULL,
	"owner_id" text NOT NULL,
	"field" text NOT NULL,
	CONSTRAINT "media_usage_media_id_owner_type_owner_id_field_pk" PRIMARY KEY("media_id","owner_type","owner_id","field")
);
--> statement-breakpoint
ALTER TABLE "media" ADD CONSTRAINT "media_uploaded_by_user_id_fk" FOREIGN KEY ("uploaded_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "media_usage" ADD CONSTRAINT "media_usage_media_id_media_id_fk" FOREIGN KEY ("media_id") REFERENCES "public"."media"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "media_created_idx" ON "media" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "media_usage_owner_idx" ON "media_usage" USING btree ("owner_type","owner_id");