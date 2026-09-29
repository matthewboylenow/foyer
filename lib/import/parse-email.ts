import Anthropic from '@anthropic-ai/sdk';
import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod';
import { z } from 'zod';

/**
 * Turns the text of a weekly email blast into slide proposals. Claude's job
 * here is segmentation and light labeling only — the copy comes back word
 * for word. Nothing is shortened, rewritten or summarized; the editor can
 * still adjust any field before slides are created.
 */

export const ImportItemSchema = z.object({
  /** The section heading, exactly as written. */
  heading: z.string(),
  /** Date and time (and place) of the event, e.g. "Sunday, October 12 · 7:00 PM · Meaney Hall". Empty if none. */
  subtitle: z.string(),
  /** The body copy, one entry per paragraph, exactly as written, with the call-to-action sentence removed. */
  paragraphs: z.array(z.string()),
  /** The call-to-action sentence exactly as written (e.g. "To sign up, visit sainthelen.org/fest."). Empty if none. */
  cta: z.string(),
  /** The URL that call to action points to, if a link was present. Empty if none. */
  ctaUrl: z.string(),
  /** The event date as YYYY-MM-DD when it can be determined, else empty. */
  eventDate: z.string(),
  /** 'announcement' for regular items; 'letter' for a pastor's letter or reflection; 'other' for anything else. */
  kind: z.enum(['announcement', 'letter', 'other']),
});

export const ImportResultSchema = z.object({
  items: z.array(ImportItemSchema),
});

export type ImportItem = z.infer<typeof ImportItemSchema>;

export const MODEL = 'claude-opus-5-5';

/** Collections created by the importer are named with this prefix so the
 *  next import can find and retire the previous week's slides. */
export const IMPORT_COLLECTION_PREFIX = 'Email blast · ';

function systemPrompt(today: string): string {
  return `You split a Catholic parish's weekly email newsletter into screen slides, one per announcement. Today is ${today} (America/New_York).

You are a copy-preserving segmenter, not a writer. The parish wants every slide to read exactly as the email was written.

Rules:
1. One item per announcement section. Skip the newsletter chrome: logo, navigation, "view in browser", social links, unsubscribe, address footer, and any section that is only an image with no copy.
2. heading: the section's heading text exactly as written. If a section has no heading, use its first sentence's key phrase without adding words that aren't there.
3. paragraphs: the body copy word for word, in order, one entry per paragraph. Do not shorten, summarize, rewrite, reorder, correct, or add anything. Keep every sentence. Keep names, prices, times, links and phone numbers as written. Strip only the "text (url)" link annotations down to their text, unless the URL itself is part of the sentence.
4. cta: the sentence that tells the reader what to do next (sign up, register, RSVP, visit, email, call, contact, learn more), exactly as written and including its punctuation. Take the whole sentence. Remove that sentence from paragraphs so it stands on its own line. If there are two such sentences, keep the first in cta and leave the second in paragraphs. Empty string if none.
5. ctaUrl: the URL associated with the call to action — from a "(url)" annotation on that sentence's link, or a URL written in the sentence. Empty string if none. Never invent one.
6. subtitle: the event's date and time, and place if given, assembled from facts in the section: "Sunday, October 12 · 7:00 PM · Meaney Hall". Use only what is stated. Empty string if the section has no date or time. Leave the date and time in the paragraphs as well.
7. eventDate: the event's calendar date as YYYY-MM-DD, resolved relative to today when only a weekday and day-of-month are given. Empty string if unknown or if the item is not a dated event. For multi-date items use the first date.
8. kind: 'letter' for a pastor's letter, reflection or column; 'other' for Mass intentions, prayer lists, or boilerplate; 'announcement' for everything else.

Return every announcement in the order it appears.`;
}

export interface ParseEmailResult {
  items: ImportItem[];
  usage: { inputTokens: number; outputTokens: number };
  model: string;
}

export async function parseEmailText(text: string, today: string): Promise<ParseEmailResult> {
  const client = new Anthropic();
  const response = await client.messages.parse({
    model: MODEL,
    max_tokens: 16000,
    system: systemPrompt(today),
    messages: [
      {
        role: 'user',
        content: `Here is this week's email, converted to text. Split it into slides.\n\n<email>\n${text}\n</email>`,
      },
    ],
    output_config: {
      format: zodOutputFormat(ImportResultSchema),
    },
  });

  if (response.stop_reason === 'refusal') {
    throw new Error('The model declined to process this email.');
  }
  if (response.stop_reason === 'max_tokens') {
    throw new Error('The email is too long to process in one pass.');
  }
  const parsed = response.parsed_output;
  if (!parsed) throw new Error('Could not read the model output.');

  return {
    items: parsed.items,
    usage: {
      inputTokens: response.usage.input_tokens,
      outputTokens: response.usage.output_tokens,
    },
    model: response.model,
  };
}

/** Body HTML for a General slide: TipTap-style paragraphs, CTA on its own line. */
export function itemToBodyHtml(item: Pick<ImportItem, 'paragraphs' | 'cta'>): string {
  const esc = (s: string) =>
    s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const parts = item.paragraphs.map((p) => p.trim()).filter(Boolean).map((p) => `<p>${esc(p)}</p>`);
  if (item.cta.trim()) parts.push(`<p><strong>${esc(item.cta.trim())}</strong></p>`);
  return parts.join('');
}
