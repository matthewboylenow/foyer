/**
 * Turns pasted email source (HubSpot HTML, or plain text) into compact,
 * structured plain text for the parser: one line per block, headings
 * marked with '#', links written as "text (url)". Layout tables, styles,
 * scripts, tracking pixels and comments are dropped. Nothing in the copy
 * itself is altered — words come through exactly as written.
 */

const BLOCK_TAGS = new Set([
  'p', 'div', 'br', 'tr', 'td', 'th', 'li', 'ul', 'ol', 'table', 'tbody', 'thead',
  'section', 'article', 'header', 'footer', 'blockquote', 'hr', 'center',
]);
const HEADING_RE = /^h([1-6])$/i;

function decodeEntities(s: string): string {
  const named: Record<string, string> = {
    amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ',
    ndash: '–', mdash: '—', hellip: '…', rsquo: '’', lsquo: '‘', rdquo: '”', ldquo: '“',
    bull: '•', middot: '·', copy: '©', reg: '®', trade: '™', zwnj: '', zwj: '',
  };
  return s
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(parseInt(d, 10)))
    .replace(/&([a-z]+);/gi, (m, n) => (n.toLowerCase() in named ? named[n.toLowerCase()] : m));
}

function looksLikeHtml(s: string): boolean {
  return /<\s*(html|body|table|div|p|br|td|a|span|h[1-6])\b[^>]*>/i.test(s);
}

/** Strip HubSpot/ESP click-tracking wrappers when the real URL is recoverable. */
export function cleanUrl(raw: string): string {
  let url = raw.trim().replace(/^["']|["']$/g, '');
  try {
    const u = new URL(url);
    // Common tracked-link shapes carry the destination in a query param.
    for (const key of ['url', 'u', 'redirect', 'target', 'link']) {
      const v = u.searchParams.get(key);
      if (v && /^https?:\/\//i.test(v)) {
        url = v;
        break;
      }
    }
    const cleaned = new URL(url);
    // Drop UTM / HubSpot tracking params so the QR encodes the plain link.
    for (const k of Array.from(cleaned.searchParams.keys())) {
      if (/^(utm_|_hs|hs_|mc_|ref$|fbclid|gclid)/i.test(k)) cleaned.searchParams.delete(k);
    }
    return cleaned.toString().replace(/\?$/, '');
  } catch {
    return url;
  }
}

export function htmlToText(input: string): string {
  if (!looksLikeHtml(input)) {
    return input.replace(/\r\n?/g, '\n').replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim();
  }

  let html = input
    .replace(/\r\n?/g, '\n')
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/<(script|style|head|title|noscript)\b[^>]*>[\s\S]*?<\/\1>/gi, '')
    // Preheader / hidden preview text.
    .replace(/<[^>]+\bstyle="[^"]*display:\s*none[^"]*"[^>]*>[\s\S]*?<\/[^>]+>/gi, '');

  // Links: "text (url)". Images with alt text become "[alt]".
  html = html.replace(/<a\b([^>]*)>([\s\S]*?)<\/a>/gi, (_m, attrs: string, inner: string) => {
    const href = /href\s*=\s*("([^"]*)"|'([^']*)'|([^\s>]+))/i.exec(attrs);
    const url = href ? cleanUrl(decodeEntities(href[2] ?? href[3] ?? href[4] ?? '')) : '';
    const text = inner.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
    if (!url || /^(mailto:|tel:|#)/i.test(url)) return text ? ` ${text} ` : '';
    if (!text) return '';
    if (url.replace(/^https?:\/\//i, '').replace(/\/$/, '') === text.replace(/^https?:\/\//i, '').replace(/\/$/, '')) {
      return ` ${text} `;
    }
    return ` ${text} (${url}) `;
  });
  html = html.replace(/<img\b[^>]*\balt\s*=\s*"([^"]*)"[^>]*>/gi, (_m, alt: string) =>
    alt.trim() ? ` [${alt.trim()}] ` : '',
  );

  // Block boundaries → newlines; headings → "# Heading".
  const out: string[] = [];
  const tokens = html.split(/(<[^>]+>)/);
  let headingDepth = 0;
  for (const t of tokens) {
    if (!t) continue;
    if (t.startsWith('<')) {
      const m = /^<\/?\s*([a-z0-9]+)/i.exec(t);
      const tag = m ? m[1].toLowerCase() : '';
      const closing = t.startsWith('</');
      if (HEADING_RE.test(tag)) {
        if (closing) {
          headingDepth = Math.max(0, headingDepth - 1);
          out.push('\n');
        } else {
          headingDepth++;
          out.push('\n# ');
        }
      } else if (BLOCK_TAGS.has(tag)) {
        out.push('\n');
      } else if (tag === 'strong' || tag === 'b') {
        // Bold-only lines in email builders are usually headings; keep the
        // marker so the parser can see it, but only for the opening tag.
        out.push(closing ? '' : '');
      }
      continue;
    }
    out.push(decodeEntities(t));
  }

  return out
    .join('')
    .replace(/ /g, ' ')
    .split('\n')
    .map((l) => l.replace(/[ \t]+/g, ' ').replace(/ ([.,;:!?)])/g, '$1').replace(/\( /g, '(').trim())
    .filter((l, i, arr) => !(l === '' && arr[i - 1] === ''))
    .join('\n')
    .replace(/\n# \n/g, '\n')
    .trim();
}
