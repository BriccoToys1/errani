'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useLanguage } from '@/contexts/LanguageContext';

export function Footer() {
  const pathname = usePathname();
  const { lang } = useLanguage();
  const year = new Date().getFullYear();

  // Hide footer on admin pages
  if (pathname.startsWith('/admin')) return null;

  return (
    <footer className="site-footer">
      <div className="footer-inner">
        <div className="footer-brand">errani</div>

        {/* Socials */}
        <div className="footer-socials">
          {/* Telegram */}
          <a href="https://t.me/+QaqnQwrobGBlNjE6" target="_blank" rel="noopener noreferrer" aria-label="Telegram">
            <svg width="18" height="18" fill="currentColor" viewBox="0 0 24 24">
              <path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z" />
            </svg>
          </a>

          {/* Pinterest */}
          <a href="https://pin.it/2cpn1BlYo" target="_blank" rel="noopener noreferrer" aria-label="Pinterest">
            <svg width="18" height="18" fill="currentColor" viewBox="0 0 24 24">
              <path d="M12 0C5.373 0 0 5.373 0 12c0 5.084 3.163 9.426 7.627 11.174-.105-.949-.2-2.405.042-3.441.218-.937 1.407-5.965 1.407-5.965s-.359-.719-.359-1.782c0-1.668.967-2.914 2.171-2.914 1.023 0 1.518.769 1.518 1.69 0 1.029-.655 2.568-.994 3.995-.283 1.194.599 2.169 1.777 2.169 2.133 0 3.772-2.249 3.772-5.495 0-2.873-2.064-4.882-5.012-4.882-3.414 0-5.418 2.561-5.418 5.207 0 1.031.397 2.138.893 2.738a.36.36 0 0 1 .083.345l-.333 1.36c-.053.22-.174.267-.402.161-1.499-.698-2.436-2.889-2.436-4.649 0-3.785 2.75-7.262 7.929-7.262 4.163 0 7.398 2.967 7.398 6.931 0 4.136-2.607 7.464-6.227 7.464-1.216 0-2.359-.632-2.75-1.378l-.748 2.853c-.271 1.043-1.002 2.35-1.492 3.146C9.57 23.812 10.763 24 12 24c6.627 0 12-5.373 12-12S18.627 0 12 0z" />
            </svg>
          </a>

          {/* YouTube */}
          <a href="https://youtube.com/@katyerrani?si=6Xsl-8be139_Qe9G" target="_blank" rel="noopener noreferrer" aria-label="YouTube">
            <svg width="18" height="18" fill="currentColor" viewBox="0 0 24 24">
              <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" />
            </svg>
          </a>

          {/* Email */}
          <a href="mailto:mail@errani.ru" aria-label="Email">
            <svg width="18" height="18" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
            </svg>
          </a>
        </div>

        {/* Legal + copyright */}
        <div style={{ textAlign: 'center' }}>
          <p className="footer-copy">&copy; {year} errani. {lang === 'ru' ? 'Все права защищены.' : 'All rights reserved.'}</p>
          <div style={{ display: 'flex', gap: '1.25rem', marginTop: '0.5rem', justifyContent: 'center', flexWrap: 'wrap' }}>
            <Link href="/oferta" style={{ fontSize: '0.72rem', color: 'var(--text-muted)', textDecoration: 'underline', letterSpacing: 0 }}>
              {lang === 'ru' ? 'Публичная оферта' : 'Public Offer'}
            </Link>
            <Link href="/privacy" style={{ fontSize: '0.72rem', color: 'var(--text-muted)', textDecoration: 'underline', letterSpacing: 0 }}>
              {lang === 'ru' ? 'Политика конфиденциальности' : 'Privacy Policy'}
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
