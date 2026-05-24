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
  /** Physical mounting orientation of the TV. 'portrait' = 1080×1920,
   *  'landscape' = 1920×1080. Stored as text (not enum) so we can add
   *  values like 'square' later without a migration. Drives which
   *  content (`content` vs `contentLandscape`) the player receives. */
  orientation: text('orientation').default('portrait').notNull(),
  /** ID of the slide the player last reported as currently visible. Null
   *  if the player has never heart-beat (new display) or after a wipe. */
  currentSlideId: uuid('current_slide_id'),
  /** When the current slide became visible. Used to show "on screen for 12s". */
  currentSlideStartedAt: timestamp('current_slide_started_at', { withTimezone: true }),
  /** Last time we heard from the player at all. Drives the online/offline
   *  dot in the admin Displays view. */
  lastHeartbeatAt: timestamp('last_heartbeat_at', { withTimezone: true }),
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
  /** Slide-output font pair id, looked up in lib/fonts.ts FONT_PAIRS.
   *  Drives --font-serif / --font-sans CSS variables via TenantTheme.
   *  Stored as text (not enum) so adding pairs doesn't need a migration. */
  fontPair: text('font_pair').default('classic-sans').notNull(),
  /** Per-tenant Resend "from" address. When null we fall back to EMAIL_FROM env. */
  emailFromName: text('email_from_name'),
  emailFromAddress: text('email_from_address'),
  /** Wildcard email domain that auto-grants access (e.g. 'sainthelen.org'
   *  — any @sainthelen.org address can sign in without being individually
   *  invited). Per-tenant override of the v1.0 hardcoded STAFF_DOMAINS list. */
  allowedDomain: text('allowed_domain'),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

/**
 * A "Collection" groups slides into editorial packs (e.g. "Easter Triduum",
 * "Lent 2026"). Membership is one-to-many — a slide belongs to zero or one
 * collection. Collections give the admin bulk activate / deactivate plus
 * visual grouping in the grid. Deliberately *not* a scheduling primitive
 * (slides keep their own startAt/endAt) so v1.6 stays simple.
 */
export const collections = pgTable('collections', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenantId: uuid('tenant_id').notNull().references(() => tenants.id),
  name: text('name').notNull(),
  /** Brand-palette accent: 'rust' | 'gold' | 'navy' | 'sage' | 'plum' | 'sky'.
   *  Stored as text rather than an enum so adding swatches doesn't need a
   *  migration. Frontend maps unknown values to 'rust'. */
  color: text('color').default('rust').notNull(),
  displayOrder: integer('display_order').default(0).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

export const slides = pgTable('slides', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenantId: uuid('tenant_id').notNull().references(() => tenants.id),
  templateType: slideTemplateEnum('template_type').notNull(),
  title: text('title').notNull(),
  /** Portrait content (1080×1920). The original/default content slot.
   *  Empty object ({}) means this slide is NOT available on portrait
   *  displays (use `contentLandscape` only). */
  content: jsonb('content').notNull().default({}),
  /** Optional landscape content (1920×1080). Null means this slide is
   *  NOT available on landscape displays. Allows per-orientation authoring
   *  so a Mass Schedule can have a stacked portrait layout and a
   *  side-by-side landscape layout without two separate slide rows. */
  contentLandscape: jsonb('content_landscape'),
  scheduleType: scheduleTypeEnum('schedule_type').default('evergreen').notNull(),
  startAt: timestamp('start_at', { withTimezone: true }),
  endAt: timestamp('end_at', { withTimezone: true }),
  targetDisplays: jsonb('target_displays').default([]).notNull(),
  active: boolean('active').default(true).notNull(),
  weight: integer('weight').default(1).notNull(),
  durationOverrideSec: integer('duration_override_sec'),
  /** Optional collection membership. ON DELETE SET NULL: deleting a
   *  collection un-groups its slides rather than cascade-deleting them. */
  collectionId: uuid('collection_id').references(() => collections.id, {
    onDelete: 'set null',
  }),
  /** Admin-facing sort order in the slide grid. Does NOT affect TV playback —
   *  rotation is still weight-based shuffle. 0 = unsorted (defaults to
   *  updatedAt DESC tiebreaker). Reordering assigns 10, 20, 30… with room
   *  to insert between without renumbering. */
  displayOrder: integer('display_order').default(0).notNull(),
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

/**
 * Tenant-scoped allowlist + role. Replaces the v1.0 hardcoded
 * lib/auth/allowlist.ts. An email may sign in to a tenant if it appears
 * here OR if its domain matches settings.allowedDomain.
 *
 * Roles:
 *   - 'owner'  : full admin including managing the user list
 *   - 'editor' : everything except managing other users
 */
export const tenantUsers = pgTable('tenant_users', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenantId: uuid('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),
  email: text('email').notNull(),
  role: text('role').default('editor').notNull(),
  addedBy: text('added_by'),
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

/**
 * Runtime errors captured from anywhere in the system (player template
 * throws, API 500s, unhandled rejections in admin). Self-contained — we
 * use this table instead of Sentry so the parish doesn't need an external
 * account and v1.6 ships standalone.
 *
 * `source` distinguishes player vs api vs admin to make the admin list
 * filterable. `context` is whatever the caller wants to include
 * (display id, slide id, route, user-agent, etc.); displayId and slideId
 * are also columns for easy joining.
 */
export const errors = pgTable('errors', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenantId: uuid('tenant_id').references(() => tenants.id),
  source: text('source').notNull(),
  message: text('message').notNull(),
  stack: text('stack'),
  context: jsonb('context').default({}),
  displayId: uuid('display_id'),
  slideId: uuid('slide_id'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

// ─── TypeScript content types per template ───────────────────────────────────

export type SizePreset = 'small' | 'medium' | 'large';

export type ParishIdentityContent = {
  templateType: 'parish_identity';
  logoMediaId?: string;
  /** Logo scale 20-100 (percentage of 900px max). Default 100. Legacy: 'small'|'medium'|'large'. */
  logoSize?: number | SizePreset;
  headline: string;
  headlineSize?: SizePreset;      // default: 'large' (= original spec size)
  subline?: string;                // HTML from RichTextEditor (or plain text)
  /** Optional background image (Ken Burns). Falls back to gradient if not set. */
  bgImageMediaId?: string;
  /** Optional looping muted background video. Takes precedence over bgImage if both set. */
  bgVideoMediaId?: string;
};

export type TextMode = 'light' | 'dark';

export type WelcomeQuoteContent = {
  templateType: 'welcome_quote';
  quote: string;
  quoteSize?: SizePreset;          // default: 'large' (= original spec size)
  attribution?: string;
  bgImageMediaId?: string;
  /** 'dark' = dark text on light bg (default), 'light' = light text on dark bg. */
  textMode?: TextMode;
};

export type GeneralContent = {
  templateType: 'general';
  headline: string;
  headlineSize?: SizePreset;       // default: 'large' (= original spec size)
  body: string;                     // HTML from RichTextEditor
  meta?: string;
  bgImageMediaId?: string;
  motionStyle?: 'splitReveal' | 'lineMask';
  textMode?: TextMode;
};

export type MassScheduleRow = {
  timeLabel: string;
  intention: string;
};

/**
 * Mass Intentions: combines weekend + daily on a single slide.
 * Legacy fields (`scheduleKind` + `rows`) retained for backward-compat
 * with slides created before the combined layout.
 */
export type MassScheduleContent = {
  templateType: 'mass_schedule';
  /** Optional dated label, e.g. "Weekend of May 16 / 17" */
  weekendLabel?: string;
  weekendRows?: MassScheduleRow[];
  weekdayRows?: MassScheduleRow[];
  // Legacy single-section format:
  scheduleKind?: 'weekend' | 'weekday';
  rows?: MassScheduleRow[];
  bgImageMediaId?: string;
  textMode?: TextMode;
};

export type WeeklyAssociationContent = {
  templateType: 'weekly_association';
  names: string[];
  bgImageMediaId?: string;
  textMode?: TextMode;
};

/** Dark-themed by design (candle SVG assumes a near-black bg).
 *  Bg image supported but text mode is fixed to 'light'. */
export type SanctuaryCandleContent = {
  templateType: 'sanctuary_candle';
  name: string;
  nameSize?: SizePreset;           // default: 'large' (= original spec size)
  inMemoryOf?: boolean;
  bgImageMediaId?: string;
};

/** Dark-themed by design. Bg image supported, text mode fixed to 'light'. */
export type AppPromoContent = {
  templateType: 'app_promo';
  headline: string;
  headlineSize?: SizePreset;       // default: 'large' (= original spec size)
  body: string;
  url: string;
  phoneMockupMediaId?: string;
  bgImageMediaId?: string;
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
export type Collection = typeof collections.$inferSelect;
export type TenantUser = typeof tenantUsers.$inferSelect;
export type TenantUserRole = 'owner' | 'editor';
export type CollectionColor =
  | 'rust'
  | 'gold'
  | 'navy'
  | 'sage'
  | 'plum'
  | 'sky';

export type SlideWithContent = Omit<Slide, 'content' | 'contentLandscape'> & {
  content: SlideContent;
  contentLandscape: SlideContent | null;
};

export type SlideOrientation = 'portrait' | 'landscape';
