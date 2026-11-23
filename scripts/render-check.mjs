// Render every slide of a playlist through the real player page at several
// viewports and save a PNG of each, so a human (or a reviewing agent) can
// see exactly what each kind of TV shows. Also reports clipped body text,
// headlines outside the canvas, and any page error, so it can gate a push.
//
//   node scripts/render-check.mjs --playlist playlist.json [--out dir]
//        [--viewports 1080x1920@1,540x960@2,720x1280@1.5] [--only slideId]
//
// The playlist is the JSON that GET /api/display/<id> returns (save it with
// curl), or any file in that shape. The app must be running at BASE_URL
// (default http://localhost:3999, e.g. `pnpm build && scripts/smoke.sh`'s
// server, or `pnpm dev`). CHROME_PATH as in smoke-player.mjs.

import { chromium } from 'playwright';
import { geometryProblems } from './player-checks.mjs';
import { mkdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const args = Object.fromEntries(
  process.argv.slice(2).map((a, i, all) => (a.startsWith('--') ? [a.slice(2), all[i + 1] ?? ''] : null)).filter(Boolean),
);
if (!args.playlist) {
  console.error('usage: node scripts/render-check.mjs --playlist <file> [--out dir] [--viewports WxH@dpr,...] [--only id]');
  process.exit(2);
}
const BASE_URL = process.env.BASE_URL ?? 'http://localhost:3999';
const OUT = args.out ?? 'render-check';
const DISPLAY_ID = '22222222-2222-4222-8222-222222222222';
const SETTLE_MS = Number(args.settle ?? 4000);
const viewports = (args.viewports ?? '1080x1920@1,540x960@2,720x1280@1.5').split(',').map((v) => {
  const m = /^(\d+)x(\d+)(?:@([\d.]+))?$/.exec(v.trim());
  if (!m) throw new Error(`bad viewport ${v}`);
  return { w: Number(m[1]), h: Number(m[2]), dpr: Number(m[3] ?? 1), label: v.trim() };
});

const playlist = JSON.parse(readFileSync(args.playlist, 'utf8'));
let slides = playlist.slides ?? [];
if (args.only) slides = slides.filter((s) => s.id === args.only || s.title === args.only);
if (slides.length === 0) throw new Error('no slides to render');
mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch({
  executablePath: process.env.CHROME_PATH || undefined,
  channel: process.env.CHROME_PATH ? undefined : 'chrome',
  args: ['--autoplay-policy=no-user-gesture-required'],
});

const findings = [];

let page;
for (const vp of viewports) {
  const context = await browser.newContext({ viewport: { width: vp.w, height: vp.h }, deviceScaleFactor: vp.dpr });
  page = await context.newPage();
  const pageErrors = [];
  page.on('pageerror', (e) => pageErrors.push(`page error: ${e.message}`));
  page.on('console', (m) => {
    if (m.type() === 'error' && !/favicon/i.test(m.text())) pageErrors.push(`console.error: ${m.text().slice(0, 200)}`);
  });
  await page.route(`**/api/display/${DISPLAY_ID}/heartbeat`, (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: '{"ok":true,"version":"rc","reload":false}' }),
  );
  await page.route('**/api/errors', (route) => {
    pageErrors.push(`player reported an error: ${(route.request().postData() ?? '').slice(0, 300)}`);
    route.fulfill({ status: 200, contentType: 'application/json', body: '{"ok":true}' });
  });

  for (const s of slides) {
    const one = { ...playlist, version: 'rc', slides: [{ ...s, pin: null, durationOverrideSec: 600 }] };
    await page.route(`**/api/display/${DISPLAY_ID}`, (route) =>
      route.fulfill({ status: 200, contentType: 'application/json', headers: { ETag: '"rc"' }, body: JSON.stringify(one) }),
    );
    pageErrors.length = 0;
    await page.goto(`${BASE_URL}/display/${DISPLAY_ID}`, { waitUntil: 'load', timeout: 60_000 });
    await page.waitForSelector('[data-canvas]', { timeout: 20_000 }).catch(() => {});
    await page.waitForTimeout(SETTLE_MS);
    const safe = `${s.title ?? s.id}`.replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '').slice(0, 50) || s.id;
    const file = join(OUT, `${safe}__${vp.label.replace('@', 'x')}.png`);
    await page.screenshot({ path: file });
    const problems = [...(await page.evaluate(geometryProblems)), ...pageErrors];
    for (const p of problems) findings.push({ slide: s.title ?? s.id, viewport: vp.label, problem: p, file });
    console.log(`${problems.length ? 'FAIL' : ' ok '} ${vp.label.padEnd(14)} ${s.templateType.padEnd(16)} ${s.title ?? s.id}${problems.length ? '  ← ' + problems.join('; ') : ''}`);
    await page.unroute(`**/api/display/${DISPLAY_ID}`);
  }
  await context.close();
}
await browser.close();

if (findings.length) {
  console.error(`\n${findings.length} problem(s):`);
  for (const f of findings) console.error(` - [${f.viewport}] ${f.slide}: ${f.problem} (${f.file})`);
  process.exit(1);
}
console.log(`\nAll ${slides.length} slides render cleanly at ${viewports.map((v) => v.label).join(', ')}. PNGs in ${OUT}/`);
