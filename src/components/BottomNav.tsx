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
      icon: <i className="fi fi-rr-apps" style={{ fontSize: 22 }} />,
    },
    {
      href: '/tenderly-vibe',
      id: 'product',
      label: t(lang, 'nav.product'),
      icon: <i className="fi fi-rr-star" style={{ fontSize: 22 }} />,
    },
    {
      href: '/',
      id: 'home',
      label: t(lang, 'nav.home'),
      icon: <i className="fi fi-rr-home" style={{ fontSize: 22 }} />,
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
      icon: <i className="fi fi-rr-shopping-cart" style={{ fontSize: 22 }} />,
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
