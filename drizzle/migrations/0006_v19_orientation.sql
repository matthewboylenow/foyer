ALTER TABLE "displays" ADD COLUMN "orientation" text DEFAULT 'portrait' NOT NULL;--> statement-breakpoint
ALTER TABLE "slides" ADD COLUMN "content_landscape" jsonb;