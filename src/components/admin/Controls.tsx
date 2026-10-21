'use client';

import type { ReactNode } from 'react';

/** Toggle = on/off switch for enabling a feature. */
export function Toggle({
  checked,
  onChange,
  label,
  disabled,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label?: ReactNode;
  disabled?: boolean;
}) {
  return (
    <label className="cms-toggle-row">
      <span className="cms-toggle">
        <input type="checkbox" checked={checked} disabled={disabled} onChange={(e) => onChange(e.target.checked)} />
        <span className="cms-toggle-slider" />
      </span>
      {label && <span className="cms-toggle-label">{label}</span>}
    </label>
  );
}

/** iOS-like slider (0..100 by default). */
export function Slider({
  value,
  onChange,
  min = 0,
  max = 100,
  step = 1,
  label,
  suffix = '%',
  compact = false,
  leading,
}: {
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  step?: number;
  label?: ReactNode;
  suffix?: string;
  /** Shorter track (≈1/3 width) for settings appearance. */
  compact?: boolean;
  /** Icon / node before the track (e.g. “есть / нету”). */
  leading?: ReactNode;
}) {
  const pct = ((value - min) / (max - min)) * 100;
  return (
    <div className={`cms-slider-row${compact ? ' cms-slider-row-compact' : ''}`}>
      {label && <span className="cms-slider-label">{label}</span>}
      {leading}
      <input
        type="range"
        className="cms-slider"
        min={min}
        max={max}
        step={step}
        value={value}
        style={{ ['--cms-slider-fill' as string]: `${pct}%` }}
        onChange={(e) => onChange(Number(e.target.value))}
      />
      <span className="cms-slider-value">
        {Math.round(value)}
        {suffix}
      </span>
    </div>
  );
}
