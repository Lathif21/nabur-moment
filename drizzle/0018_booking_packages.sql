CREATE TABLE "booking_package" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"booking_id" uuid NOT NULL,
	"package_id" uuid,
	"name" text NOT NULL,
	"price" bigint NOT NULL,
	"inclusions" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"category" text,
	"sort" smallint DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "booking_package_price_nonneg" CHECK ("booking_package"."price" >= 0)
);
--> statement-breakpoint
ALTER TABLE "booking" DROP CONSTRAINT "booking_package_id_package_id_fk";
--> statement-breakpoint
ALTER TABLE "booking_package" ADD CONSTRAINT "booking_package_booking_id_booking_id_fk" FOREIGN KEY ("booking_id") REFERENCES "public"."booking"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "booking_package" ADD CONSTRAINT "booking_package_package_id_package_id_fk" FOREIGN KEY ("package_id") REFERENCES "public"."package"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "booking_package_booking_idx" ON "booking_package" USING btree ("booking_id");--> statement-breakpoint
-- A booking may now hold several packages: move each booking's single package (and its snapshot) over
INSERT INTO "booking_package" ("booking_id", "package_id", "name", "price", "inclusions", "category", "sort", "created_at")
SELECT
	b."id",
	b."package_id",
	b."package_snapshot"->>'name',
	coalesce((b."package_snapshot"->>'price')::bigint, 0),
	coalesce(b."package_snapshot"->'inclusions', '[]'::jsonb),
	b."package_snapshot"->>'category',
	0,
	b."created_at"
FROM "booking" b
WHERE b."package_snapshot" IS NOT NULL AND b."package_snapshot"->>'name' IS NOT NULL;--> statement-breakpoint
ALTER TABLE "booking" DROP COLUMN "package_id";--> statement-breakpoint
ALTER TABLE "booking" DROP COLUMN "package_snapshot";