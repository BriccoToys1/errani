'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useLanguage } from '@/contexts/LanguageContext';
import { t, SPEC_KEYS } from '@/lib/i18n';
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

      {/* Specifications */}
      <section className="specs-section">
        <h2 className="specs-heading">{t(lang, 'product.specs')}</h2>
        <table className="specs-table">
          <tbody>
            {SPEC_KEYS.map((key) => (
              <tr key={key}>
                <td>{t(lang, key)}</td>
                <td>{t(lang, `${key}.value`)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      {/* Gallery */}
      <section className="gallery-section">
        <div className="gallery-grid">
          {GALLERY_IMAGES.map((src, i) => (
            <div key={i} className="gallery-item">
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
