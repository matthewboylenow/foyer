ALTER TABLE "settings" ADD COLUMN "font_pair" text DEFAULT 'classic-sans' NOT NULL;--> statement-breakpoint
-- Data backfill: every tenant that exists before this migration runs was on
-- Saint Helen's font pair (Libre Baskerville + Libre Franklin) because that
-- was the only option. Set them all to 'editorial-serif' so existing TVs
-- look identical the morning after the migration. New tenants created
-- after this row will pick up the column default ('classic-sans').
UPDATE "settings" SET "font_pair" = 'editorial-serif';
