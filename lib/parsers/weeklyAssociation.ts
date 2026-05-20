import type { ParseResult } from './types';

export function parseWeeklyAssociation(input: string): ParseResult {
  const names = input
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean);

  const warnings: ParseResult['warnings'] = [];

  if (names.length > 12) {
    warnings.push({
      lineNumber: 0,
      raw: '',
      reason: `${names.length} names entered. Display will scale down to fit, but consider trimming for legibility.`,
    });
  }

  return {
    rows: names.map((name) => ({ name, needsReview: false })),
    warnings,
  };
}
