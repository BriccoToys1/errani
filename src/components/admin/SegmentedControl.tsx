'use client';

import { useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { Icon, type IconName } from './Icon';

export interface SegmentOption<T extends string> {
  value: T;
  label?: ReactNode;
  icon?: IconName;
  /** Tooltip / aria label (required for icon-only segments). */
  title?: string;
  badge?: number;
}

interface SegmentedControlProps<T extends string> {
  options: SegmentOption<T>[];
  value: T;
  onChange: (value: T) => void;
  size?: 'md' | 'sm' | 'xs';
  fullWidth?: boolean;
  className?: string;
  ariaLabel?: string;
}

/** Apple HIG-style segmented control with a sliding thumb. */
export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
  size = 'sm',
  fullWidth = false,
  className = '',
  ariaLabel,
}: SegmentedControlProps<T>) {
  const iconSize = size === 'xs' ? 13 : 14;
  const trackRef = useRef<HTMLDivElement>(null);
  const [thumb, setThumb] = useState<{ left: number; width: number } | null>(null);

  useLayoutEffect(() => {
    const track = trackRef.current;
    if (!track) return;
    const measure = () => {
      const active = track.querySelector<HTMLButtonElement>('[data-active="true"]');
      if (!active) {
        setThumb(null);
        return;
      }
      setThumb({ left: active.offsetLeft, width: active.offsetWidth });
    };
    measure();
    if (typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(measure);
    ro.observe(track);
    return () => ro.disconnect();
  }, [value, options.length]);

  return (
    <div
      ref={trackRef}
      role="tablist"
      aria-label={ariaLabel}
      className={`cms-segmented cms-segmented-${size} ${fullWidth ? 'cms-segmented-full' : ''} ${className}`.trim()}
    >
      {thumb && (
        <span
          className="cms-segmented-thumb"
          style={{ transform: `translateX(${thumb.left - 3}px)`, width: thumb.width }}
          aria-hidden="true"
        />
      )}
      {options.map((opt) => {
        const active = opt.value === value;
        return (
          <button
            key={opt.value}
            type="button"
            role="tab"
            aria-selected={active}
            data-active={active}
            aria-label={opt.title}
            data-tooltip={!opt.label && opt.title ? opt.title : undefined}
            className={`cms-segmented-item ${active ? 'active' : ''}`}
            onClick={() => onChange(opt.value)}
          >
            {opt.icon && <Icon name={opt.icon} size={iconSize} />}
            {opt.label && <span>{opt.label}</span>}
            {typeof opt.badge === 'number' && opt.badge > 0 && (
              <span className="cms-count cms-count-red cms-segmented-badge">{opt.badge > 99 ? '99+' : opt.badge}</span>
            )}
          </button>
        );
      })}
    </div>
  );
}
