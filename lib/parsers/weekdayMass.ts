import type { ParseResult } from './types';

const WEEKDAY_FULL = /^\s*(Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday)\s+\d{1,2}\/\d{1,2}\s*$/i;
const WEEKDAY_ABBR = /^\s*(Mon|Tue|Wed|Thu|Fri|Sat|Sun)\s+\d{1,2}\/\d{1,2}\s*$/i;
const DATE_ONLY = /^\s*\d{1,2}\/\d{1,2}\s*$/;
const SEPARATORS = [' - ', ' – ', ' — ', '\t'];

function normalizeInput(s: string): string {
  return s.replace(/ /g, ' ').replace(/  +/g, ' ');
}

export function parseWeekdayMass(input: string): ParseResult {
  const rows: ParseResult['rows'] = [];
  const warnings: ParseResult['warnings'] = [];

  const lines = normalizeInput(input)
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean);

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    let timeLabel: string | null = null;
    let intention: string | null = null;
    let needsReview = false;

    for (const sep of SEPARATORS) {
      const idx = line.indexOf(sep);
      if (idx > 0) {
        const left = line.slice(0, idx).trim();
        const right = line.slice(idx + sep.length).trim();
        if (WEEKDAY_ABBR.test(left) || WEEKDAY_FULL.test(left)) {
          timeLabel = left;
          intention = right;
          break;
        }
        if (DATE_ONLY.test(left)) {
          timeLabel = left;
          intention = right;
          needsReview = true;
          warnings.push({
            lineNumber: i + 1,
            raw: line,
            reason: 'No weekday name found — please verify date',
          });
          break;
        }
      }
    }

    if (!timeLabel || !intention) {
      warnings.push({ lineNumber: i + 1, raw: line, reason: 'Could not parse date and intention' });
      rows.push({ timeLabel: '', intention: line, needsReview: true });
      continue;
    }

    rows.push({ timeLabel, intention, needsReview });
  }

  return { rows, warnings };
}
