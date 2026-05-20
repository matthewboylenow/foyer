import {
  pgTable,
  pgEnum,
  uuid,
  text,
  boolean,
  integer,
  timestamp,
  jsonb,
} from 'drizzle-orm/pg-core';

// ─── Enums ───────────────────────────────────────────────────────────────────

export const slideTemplateEnum = pgEnum('slide_template', [
  'parish_identity',
  'welcome_quote',
  'general',
  'mass_schedule',
  'weekly_association',
  'sanctuary_candle',
  'app_promo',
]);

export const scheduleTypeEnum = pgEnum('schedule_type', [
  'evergreen',
  'dated',
]);

export const mediaTypeEnum = pgEnum('media_type', ['image', 'video', 'logo']);

// ─── Tables ──────────────────────────────────────────────────────────────────

export const tenants = pgTable('tenants', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull(),
  slug: text('slug').notNull().unique(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

export const displays = pgTable('displays', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenantId: uuid('tenant_id').notNull().references(() => tenants.id),
  name: text('name').notNull(),
  location: text('location'),
  active: boolean('active').default(true).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

export const media = pgTable('media', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenantId: uuid('tenant_id').notNull().references(() => tenants.id),
  type: mediaTypeEnum('type').notNull(),
  blobUrl: text('blob_url').notNull(),
  filename: text('filename').notNull(),
  width: integer('width'),
  height: integer('height'),
  bytes: integer('bytes'),
  uploadedAt: timestamp('uploaded_at', { withTimezone: true }).defaultNow().notNull(),
  uploadedBy: text('uploaded_by'),
});

export const settings = pgTable('settings', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenantId: uuid('tenant_id').notNull().references(() => tenants.id).unique(),
  globalDurationSec: integer('global_duration_sec').default(15).notNull(),
  videoEnabled: boolean('video_enabled').default(false).notNull(),
  logoMediaId: uuid('logo_media_id').references(() => media.id),
  missionStatement: text('mission_statement'),
  primaryColor: text('primary_color').default('#1F346D').notNull(),
  accentColor: text('accent_color').default('#CD5334').notNull(),
  creamColor: text('cream_color').default('#FAF9F7').notNull(),
  goldColor: text('gold_color').default('#D4AF37').notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

export const slides = pgTable('slides', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenantId: uuid('tenant_id').notNull().references(() => tenants.id),
  templateType: slideTemplateEnum('template_type').notNull(),
  title: text('title').notNull(),
  content: jsonb('content').notNull().default({}),
  scheduleType: scheduleTypeEnum('schedule_type').default('evergreen').notNull(),
  startAt: timestamp('start_at', { withTimezone: true }),
  endAt: timestamp('end_at', { withTimezone: true }),
  targetDisplays: jsonb('target_displays').default([]).notNull(),
  active: boolean('active').default(true).notNull(),
  weight: integer('weight').default(1).notNull(),
  durationOverrideSec: integer('duration_override_sec'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  createdBy: text('created_by'),
  updatedBy: text('updated_by'),
});

// Auth.js tables ──────────────────────────────────────────────────────────────

export const users = pgTable('users', {
  id: text('id').primaryKey(),
  tenantId: uuid('tenant_id').references(() => tenants.id),
  email: text('email').notNull().unique(),
  name: text('name'),
  image: text('image'),
  emailVerified: timestamp('email_verified', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

export const accounts = pgTable('accounts', {
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  type: text('type').notNull(),
  provider: text('provider').notNull(),
  providerAccountId: text('provider_account_id').notNull(),
  refresh_token: text('refresh_token'),
  access_token: text('access_token'),
  expires_at: integer('expires_at'),
  token_type: text('token_type'),
  scope: text('scope'),
  id_token: text('id_token'),
  session_state: text('session_state'),
});

export const sessions = pgTable('sessions', {
  sessionToken: text('session_token').primaryKey(),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  expires: timestamp('expires', { withTimezone: true }).notNull(),
});

export const verificationTokens = pgTable('verification_tokens', {
  identifier: text('identifier').notNull(),
  token: text('token').notNull(),
  expires: timestamp('expires', { withTimezone: true }).notNull(),
});

export const otpCodes = pgTable('otp_codes', {
  id: uuid('id').primaryKey().defaultRandom(),
  email: text('email').notNull(),
  codeHash: text('code_hash').notNull(),
  attempts: integer('attempts').default(0).notNull(),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  consumedAt: timestamp('consumed_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

export const auditLog = pgTable('audit_log', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenantId: uuid('tenant_id').notNull().references(() => tenants.id),
  userId: text('user_id'),
  userEmail: text('user_email'),
  action: text('action').notNull(),
  targetType: text('target_type'),
  targetId: text('target_id'),
  metadata: jsonb('metadata').default({}),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

// ─── TypeScript content types per template ───────────────────────────────────

export type SizePreset = 'small' | 'medium' | 'large';

export type ParishIdentityContent = {
  templateType: 'parish_identity';
  logoMediaId?: string;
  logoSize?: SizePreset;          // default: 'medium'
  headline: string;
  headlineSize?: SizePreset;      // default: 'medium'
  subline?: string;                // HTML from RichTextEditor (or plain text)
};

export type WelcomeQuoteContent = {
  templateType: 'welcome_quote';
  quote: string;
  quoteSize?: SizePreset;          // default: 'medium'
  attribution?: string;
};

export type GeneralContent = {
  templateType: 'general';
  headline: string;
  headlineSize?: SizePreset;       // default: 'medium'
  body: string;                     // HTML from RichTextEditor
  meta?: string;
  bgImageMediaId?: string;
  motionStyle?: 'splitReveal' | 'lineMask';
};

export type MassScheduleRow = {
  timeLabel: string;
  intention: string;
};

export type MassScheduleContent = {
  templateType: 'mass_schedule';
  scheduleKind: 'weekend' | 'weekday';
  rows: MassScheduleRow[];
};

export type WeeklyAssociationContent = {
  templateType: 'weekly_association';
  names: string[];
};

export type SanctuaryCandleContent = {
  templateType: 'sanctuary_candle';
  name: string;
  nameSize?: SizePreset;           // default: 'medium'
  inMemoryOf?: boolean;
};

export type AppPromoContent = {
  templateType: 'app_promo';
  headline: string;
  headlineSize?: SizePreset;       // default: 'medium'
  body: string;
  url: string;
  phoneMockupMediaId?: string;
};

export type SlideContent =
  | ParishIdentityContent
  | WelcomeQuoteContent
  | GeneralContent
  | MassScheduleContent
  | WeeklyAssociationContent
  | SanctuaryCandleContent
  | AppPromoContent;

// Inferred row types for use throughout the app
export type Tenant = typeof tenants.$inferSelect;
export type Display = typeof displays.$inferSelect;
export type Media = typeof media.$inferSelect;
export type Settings = typeof settings.$inferSelect;
export type Slide = typeof slides.$inferSelect;
export type User = typeof users.$inferSelect;
export type AuditLogEntry = typeof auditLog.$inferSelect;

export type SlideWithContent = Omit<Slide, 'content'> & { content: SlideContent };
