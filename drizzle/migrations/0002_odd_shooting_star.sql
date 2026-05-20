ALTER TABLE "displays" ADD COLUMN "current_slide_id" uuid;--> statement-breakpoint
ALTER TABLE "displays" ADD COLUMN "current_slide_started_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "displays" ADD COLUMN "last_heartbeat_at" timestamp with time zone;