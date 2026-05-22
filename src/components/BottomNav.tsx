'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { getCart, getCartCount } from '@/lib/cart';
import { LanguageSelector } from './LanguageSelector';
import { useLanguage } from '@/contexts/LanguageContext';
import { t } from '@/lib/i18n';

export function BottomNav() {
  const pathname = usePathname();
  const { lang } = useLanguage();
  const [cartCount, setCartCount] = useState(0);
  const [featuredLink, setFeaturedLink] = useState('/tenderly-vibe');

  useEffect(() => {
    const update = () => setCartCount(getCartCount(getCart()));
    update();
    window.addEventListener('cart-updated', update);
    return () => window.removeEventListener('cart-updated', update);
  }, []);

  // Fetch featured product link from settings
  useEffect(() => {
    fetch('/api/admin/settings?key=featuredProductLink')
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (data?.value) setFeaturedLink(data.value);
      })
      .catch(() => {});
  }, []);

  if (pathname.startsWith('/admin')) return null;

  const navItems = [
    {
      href: '/catalog',
      id: 'catalog',
      label: t(lang, 'nav.catalog'),
      icon: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="7" rx="2"/><rect x="14" y="3" width="7" height="7" rx="2"/><rect x="3" y="14" width="7" height="7" rx="2"/><rect x="14" y="14" width="7" height="7" rx="2"/></svg>,
    },
    {
      href: featuredLink,
      id: 'product',
      label: t(lang, 'nav.product'),
      icon: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>,
    },
    {
      href: '/',
      id: 'home',
      label: t(lang, 'nav.home'),
      icon: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M3 12l9-9 9 9"/><path d="M5 10v9a1 1 0 001 1h4v-5h4v5h4a1 1 0 001-1v-9"/></svg>,
    },
    {
      id: 'lang',
      label: t(lang, 'nav.lang'),
      icon: null,
    },
    {
      href: '/cart',
      id: 'cart',
      label: t(lang, 'nav.cart'),
      icon: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/><path d="M1 1h4l2.68 13.39a2 2 0 002 1.61h9.72a2 2 0 002-1.61L23 6H6"/></svg>,
    },
  ];

  return (
    <nav className="bottom-nav">
      <div className="bottom-nav-pill">
        {navItems.map((item) => {
          if (item.id === 'lang') {
            return (
              <div key="lang" className="bottom-nav-item" data-tooltip={item.label}>
                <LanguageSelector />
              </div>
            );
          }

          const isActive = pathname === item.href;
          return (
            <Link
              key={item.id}
              href={item.href!}
              className={`bottom-nav-item ${isActive ? 'active' : ''}`}
              data-tooltip={item.label}
            >
              <div className="bottom-nav-icon">
                {item.icon}
                {item.id === 'cart' && cartCount > 0 && (
                  <span className="bottom-nav-badge">{cartCount > 9 ? '9+' : cartCount}</span>
                )}
              </div>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
