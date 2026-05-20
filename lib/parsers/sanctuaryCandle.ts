import type { ParseResult } from './types';

export function parseSanctuaryCandle(input: string): ParseResult {
  const name = input.trim();
  if (!name) {
    return {
      rows: [],
      warnings: [{ lineNumber: 0, raw: '', reason: 'Name is required' }],
    };
  }
  return { rows: [{ name, needsReview: false }], warnings: [] };
}
