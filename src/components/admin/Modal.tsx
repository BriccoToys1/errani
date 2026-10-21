'use client';

import { useEffect, type ReactNode } from 'react';
import { IconButton } from './IconButton';

interface ModalProps {
  open: boolean;
  title?: ReactNode;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
  width?: number;
  headerExtra?: ReactNode;
  className?: string;
}

export function Modal({ open, title, onClose, children, footer, width = 540, headerExtra, className = '' }: ModalProps) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div className="cms-modal-overlay" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className={`cms-modal ${className}`.trim()} style={{ maxWidth: width }} role="dialog" aria-modal="true">
        <div className="cms-modal-header">
          {typeof title === 'string' ? <h3>{title}</h3> : title}
          <div className="cms-modal-header-actions">
            {headerExtra}
            <IconButton icon="close" label="Закрыть" shape="square" onClick={onClose} />
          </div>
        </div>
        <div className="cms-modal-body">{children}</div>
        {footer && <div className="cms-modal-footer">{footer}</div>}
      </div>
    </div>
  );
}
