'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { Icon, type IconName, SearchField, ConfirmPopover, CountBadge } from '@/components/admin';
import {
  APPEARANCE_SETTING_KEY,
  applyAppearance,
  cacheAppearance,
  parseAppearance,
  readCachedAppearance,
} from '@/components/admin/appearance';
import { adminFetch } from '@/lib/admin-client';
import {
  DEFAULT_MOBILE_NAV_SLOTS,
  MOBILE_NAV_SETTING_KEY,
  parseMobileNavSlots,
  resolveMobileNavSlots,
  type MobileNavOption,
  type MobileNavSlotId,
} from '@/lib/mobile-nav';

interface Counts {
  newOrders: number;
  newInquiries: number;
  newEmails: number;
  newWaitlist: number;
  newReviews: number;
}

interface SearchResult {
  type: string;
  label: string;
  sub: string;
  href: string;
}

interface NavItem {
  href: string;
  icon: IconName;
  label: string;
  countKey?: keyof Counts;
}

const NAV_ITEMS: (NavItem | { section: string })[] = [
  { href: '/admin', icon: 'analytics', label: 'Аналитика' },
  { href: '/admin/email', icon: 'mail', label: 'Почта', countKey: 'newEmails' },
  { section: '' },
  { href: '/admin/orders', icon: 'orders', label: 'Заказы', countKey: 'newOrders' },
  { href: '/admin/products', icon: 'products', label: 'Товары' },
  { href: '/admin/media', icon: 'media', label: 'Галерея' },
  { href: '/admin/inquiries', icon: 'requests', label: 'Заявки', countKey: 'newInquiries' },
  { href: '/admin/waitlist', icon: 'waiting', label: 'В ожидании', countKey: 'newWaitlist' },
  { href: '/admin/users', icon: 'customers', label: 'Клиенты' },
  { href: '/admin/reviews', icon: 'reviews', label: 'Отзывы', countKey: 'newReviews' },
  { section: '' },
  { href: '/admin/settings', icon: 'settings', label: 'Настройки' },
];

const TYPE_LABELS: Record<string, string> = {
  order: 'Заказ',
  product: 'Товар',
  inquiry: 'Заявка',
  user: 'Клиент',
  waitlist: 'Ожидание',
  review: 'Отзыв',
  email: 'Письмо',
  media: 'Галерея',
  page: 'Страница',
  section: 'Раздел',
  expense: 'Расход',
  avito: 'Avito',
  setting: 'Настройка',
  content: 'Контент',
  invite: 'Приглашение',
};

export function AdminSidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [counts, setCounts] = useState<Counts>({ newOrders: 0, newInquiries: 0, newEmails: 0, newWaitlist: 0, newReviews: 0 });
  const [search, setSearch] = useState('');
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [showResults, setShowResults] = useState(false);
  const [mobileSearchOpen, setMobileSearchOpen] = useState(false);
  const [mobileNavSlots, setMobileNavSlots] = useState<MobileNavSlotId[]>(DEFAULT_MOBILE_NAV_SLOTS);
  const [confirmLogout, setConfirmLogout] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mobileSearchInputRef = useRef<HTMLInputElement>(null);
  const prevTotalRef = useRef<number | null>(null);
  const notifySettingsRef = useRef<{ enabled: boolean; url: string }>({ enabled: false, url: '' });
  const mobileNavItems: MobileNavOption[] = resolveMobileNavSlots(mobileNavSlots);

  // Appearance (glass transparency + wallpaper) — cached first, then refreshed from settings.
  useEffect(() => {
    const cached = readCachedAppearance();
    if (cached) applyAppearance(cached);
    adminFetch(`/api/admin/settings?key=${APPEARANCE_SETTING_KEY}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (!d) return;
        const next = parseAppearance(d.value || '{}');
        applyAppearance(next);
        cacheAppearance(next);
      })
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    Promise.all([
      adminFetch('/api/admin/settings?key=notificationsEnabled').then((r) => r.json()).catch(() => ({})),
      adminFetch('/api/admin/settings?key=notificationSoundUrl').then((r) => r.json()).catch(() => ({})),
      adminFetch(`/api/admin/settings?key=${MOBILE_NAV_SETTING_KEY}`).then((r) => r.json()).catch(() => ({})),
    ]).then(([enabledRes, urlRes, mobileNavRes]) => {
      notifySettingsRef.current = {
        enabled: enabledRes?.value !== 'false',
        url: urlRes?.value || '',
      };
      if (mobileNavRes?.value) setMobileNavSlots(parseMobileNavSlots(mobileNavRes.value));
    });

    const onMobileNav = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (detail) setMobileNavSlots(parseMobileNavSlots(detail));
    };
    window.addEventListener('admin:mobile-nav', onMobileNav);
    return () => window.removeEventListener('admin:mobile-nav', onMobileNav);
  }, []);

  const fetchCounts = useCallback(async () => {
    try {
      const countsRes = await adminFetch('/api/admin/counts');
      if (countsRes.ok) {
        const data = await countsRes.json();
        const next: Counts = {
          newOrders: data.newOrders || 0,
          newInquiries: data.newInquiries || 0,
          newWaitlist: data.newWaitlist || 0,
          newEmails: data.newEmails || 0,
          newReviews: data.newReviews || 0,
        };
        setCounts(next);
        const total = Object.values(next).reduce((s, n) => s + n, 0);
        const { enabled, url } = notifySettingsRef.current;
        if (prevTotalRef.current !== null && total > prevTotalRef.current && enabled && url) {
          new Audio(url).play().catch(() => {});
        }
        prevTotalRef.current = total;
      }
    } catch { /* ignore */ }
  }, []);

  useEffect(() => {
    fetchCounts();
    const interval = setInterval(fetchCounts, 90000);
    const onRefresh = () => { void fetchCounts(); };
    window.addEventListener('admin:counts-refresh', onRefresh);
    return () => {
      clearInterval(interval);
      window.removeEventListener('admin:counts-refresh', onRefresh);
    };
  }, [fetchCounts]);

  useEffect(() => {
    const saved = localStorage.getItem('cms_sidebar_collapsed');
    if (saved === 'true') setCollapsed(true);
  }, []);

  useEffect(() => {
    setMobileOpen(false);
    setMobileSearchOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (typeof document === 'undefined') return;
    document.body.style.overflow = mobileOpen || mobileSearchOpen ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [mobileOpen, mobileSearchOpen]);

  useEffect(() => {
    if (!mobileSearchOpen) return;
    const t = window.setTimeout(() => mobileSearchInputRef.current?.focus(), 50);
    return () => window.clearTimeout(t);
  }, [mobileSearchOpen]);

  const toggleCollapse = () => {
    setCollapsed((prev) => {
      localStorage.setItem('cms_sidebar_collapsed', String(!prev));
      return !prev;
    });
  };

  const isActive = (href: string) => {
    if (href === '/admin') return pathname === '/admin' || pathname === '/admin/analytics';
    return pathname.startsWith(href);
  };

  const handleLogout = async () => {
    await fetch('/api/admin/login', { method: 'DELETE' }).catch(() => undefined);
    localStorage.removeItem('admin_token');
    router.push('/admin/login');
  };

  const getCount = (countKey?: keyof Counts) => (countKey ? counts[countKey] || 0 : 0);

  // Debounced search across the whole admin (every text field)
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!search.trim()) {
      setSearchResults([]);
      setShowResults(false);
      return;
    }
    debounceRef.current = setTimeout(async () => {
      setSearchLoading(true);
      try {
        const res = await adminFetch(`/api/admin/search?q=${encodeURIComponent(search.trim())}`);
        if (res.ok) {
          const data = await res.json();
          setSearchResults(data.results || []);
          setShowResults(true);
        }
      } catch { /* ignore */ } finally {
        setSearchLoading(false);
      }
    }, 220);
  }, [search]);

  const closeMobileSearch = () => {
    setMobileSearchOpen(false);
    setSearch('');
    setSearchResults([]);
    setShowResults(false);
  };

  const openMobileSearch = () => {
    setMobileOpen(false);
    setMobileSearchOpen(true);
  };

  const goSearchResult = (href: string) => {
    closeMobileSearch();
    router.push(href);
  };

  return (
    <>
      <button className="cms-mobile-nav-toggle" onClick={() => setMobileOpen(true)} aria-label="Открыть меню">
        <Icon name="menu" size={18} />
      </button>

      {mobileOpen && <div className="cms-sidebar-backdrop" onClick={() => setMobileOpen(false)} />}

      <aside className={`cms-sidebar ${collapsed ? 'collapsed' : ''} ${mobileOpen ? 'mobile-open' : ''}`}>
        <div className="cms-sidebar-brand">
          {!collapsed && (
            <div className="cms-sidebar-brand-text">
              errani <span>admin</span>
            </div>
          )}
          <button
            className="cms-sidebar-toggle cms-sidebar-iconbox"
            onClick={toggleCollapse}
            data-tooltip={collapsed ? 'Развернуть' : 'Свернуть'}
            data-tooltip-placement={collapsed ? 'right' : 'bottom'}
            aria-label={collapsed ? 'Развернуть' : 'Свернуть'}
          >
            <Icon name={collapsed ? 'right' : 'left'} size={16} />
          </button>
        </div>

        {!collapsed && (
          <div className="cms-sidebar-search" onBlur={() => setTimeout(() => setShowResults(false), 200)}>
            <div style={{ position: 'relative' }}>
              <SearchField
                value={search}
                onChange={setSearch}
                onFocus={() => searchResults.length > 0 && setShowResults(true)}
              />
              {searchLoading && <span className="cms-spinner" style={{ position: 'absolute', right: 12, top: 11, width: 14, height: 14 }} />}
              {showResults && (
                <div className="cms-search-results">
                  {searchResults.length === 0 && !searchLoading && (
                    <div style={{ padding: '8px 10px', fontSize: 12, color: 'var(--cms-text-muted)' }}>Ничего не найдено</div>
                  )}
                  {searchResults.map((r, i) => (
                    <Link
                      key={`${r.type}-${i}`}
                      href={r.href}
                      className="cms-search-result"
                      onClick={() => { setSearch(''); setShowResults(false); }}
                    >
                      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>{r.label}</span>
                      <span className="cms-search-result-sub">{TYPE_LABELS[r.type] || r.type}{r.sub ? ` · ${r.sub}` : ''}</span>
                    </Link>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        <nav className="cms-sidebar-nav">
          {NAV_ITEMS.map((item, i) => {
            if ('section' in item) {
              return <div key={i} style={{ borderTop: '1px solid var(--cms-border)', margin: '6px 12px' }} />;
            }
            const count = getCount(item.countKey);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`cms-nav-item ${isActive(item.href) ? 'active' : ''}`}
                data-tooltip={collapsed ? item.label : undefined}
                data-tooltip-placement="right"
                onClick={() => setMobileOpen(false)}
              >
                <span className="cms-nav-icon"><Icon name={item.icon} size={17} /></span>
                {!collapsed && <span className="cms-nav-label">{item.label}</span>}
                <CountBadge count={count} className="cms-nav-badge" />
              </Link>
            );
          })}
        </nav>

        <div className="cms-sidebar-footer">
          <div className="cms-sidebar-footer-row">
            <Link
              href="/admin/account"
              className={`cms-sidebar-footer-btn${isActive('/admin/account') ? ' active' : ''}`}
              data-tooltip={collapsed ? 'Пользователи' : undefined}
              data-tooltip-placement="right"
              onClick={() => setMobileOpen(false)}
            >
              <Icon name="betaComputer" size={16} />
              {!collapsed && <span>Пользователи</span>}
            </Link>
            <ConfirmPopover
              open={confirmLogout}
              placement="top"
              align="center"
              message="Выйти из админки?"
              confirmLabel="Выйти"
              confirmIcon="logout"
              onConfirm={handleLogout}
              onCancel={() => setConfirmLogout(false)}
              width={210}
            >
              <button
                type="button"
                className="cms-sidebar-footer-btn"
                onClick={() => setConfirmLogout((v) => !v)}
                data-tooltip={collapsed ? 'Выйти' : undefined}
                data-tooltip-placement="right"
                aria-label="Выйти"
              >
                <Icon name="logout" size={16} />
                {!collapsed && <span>Выйти</span>}
              </button>
            </ConfirmPopover>
          </div>
        </div>
      </aside>

      <nav className="cms-mobile-bottom-nav" aria-label="Основная навигация">
        <div className="cms-mobile-bottom-slots">
          {mobileNavItems.map((item) => {
            const count = getCount(item.countKey);
            return (
              <Link
                key={item.id}
                href={item.href}
                className={`cms-mobile-bottom-item ${isActive(item.href) ? 'active' : ''}`}
                aria-current={isActive(item.href) ? 'page' : undefined}
              >
                <span className="cms-mobile-bottom-icon">
                  <Icon name={item.icon} size={20} />
                  <CountBadge count={count} max={9} className="cms-mobile-bottom-badge" />
                </span>
                <span>{item.label}</span>
              </Link>
            );
          })}
        </div>
        <button
          type="button"
          className={`cms-mobile-bottom-item cms-mobile-bottom-search ${mobileSearchOpen ? 'active' : ''}`}
          onClick={openMobileSearch}
          aria-expanded={mobileSearchOpen}
          aria-label="Поиск"
        >
          <span className="cms-mobile-bottom-icon"><Icon name="search" size={20} /></span>
          <span>Поиск</span>
        </button>
      </nav>

      {mobileSearchOpen && (
        <div className="cms-mobile-search-overlay" role="dialog" aria-modal="true" aria-label="Поиск по админке">
          <div className="cms-mobile-search-sheet">
            <div className="cms-mobile-search-bar">
              <Icon name="search" size={16} className="cms-mobile-search-ico" />
              <input
                ref={mobileSearchInputRef}
                className="cms-mobile-search-input"
                type="search"
                enterKeyHint="search"
                autoComplete="off"
                autoCorrect="off"
                spellCheck={false}
                placeholder="Поиск по всей админке…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
              {searchLoading && <span className="cms-spinner cms-mobile-search-spinner" />}
              <button type="button" className="cms-mobile-search-cancel" onClick={closeMobileSearch}>
                Отмена
              </button>
            </div>
            <div className="cms-mobile-search-results">
              {!search.trim() && (
                <div className="cms-mobile-search-hint">Ищем по заказам, товарам, письмам, клиентам и любому тексту в админке</div>
              )}
              {search.trim() && !searchLoading && searchResults.length === 0 && (
                <div className="cms-mobile-search-hint">Ничего не найдено</div>
              )}
              {showResults && searchResults.map((r, i) => (
                <button
                  key={`${r.type}-${i}-${r.href}`}
                  type="button"
                  className="cms-mobile-search-result"
                  onClick={() => goSearchResult(r.href)}
                >
                  <span className="cms-mobile-search-result-label">{r.label}</span>
                  <span className="cms-mobile-search-result-sub">
                    {TYPE_LABELS[r.type] || r.type}{r.sub ? ` · ${r.sub}` : ''}
                  </span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
