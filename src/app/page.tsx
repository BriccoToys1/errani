'use client';

import Link from 'next/link';
import Image from 'next/image';
import Script from 'next/script';
import { createElement } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';

function HeroModel({ className, src }: { className: string; src: string }) {
  return createElement('model-viewer', {
    class: className,
    src,
    'camera-controls': true,
    'camera-orbit': '0deg 90deg auto',
    'min-camera-orbit': 'auto 90deg auto',
    'max-camera-orbit': 'auto 90deg auto',
    'auto-rotate': true,
    'auto-rotate-delay': '0',
    'rotation-per-second': '18deg',
    'disable-zoom': true,
    'disable-pan': true,
    'interaction-prompt': 'none',
    exposure: '1',
    'shadow-intensity': '0',
    loading: 'eager',
    reveal: 'auto',
  });
}

export default function HomePage() {
  const { lang } = useLanguage();

  return (
    <>
      <Script
        type="module"
        src="/vendor/model-viewer.min.js"
        strategy="lazyOnload"
      />

      {/* Full-bleed welcome hero */}
      <main className="home-hero-full">
        <div className="home-hero-full-bg">
          <Image
            src="/api/media/438ddc5a-a49c-4039-8c2a-efd52a8b64c1"
            alt="Errani"
            fill
            priority
            sizes="100vw"
            quality={85}
            className="home-hero-full-img"
          />
          <div className="home-hero-full-overlay" />
        </div>

        <div className="home-hero-model-top-wrap" aria-hidden="true">
          <HeroModel className="home-hero-model home-hero-model-top" src="/3D/base%201.glb" />
        </div>

        <div className="home-hero-full-content anim-fade-up anim-fade-up-d2">
          <h1 className="home-hero-full-title">
            {lang === 'ru' ? 'Здесь начинается путешествие' : 'Here begins the journey'}
          </h1>

          <div className="home-hero-full-actions">
            <Link href="/catalog" className="preorder-btn-primary home-hero-shop-btn">
              {lang === 'ru' ? 'В каталог' : 'Shop'}
            </Link>
          </div>
        </div>
      </main>

      <section className="home-hero-features-wrap">
        <div className="home-hero-features" aria-label={lang === 'ru' ? 'Преимущества' : 'Benefits'}>
          <article className="home-hero-feature">
            <span className="home-hero-feature-icon" aria-hidden="true">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d="m12 3 2.8 5.7 6.2.9-4.5 4.4 1.1 6.2-5.6-2.9-5.6 2.9 1.1-6.2L3 9.6l6.2-.9z"/>
              </svg>
            </span>
            <span>{lang === 'ru' ? 'Лимитированная авторская коллекция' : 'Limited artist collection'}</span>
          </article>
          <article className="home-hero-feature">
            <span className="home-hero-feature-icon" aria-hidden="true">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8l1.1 1.1L12 21l7.8-7.5 1.1-1.1a5.5 5.5 0 0 0-.1-7.8z"/>
              </svg>
            </span>
            <span>{lang === 'ru' ? 'Сделано с любовью' : 'Made with love'}</span>
          </article>
          <article className="home-hero-feature">
            <span className="home-hero-feature-icon" aria-hidden="true">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d="M3 6h11v10H3z"/><path d="M14 9h4l3 3v4h-7z"/><circle cx="7" cy="18" r="2"/><circle cx="18" cy="18" r="2"/>
              </svg>
            </span>
            <span>{lang === 'ru' ? 'Доставка по всему миру' : 'Worldwide delivery'}</span>
          </article>
        </div>
      </section>
    </>
  );
}
