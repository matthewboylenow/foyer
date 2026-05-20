CREATE TABLE "tenant_users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"email" text NOT NULL,
	"role" text DEFAULT 'editor' NOT NULL,
	"added_by" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "settings" ADD COLUMN "email_from_name" text;--> statement-breakpoint
ALTER TABLE "settings" ADD COLUMN "email_from_address" text;--> statement-breakpoint
ALTER TABLE "settings" ADD COLUMN "allowed_domain" text;--> statement-breakpoint
ALTER TABLE "tenant_users" ADD CONSTRAINT "tenant_users_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
-- Data seeds for the v1.0 → v1.7 transition: migrate the hardcoded
-- allowlist from lib/auth/allowlist.ts into the DB so the existing
-- Saint Helen tenant keeps working after that file is removed.
INSERT INTO "tenant_users" ("tenant_id", "email", "role")
SELECT "id", 'matthew@adventii.com', 'owner' FROM "tenants" LIMIT 1
ON CONFLICT DO NOTHING;--> statement-breakpoint
UPDATE "settings" SET "allowed_domain" = 'sainthelen.org' WHERE "allowed_domain" IS NULL;