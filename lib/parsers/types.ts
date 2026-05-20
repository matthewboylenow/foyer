export type ParseResult = {
  rows: ParsedRow[];
  warnings: ParseWarning[];
};

export type ParsedRow =
  | { timeLabel: string; intention: string; needsReview: boolean }
  | { name: string; needsReview: boolean };

export type ParseWarning = {
  lineNumber: number;
  raw: string;
  reason: string;
};
