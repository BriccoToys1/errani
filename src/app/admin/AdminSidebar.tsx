'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';

interface Counts {
  newOrders: number;
  newInquiries: number;
  newEmails: number;
}

interface SearchResult {
  type: string;
  label: string;
  sub: string;
  href: string;
}

const NAV_ITEMS = [
  { section: 'Главное' },
  { href: '/admin', icon: 'dashboard', label: 'Дашборд' },
  { section: 'Управление' },
  { href: '/admin/orders', icon: 'orders', label: 'Заказы', countKey: 'newOrders' },
  { href: '/admin/products', icon: 'products', label: 'Товары' },
  { href: '/admin/inquiries', icon: 'inquiries', label: 'Заявки', countKey: 'newInquiries' },
  { href: '/admin/email', icon: 'email', label: 'Почта', countKey: 'newEmails' },
  { href: '/admin/users', icon: 'users', label: 'Клиенты' },
  { section: 'Техническое' },
  { href: '/admin/technical', icon: 'code', label: 'Техническое' },
  { section: '' },
  { href: '/admin/settings', icon: 'settings', label: 'Настройки' },
  { href: '/admin/info', icon: 'info', label: 'Информация' },
  { href: '/admin/account', icon: 'account', label: 'Аккаунт' },
];

const ICONS: Record<string, React.ReactNode> = {
  dashboard: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><rect x="3" y="3" width="7" height="9" rx="1.5"/><rect x="14" y="3" width="7" height="5" rx="1.5"/><rect x="3" y="16" width="7" height="5" rx="1.5"/><rect x="14" y="12" width="7" height="9" rx="1.5"/></svg>,
  chart: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M3 3v18h18"/><path d="M7 16l4-6 4 3 5-7"/></svg>,
  orders: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M8 7h8M8 11h8M8 15h4"/></svg>,
  products: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M20.59 13.41l-7.17 7.17a2 2 0 01-2.83 0L2 12V2h10l8.59 8.59a2 2 0 010 2.82z"/><circle cx="7" cy="7" r="1.5" fill="currentColor"/></svg>,
  inquiries: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/></svg>,
  email: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><path d="M22 6l-10 7L2 6"/></svg>,
  content: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 013 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>,
  pages: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>,
  files: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z"/></svg>,
  seo: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/></svg>,
  settings: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 01-2.83 2.83l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z"/></svg>,
  database: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3"/><path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5"/></svg>,
  account: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>,
  users: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87"/><path d="M16 3.13a4 4 0 010 7.75"/></svg>,
  code: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/><line x1="14" y1="4" x2="10" y2="20"/></svg>,
  info: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>,
};

interface HealthStatus {
  level: 'green' | 'yellow' | 'red';
  message: string;
}

export function AdminSidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [counts, setCounts] = useState<Counts>({ newOrders: 0, newInquiries: 0, newEmails: 0 });
  const [health, setHealth] = useState<HealthStatus>({ level: 'green', message: 'Всё в порядке' });
  const [search, setSearch] = useState('');
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [showResults, setShowResults] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fetchCounts = useCallback(async () => {
    try {
      const token = localStorage.getItem('admin_token');
      if (!token) return;
      const [dashRes, statsRes] = await Promise.all([
        fetch('/api/admin/dashboard', { headers: { Authorization: `Bearer ${token}` } }),
        fetch('/api/admin/server-stats', { headers: { Authorization: `Bearer ${token}` } }),
      ]);
      if (dashRes.ok) {
        const data = await dashRes.json();
        setCounts({
          newOrders: data.newOrdersCount || 0,
          newInquiries: data.newInquiriesCount || 0,
          newEmails: data.newEmailsCount || 0,
        });
      }
      if (statsRes.ok) {
        const s = await statsRes.json();
        const issues: string[] = [];
        if (s.dbConnected === false) issues.push('БД недоступна');
        if (s.cpu?.usage > 85) issues.push(`CPU ${s.cpu.usage}%`);
        if (s.memory?.usage > 85) issues.push(`RAM ${s.memory.usage}%`);
        if (s.disk?.usage > 90) issues.push(`Disk ${s.disk.usage}%`);
        if (s.dbConnected === false) {
          setHealth({ level: 'red', message: issues.join(', ') });
        } else if (issues.length > 0) {
          setHealth({ level: 'yellow', message: issues.join(', ') });
        } else {
          setHealth({ level: 'green', message: 'Всё в порядке' });
        }
      }
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    fetchCounts();
    const interval = setInterval(fetchCounts, 30000);
    return () => clearInterval(interval);
  }, [fetchCounts]);

  useEffect(() => {
    const saved = localStorage.getItem('cms_sidebar_collapsed');
    if (saved === 'true') setCollapsed(true);
  }, []);

  // Close on route change
  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  // Body scroll lock when mobile drawer open
  useEffect(() => {
    if (typeof document === 'undefined') return;
    if (mobileOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => { document.body.style.overflow = ''; };
  }, [mobileOpen]);

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
    document.cookie = 'admin_token=; path=/; max-age=0';
    router.push('/admin/login');
  };

  const getCount = (countKey?: string) => {
    if (!countKey) return 0;
    return counts[countKey as keyof Counts] || 0;
  };

  // Debounced search across all content
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!search.trim() || search.length < 2) {
      setSearchResults([]);
      setShowResults(false);
      return;
    }
    debounceRef.current = setTimeout(async () => {
      setSearchLoading(true);
      try {
        const token = localStorage.getItem('admin_token');
        if (!token) return;
        const res = await fetch(`/api/admin/search?q=${encodeURIComponent(search.trim())}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.ok) {
          const data = await res.json();
          setSearchResults(data.results || []);
          setShowResults(true);
        }
      } catch { /* ignore */ } finally {
        setSearchLoading(false);
      }
    }, 350);
  }, [search]);

  return (
    <>
      <button
        className="cms-mobile-nav-toggle"
        onClick={() => setMobileOpen(true)}
        aria-label="Открыть меню"
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <line x1="3" y1="6" x2="21" y2="6" />
          <line x1="3" y1="12" x2="21" y2="12" />
          <line x1="3" y1="18" x2="21" y2="18" />
        </svg>
      </button>

      {mobileOpen && <div className="cms-sidebar-backdrop" onClick={() => setMobileOpen(false)} />}

      <aside className={`cms-sidebar ${collapsed ? 'collapsed' : ''} ${mobileOpen ? 'mobile-open' : ''}`}>
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

      {/* Search */}
      {!collapsed && (
        <div style={{ padding: '0 12px 8px' }} ref={searchRef}>
          <div style={{ position: 'relative' }}>
            <svg
              width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
              style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', opacity: searchLoading ? 0 : 0.4, transition: 'opacity 0.2s' }}
            >
              <circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/>
            </svg>
            {searchLoading && (
              <span style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', width: 12, height: 12, border: '2px solid var(--cms-border)', borderTopColor: 'var(--cms-accent)', borderRadius: '50%', animation: 'spin 0.7s linear infinite', display: 'block' }} />
            )}
            <input
              type="text"
              placeholder="Поиск по всему..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onFocus={() => searchResults.length > 0 && setShowResults(true)}
              onBlur={() => setTimeout(() => setShowResults(false), 200)}
              style={{
                width: '100%',
                padding: '7px 10px 7px 32px',
                border: '1px solid var(--cms-border)',
                borderRadius: showResults && searchResults.length > 0 ? '8px 8px 0 0' : '8px',
                background: 'var(--cms-surface)',
                color: 'var(--cms-text)',
                fontSize: '12px',
                outline: 'none',
              }}
            />
            {/* Search Results Dropdown */}
            {showResults && searchResults.length > 0 && (
              <div style={{
                position: 'absolute',
                top: '100%',
                left: 0,
                right: 0,
                background: 'var(--cms-bg)',
                border: '1px solid var(--cms-border)',
                borderTop: 'none',
                borderRadius: '0 0 8px 8px',
                boxShadow: '0 8px 24px rgba(0,0,0,0.2)',
                zIndex: 100,
                maxHeight: 220,
                overflowY: 'auto',
              }}>
                {searchResults.map((r, i) => (
                  <Link
                    key={i}
                    href={r.href}
                    onClick={() => { setSearch(''); setShowResults(false); }}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '8px 12px',
                      fontSize: '12px',
                      borderBottom: i < searchResults.length - 1 ? '1px solid var(--cms-border)' : 'none',
                      textDecoration: 'none',
                      color: 'var(--cms-text)',
                      gap: 8,
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--cms-surface-hover)')}
                    onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                  >
                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>{r.label}</span>
                    <span style={{ fontSize: '10px', color: 'var(--cms-text-muted)', flexShrink: 0 }}>{r.sub}</span>
                  </Link>
                ))}
              </div>
            )}
            {showResults && search.length >= 2 && searchResults.length === 0 && !searchLoading && (
              <div style={{
                position: 'absolute', top: '100%', left: 0, right: 0,
                background: 'var(--cms-bg)', border: '1px solid var(--cms-border)', borderTop: 'none',
                borderRadius: '0 0 8px 8px', padding: '10px 12px', fontSize: '12px',
                color: 'var(--cms-text-muted)', zIndex: 100,
              }}>
                Ничего не найдено
              </div>
            )}
          </div>
        </div>
      )}

      <nav className="cms-sidebar-nav">
        {NAV_ITEMS.map((item, i) => {
          if ('section' in item && !('href' in item)) {
            if (!item.section) {
              return <div key={i} style={{ borderTop: '1px solid var(--cms-border)', margin: '6px 12px' }} />;
            }
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
              onClick={() => setMobileOpen(false)}
            >
              <span className="cms-nav-icon">{ICONS[nav.icon]}</span>
              {!collapsed && <span className="cms-nav-label">{nav.label}</span>}
              {count > 0 && <span className="cms-nav-badge">{count > 99 ? '99+' : count}</span>}
            </Link>
          );
        })}
      </nav>

      {/* Traffic Light */}
      {!collapsed && (
        <div className="cms-traffic-light" title={health.message}>
          <span className={`cms-traffic-dot ${health.level === 'red' ? 'red' : 'off'}`} />
          <span className={`cms-traffic-dot ${health.level === 'yellow' ? 'yellow' : 'off'}`} />
          <span className={`cms-traffic-dot ${health.level === 'green' ? 'green' : 'off'}`} />
          <span className="cms-traffic-tooltip">{health.message}</span>
        </div>
      )}

      <div className="cms-sidebar-footer">
        <Link href="/admin/account" className="cms-sidebar-user" style={{ textDecoration: 'none', color: 'inherit' }} title="Аккаунт">
          <div className="cms-sidebar-avatar">K</div>
          {!collapsed && (
            <div className="cms-sidebar-user-info">
              <div className="cms-sidebar-user-name">Аккаунт</div>
              <div className="cms-sidebar-user-role">Администратор</div>
            </div>
          )}
        </Link>
        <button
          onClick={handleLogout}
          title="Выйти"
          style={{
            background: 'none', border: 'none', cursor: 'pointer', padding: '8px',
            color: 'var(--cms-text-muted)', display: 'flex', alignItems: 'center',
            borderRadius: '6px', transition: 'background 0.15s',
          }}
          onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--cms-surface-hover)')}
          onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" style={{ opacity: 0.7 }}>
            <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4M16 17l5-5-5-5M21 12H9"/>
          </svg>
        </button>
      </div>
      </aside>
    </>
  );
}
