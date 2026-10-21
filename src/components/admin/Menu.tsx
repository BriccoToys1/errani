'use client';

import { useEffect, useRef, type ReactNode } from 'react';
import { Icon, type IconName } from './Icon';

export interface MenuItem<T extends string> {
  value: T;
  label: ReactNode;
  icon?: IconName;
  /** Optional trailing hint (e.g. ↑/↓ for sort direction). */
  hint?: ReactNode;
}

interface MenuProps<T extends string> {
  open: boolean;
  onClose: () => void;
  items: MenuItem<T>[];
  value?: T | T[];
  onSelect: (value: T) => void;
  title?: string;
  /** Trigger element the menu is anchored to. */
  children: ReactNode;
  align?: 'start' | 'end';
  closeOnSelect?: boolean;
}

/** Anchored dropdown used for filter and sort controls. */
export function Menu<T extends string>({
  open,
  onClose,
  items,
  value,
  onSelect,
  title,
  children,
  align = 'start',
  closeOnSelect = true,
}: MenuProps<T>) {
  const ref = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('mousedown', onDown);
    window.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      window.removeEventListener('keydown', onKey);
    };
  }, [open, onClose]);

  const isActive = (v: T) => (Array.isArray(value) ? value.includes(v) : value === v);

  return (
    <span ref={ref} className="cms-popover-anchor">
      {children}
      {open && (
        <div className={`cms-menu cms-popover-${align}`} role="menu">
          {title && <div className="cms-menu-title">{title}</div>}
          {items.map((item) => (
            <button
              key={item.value}
              type="button"
              role="menuitemradio"
              aria-checked={isActive(item.value)}
              className={`cms-menu-item ${isActive(item.value) ? 'active' : ''}`}
              onClick={() => {
                onSelect(item.value);
                if (closeOnSelect) onClose();
              }}
            >
              {item.icon && <Icon name={item.icon} size={14} />}
              <span className="cms-menu-label">{item.label}</span>
              {item.hint && <span className="cms-menu-hint">{item.hint}</span>}
              {isActive(item.value) && <Icon name="check" size={13} className="cms-menu-check" />}
            </button>
          ))}
        </div>
      )}
    </span>
  );
}
