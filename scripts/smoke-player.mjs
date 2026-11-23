// Player smoke test: boots the real player page in a real Chromium against
// a mocked playlist and fails on any page error, console error, or error
// report the player tries to post. Run by `pnpm smoke` (see scripts/smoke.sh)
// and by CI before anything reaches the release branch.
//
//   BASE_URL       where the app is served (default http://localhost:3999)
//   CHROME_PATH    optional browser executable (otherwise Playwright's Chromium)
//   SMOKE_SECONDS  how long to watch (default 24)
//   SMOKE_VIEWPORT "WxH@dpr" the browser pretends to be (default 540x960@2,
//                  what an Android TV WebView reports for a 1080p panel; the
//                  canvas must come out identical to a native 1080x1920)

import { chromium } from 'playwright';
import { geometryProblems } from './player-checks.mjs';

const BASE_URL = process.env.BASE_URL ?? 'http://localhost:3999';
const DISPLAY_ID = '11111111-1111-4111-8111-111111111111';
const WATCH_MS = Number(process.env.SMOKE_SECONDS ?? 24) * 1000;

const slide = (id, templateType, content, extra = {}) => ({
  id,
  tenantId: 't',
  templateType,
  title: id,
  content,
  contentLandscape: null,
  scheduleType: 'evergreen',
  startAt: null,
  endAt: null,
  targetDisplays: [],
  active: true,
  priority: false,
  pin: null,
  weight: 1,
  durationOverrideSec: 5,
  collectionId: null,
  displayOrder: 0,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
  createdBy: null,
  updatedBy: null,
  sourceId: null,
  ...extra,
});

/** A playlist that exercises every risky path: a video background with
 *  both fits, an image background, the QR badge, and the pinned parish
 *  slides. Media comes from public/media so no network is involved. */
const playlist = {
  orientation: 'portrait',
  version: 'smoke-v1',
  slides: [
    slide('intro', 'parish_identity', {
      templateType: 'parish_identity', headline: 'Welcome!', subline: '<p>Worshipping God.</p><p>Serving Others.</p>',
      logoSize: 100, bgVideoFit: 'cover', bgVideoMediaId: 'v', logoMediaId: 'l',
    }, { pin: 'start', resolvedMedia: { logoUrl: '/media/saint-helen-logo-submark-vector-white.png', bgVideoUrl: '/media/hero-2026-landscape.mp4' } }),
    slide('general', 'general', {
      templateType: 'general', headline: 'Breakfast with Santa', headlineSize: 'small',
      meta: 'Saturday, December 5 · 8:30am · Gym', body: '<p>Santa is coming.</p><p><strong>Register at sainthelen.org/santa.</strong></p>',
      eventDate: '2026-12-05', qrUrl: 'https://sainthelen.org/santa', qrLabel: 'Scan to visit', motionStyle: 'lineMask', textMode: 'dark', bgImageMediaId: 'b',
    }, { resolvedMedia: { bgImageUrl: '/media/advent-glow-joy-candle.jpg' } }),
    slide('longbody', 'general', {
      templateType: 'general', headline: 'Advent LifeLines and the Pray25 Challenge', headlineSize: 'small',
      meta: 'Begins Monday, November 30 · Hallow app',
      body: '<p>Hallow\'s Pray25 Advent challenge is built around It\'s a Wonderful Life this year: a short daily prayer from November 30 through Christmas Day with Sr. Miriam James Heidland, Jonathan Roumie, Chris Pratt and Mark Wahlberg.</p><p>Our Advent LifeLines small groups meet weekly to pray through the same reflections together. Sign up in the narthex after any Mass, or scan the code to join a group online.</p><p>All are welcome, whether you have prayed with Hallow before or are just starting.</p>',
      qrUrl: 'https://sainthelen.org/advent', qrLabel: 'Scan to join', motionStyle: 'lineMask', textMode: 'dark',
    }),
    slide('contain', 'parish_identity', {
      templateType: 'parish_identity', headline: 'Contain', subline: '', bgVideoFit: 'contain', bgVideoMediaId: 'v',
    }, { resolvedMedia: { bgVideoUrl: '/media/hero-2026-landscape.mp4' } }),
    slide('intentions', 'mass_schedule', {
      templateType: 'mass_schedule', weekendLabel: 'Weekend of November 21 / 22',
      weekendRows: [{ timeLabel: '5:00PM', intention: 'A' }], weekdayRows: [{ timeLabel: 'Nov 23', intention: 'B' }],
    }, { pin: 'end' }),
    slide('candle', 'sanctuary_candle', { templateType: 'sanctuary_candle', name: 'Someone', inMemoryOf: true }, { pin: 'end' }),
  ],
};

// Google Chrome, not Playwright's bundled Chromium: the TVs play H.264, and
// the open-source build cannot decode it, so a missing codec would look
// like a broken player. CHROME_PATH points at a local Chrome; otherwise
// Playwright's "chrome" channel (`npx playwright install chrome`) is used.
const browser = await chromium.launch({
  executablePath: process.env.CHROME_PATH || undefined,
  channel: process.env.CHROME_PATH ? undefined : 'chrome',
  args: ['--autoplay-policy=no-user-gesture-required'],
});
const [, vw, vh, dpr] = /^(\d+)x(\d+)(?:@([\d.]+))?$/.exec(process.env.SMOKE_VIEWPORT ?? '540x960@2') ?? [];
if (!vw) throw new Error('SMOKE_VIEWPORT must look like 540x960@2');
const page = await browser.newPage({ viewport: { width: Number(vw), height: Number(vh) }, deviceScaleFactor: Number(dpr ?? 1) });

const problems = [];
let heartbeats = 0;
page.on('pageerror', (e) => problems.push(`pageerror: ${e.message}`));
page.on('console', (m) => {
  if (m.type() === 'error' && !/favicon/i.test(m.text())) problems.push(`console.error: ${m.text().slice(0, 200)}`);
});
await page.route(`**/api/display/${DISPLAY_ID}/heartbeat`, (route) => {
  heartbeats++;
  route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, version: 'smoke-v1', reload: false }) });
});
await page.route(`**/api/display/${DISPLAY_ID}`, (route) =>
  route.fulfill({ status: 200, contentType: 'application/json', headers: { ETag: '"smoke-v1"' }, body: JSON.stringify(playlist) }),
);
await page.route('**/api/errors', async (route) => {
  const body = route.request().postData() ?? '';
  problems.push(`player reported an error: ${body.slice(0, 300)}`);
  route.fulfill({ status: 200, contentType: 'application/json', body: '{"ok":true}' });
});

const res = await page.goto(`${BASE_URL}/display/${DISPLAY_ID}`, { waitUntil: 'load', timeout: 60_000 });
if (!res || res.status() !== 200) problems.push(`page status ${res?.status()}`);

// Geometry (shared with render-check): canvas laid out at design size,
// scaled exactly to the viewport, nothing clipped. Wait for the canvas
// first: the player shows a bare navy div until the playlist fetch and
// hydration finish, and a slow runner must not turn that into a failure.
try {
  await page.waitForSelector('[data-canvas]', { timeout: 20_000 });
} catch {
  problems.push('no [data-canvas] element within 20 s: the slide is not being scaled to the viewport');
}

const seen = new Set();
const geometry = new Set();
const t0 = Date.now();
while (Date.now() - t0 < WATCH_MS) {
  await page.waitForTimeout(1000);
  const text = await page.evaluate(() => document.body.innerText.replace(/\s+/g, ' ').trim().slice(0, 60));
  if (text) seen.add(text);
  for (const g of await page.evaluate(geometryProblems)) geometry.add(g);
  if (await page.evaluate(() => /Application error/i.test(document.body.innerText))) {
    problems.push('Next.js "Application error" page shown');
    break;
  }
}
for (const g of geometry) problems.push(g);
if (seen.size < 2) problems.push(`slides did not advance (saw ${seen.size} distinct screen${seen.size === 1 ? '' : 's'})`);
if (heartbeats < 1) problems.push('no heartbeat was sent');
const videoOk = await page.evaluate(() => {
  const v = document.querySelector('video');
  return v ? { readyState: v.readyState, paused: v.paused, time: v.currentTime, error: v.error ? `${v.error.code} ${v.error.message}` : null } : null;
});
if (!videoOk) problems.push('no <video> element mounted for the background loop');
else if (videoOk.error) problems.push(`background video failed: ${videoOk.error}`);
else if (videoOk.readyState < 2) problems.push(`background video never loaded (readyState ${videoOk.readyState}; is this browser able to decode H.264?)`);

// One off-aspect viewport too (a portrait playlist on a landscape panel),
// so the centring and letterboxing arithmetic is exercised, not just the
// 9:16 kiosk case where every ratio happens to be equal.
{
  const side = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
  await side.route(`**/api/display/${DISPLAY_ID}/heartbeat`, (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, version: 'smoke-v1', reload: false }) }),
  );
  await side.route(`**/api/display/${DISPLAY_ID}`, (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', headers: { ETag: '"smoke-v1"' }, body: JSON.stringify(playlist) }),
  );
  await side.goto(`${BASE_URL}/display/${DISPLAY_ID}`, { waitUntil: 'load', timeout: 60_000 });
  await side.waitForSelector('[data-canvas]', { timeout: 20_000 }).catch(() => {});
  await side.waitForTimeout(1500);
  for (const g of await side.evaluate(geometryProblems)) problems.push(`at 1920x1080: ${g}`);
  await side.close();
}

await browser.close();

if (problems.length) {
  console.error('SMOKE FAILED');
  for (const p of problems) console.error(' -', p);
  process.exit(1);
}
console.log(`SMOKE OK at ${vw}x${vh}@${dpr ?? 1}: ${seen.size} screens, ${heartbeats} heartbeats, video readyState ${videoOk.readyState}`);
