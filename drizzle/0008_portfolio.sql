CREATE TABLE "album_item" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"album_id" uuid NOT NULL,
	"media_id" uuid NOT NULL,
	"caption" text DEFAULT '' NOT NULL,
	"position" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "portfolio_album" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" text NOT NULL,
	"title" text NOT NULL,
	"event_type" "event_type" NOT NULL,
	"event_date" date,
	"venue" text DEFAULT '' NOT NULL,
	"city" text DEFAULT '' NOT NULL,
	"story" text DEFAULT '' NOT NULL,
	"cover_media_id" uuid,
	"featured" boolean DEFAULT false NOT NULL,
	"visible" boolean DEFAULT true NOT NULL,
	"position" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "portfolio_album_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
ALTER TABLE "album_item" ADD CONSTRAINT "album_item_album_id_portfolio_album_id_fk" FOREIGN KEY ("album_id") REFERENCES "public"."portfolio_album"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "album_item" ADD CONSTRAINT "album_item_media_id_media_id_fk" FOREIGN KEY ("media_id") REFERENCES "public"."media"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "portfolio_album" ADD CONSTRAINT "portfolio_album_cover_media_id_media_id_fk" FOREIGN KEY ("cover_media_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "album_item_album_idx" ON "album_item" USING btree ("album_id");