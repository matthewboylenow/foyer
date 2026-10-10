import {
  pgTable,
  pgEnum,
  uuid,
  text,
  boolean,
  integer,
  timestamp,
  jsonb,
  index,
  uniqueIndex,
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
  'poster',
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
  /** When the player was last seen before it went quiet. Set the moment we
   *  notice the heartbeat is older than OFFLINE_AFTER_SEC; cleared (and the
   *  matching display_events row resolved) on the next heartbeat. Acts as
   *  the "is there an open outage?" pointer so the heartbeat path never
   *  has to query display_events. */
  offlineSince: timestamp('offline_since', { withTimezone: true }),
  /** What drives the TV: 'pi' (our Raspberry Pi kiosk + agent),
   *  'optisigns', or 'browser' (anything else pointed at the URL). Set to
   *  'pi' automatically the first time the agent checks in. */
  hardware: text('hardware').default('browser').notNull(),
  /** Raspberry Pi agent — last check-in and the vitals it reported
   *  (hostname, ip, cpuTempC, uptimeSec, chromiumRunning, throttled…). */
  agentLastSeenAt: timestamp('agent_last_seen_at', { withTimezone: true }),
  agentInfo: jsonb('agent_info').$type<AgentInfo | null>(),
  /** One queued command for the agent to pick up on its next check-in:
   *  'reboot' | 'reload' | 'screenshot' | 'update'. Cleared when handed
   *  over. Only one at a time — a newer request replaces the older one. */
  pendingCommand: text('pending_command'),
  pendingCommandAt: timestamp('pending_command_at', { withTimezone: true }),
  pendingCommandBy: text('pending_command_by'),
  /** Set when an admin asks the *browser* player to reload (works for any
   *  hardware, not just Pi). The heartbeat response carries it back and
   *  the column is cleared. */
  reloadRequestedAt: timestamp('reload_requested_at', { withTimezone: true }),
  /** Most recent screenshot the agent uploaded (Vercel Blob, overwritten
   *  in place so we only ever store one per display). */
  screenshotUrl: text('screenshot_url'),
  screenshotAt: timestamp('screenshot_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

/**
 * Uptime + activity history per display. Kept deliberately sparse: one
 * row per outage (kind='offline', closed by `resolvedAt`), one per admin
 * command, one per screenshot. Uptime percentages and the history strip
 * are computed from the offline rows — no per-heartbeat storage.
 */
export const displayEvents = pgTable('display_events', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenantId: uuid('tenant_id').notNull().references(() => tenants.id),
  displayId: uuid('display_id')
    .notNull()
    .references(() => displays.id, { onDelete: 'cascade' }),
  /** 'offline' | 'command' | 'screenshot' | 'agent_installed' */
  kind: text('kind').notNull(),
  at: timestamp('at', { withTimezone: true }).defaultNow().notNull(),
  /** For kind='offline': when the player came back. Null = still down. */
  resolvedAt: timestamp('resolved_at', { withTimezone: true }),
  /** For kind='offline': when the downtime alert email went out (null if
   *  the outage ended before the alert threshold, or alerts are off). */
  alertedAt: timestamp('alerted_at', { withTimezone: true }),
  meta: jsonb('meta').$type<Record<string, unknown>>().default({}),
}, (t) => [index('display_events_display_at_idx').on(t.displayId, t.at)]);

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
  /** Downtime alerts. Comma-separated recipient list; empty = no emails.
   *  A display that has been silent for `alertOfflineAfterMin` minutes
   *  gets one "down" email, and one "back" email when it recovers. */
  alertEmails: text('alert_emails'),
  alertOfflineAfterMin: integer('alert_offline_after_min').default(10).notNull(),
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
  /** Takeover. While any eligible slide has priority, the player shows only
   *  priority slides — for a funeral notice, a weather closure, an
   *  emergency message. Turn it off (or let its end date pass) and the
   *  normal rotation resumes on the next heartbeat. */
  priority: boolean('priority').default(false).notNull(),
  /** Position in the loop. null = shuffled with everything else (weighted);
   *  'start' = plays first every loop; 'end' = plays last every loop.
   *  Pinned slides play exactly once per loop, ordered by displayOrder
   *  (drag order on the Slides page), so "Welcome → announcements →
   *  Mass intentions, Mass association, Sanctuary candle → Welcome…" is
   *  just four pins. */
  pin: text('pin'),
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

/**
 * What the screens are playing. "Publish to screens" copies every active
 * slide into a snapshot; the player serves the latest snapshot (filtered
 * by schedule dates at serve time) so edits in the admin stay staged
 * until the next publish. Before the first publish the player falls back
 * to the live rows, which is how v1 through v22 behaved.
 */
export const playlistSnapshots = pgTable('playlist_snapshots', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenantId: uuid('tenant_id').notNull().references(() => tenants.id),
  publishedAt: timestamp('published_at', { withTimezone: true }).defaultNow().notNull(),
  publishedBy: text('published_by'),
  /** Why this publish happened: 'manual' | 'takeover' | 'import' | 'editor' */
  reason: text('reason').default('manual').notNull(),
  /** md5 over every tenant slide's id:updatedAt at publish time — compared
   *  against the live rows to show "N unpublished changes". */
  sourceHash: text('source_hash').notNull(),
  /** The active slides at publish time, full rows, dates as ISO strings. */
  slides: jsonb('slides').$type<SnapshotSlide[]>().notNull(),
  slideCount: integer('slide_count').default(0).notNull(),
}, (t) => [index('playlist_snapshots_tenant_published_idx').on(t.tenantId, t.publishedAt)]);

/** A slide row as stored inside a snapshot (timestamps serialized). */
export type SnapshotSlide = Omit<
  typeof slides.$inferSelect,
  'startAt' | 'endAt' | 'createdAt' | 'updatedAt'
> & {
  startAt: string | null;
  endAt: string | null;
  createdAt: string;
  updatedAt: string;
};

/**
 * Source-managed content: items whose editorial content is owned by an
 * external system (WordPress) and delivered over the signed sync endpoint
 * (app/api/sources/wordpress). They are NOT slides: Foyer slides are
 * authored here and go through staging + publish; source items go live
 * as soon as the source says they are approved, and are merged into the
 * player's eligible set at serve time (lib/db/queries.ts). The sync
 * writes only the editorial columns; the presentation columns below the
 * divider are Foyer-owned and survive every resync.
 */
export const sourceItems = pgTable('source_items', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenantId: uuid('tenant_id').notNull().references(() => tenants.id),
  /** 'wordpress' for now; the unique key is (tenant, source, sourceId). */
  source: text('source').notNull(),
  sourceId: text('source_id').notNull(),
  /** Monotonic per item on the source side (WordPress post modified time
   *  as epoch seconds, or a revision counter). Older revisions are ignored. */
  revision: integer('revision').default(0).notNull(),
  /** 'active' plays (subject to schedule); 'withdrawn' never plays but is
   *  kept so a later re-delivery can revive it and the admin can see it. */
  status: text('status').default('active').notNull(),
  kind: text('kind').default('announcement').notNull(),
  templateType: slideTemplateEnum('template_type').notNull(),
  title: text('title').notNull(),
  /** Built by lib/sources/wordpress.ts from the delivered fields; same
   *  shape the matching template expects (GeneralContent / PosterContent). */
  content: jsonb('content').notNull().default({}),
  /** Public (https) image for the poster template; never a Blob upload. */
  imageUrl: text('image_url'),
  scheduleType: scheduleTypeEnum('schedule_type').default('evergreen').notNull(),
  startAt: timestamp('start_at', { withTimezone: true }),
  endAt: timestamp('end_at', { withTimezone: true }),
  sourceUrl: text('source_url'),
  sourceUpdatedAt: timestamp('source_updated_at', { withTimezone: true }),
  /** md5 of the normalized editorial payload; equal hash = no-op resync. */
  payloadHash: text('payload_hash').notNull(),
  lastReceivedAt: timestamp('last_received_at', { withTimezone: true }).defaultNow().notNull(),
  lastError: text('last_error'),
  // ── Foyer-owned presentation (never touched by the sync) ──────────────
  hidden: boolean('hidden').default(false).notNull(),
  weight: integer('weight').default(1).notNull(),
  durationOverrideSec: integer('duration_override_sec'),
  pin: text('pin'),
  targetDisplays: jsonb('target_displays').default([]).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (t) => [
  uniqueIndex('source_items_tenant_source_id_idx').on(t.tenantId, t.source, t.sourceId),
  index('source_items_tenant_status_idx').on(t.tenantId, t.status),
]);

/** One row per inbound delivery, for diagnosing the sync without logging
 *  payload bodies or secrets. */
export const sourceDeliveries = pgTable('source_deliveries', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenantId: uuid('tenant_id').references(() => tenants.id),
  source: text('source').notNull(),
  receivedAt: timestamp('received_at', { withTimezone: true }).defaultNow().notNull(),
  ok: boolean('ok').default(false).notNull(),
  /** 'accepted' | 'bad_signature' | 'stale_timestamp' | 'bad_payload' | 'tenant_mismatch' | 'error' */
  outcome: text('outcome').notNull(),
  itemCount: integer('item_count').default(0).notNull(),
  /** Per-item actions: { created, updated, unchanged, stale, withdrawn, rejected } */
  summary: jsonb('summary').$type<Record<string, number>>().default({}),
  error: text('error'),
  /** Client-supplied delivery id (for their retry bookkeeping), if any. */
  deliveryId: text('delivery_id'),
}, (t) => [index('source_deliveries_tenant_received_idx').on(t.tenantId, t.receivedAt)]);

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
  /** The event's date (YYYY-MM-DD). Drives the auto-expire option in the
   *  editor and, when `meta` is empty, a formatted date line. */
  eventDate?: string;
  /** Sign-up / more-info link rendered as a QR code in the corner. */
  qrUrl?: string;
  /** Caption under the QR, default "Scan to sign up". */
  qrLabel?: string;
  bgImageMediaId?: string;
  motionStyle?: 'splitReveal' | 'lineMask';
  textMode?: TextMode;
};

/**
 * Full-bleed flyer. The image IS the slide: contain-fit on a blurred copy
 * of itself so a letter-size flyer on a 9:16 screen has no hard black
 * bars. Optional caption strip and QR.
 */
export type PosterContent = {
  templateType: 'poster';
  /** The flyer image (required for the slide to show anything). */
  imageMediaId?: string;
  /** 'contain' (default) shows the whole flyer; 'cover' crops to fill. */
  fit?: 'contain' | 'cover';
  caption?: string;
  qrUrl?: string;
  qrLabel?: string;
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
  | AppPromoContent
  | PosterContent;

/** Vitals the Raspberry Pi agent reports on every check-in. Every field is
 *  optional — older agents or non-Pi hardware may send a subset. */
export type AgentInfo = {
  agentVersion?: string;
  hostname?: string;
  ip?: string;
  model?: string;
  os?: string;
  uptimeSec?: number;
  cpuTempC?: number;
  memUsedPct?: number;
  diskUsedPct?: number;
  chromiumRunning?: boolean;
  /** Raw `vcgencmd get_throttled` value (hex string). Non-zero means the
   *  Pi has seen under-voltage or thermal throttling since boot. */
  throttled?: string;
};

export type DisplayHardware = 'pi' | 'optisigns' | 'browser';
export type SlidePin = 'start' | 'end';
export type AgentCommand = 'reboot' | 'reload' | 'screenshot' | 'update';

// Inferred row types for use throughout the app
export type Tenant = typeof tenants.$inferSelect;
export type Display = typeof displays.$inferSelect;
export type DisplayEvent = typeof displayEvents.$inferSelect;
export type PlaylistSnapshot = typeof playlistSnapshots.$inferSelect;
export type SourceItem = typeof sourceItems.$inferSelect;
export type SourceDelivery = typeof sourceDeliveries.$inferSelect;
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
