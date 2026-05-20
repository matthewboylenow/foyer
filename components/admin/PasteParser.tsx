'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import type { ParsedRow, ParseWarning } from '@/lib/parsers/types';

// Lazy-import parsers to keep server bundle clean
async function getParsers() {
  const [w, wd, wa, sc] = await Promise.all([
    import('@/lib/parsers/weekendMass'),
    import('@/lib/parsers/weekdayMass'),
    import('@/lib/parsers/weeklyAssociation'),
    import('@/lib/parsers/sanctuaryCandle'),
  ]);
  return {
    mass_schedule_weekend: w.parseWeekendMass,
    mass_schedule_weekday: wd.parseWeekdayMass,
    weekly_association: wa.parseWeeklyAssociation,
    sanctuary_candle: sc.parseSanctuaryCandle,
  };
}

const PLACEHOLDERS: Record<string, string> = {
  mass_schedule_weekend:
    '5:00 PM - John Smith, requested by the Smith family\n7:00 AM - Mary Brown\n9:00 AM - The Johnson Family\n10:30 AM - Anniversary of the Doe Family\n12:00 PM - For the People of the Parish',
  mass_schedule_weekday:
    'May 18 - Marchitelli Family & Jessica Lutkenhouse\nMay 19 - McGettigan Family (Deceased Members)\nMay 20 - Frank Bernhard\nMay 21 - Nicholas Salerno\nMay 22 - Terry Vinanskie\nMay 23 - People of the Parish',
  weekly_association:
    'John Smith\nMary Brown\nThe Johnson Family\nPeter and Anne O\'Sullivan\nJames MacGowan, Sr.',
  sanctuary_candle: 'John Smith',
};

type ParserKey = 'mass_schedule_weekend' | 'mass_schedule_weekday' | 'weekly_association' | 'sanctuary_candle';

interface PasteParserProps {
  templateType: ParserKey;
  savedRows: ParsedRow[];
  onParsed: (rows: ParsedRow[]) => void;
}

interface DiffResult {
  added: number;
  removed: number;
  unchanged: number;
}

function computeDiff(saved: ParsedRow[], current: ParsedRow[]): DiffResult {
  const savedKeys = saved.map((r) => JSON.stringify(r));
  const currentKeys = current.map((r) => JSON.stringify(r));
  const savedSet = new Set(savedKeys);
  const currentSet = new Set(currentKeys);

  let unchanged = 0;
  for (const k of currentKeys) if (savedSet.has(k)) unchanged++;
  const added = currentKeys.filter((k) => !savedSet.has(k)).length;
  const removed = savedKeys.filter((k) => !currentSet.has(k)).length;
  return { added, removed, unchanged };
}

export function PasteParser({ templateType, savedRows, onParsed }: PasteParserProps) {
  const [text, setText] = useState('');
  const [parsedRows, setParsedRows] = useState<ParsedRow[]>(savedRows);
  const [warnings, setWarnings] = useState<ParseWarning[]>([]);
  const [diff, setDiff] = useState<DiffResult | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const parsersRef = useRef<Awaited<ReturnType<typeof getParsers>> | null>(null);

  const parse = useCallback(
    async (input: string) => {
      if (!parsersRef.current) {
        parsersRef.current = await getParsers();
      }
      const fn = parsersRef.current[templateType] as ((input: string) => import('@/lib/parsers/types').ParseResult) | undefined;
      if (!fn) return;
      const result = fn(input);
      setParsedRows(result.rows);
      setWarnings(result.warnings);
      setDiff(computeDiff(savedRows, result.rows));
      onParsed(result.rows);
    },
    [templateType, savedRows, onParsed],
  );

  useEffect(() => {
    clearTimeout(debounceRef.current);
    if (!text.trim()) {
      setParsedRows(savedRows);
      setWarnings([]);
      setDiff(null);
      return;
    }
    debounceRef.current = setTimeout(() => parse(text), 300);
    return () => clearTimeout(debounceRef.current);
  }, [text, parse, savedRows]);

  const isNameParser = templateType === 'weekly_association' || templateType === 'sanctuary_candle';

  return (
    <div className="space-y-3">
      <Label>Paste from bulletin</Label>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {/* Textarea */}
        <Textarea
          rows={8}
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={PLACEHOLDERS[templateType]}
          className="font-mono text-sm"
        />

        {/* Parsed preview */}
        <div className="border border-border rounded-md p-3 bg-muted/30 overflow-y-auto text-sm space-y-1 min-h-[160px]">
          {parsedRows.length === 0 && warnings.length === 0 ? (
            <p className="text-muted-foreground text-xs">Parsed rows will appear here…</p>
          ) : (
            <>
              {parsedRows.map((row, i) => (
                <div
                  key={i}
                  className={`flex gap-2 items-start ${row.needsReview ? 'text-amber-700' : 'text-foreground'}`}
                >
                  <span>{row.needsReview ? '⚠' : '▸'}</span>
                  {isNameParser ? (
                    <span>{'name' in row ? row.name : ''}</span>
                  ) : (
                    <span>
                      {'timeLabel' in row && row.timeLabel && (
                        <strong>{row.timeLabel}</strong>
                      )}{' '}
                      {'intention' in row ? row.intention : ''}
                    </span>
                  )}
                </div>
              ))}
              {warnings.map((w, i) => (
                <div key={`warn-${i}`} className="text-amber-700 text-xs">
                  ⚠ Line {w.lineNumber}: {w.reason}
                </div>
              ))}
            </>
          )}
        </div>
      </div>

      {/* Diff summary */}
      {diff && text.trim() && (
        <div className="text-xs text-muted-foreground flex gap-4">
          {diff.added > 0 && <span className="text-green-700">+{diff.added} added</span>}
          {diff.removed > 0 && <span className="text-red-700">-{diff.removed} removed</span>}
          {diff.unchanged > 0 && <span>{diff.unchanged} unchanged</span>}
        </div>
      )}
    </div>
  );
}
