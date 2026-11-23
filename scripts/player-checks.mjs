// Geometry checks run inside the player page by both the smoke test and
// render-check. Keep this function self-contained: Playwright serialises
// its source and runs it in the browser, so it cannot close over anything.
//
// The invariants are the ones the kiosk bug broke: the slide must be laid
// out on its 1080 (or 1920) px design canvas, that canvas must be scaled
// by exactly min(viewport / canvas) and fill the viewport on one axis
// without overflowing the other, text AutoFitText manages must not be
// clipped, and no headline may leave the canvas.
export function geometryProblems() {
  const out = [];
  const canvas = document.querySelector('[data-canvas]');
  if (!canvas) return ['no [data-canvas] element: the slide is not being scaled to the viewport'];
  const iw = window.innerWidth;
  const ih = window.innerHeight;
  const r = canvas.getBoundingClientRect();
  const landscape = canvas.dataset.canvas === 'landscape';
  const W = landscape ? 1920 : 1080;
  const H = landscape ? 1080 : 1920;
  if (canvas.offsetWidth !== W || canvas.offsetHeight !== H) {
    out.push(`canvas lays out at ${canvas.offsetWidth}x${canvas.offsetHeight}px, expected ${W}x${H}`);
  }
  const want = Math.min(iw / W, ih / H);
  const got = r.width / Math.max(1, canvas.offsetWidth);
  if (Math.abs(got - want) > want * 0.01) {
    out.push(`canvas is scaled ${got.toFixed(3)}x, expected ${want.toFixed(3)}x for a ${iw}x${ih} viewport`);
  }
  const fitW = Math.abs(r.width - iw) <= 1.5;
  const fitH = Math.abs(r.height - ih) <= 1.5;
  if (r.width > iw + 1.5 || r.height > ih + 1.5 || (!fitW && !fitH)) {
    out.push(`canvas ${r.width.toFixed(1)}x${r.height.toFixed(1)} does not fit the ${iw}x${ih} viewport`);
  }
  const cx = Math.abs((r.left + r.right) / 2 - iw / 2);
  const cy = Math.abs((r.top + r.bottom) / 2 - ih / 2);
  if (cx > 1.5 || cy > 1.5) out.push(`canvas is off-centre by ${cx.toFixed(1)},${cy.toFixed(1)}px`);
  for (const el of canvas.querySelectorAll('[data-autofit]')) {
    const p = el.parentElement;
    if (p && (el.scrollHeight > p.clientHeight + 2 || el.scrollWidth > p.clientWidth + 2)) {
      out.push(`body text is clipped: ${el.scrollHeight}px of text in a ${p.clientHeight}px box ("${(el.textContent || '').trim().slice(0, 40)}…")`);
    }
  }
  for (const h of canvas.querySelectorAll('h1, h2')) {
    const b = h.getBoundingClientRect();
    if (b.width === 0) continue;
    if (b.left < r.left - 2 || b.right > r.right + 2 || b.top < r.top - 2 || b.bottom > r.bottom + 2) {
      out.push(`headline spills outside the canvas: "${(h.textContent || '').trim().slice(0, 40)}"`);
    }
  }
  return out;
}
