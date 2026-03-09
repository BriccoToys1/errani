'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';

interface Counts {
  newOrders: number;
  newInquiries: number;
}

const NAV_ITEMS = [
  { section: 'Главное' },
  { href: '/admin', icon: 'dashboard', label: 'Дашборд' },
  { href: '/admin/analytics', icon: 'chart', label: 'Аналитика' },
  { section: 'Управление' },
  { href: '/admin/orders', icon: 'orders', label: 'Заказы', countKey: 'newOrders' },
  { href: '/admin/products', icon: 'products', label: 'Товары' },
  { href: '/admin/inquiries', icon: 'inquiries', label: 'Обращения', countKey: 'newInquiries' },
  { href: '/admin/content', icon: 'content', label: 'Контент' },
  { section: 'Настройки' },
  { href: '/admin/files', icon: 'files', label: 'Файлы' },
  { href: '/admin/seo', icon: 'seo', label: 'SEO' },
  { href: '/admin/settings', icon: 'settings', label: 'Настройки' },
  { href: '/admin/database', icon: 'database', label: 'База данных' },
];

const ICONS: Record<string, React.ReactNode> = {
  dashboard: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><rect x="3" y="3" width="7" height="9" rx="1.5"/><rect x="14" y="3" width="7" height="5" rx="1.5"/><rect x="3" y="16" width="7" height="5" rx="1.5"/><rect x="14" y="12" width="7" height="9" rx="1.5"/></svg>,
  chart: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M3 3v18h18"/><path d="M7 16l4-6 4 3 5-7"/></svg>,
  orders: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M8 7h8M8 11h8M8 15h4"/></svg>,
  products: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M20.59 13.41l-7.17 7.17a2 2 0 01-2.83 0L2 12V2h10l8.59 8.59a2 2 0 010 2.82z"/><circle cx="7" cy="7" r="1.5" fill="currentColor"/></svg>,
  inquiries: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><path d="M22 6l-10 7L2 6"/></svg>,
  content: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 013 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>,
  files: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z"/></svg>,
  seo: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/></svg>,
  settings: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 01-2.83 2.83l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z"/></svg>,
  database: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3"/><path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5"/></svg>,
};

export function AdminSidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const [collapsed, setCollapsed] = useState(false);
  const [counts, setCounts] = useState<Counts>({ newOrders: 0, newInquiries: 0 });

  const fetchCounts = useCallback(async () => {
    try {
      const token = localStorage.getItem('admin_token');
      if (!token) return;
      const res = await fetch('/api/admin/dashboard', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setCounts({
          newOrders: data.newOrdersCount || 0,
          newInquiries: data.newInquiriesCount || 0,
        });
      }
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    fetchCounts();
    const interval = setInterval(fetchCounts, 30000); // refresh every 30s
    return () => clearInterval(interval);
  }, [fetchCounts]);

  useEffect(() => {
    const saved = localStorage.getItem('cms_sidebar_collapsed');
    if (saved === 'true') setCollapsed(true);
  }, []);

  const toggleCollapse = () => {
    setCollapsed(prev => {
      localStorage.setItem('cms_sidebar_collapsed', String(!prev));
      return !prev;
    });
  };

  const isActive = (href: string) => {
    if (href === '/admin') return pathname === '/admin';
    return pathname.startsWith(href);
  };

  const handleLogout = () => {
    localStorage.removeItem('admin_token');
    router.push('/admin/login');
  };

  const getCount = (countKey?: string) => {
    if (!countKey) return 0;
    return counts[countKey as keyof Counts] || 0;
  };

  return (
    <aside className={`cms-sidebar ${collapsed ? 'collapsed' : ''}`}>
      <div className="cms-sidebar-brand">
        <svg className="cms-sidebar-brand-icon" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
          <rect x="3" y="3" width="7" height="9" rx="1.5"/>
          <rect x="14" y="3" width="7" height="5" rx="1.5"/>
          <rect x="3" y="16" width="7" height="5" rx="1.5"/>
          <rect x="14" y="12" width="7" height="9" rx="1.5"/>
        </svg>
        {!collapsed && (
          <div className="cms-sidebar-brand-text">
            errani<span>CMS</span>
          </div>
        )}
        <button
          className="cms-sidebar-toggle"
          onClick={toggleCollapse}
          title={collapsed ? 'Развернуть' : 'Свернуть'}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            {collapsed ? (
              <path d="M9 18l6-6-6-6" />
            ) : (
              <path d="M15 18l-6-6 6-6" />
            )}
          </svg>
        </button>
      </div>

      <nav className="cms-sidebar-nav">
        {NAV_ITEMS.map((item, i) => {
          if ('section' in item && !('href' in item)) {
            return !collapsed ? <div key={i} className="cms-sidebar-section">{item.section}</div> : null;
          }
          const nav = item as { href: string; icon: string; label: string; countKey?: string };
          const count = getCount(nav.countKey);
          return (
            <Link
              key={nav.href}
              href={nav.href}
              className={`cms-nav-item ${isActive(nav.href) ? 'active' : ''}`}
              title={collapsed ? nav.label : undefined}
            >
              <span className="cms-nav-icon">{ICONS[nav.icon]}</span>
              {!collapsed && <span className="cms-nav-label">{nav.label}</span>}
              {count > 0 && <span className="cms-nav-badge">{count > 99 ? '99+' : count}</span>}
            </Link>
          );
        })}
      </nav>

      <div className="cms-sidebar-footer">
        <div className="cms-sidebar-user" onClick={handleLogout} title="Выйти">
          <div className="cms-sidebar-avatar">K</div>
          {!collapsed && (
            <div className="cms-sidebar-user-info">
              <div className="cms-sidebar-user-name">Ekaterina</div>
              <div className="cms-sidebar-user-role">Администратор</div>
            </div>
          )}
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" style={{ opacity: 0.5 }}>
            <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4M16 17l5-5-5-5M21 12H9"/>
          </svg>
        </div>
      </div>
    </aside>
  );
}
