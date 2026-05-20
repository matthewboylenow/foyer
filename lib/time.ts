export interface TimeValue {
  hour: number;   // 1-12
  minute: number; // 0, 5, 10, ..., 55
  period: 'AM' | 'PM';
}

export function timeValueToDate(date: Date, time: TimeValue): Date {
  const d = new Date(date);
  let h = time.hour % 12;
  if (time.period === 'PM') h += 12;
  d.setHours(h, time.minute, 0, 0);
  return d;
}

export function dateToTimeValue(date: Date): TimeValue {
  const h = date.getHours();
  const period = h >= 12 ? 'PM' : 'AM';
  const hour = h % 12 || 12;
  const minute = Math.floor(date.getMinutes() / 5) * 5;
  return { hour, minute, period };
}

export function formatTimeValue(t: TimeValue): string {
  const min = String(t.minute).padStart(2, '0');
  return `${t.hour}:${min} ${t.period}`;
}
