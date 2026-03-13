'use client';

import Link from 'next/link';
import Image from 'next/image';
import { useLanguage } from '@/contexts/LanguageContext';
import { useEffect, useState } from 'react';

export default function HomePage() {
  const { lang } = useLanguage();
  const [price, setPrice] = useState<number | null>(null);

  useEffect(() => {
    fetch('/api/products')
      .then(r => r.json())
      .then((list: Array<{ slug: string; price: number }>) => {
        const tv = list.find(p => p.slug === 'tenderly-vibe');
        if (tv) setPrice(tv.price);
      })
      .catch(() => {});
  }, []);

  const formatPrice = (p: number) => `${p.toLocaleString('ru-RU')} ₽`;

  return (
    <main className="preorder-hero">
      {/* Ambient glow orbs */}
      <div className="preorder-orb preorder-orb-1" />
      <div className="preorder-orb preorder-orb-2" />

      <div className="preorder-content">
        {/* ── Text Column ── */}
        <div className="preorder-text">
          <div className="preorder-eyebrow anim-fade-up">
            {lang === 'ru' ? 'Авторская колода Таро' : 'Original Tarot Deck'}
          </div>

          <h1 className="preorder-title anim-fade-up anim-fade-up-d2">
            <em>Tenderly</em><br />
            <span>Vibe</span>
          </h1>

          <div className="preorder-badge anim-fade-up anim-fade-up-d3">
            {lang === 'ru' ? 'Предзаказ открыт' : 'Pre-order open'}
          </div>

          <p className="preorder-desc anim-fade-up anim-fade-up-d3">
            {lang === 'ru'
              ? 'Уникальная колода, созданная с любовью — каждая карта несёт особую энергетику и смысл. Станьте одним из первых владельцев.'
              : 'A unique deck crafted with love — every card carries a special energy and meaning. Be one of the first to own it.'}
          </p>

          {price !== null && (
            <div className="preorder-price anim-fade-up anim-fade-up-d3">
              {formatPrice(price)}
            </div>
          )}

          <div className="preorder-actions anim-fade-up anim-fade-up-d4">
            <Link href="/tenderly-vibe" className="preorder-btn-primary">
              {lang === 'ru' ? 'Оформить предзаказ' : 'Pre-order now'}
              <svg width="15" height="15" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M17 8l4 4m0 0l-4 4m4-4H3" />
              </svg>
            </Link>
            <Link href="/tenderly-vibe" className="preorder-btn-ghost">
              {lang === 'ru' ? 'Подробнее' : 'Learn more'}
            </Link>
          </div>
        </div>

        {/* ── Image Column ── */}
        <div className="preorder-visual anim-fade-up anim-fade-up-d2">
          <div className="preorder-img-wrap">
            <Image
              src="/media/photo-11.jpeg"
              alt="Tenderly Vibe Tarot"
              fill
              className="preorder-img"
              priority
              sizes="(max-width: 768px) 80vw, 42vw"
            />
            <div className="preorder-img-overlay" />
          </div>
        </div>
      </div>

      {/* Scroll indicator */}
      <div className="preorder-scroll">
        <div className="preorder-scroll-line" />
      </div>
    </main>
  );
}
