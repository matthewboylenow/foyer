import { describe, it, expect } from 'vitest';
import { htmlToText, cleanUrl } from '../html-to-text';

describe('htmlToText', () => {
  it('keeps plain text as-is', () => {
    expect(htmlToText('Hello\r\nWorld\n\n\n\nEnd')).toBe('Hello\nWorld\n\nEnd');
  });

  it('drops styles, scripts and comments, keeps copy verbatim', () => {
    const html = `<html><head><style>p{color:red}</style></head><body>
      <!-- preheader --><table><tr><td>
      <h2>Saint Helen Fest</h2>
      <p>Join us Saturday, October 18 at 5:00 PM in Meaney Hall. Bring the whole family!</p>
      <p>To sign up, visit <a href="https://sainthelen.org/fest?utm_source=hs_email&amp;utm_medium=email">sainthelen.org/fest</a>.</p>
      </td></tr></table></body></html>`;
    const text = htmlToText(html);
    expect(text).toContain('# Saint Helen Fest');
    expect(text).toContain('Join us Saturday, October 18 at 5:00 PM in Meaney Hall. Bring the whole family!');
    // Link text equals the URL → no duplicate; tracking params stripped.
    expect(text).toContain('To sign up, visit sainthelen.org/fest.');
    expect(text).not.toContain('utm_source');
    expect(text).not.toContain('color:red');
  });

  it('writes links with different text as "text (url)"', () => {
    const text = htmlToText('<p>Please <a href="https://example.org/rsvp">RSVP here</a> by Friday.</p>');
    expect(text).toBe('Please RSVP here (https://example.org/rsvp) by Friday.');
  });

  it('decodes entities', () => {
    expect(htmlToText('<p>Msgr. Tom&rsquo;s letter &amp; more&nbsp;news</p>')).toBe('Msgr. Tom’s letter & more news');
  });
});

describe('cleanUrl', () => {
  it('unwraps tracked links and strips utm params', () => {
    expect(cleanUrl('https://t.example.com/click?url=https%3A%2F%2Fsainthelen.org%2Flifelines%3Futm_campaign%3Dx')).toBe(
      'https://sainthelen.org/lifelines',
    );
  });
  it('returns non-URLs untouched', () => {
    expect(cleanUrl('sainthelen.org/app')).toBe('sainthelen.org/app');
  });
});
