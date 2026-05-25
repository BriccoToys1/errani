'use client';

import Link from 'next/link';
import Image from 'next/image';
import { useLanguage } from '@/contexts/LanguageContext';
import { useEffect, useState } from 'react';
import ReviewsStack from '@/components/ReviewsStack';

export default function HomePage() {
  const { lang } = useLanguage();
  const [pgvtPrice, setPgvtPrice] = useState<number | null>(null);

  useEffect(() => {
    fetch('/api/products')
      .then(r => r.json())
      .then((list: Array<{ slug: string; price: number }>) => {
        const pgvt = list.find(p => p.slug === 'pgvt');
        if (pgvt) setPgvtPrice(pgvt.price);
      })
      .catch(() => {});
  }, []);

  const formatPrice = (p: number) => `${p.toLocaleString('ru-RU')} ₽`;

  return (
    <>
      {/* Pink Gothic Vibe Tarot Hero */}
      <main className="preorder-hero">
        <div className="preorder-orb preorder-orb-1" />
        <div className="preorder-orb preorder-orb-2" />

        <div className="preorder-content">
          <div className="preorder-text">
            <h1 className="preorder-title anim-fade-up anim-fade-up-d2">
              <em><span style={{ color: '#ff6eb4' }}>Gothic</span></em><br />
              <span style={{ color: '#ff6eb4' }}>Vibe</span>
            </h1>

            <p className="preorder-spec anim-fade-up anim-fade-up-d2">
              {lang === 'ru' ? '78 карт · Лимитированный тираж' : '78 cards · Limited edition'}
            </p>

            <div className="preorder-badge anim-fade-up anim-fade-up-d3" style={{ background: 'rgba(255,110,180,0.1)', color: '#ff6eb4', borderColor: 'rgba(255,110,180,0.3)' }}>
              {lang === 'ru' ? 'Скоро в предзаказе' : 'Pre-order soon'}
            </div>

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

      {/* Tenderly Vibe Hero */}
      <main className="preorder-hero">
        <div className="preorder-orb preorder-orb-1" />
        <div className="preorder-orb preorder-orb-2" />

        <div className="preorder-content">
          <div className="preorder-text">
            <div className="preorder-eyebrow anim-fade-up">
              {lang === 'ru' ? 'Авторская' : 'Original'}
            </div>

            <h1 className="preorder-title anim-fade-up anim-fade-up-d2">
              <em>Tenderly</em><br />
              <span>Vibe</span>
            </h1>

            <p className="preorder-spec anim-fade-up anim-fade-up-d2">
              {lang === 'ru' ? '78 карт · Лимитированный тираж' : '78 cards · Limited edition'}
            </p>

            <div className="preorder-badge anim-fade-up anim-fade-up-d3" style={{ background: 'rgba(255,255,255,0.06)', color: 'var(--text-secondary)', borderColor: 'rgba(255,255,255,0.12)' }}>
              {lang === 'ru' ? 'Предзаказ закрыт. Скоро в продаже...' : 'Pre-order closed. Coming soon...'}
            </div>

            <div className="preorder-badge anim-fade-up anim-fade-up-d3" style={{ background: 'rgba(255, 180, 0, 0.12)', color: '#ffb400', borderColor: 'rgba(255, 180, 0, 0.35)' }}>
              {lang === 'ru' ? '⚠️ Ориентировочная дата доставок — начало мая' : '⚠️ Estimated delivery — early May'}
            </div>

            <p className="preorder-desc anim-fade-up anim-fade-up-d3">
              {lang === 'ru'
                ? 'Уникальная колода, созданная с любовью — каждая карта несёт особую энергетику и смысл. Станьте одним из первых владельцев.'
                : 'A unique deck crafted with love — every card carries a special energy and meaning. Be one of the first to own it.'}
            </p>

            <div className="preorder-actions anim-fade-up anim-fade-up-d4">
              <Link href="/tenderly-vibe" className="preorder-btn-ghost">
                {lang === 'ru' ? 'Подробнее' : 'Learn more'}
              </Link>
            </div>
          </div>

          <div className="preorder-visual anim-fade-up anim-fade-up-d2">
            <div className="preorder-img-wrap">
              <Image
                src="/media/photo-11.jpeg"
                alt="Tenderly Vibe Tarot"
                fill
                className="preorder-img"
                priority
                sizes="(max-width: 768px) 80vw, 42vw"
                quality={65}
              />
              <div className="preorder-img-overlay" />
            </div>
          </div>
        </div>
      </main>

      <ReviewsStack />
    </>
  );
}
