'use client';

import Link from 'next/link';
import { useLanguage } from '@/contexts/LanguageContext';
import { t } from '@/lib/i18n';

export default function HomePage() {
  const { lang } = useLanguage();

  return (
    <main className="home-hero">
      {/* Divider */}
      <div className="home-divider anim-line-reveal" />

      {/* Main Text */}
      <h1 className="home-display anim-fade-up anim-fade-up-d2">
        {t(lang, 'home.title')}
      </h1>

      {/* Subtitle */}
      <p className="home-sub anim-fade-up anim-fade-up-d3">
        {t(lang, 'home.subtitle')}
      </p>

      {/* CTA */}
      <Link href="/tenderly-vibe" className="home-cta home-cta-orange anim-fade-up anim-fade-up-d4">
        {t(lang, 'home.cta')}
        <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
        </svg>
      </Link>
    </main>
  );
}
