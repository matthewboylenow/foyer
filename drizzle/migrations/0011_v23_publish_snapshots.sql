CREATE TABLE "playlist_snapshots" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"published_at" timestamp with time zone DEFAULT now() NOT NULL,
	"published_by" text,
	"reason" text DEFAULT 'manual' NOT NULL,
	"source_hash" text NOT NULL,
	"slides" jsonb NOT NULL,
	"slide_count" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
ALTER TABLE "playlist_snapshots" ADD CONSTRAINT "playlist_snapshots_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "playlist_snapshots_tenant_published_idx" ON "playlist_snapshots" USING btree ("tenant_id","published_at");