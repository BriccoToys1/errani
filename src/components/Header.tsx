import Link from 'next/link';
import { HeaderScroll } from './HeaderScroll';

export function Header() {
  return (
    <header className="site-header" id="site-header">
      <Link href="/" className="site-logo">
        errani
      </Link>
      <HeaderScroll />
    </header>
  );
}
