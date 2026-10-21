import type { CSSProperties, ReactNode } from 'react';

export type StatusTone = 'green' | 'red' | 'yellow' | 'pink' | 'blue' | 'gray' | 'gray-dark';

const SOLID_FG: Record<StatusTone, string> = {
  green: '#052e1c',
  red: '#fff',
  yellow: '#3b2a05',
  pink: '#3a102e',
  blue: '#06233a',
  gray: '#111',
  'gray-dark': '#fff',
};

const SOLID_BG: Record<StatusTone, string> = {
  green: '#34d399',
  red: '#ef4444',
  yellow: '#fbbf24',
  pink: '#f58bdc',
  blue: '#61bffa',
  gray: '#c9ccd4',
  'gray-dark': '#6b7280',
};

interface StatusBadgeProps {
  tone?: StatusTone;
  /** Custom colour (overrides tone), e.g. order stage colour. */
  color?: string;
  /** xs = half-height solid chip; sm/row for legacy. */
  size?: 'xs' | 'sm' | 'row';
  /** Solid fill plaque (default true). */
  solid?: boolean;
  children: ReactNode;
  className?: string;
  title?: string;
}

export function StatusBadge({
  tone = 'gray',
  color,
  size = 'xs',
  solid = true,
  children,
  className = '',
  title,
}: StatusBadgeProps) {
  let style: CSSProperties | undefined;
  if (color) {
    style = solid
      ? { color: '#111', background: color, borderColor: color }
      : {
          color,
          background: `color-mix(in srgb, ${color} 14%, transparent)`,
          borderColor: `color-mix(in srgb, ${color} 36%, transparent)`,
        };
  } else if (solid) {
    style = { color: SOLID_FG[tone], background: SOLID_BG[tone], borderColor: SOLID_BG[tone] };
  }
  return (
    <span
      className={`cms-status cms-status-${tone} cms-status-${size}${solid ? ' cms-status-solid' : ''} ${className}`.trim()}
      style={style}
      title={title}
    >
      {children}
    </span>
  );
}
