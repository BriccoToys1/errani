'use client';

import { useEffect, type ReactNode } from 'react';
import { CountBadge } from '@/components/admin';
import { useAdminShell } from './AdminShell';

interface AdminPageProps {
  title: ReactNode;
  /** Neutral total shown in a white circle right after the title. */
  count?: number;
  /** Notification count shown in a red circle right after the title. */
  notifyCount?: number;
  /** Extra control right after title/count (e.g. filter icon). */
  titleExtra?: ReactNode;
  actions?: ReactNode;
  /** Fill the viewport: only inner ScrollArea/DataList scrolls, gap above screen bottom. */
  fill?: boolean;
  className?: string;
  children: ReactNode;
}

/** Shared admin page content: sticky header + content (sidebar lives in AdminShell). */
export function AdminPage({ title, count, notifyCount, titleExtra, actions, fill = false, className = '', children }: AdminPageProps) {
  const shell = useAdminShell();

  useEffect(() => {
    shell?.setFill(fill);
    return () => shell?.setFill(false);
  }, [fill, shell]);

  return (
    <main className={`cms-main ${className}`.trim()}>
      <header className="cms-header">
        <h1 className="cms-header-title">
          <span>{title}</span>
          {typeof count === 'number' && <CountBadge count={count} tone="white" max={9999} />}
          {typeof notifyCount === 'number' && <CountBadge count={notifyCount} />}
          {titleExtra}
        </h1>
        {actions}
      </header>
      <div className="cms-content">{children}</div>
    </main>
  );
}
