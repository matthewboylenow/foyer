'use client';

import { Label } from '@/components/ui/label';

interface PercentageSliderProps {
  label: string;
  value: number;
  onChange: (v: number) => void;
  min?: number;
  max?: number;
  step?: number;
}

export function PercentageSlider({
  label,
  value,
  onChange,
  min = 20,
  max = 100,
  step = 5,
}: PercentageSliderProps) {
  return (
    <div className="space-y-1">
      <Label className="text-xs">{label}</Label>
      <div className="flex items-center gap-3">
        <input
          type="range"
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={(e) => onChange(Number(e.target.value))}
          className="flex-1 accent-rust"
        />
        <span className="text-sm font-mono w-12 text-right tabular-nums">{value}%</span>
      </div>
    </div>
  );
}
