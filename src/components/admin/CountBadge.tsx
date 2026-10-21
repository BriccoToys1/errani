interface CountBadgeProps {
  count: number;
  /** red = notifications (#FF0F0F), white = neutral totals next to a page title. */
  tone?: 'red' | 'white';
  max?: number;
  className?: string;
}

/** Perfect circle counter, number centred both ways. */
export function CountBadge({ count, tone = 'red', max = 99, className = '' }: CountBadgeProps) {
  if (!count || count <= 0) return null;
  const text = count > max ? `${max}+` : String(count);
  return (
    <span
      className={`cms-count cms-count-${tone} ${text.length > 2 ? 'cms-count-wide' : ''} ${className}`.trim()}
      aria-label={String(count)}
    >
      {text}
    </span>
  );
}
