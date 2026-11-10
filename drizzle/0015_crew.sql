CREATE TABLE "booking_crew" (
	"booking_id" uuid NOT NULL,
	"crew_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "booking_crew_booking_id_crew_id_pk" PRIMARY KEY("booking_id","crew_id")
);
--> statement-breakpoint
CREATE TABLE "crew" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"role" text DEFAULT '' NOT NULL,
	"phone" text,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "booking_crew" ADD CONSTRAINT "booking_crew_booking_id_booking_id_fk" FOREIGN KEY ("booking_id") REFERENCES "public"."booking"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "booking_crew" ADD CONSTRAINT "booking_crew_crew_id_crew_id_fk" FOREIGN KEY ("crew_id") REFERENCES "public"."crew"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "booking_crew_crew_idx" ON "booking_crew" USING btree ("crew_id");