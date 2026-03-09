'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useState, useCallback, useEffect } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { t } from '@/lib/i18n';
import { addToCart } from '@/lib/cart';

interface Product {
  id: string;
  slug: string;
  name: string;
  nameRu: string | null;
  description: string;
  descriptionRu: string | null;
  price: number;
  oldPrice: number | null;
  discount: number;
  image: string;
  images: string;
  isPreorder: boolean;
  isLimited: boolean;
  isAuthor: boolean;
}

export function ProductContent({ product }: { product: Product }) {
  const { lang } = useLanguage();
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const [added, setAdded] = useState(false);
  const [showGoToCart, setShowGoToCart] = useState(false);

  const galleryImages: string[] = (() => {
    try { return JSON.parse(product.images) || []; } catch { return []; }
  })();
  const heroImage = product.image || galleryImages[0] || '';
  const allImages = heroImage ? [heroImage, ...galleryImages.filter(img => img !== heroImage)] : galleryImages;

  const openLightbox = (index: number) => setLightboxIndex(index);
  const closeLightbox = () => setLightboxIndex(null);

  const nextImage = useCallback(() => {
    if (lightboxIndex !== null) setLightboxIndex((lightboxIndex + 1) % allImages.length);
  }, [lightboxIndex, allImages.length]);

  const prevImage = useCallback(() => {
    if (lightboxIndex !== null) setLightboxIndex((lightboxIndex - 1 + allImages.length) % allImages.length);
  }, [lightboxIndex, allImages.length]);

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

  const displayName = lang === 'ru' && product.nameRu ? product.nameRu : product.name;
  const displayDesc = lang === 'ru' && product.descriptionRu ? product.descriptionRu : product.description;
  const price = product.price;

  const handleAdd = () => {
    addToCart({
      productId: product.id,
      name: displayName,
      price,
      currency: 'RUB',
      image: heroImage,
      isPreorder: product.isPreorder,
    });
    setAdded(true);
    setShowGoToCart(true);
    setTimeout(() => setAdded(false), 2000);
  };

  return (
    <main>
      {/* Hero */}
      <section className="product-hero">
        <div className="product-image-col">
          {heroImage && (
            <Image
              src={heroImage}
              alt={displayName}
              fill
              className="object-cover"
              sizes="(max-width: 768px) 100vw, 50vw"
              priority
              quality={90}
            />
          )}
        </div>

        <div className="product-info-col">
          {product.isPreorder && (
            <span className="product-preorder-text anim-fade-up">
              {lang === 'ru' ? 'Предзаказ' : 'Pre-order'}
            </span>
          )}
          <h1 className="product-title anim-fade-up anim-fade-up-d1">{displayName}</h1>
          <div className="product-price anim-fade-up anim-fade-up-d3">
            {`${price.toLocaleString('ru-RU')} ₽`}
            {product.oldPrice && (
              <span className="product-old-price">{`${product.oldPrice.toLocaleString('ru-RU')} ₽`}</span>
            )}
          </div>

          <div className="product-actions anim-fade-up anim-fade-up-d4">
            <button
              type="button"
              className={`product-btn ${added ? 'added' : ''}`}
              onClick={handleAdd}
            >
              {added ? t(lang, 'product.added') : t(lang, 'product.addToCart')}
            </button>
            {showGoToCart && (
              <Link href="/cart" className="product-btn-secondary">
                {t(lang, 'product.goToCart')}
              </Link>
            )}
          </div>
        </div>
      </section>

      {/* Description */}
      {displayDesc && (
        <section className="description-section">
          <h2 className="description-heading">{lang === 'ru' ? 'О товаре' : 'About'}</h2>
          <div className="description-content">
            {displayDesc.split('\n').filter(Boolean).map((p, i) => (
              <p key={i}>{p}</p>
            ))}
          </div>
          {product.isLimited && (
            <div className="limited-edition-banner">
              <h3>{t(lang, 'product.limited.title')}</h3>
              <p>{t(lang, 'product.limited.text')}</p>
            </div>
          )}
        </section>
      )}

      {/* Gallery */}
      {allImages.length > 1 && (
        <section className="gallery-section">
          <h2 className="gallery-heading">{lang === 'ru' ? 'Галерея' : 'Gallery'}</h2>
          <div className="gallery-grid">
            {allImages.slice(1).map((src, i) => (
              <div key={i} className="gallery-item" onClick={() => openLightbox(i + 1)}>
                <Image
                  src={src}
                  alt={`${displayName} — ${i + 2}`}
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
      )}

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
              src={allImages[lightboxIndex]}
              alt={`${displayName} — ${lightboxIndex + 1}`}
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
