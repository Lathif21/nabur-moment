CREATE TYPE "public"."activity_type" AS ENUM('note', 'call', 'whatsapp', 'meeting', 'stage_change', 'payment', 'invoice', 'expense', 'system');--> statement-breakpoint
CREATE TYPE "public"."booking_origin" AS ENUM('website_form', 'manual');--> statement-breakpoint
CREATE TYPE "public"."booking_stage" AS ENUM('inquiry', 'consultation', 'quotation', 'booked', 'preparation', 'event_day', 'editing', 'completed', 'lost');--> statement-breakpoint
CREATE TYPE "public"."event_type" AS ENUM('wedding', 'akad', 'resepsi', 'lamaran', 'engagement', 'prewedding', 'other');--> statement-breakpoint
CREATE TABLE "activity" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"client_id" uuid NOT NULL,
	"booking_id" uuid,
	"type" "activity_type" NOT NULL,
	"body" text,
	"meta" jsonb,
	"user_id" text,
	"occurred_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "booking" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"client_id" uuid NOT NULL,
	"title" text NOT NULL,
	"event_type" "event_type" NOT NULL,
	"package_id" uuid,
	"package_snapshot" jsonb,
	"agreed_price" bigint DEFAULT 0 NOT NULL,
	"stage" "booking_stage" DEFAULT 'inquiry' NOT NULL,
	"position" text NOT NULL,
	"origin" "booking_origin" DEFAULT 'manual' NOT NULL,
	"inquiry_message" text,
	"lost_reason" text,
	"booked_at" timestamp with time zone,
	"stage_changed_at" timestamp with time zone,
	"delivery_link" text,
	"raw_delivered_on" date,
	"edited_delivered_on" date,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "booking_booked_needs_dp" CHECK ("booking"."stage" not in ('booked', 'preparation', 'event_day', 'editing', 'completed') or "booking"."booked_at" is not null),
	CONSTRAINT "booking_lost_needs_reason" CHECK ("booking"."stage" <> 'lost' or ("booking"."lost_reason" is not null and btrim("booking"."lost_reason") <> '')),
	CONSTRAINT "booking_agreed_price_nonneg" CHECK ("booking"."agreed_price" >= 0)
);
--> statement-breakpoint
CREATE TABLE "booking_addon" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"booking_id" uuid NOT NULL,
	"addon_id" uuid,
	"name" text NOT NULL,
	"unit_price" bigint NOT NULL,
	"qty" smallint DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "booking_addon_qty_min" CHECK ("booking_addon"."qty" >= 1),
	CONSTRAINT "booking_addon_price_nonneg" CHECK ("booking_addon"."unit_price" >= 0)
);
--> statement-breakpoint
CREATE TABLE "booking_session" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"booking_id" uuid NOT NULL,
	"event_type" "event_type" NOT NULL,
	"date" date,
	"start_time" text,
	"end_time" text,
	"venue" text,
	"city" text,
	"notes" text,
	"sort" smallint DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "booking_session_time_format" CHECK (("booking_session"."start_time" is null or "booking_session"."start_time" ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$') and ("booking_session"."end_time" is null or "booking_session"."end_time" ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'))
);
--> statement-breakpoint
CREATE TABLE "client" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"phone" text,
	"email" text,
	"instagram" text,
	"city" text,
	"source_id" uuid,
	"notes" text,
	"archived_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "lead_source" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"position" text NOT NULL,
	"archived" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "lead_source_name_unique" UNIQUE("name")
);
--> statement-breakpoint
ALTER TABLE "activity" ADD CONSTRAINT "activity_client_id_client_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."client"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "activity" ADD CONSTRAINT "activity_booking_id_booking_id_fk" FOREIGN KEY ("booking_id") REFERENCES "public"."booking"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "activity" ADD CONSTRAINT "activity_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "booking" ADD CONSTRAINT "booking_client_id_client_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."client"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "booking_addon" ADD CONSTRAINT "booking_addon_booking_id_booking_id_fk" FOREIGN KEY ("booking_id") REFERENCES "public"."booking"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "booking_session" ADD CONSTRAINT "booking_session_booking_id_booking_id_fk" FOREIGN KEY ("booking_id") REFERENCES "public"."booking"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "client" ADD CONSTRAINT "client_source_id_lead_source_id_fk" FOREIGN KEY ("source_id") REFERENCES "public"."lead_source"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "activity_client_idx" ON "activity" USING btree ("client_id","occurred_at");--> statement-breakpoint
CREATE INDEX "activity_booking_idx" ON "activity" USING btree ("booking_id","occurred_at");--> statement-breakpoint
CREATE INDEX "booking_stage_position_idx" ON "booking" USING btree ("stage","position");--> statement-breakpoint
CREATE INDEX "booking_client_idx" ON "booking" USING btree ("client_id");--> statement-breakpoint
CREATE INDEX "booking_addon_booking_idx" ON "booking_addon" USING btree ("booking_id");--> statement-breakpoint
CREATE INDEX "booking_session_date_idx" ON "booking_session" USING btree ("date");--> statement-breakpoint
CREATE INDEX "booking_session_booking_idx" ON "booking_session" USING btree ("booking_id");--> statement-breakpoint
CREATE INDEX "client_phone_idx" ON "client" USING btree ("phone");--> statement-breakpoint
CREATE INDEX "client_name_trgm_idx" ON "client" USING gin ("name" gin_trgm_ops);--> statement-breakpoint
-- Dummy lead sources (D27): the owner edits / replaces them in Pengaturan. Positions are fractional-indexing keys.
INSERT INTO "lead_source" ("name", "position") VALUES
	('Instagram', 'a0'),
	('TikTok', 'a1'),
	('Referral', 'a2'),
	('Website', 'a3'),
	('WhatsApp', 'a4'),
	('Vendor partner', 'a5'),
	('Lainnya', 'a6')
ON CONFLICT ("name") DO NOTHING;
