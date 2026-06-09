# Signage App: Spec Documentation

This is the full spec for a Saint Helen Parish digital signage app, structured for Claude Code in GitHub Codespaces.

## Product Name

**Foyer.** Literal, friendly, works inside or outside the Catholic vertical. Travels well to Protestant churches, schools, and nonprofits if the product expands beyond Saint Helen.

Repo: `foyer`. Domain: TBD (likely `foyer.app` or similar). For Saint Helen's internal deployment: `signage.sainthelen.org`.

## Reading Order

For a first read, go in numeric order. For implementation, the suggested build order is in 12.

| File | What's In It |
|---|---|
| `00-overview.md` | What we're building, goals, scope, constraints, success criteria |
| `01-tech-stack.md` | Pinned versions (Next 15.x, not 16), rationale, what we're not using |
| `02-architecture.md` | Repo structure, route map, data flow |
| `03-database.md` | Drizzle schema, all tables, seeds |
| `04-design-system.md` | Brand tokens, type scale, layout, motion principles |
| `05-templates.md` | All seven slide templates with content shapes and visual treatment |
| `06-motion.md` | The six reusable motion primitives, composition rules, performance notes |
| `07-display-player.md` | The kiosk route, shuffle logic, offline cache, watchdog, nightly reload |
| `08-admin.md` | Admin UI: slide list, editor, displays page, settings, mobile considerations |
| `09-paste-to-parse.md` | Parsers for Mass intentions, weekly association, sanctuary candle |
| `10-auth.md` | Microsoft Entra ID plus email OTP via Resend |
| `11-deployment.md` | Vercel, Neon, Blob, Resend, OptiSigns configuration |
| `12-getting-started.md` | Codespaces setup, build order, smoke test |

## Key Architectural Decisions

1. **Separate repo** from the website rebuild. Keeps the door open for spinning this off as a product later.
2. **Next.js 15.x locked.** Do not upgrade to 16.
3. **No video in v1.** Schema has a video slot reserved, no upload pipeline yet. Focus is on motion typography that looks crafted, not stock backgrounds.
4. **Random shuffle with weighted pool.** Shuffle-don't-repeat algorithm. Reshuffle every loop.
5. **OptiSigns handles takeovers**, not the app. The app only worries about slide-level evergreen vs dated scheduling.
6. **Paste-to-parse** is the authoring pattern for Mass intentions. Vercel-style. Vital for keeping update time under 90 seconds.
7. **Tenant ID reserved in schema** from day one so a future multi-tenant SaaS is not a rewrite.

## Media & Blob Budget

Displays run 24/7, so every byte an asset weighs is paid for repeatedly in Vercel Blob
data transfer and per-request "simple operations." The guardrails, in order of where
they act:

1. **On upload (browser):** `lib/optimizeImage.ts` downscales backgrounds to ≤2560px
   and re-encodes to WebP before anything reaches Blob; logos are downscaled only,
   keeping their format. Videos are capped at 15 MB by the upload token
   (`app/api/upload/client/route.ts`).
2. **In storage:** blob URLs are immutable (random suffix), so uploads set a 1-year
   `Cache-Control` — browsers and the image optimizer never re-fetch unchanged files.
3. **On the player:** background images render through `next/image` (the optimizer's
   edge cache serves displays; Blob is only hit on a cache miss), the next-slide
   prewarm warms that same optimized URL — never the raw original — and bg videos are
   mounted once per page load by `BgVideoStack` instead of re-streaming per rotation.

Rules of thumb when authoring: background photos should land under ~1 MB after the
automatic compression; video loops ~10s at ≤15 MB; check the media library, which
shows the stored size of every asset, and delete unused files.

## Brand and Voice

This app does not generate content. The brand voice (warm, personal, Saint Helen) is enforced by the content authored in the admin, not by the templates. The templates enforce the visual brand: navy, rust, cream, gold, Libre Baskerville and Libre Franklin.

## Questions to Answer Before Implementation Starts

1. Microsoft Entra tenant and app registration details (for auth setup).
2. Resend account (existing parish account or new).
3. Neon project (existing parish account or new).
4. Subdomain choice (`signage.sainthelen.org` is the recommendation for Saint Helen).

## v1.5 Roadmap (Post-Launch)

Once v1 is live at Saint Helen and proven stable, these are the next moves to turn Foyer into a sellable product.

### Tenant Branding (the big one)
- Expose `primaryColor`, `accentColor`, `creamColor`, `goldColor` in the Settings page as color pickers. Schema already supports this.
- Logo upload per tenant (already in schema, just needs UI in Settings).
- Optional custom font upload (one serif, one sans). Templates already use CSS variables for fonts, so this is mostly a Settings UI change and a webfont loader.
- This is what stops every Foyer customer from looking identical. Catholic parishes will use cream and navy. Protestant churches might want black and gold or modern blue and white. Schools could go school-color.

### Pricing and Self-Serve Signup
- Single tier: $29/month per location, unlimited screens up to 10, then $5 per additional screen.
- Annual: $290/year (two months free).
- Free 60-day trial with full features, one screen.
- Position as content layer on top of OptiSigns, not a replacement. The comparison is "Foyer + OptiSigns vs Canva + OptiSigns," not "Foyer vs OptiSigns."

### Template Library Expansion
The moat. Each new template is 2-3 days of work and a piece of marketing content. Targets for v1.5:
- Prayer request slide
- Ministry highlight (recurring slot for spotlighting one ministry)
- Capital campaign progress thermometer
- Sermon series promo (Protestant-leaning)
- Liturgical season countdown (Advent, Lent)
- Baptism announcement
- Memorial / death notice
- Newcomer welcome with QR code

### Multi-Tenant Activation
- The `tenantId` column is already on every table. Activate it in queries (`WHERE tenant_id = ?` everywhere).
- Add a tenant signup flow on a marketing landing page.
- Billing via Stripe (subscription, not per-screen metering in v1.5).
- Tenant-scoped admin (a Saint Helen user only sees Saint Helen slides).

### Per-Slide Color Mood (v2 territory, not v1.5)
- Add a `colorMood` field on slides that can override the tenant default for that specific slide.
- Use case: a Christmas slide using red and gold while the rest of the year is navy and rust.
- Defer until the per-tenant palette work is proven.

### Other v1.5 Nice-to-Haves
- Per-screen content differentiation (use the existing `targetDisplays` array).
- Video upload pipeline (transcoding to two H.264 variants, audio stripped, capped at 15 seconds).
- Audit log UI for "who turned off the sanctuary candle slide last Sunday."
- Slack notification on slide publish (optional integration).
