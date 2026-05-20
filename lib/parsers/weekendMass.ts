import type { ParseResult } from './types';

const WEEKEND_TIME = /^\s*(1[0-2]|[1-9]):([0-5][0-9])\s*(am|pm)\s*$/i;
const SEPARATORS = [' - ', ' – ', ' — ', '\t'];

function normalizeInput(s: string): string {
  return s
    .replace(/ /g, ' ')
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/  +/g, ' ');
}

function normalizeTime(s: string): string {
  return s.trim().replace(/(am|pm)$/i, (m) => m.toUpperCase());
}

export function parseWeekendMass(input: string): ParseResult {
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

    for (const sep of SEPARATORS) {
      const idx = line.indexOf(sep);
      if (idx > 0) {
        const left = line.slice(0, idx).trim();
        const right = line.slice(idx + sep.length).trim();
        if (WEEKEND_TIME.test(left)) {
          timeLabel = normalizeTime(left);
          intention = right;
          break;
        }
      }
    }

    if (!timeLabel || !intention) {
      warnings.push({ lineNumber: i + 1, raw: line, reason: 'Could not parse time and intention' });
      rows.push({ timeLabel: '', intention: line, needsReview: true });
      continue;
    }

    rows.push({ timeLabel, intention, needsReview: false });
  }

  return { rows, warnings };
}
