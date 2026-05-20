import type { ParseResult } from './types';

// Pattern variants we accept on the left side of the separator:
//
//   Mon 1/5            — abbreviated weekday + M/D
//   Monday 1/5         — full weekday + M/D
//   May 18             — month name (abbreviated or full) + day
//   1/5                — date only (flagged for review)
//
const MONTH_NAME =
  '(?:Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:t(?:ember)?)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)';
const WEEKDAY_NAME =
  '(?:Mon(?:day)?|Tue(?:s(?:day)?)?|Wed(?:nesday)?|Thu(?:rs(?:day)?)?|Fri(?:day)?|Sat(?:urday)?|Sun(?:day)?)';

const WEEKDAY_WITH_DATE = new RegExp(`^\\s*${WEEKDAY_NAME}\\s+\\d{1,2}\\/\\d{1,2}\\s*$`, 'i');
const MONTH_WITH_DAY = new RegExp(`^\\s*${MONTH_NAME}\\s+\\d{1,2}\\s*$`, 'i');
const DATE_ONLY = /^\s*\d{1,2}\/\d{1,2}\s*$/;

const SEPARATORS = [' - ', ' – ', ' — ', '\t'];

function normalizeInput(s: string): string {
  return s.replace(/ /g, ' ').replace(/  +/g, ' ');
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
        if (
          WEEKDAY_WITH_DATE.test(left) ||
          MONTH_WITH_DAY.test(left)
        ) {
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
            reason: 'No weekday or month name found — please verify date',
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
