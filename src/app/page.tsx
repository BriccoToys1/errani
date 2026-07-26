'use client';

import Link from 'next/link';
import Image from 'next/image';
import { useLanguage } from '@/contexts/LanguageContext';
import { useEffect, useState } from 'react';
export default function HomePage() {
  const { lang } = useLanguage();
  const [pgvtPrice, setPgvtPrice] = useState<number | null>(null);

  useEffect(() => {
    fetch('/api/products')
      .then(r => r.json())
      .then((list: Array<{ slug: string; price: number }>) => {
        const pgvt = list.find(p => p.slug === 'gothic-vibe-tarot' || p.slug === 'pgvt');
        if (pgvt) setPgvtPrice(pgvt.price);
      })
      .catch(() => {});
  }, []);

  const formatPrice = (p: number) => `${p.toLocaleString('ru-RU')} ₽`;

  return (
    <>
      {/* Pink Gothic Vibe Tarot Hero */}
      <main className="preorder-hero">
        <div className="preorder-content">
          <div className="preorder-text">
            <h1 className="preorder-title anim-fade-up anim-fade-up-d2">
              <em><span style={{ color: '#ff6eb4' }}>Gothic</span></em><br />
              <span style={{ color: '#ff6eb4' }}>Vibe</span>
            </h1>

            <p className="preorder-desc anim-fade-up anim-fade-up-d3">
              {lang === 'ru'
                ? 'Тёмная романтика и нежная эстетика в одной колоде. Погрузись в мир готической нежности.'
                : 'Dark romance and tender aesthetics in one deck. Immerse yourself in the world of gothic tenderness.'}
            </p>

            {pgvtPrice !== null && (
              <div className="preorder-price anim-fade-up anim-fade-up-d3">
                {formatPrice(pgvtPrice)}
              </div>
            )}

            <div className="preorder-actions anim-fade-up anim-fade-up-d4">
              <Link href="/gothic-vibe-tarot" className="preorder-btn-primary preorder-btn-pink">
                {lang === 'ru' ? 'Предзаказ' : 'Pre-order'}
              </Link>
            </div>
          </div>

          <div className="preorder-visual anim-fade-up anim-fade-up-d2">
            <div className="preorder-img-wrap">
              <Image
                src="/media/PRIESTESS.jpg"
                alt="Pink Gothic Vibe Tarot"
                fill
                className="preorder-img"
                priority
                sizes="(max-width: 768px) 80vw, 42vw"
                quality={85}
              />
              <div className="preorder-img-overlay" />
            </div>
          </div>
        </div>
      </main>

      <section className="home-feature-tabs" aria-label={lang === 'ru' ? 'Преимущества' : 'Benefits'}>
        <article className="home-feature-tab">
          <span className="home-feature-icon" aria-hidden="true">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 6h11v10H3z"/><path d="M14 9h4l3 3v4h-7z"/><circle cx="7" cy="18" r="2"/><circle cx="18" cy="18" r="2"/>
            </svg>
          </span>
          <span>{lang === 'ru' ? 'Доставка по всему миру' : 'Worldwide delivery'}</span>
        </article>
        <article className="home-feature-tab">
          <span className="home-feature-icon" aria-hidden="true">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="m12 3 2.8 5.7 6.2.9-4.5 4.4 1.1 6.2-5.6-2.9-5.6 2.9 1.1-6.2L3 9.6l6.2-.9z"/>
            </svg>
          </span>
          <span>{lang === 'ru' ? 'Лимитированная авторская коллекция' : 'Limited original collection'}</span>
        </article>
        <article className="home-feature-tab">
          <span className="home-feature-icon" aria-hidden="true">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8l1.1 1.1L12 21l7.8-7.5 1.1-1.1a5.5 5.5 0 0 0-.1-7.8z"/>
            </svg>
          </span>
          <span>{lang === 'ru' ? 'Сделано с любовью' : 'Made with love'}</span>
        </article>
      </section>

    </>
  );
}
