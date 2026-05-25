'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { HeaderScroll } from './HeaderScroll';

export function Header() {
  const pathname = usePathname();
  if (pathname?.startsWith('/admin') || pathname?.startsWith('/review')) return null;

  return (
    <header className="site-header" id="site-header">
      <Link href="/" className="site-logo">
        errani
      </Link>
      <HeaderScroll />
    </header>
  );
}
