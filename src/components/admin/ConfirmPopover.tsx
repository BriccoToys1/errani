'use client';

import { useEffect, useRef, type ReactNode } from 'react';
import { Button } from './Button';
import type { IconName } from './Icon';

interface ConfirmPopoverProps {
  open: boolean;
  /** Trigger element; popover is anchored to it. */
  children: ReactNode;
  message: ReactNode;
  confirmLabel?: string;
  confirmIcon?: IconName;
  cancelLabel?: string;
  tone?: 'danger' | 'primary';
  placement?: 'top' | 'bottom';
  align?: 'start' | 'end' | 'center';
  busy?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
  /** Extra content (e.g. inputs) between message and buttons. */
  body?: ReactNode;
  width?: number;
}

/** Small anchored confirmation plate (above or below the trigger). */
export function ConfirmPopover({
  open,
  children,
  message,
  confirmLabel = 'Подтвердить',
  confirmIcon,
  cancelLabel = 'Отмена',
  tone = 'danger',
  placement = 'bottom',
  align = 'end',
  busy = false,
  onConfirm,
  onCancel,
  body,
  width = 240,
}: ConfirmPopoverProps) {
  const ref = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onCancel();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCancel();
    };
    document.addEventListener('mousedown', onDown);
    window.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      window.removeEventListener('keydown', onKey);
    };
  }, [open, onCancel]);

  return (
    <span ref={ref} className="cms-popover-anchor">
      {children}
      {open && (
        <div
          className={`cms-popover cms-popover-${placement} cms-popover-${align}`}
          style={{ width }}
          role="alertdialog"
        >
          <div className="cms-popover-message">{message}</div>
          {body}
          <div className="cms-popover-actions">
            <Button size="xs" variant="ghost" onClick={onCancel} disabled={busy}>
              {cancelLabel}
            </Button>
            <Button
              size="xs"
              variant={tone === 'danger' ? 'danger' : 'primary'}
              icon={confirmIcon}
              onClick={onConfirm}
              disabled={busy}
            >
              {busy ? '…' : confirmLabel}
            </Button>
          </div>
        </div>
      )}
    </span>
  );
}
