'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useState, useCallback, useEffect } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { t } from '@/lib/i18n';
import { AddToCartSection } from './AddToCartSection';

const GALLERY_IMAGES = [
  '/media/photo-1.jpeg',
  '/media/photo-2.jpeg',
  '/media/photo-3.jpeg',
  '/media/photo-9.jpeg',
  '/media/photo-10.jpeg',
  '/media/photo-8.jpeg',
];

export function TenderlyVibeContent() {
  const { lang } = useLanguage();
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);

  const openLightbox = (index: number) => setLightboxIndex(index);
  const closeLightbox = () => setLightboxIndex(null);

  const nextImage = useCallback(() => {
    if (lightboxIndex !== null) {
      setLightboxIndex((lightboxIndex + 1) % GALLERY_IMAGES.length);
    }
  }, [lightboxIndex]);

  const prevImage = useCallback(() => {
    if (lightboxIndex !== null) {
      setLightboxIndex((lightboxIndex - 1 + GALLERY_IMAGES.length) % GALLERY_IMAGES.length);
    }
  }, [lightboxIndex]);

  // Keyboard navigation
  useEffect(() => {
    if (lightboxIndex === null) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeLightbox();
      if (e.key === 'ArrowRight') nextImage();
      if (e.key === 'ArrowLeft') prevImage();
    };
    document.addEventListener('keydown', handleKeyDown);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = '';
    };
  }, [lightboxIndex, nextImage, prevImage]);

  return (
    <main>
      {/* Hero: Image + Info */}
      <section className="product-hero">
        <div className="product-image-col">
          <Image
            src="/media/photo-11.jpeg"
            alt="Tenderly Vibe — Авторская колода Таро"
            fill
            className="object-cover"
            sizes="(max-width: 768px) 100vw, 50vw"
            priority
            quality={90}
          />
        </div>

        <div className="product-info-col">
          <span className="product-label-badge anim-fade-up">{t(lang, 'product.badge')}</span>
          <h1 className="product-title anim-fade-up anim-fade-up-d1">
            {t(lang, 'product.title')}
          </h1>
          <p className="product-subtitle anim-fade-up anim-fade-up-d2">
            {t(lang, 'product.subtitle')}
          </p>
          <div className="product-price anim-fade-up anim-fade-up-d3">
            {t(lang, 'product.price')}
          </div>

          <AddToCartSection />
        </div>
      </section>

      {/* Description */}
      <section className="description-section">
        <h2 className="description-heading">{t(lang, 'product.description.title')}</h2>
        <div className="description-content">
          <p>{t(lang, 'product.description.p1')}</p>
          <p>{t(lang, 'product.description.p2')}</p>
          <p>{t(lang, 'product.description.p3')}</p>
          <p className="description-note">{t(lang, 'product.description.p4')}</p>
        </div>
        <div className="limited-edition-banner">
          <h3>{t(lang, 'product.limited.title')}</h3>
          <p>{t(lang, 'product.limited.text')}</p>
        </div>
      </section>



      {/* Gallery */}
      <section className="gallery-section">
        <h2 className="gallery-heading">{lang === 'ru' ? 'Галерея' : 'Gallery'}</h2>
        <div className="gallery-grid">
          {GALLERY_IMAGES.map((src, i) => (
            <div key={i} className="gallery-item" onClick={() => openLightbox(i)}>
              <Image
                src={src}
                alt={`Tenderly Vibe — ${i + 1}`}
                fill
                className="object-cover"
                sizes="(max-width: 768px) 50vw, 33vw"
                loading="lazy"
                quality={85}
              />
            </div>
          ))}
        </div>
      </section>

      {/* Lightbox */}
      {lightboxIndex !== null && (
        <div className="lightbox-overlay" onClick={closeLightbox}>
          <div className="lightbox-content" onClick={(e) => e.stopPropagation()}>
            <button className="lightbox-close" onClick={closeLightbox}>&times;</button>
            <button className="lightbox-nav prev" onClick={prevImage}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polyline points="15 18 9 12 15 6" />
              </svg>
            </button>
            <img
              src={GALLERY_IMAGES[lightboxIndex]}
              alt={`Tenderly Vibe — ${lightboxIndex + 1}`}
              className="lightbox-image"
            />
            <button className="lightbox-nav next" onClick={nextImage}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polyline points="9 18 15 12 9 6" />
              </svg>
            </button>
          </div>
        </div>
      )}

      {/* Back to catalog */}
      <div style={{ textAlign: 'center', padding: '3rem 1rem 6rem' }}>
        <Link
          href="/catalog"
          style={{
            fontSize: '0.75rem',
            fontWeight: 600,
            letterSpacing: '0.2em',
            textTransform: 'uppercase' as const,
            color: 'var(--text-secondary)',
            transition: 'color 0.3s',
          }}
        >
          {t(lang, 'product.backToCatalog')}
        </Link>
      </div>
    </main>
  );
}
