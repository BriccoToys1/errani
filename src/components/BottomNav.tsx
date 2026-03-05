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

  useEffect(() => {
    const update = () => setCartCount(getCartCount(getCart()));
    update();
    window.addEventListener('cart-updated', update);
    return () => window.removeEventListener('cart-updated', update);
  }, []);

  if (pathname.startsWith('/admin')) return null;

  const navItems = [
    {
      href: '/catalog',
      id: 'catalog',
      label: t(lang, 'nav.catalog'),
      icon: (
        <svg width="24" height="24" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <rect x="3" y="3" width="7" height="7" rx="1.5" strokeWidth={1.5} />
          <rect x="14" y="3" width="7" height="7" rx="1.5" strokeWidth={1.5} />
          <rect x="3" y="14" width="7" height="7" rx="1.5" strokeWidth={1.5} />
          <rect x="14" y="14" width="7" height="7" rx="1.5" strokeWidth={1.5} />
        </svg>
      ),
    },
    {
      href: '/tenderly-vibe',
      id: 'product',
      label: t(lang, 'nav.product'),
      icon: (
        <svg width="24" height="24" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
        </svg>
      ),
    },
    {
      href: '/',
      id: 'home',
      label: t(lang, 'nav.home'),
      icon: (
        <svg width="24" height="24" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-4 0a1 1 0 01-1-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 01-1 1h-2z" />
        </svg>
      ),
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
      icon: (
        <svg width="24" height="24" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 100 4 2 2 0 000-4z" />
        </svg>
      ),
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
