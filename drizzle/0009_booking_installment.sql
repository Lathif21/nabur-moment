CREATE TYPE "public"."installment_kind" AS ENUM('dp', 'pelunasan', 'other');--> statement-breakpoint
CREATE TABLE "booking_installment" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"booking_id" uuid NOT NULL,
	"kind" "installment_kind" NOT NULL,
	"amount" bigint NOT NULL,
	"due_date" date,
	"cancelled_at" timestamp with time zone,
	"sort" smallint DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "booking_installment_amount_nonneg" CHECK ("booking_installment"."amount" >= 0)
);
--> statement-breakpoint
ALTER TABLE "booking_installment" ADD CONSTRAINT "booking_installment_booking_id_booking_id_fk" FOREIGN KEY ("booking_id") REFERENCES "public"."booking"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "booking_installment_booking_idx" ON "booking_installment" USING btree ("booking_id");--> statement-breakpoint
CREATE UNIQUE INDEX "booking_installment_one_per_kind" ON "booking_installment" USING btree ("booking_id","kind") WHERE "booking_installment"."kind" in ('dp', 'pelunasan');--> statement-breakpoint
-- Backfill: every existing booking gets its schedule (DP 50%, pelunasan = the rest due on the
-- first session date; cancelled for Batal). Same rule as ensureSchedule (services/installments.ts).
INSERT INTO "booking_installment" ("booking_id", "kind", "amount", "due_date", "cancelled_at", "sort")
SELECT b."id", 'dp', b."agreed_price" * 50 / 100, NULL, NULL, 0
FROM "booking" b
WHERE NOT EXISTS (SELECT 1 FROM "booking_installment" i WHERE i."booking_id" = b."id" AND i."kind" = 'dp');--> statement-breakpoint
INSERT INTO "booking_installment" ("booking_id", "kind", "amount", "due_date", "cancelled_at", "sort")
SELECT b."id", 'pelunasan', b."agreed_price" - b."agreed_price" * 50 / 100,
	(SELECT min(s."date") FROM "booking_session" s WHERE s."booking_id" = b."id"),
	CASE WHEN b."stage" = 'lost' THEN coalesce(b."stage_changed_at", now()) END, 1
FROM "booking" b
WHERE NOT EXISTS (SELECT 1 FROM "booking_installment" i WHERE i."booking_id" = b."id" AND i."kind" = 'pelunasan');
