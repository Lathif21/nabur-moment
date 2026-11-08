CREATE TABLE "expense" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"spent_on" date NOT NULL,
	"amount" bigint NOT NULL,
	"category_id" uuid NOT NULL,
	"booking_id" uuid,
	"description" text,
	"method" "payment_method" NOT NULL,
	"receipt_media_id" uuid,
	"created_by" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "expense_amount_positive" CHECK ("expense"."amount" > 0)
);
--> statement-breakpoint
CREATE TABLE "expense_category" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"position" text NOT NULL,
	"archived" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "expense_category_name_unique" UNIQUE("name")
);
--> statement-breakpoint
ALTER TABLE "expense" ADD CONSTRAINT "expense_category_id_expense_category_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."expense_category"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "expense" ADD CONSTRAINT "expense_booking_id_booking_id_fk" FOREIGN KEY ("booking_id") REFERENCES "public"."booking"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "expense" ADD CONSTRAINT "expense_receipt_media_id_media_id_fk" FOREIGN KEY ("receipt_media_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "expense" ADD CONSTRAINT "expense_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "expense_spent_on_idx" ON "expense" USING btree ("spent_on");--> statement-breakpoint
CREATE INDEX "expense_booking_idx" ON "expense" USING btree ("booking_id");--> statement-breakpoint
CREATE INDEX "expense_category_idx" ON "expense" USING btree ("category_id");--> statement-breakpoint
-- Dummy starting list (Q9); the owner edits it in Pengaturan → Bisnis & Keuangan
INSERT INTO "expense_category" ("name", "position") VALUES
	('Fee crew', 'a0'),
	('Transport', 'a1'),
	('Akomodasi', 'a2'),
	('Konsumsi', 'a3'),
	('Alat / Gear', 'a4'),
	('Iklan', 'a5'),
	('Langganan aplikasi', 'a6'),
	('Lainnya', 'a7')
ON CONFLICT ("name") DO NOTHING;
