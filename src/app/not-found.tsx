'use client';

import Link from 'next/link';
import { useLanguage } from '@/contexts/LanguageContext';
import { t } from '@/lib/i18n';

export default function NotFound() {
  const { lang } = useLanguage();

  return (
    <main className="error-page">
      <div className="error-code">404</div>
      <p className="error-text">{t(lang, 'error.title')}</p>
      <Link href="/" className="error-link">
        {t(lang, 'error.back')}
        <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
        </svg>
      </Link>
    </main>
  );
}
