import type { ReactNode } from 'react';

/** Row of header icons (bare icons, no frames). */
export function HeaderActions({ children }: { children: ReactNode }) {
  return <div className="cms-header-actions">{children}</div>;
}

/** Toolbar between page header and list: search → filter → sort → extras. */
export function Toolbar({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <div className={`cms-toolbar ${className}`.trim()}>{children}</div>;
}

/**
 * Scroll container that fills the remaining viewport height and keeps a gap
 * above the screen bottom; only its content scrolls.
 */
export function ScrollArea({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <div className={`cms-scroll ${className}`.trim()}>{children}</div>;
}

/**
 * Fixed-layout list (no horizontal scrolling), dividers only between rows.
 * Wraps a `<table className="cms-table">` or any row markup.
 */
export function DataList({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <div className={`cms-datalist ${className}`.trim()}>
      <div className="cms-datalist-scroll">{children}</div>
    </div>
  );
}

/** Lightweight tooltip wrapper (CSS-driven via data-tooltip). */
export function Tooltip({
  content,
  children,
  placement = 'top',
}: {
  content: string;
  children: ReactNode;
  placement?: 'top' | 'bottom';
}) {
  return (
    <span className="cms-tooltip-host" data-tooltip={content} data-tooltip-placement={placement}>
      {children}
    </span>
  );
}
