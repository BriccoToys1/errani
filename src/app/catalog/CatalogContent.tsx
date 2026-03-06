'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useLanguage } from '@/contexts/LanguageContext';
import { t } from '@/lib/i18n';

export function CatalogContent() {
  const { lang } = useLanguage();

  return (
    <main>
      <section className="catalog-section">
        <h1 className="catalog-heading anim-fade-up">{t(lang, 'catalog.title')}</h1>

        <Link href="/tenderly-vibe" className="catalog-card anim-fade-up anim-fade-up-d1">
          <div className="catalog-card-image">
            <Image
              src="/media/photo-4.jpeg"
              alt="Tenderly Vibe"
              fill
              className="object-cover"
              sizes="130px"
              quality={85}
              priority
            />
          </div>
          <div className="catalog-card-info">
            <span className="catalog-card-label">{t(lang, 'catalog.preorder')}</span>
            <h2 className="catalog-card-title">Tenderly Vibe</h2>
            <p className="catalog-card-desc">
              {t(lang, 'product.subtitle')}
            </p>
            <div className="catalog-card-price">{t(lang, 'product.price')}</div>
            <span className="catalog-card-link">
              {t(lang, 'catalog.view')}
              <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
              </svg>
            </span>
          </div>
        </Link>
      </section>
    </main>
  );
}
