'use client';

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { TimeValue } from '@/lib/time';

const HOURS = Array.from({ length: 12 }, (_, i) => i + 1);
const MINUTES = Array.from({ length: 12 }, (_, i) => i * 5);

interface TimePickerProps {
  value: TimeValue;
  onChange: (v: TimeValue) => void;
}

export function TimePicker({ value, onChange }: TimePickerProps) {
  return (
    <div className="flex items-center gap-2">
      <Select
        value={String(value.hour)}
        onValueChange={(h) => onChange({ ...value, hour: Number(h) })}
      >
        <SelectTrigger className="w-20">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {HOURS.map((h) => (
            <SelectItem key={h} value={String(h)}>
              {h}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <span className="text-muted-foreground">:</span>

      <Select
        value={String(value.minute)}
        onValueChange={(m) => onChange({ ...value, minute: Number(m) })}
      >
        <SelectTrigger className="w-20">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {MINUTES.map((m) => (
            <SelectItem key={m} value={String(m)}>
              {String(m).padStart(2, '0')}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select
        value={value.period}
        onValueChange={(p) => onChange({ ...value, period: p as 'AM' | 'PM' })}
      >
        <SelectTrigger className="w-20">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="AM">AM</SelectItem>
          <SelectItem value="PM">PM</SelectItem>
        </SelectContent>
      </Select>
    </div>
  );
}
