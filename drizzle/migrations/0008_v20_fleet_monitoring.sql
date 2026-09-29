CREATE TABLE "display_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"display_id" uuid NOT NULL,
	"kind" text NOT NULL,
	"at" timestamp with time zone DEFAULT now() NOT NULL,
	"resolved_at" timestamp with time zone,
	"alerted_at" timestamp with time zone,
	"meta" jsonb DEFAULT '{}'::jsonb
);
--> statement-breakpoint
ALTER TABLE "displays" ADD COLUMN "offline_since" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "displays" ADD COLUMN "hardware" text DEFAULT 'browser' NOT NULL;--> statement-breakpoint
ALTER TABLE "displays" ADD COLUMN "agent_last_seen_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "displays" ADD COLUMN "agent_info" jsonb;--> statement-breakpoint
ALTER TABLE "displays" ADD COLUMN "pending_command" text;--> statement-breakpoint
ALTER TABLE "displays" ADD COLUMN "pending_command_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "displays" ADD COLUMN "pending_command_by" text;--> statement-breakpoint
ALTER TABLE "displays" ADD COLUMN "reload_requested_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "displays" ADD COLUMN "screenshot_url" text;--> statement-breakpoint
ALTER TABLE "displays" ADD COLUMN "screenshot_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "settings" ADD COLUMN "alert_emails" text;--> statement-breakpoint
ALTER TABLE "settings" ADD COLUMN "alert_offline_after_min" integer DEFAULT 10 NOT NULL;--> statement-breakpoint
ALTER TABLE "display_events" ADD CONSTRAINT "display_events_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "display_events" ADD CONSTRAINT "display_events_display_id_displays_id_fk" FOREIGN KEY ("display_id") REFERENCES "public"."displays"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "display_events_display_at_idx" ON "display_events" USING btree ("display_id","at");