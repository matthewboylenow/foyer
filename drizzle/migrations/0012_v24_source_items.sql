CREATE TABLE "source_deliveries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid,
	"source" text NOT NULL,
	"received_at" timestamp with time zone DEFAULT now() NOT NULL,
	"ok" boolean DEFAULT false NOT NULL,
	"outcome" text NOT NULL,
	"item_count" integer DEFAULT 0 NOT NULL,
	"summary" jsonb DEFAULT '{}'::jsonb,
	"error" text,
	"delivery_id" text
);
--> statement-breakpoint
CREATE TABLE "source_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"source" text NOT NULL,
	"source_id" text NOT NULL,
	"revision" integer DEFAULT 0 NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"kind" text DEFAULT 'announcement' NOT NULL,
	"template_type" "slide_template" NOT NULL,
	"title" text NOT NULL,
	"content" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"image_url" text,
	"schedule_type" "schedule_type" DEFAULT 'evergreen' NOT NULL,
	"start_at" timestamp with time zone,
	"end_at" timestamp with time zone,
	"source_url" text,
	"source_updated_at" timestamp with time zone,
	"payload_hash" text NOT NULL,
	"last_received_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_error" text,
	"hidden" boolean DEFAULT false NOT NULL,
	"weight" integer DEFAULT 1 NOT NULL,
	"duration_override_sec" integer,
	"pin" text,
	"target_displays" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "source_deliveries" ADD CONSTRAINT "source_deliveries_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "source_items" ADD CONSTRAINT "source_items_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "source_deliveries_tenant_received_idx" ON "source_deliveries" USING btree ("tenant_id","received_at");--> statement-breakpoint
CREATE UNIQUE INDEX "source_items_tenant_source_id_idx" ON "source_items" USING btree ("tenant_id","source","source_id");--> statement-breakpoint
CREATE INDEX "source_items_tenant_status_idx" ON "source_items" USING btree ("tenant_id","status");