'use client';

import Link from 'next/link';
import { useLanguage } from '@/contexts/LanguageContext';
import { t } from '@/lib/i18n';

export default function HomePage() {
  const { lang } = useLanguage();

  return (
    <main className="home-hero">
      {/* Animated 3D gear decoration (from /public/3d_models/technical_works) */}
      <div className="home-3d-icon" aria-hidden="true">
        <svg viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path fillRule="evenodd" clipRule="evenodd" fill="currentColor" d="M43.5 5.5a6.5 6.5 0 0 1 13 0v4.6a34.5 34.5 0 0 1 9.8 4.1l3.3-3.3a6.5 6.5 0 0 1 9.2 9.2l-3.3 3.3a34.5 34.5 0 0 1 4.1 9.8h4.6a6.5 6.5 0 0 1 0 13h-4.6a34.5 34.5 0 0 1-4.1 9.8l3.3 3.3a6.5 6.5 0 0 1-9.2 9.2l-3.3-3.3a34.5 34.5 0 0 1-9.8 4.1v4.6a6.5 6.5 0 0 1-13 0v-4.6a34.5 34.5 0 0 1-9.8-4.1l-3.3 3.3a6.5 6.5 0 0 1-9.2-9.2l3.3-3.3a34.5 34.5 0 0 1-4.1-9.8H5.5a6.5 6.5 0 0 1 0-13h4.6a34.5 34.5 0 0 1 4.1-9.8l-3.3-3.3a6.5 6.5 0 0 1 9.2-9.2l3.3 3.3a34.5 34.5 0 0 1 9.8-4.1V5.5zM50 65a15 15 0 1 0 0-30 15 15 0 0 0 0 30z" />
        </svg>
      </div>
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
