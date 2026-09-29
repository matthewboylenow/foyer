ALTER TYPE "public"."slide_template" ADD VALUE 'poster';--> statement-breakpoint
ALTER TABLE "slides" ADD COLUMN "priority" boolean DEFAULT false NOT NULL;