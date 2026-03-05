'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

export function Header() {
  const pathname = usePathname();
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 40);
    window.addEventListener('scroll', onScroll);
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  // Hide on admin pages
  if (pathname.startsWith('/admin')) return null;

  return (
    <header className={`site-header ${scrolled ? 'scrolled' : ''}`}>
      <Link href="/" className="site-logo">
        errani
      </Link>
    </header>
  );
}
