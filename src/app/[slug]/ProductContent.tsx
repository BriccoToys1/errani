'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useState, useCallback, useEffect } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { t } from '@/lib/i18n';
import { addToCart, getCart } from '@/lib/cart';

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
  limitedEditionText: string;
  isAuthor: boolean;
  characteristics: string;
}

export function ProductContent({ product }: { product: Product }) {
  const { lang } = useLanguage();
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const [carouselIndex, setCarouselIndex] = useState(0);
  const [inCart, setInCart] = useState(false);

  // Check if product is already in cart on mount
  useEffect(() => {
    const cart = getCart();
    if (cart.some(item => item.productId === product.id)) {
      setInCart(true);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [product.id]);

  const galleryImages: string[] = (() => {
    try { return JSON.parse(product.images) || []; } catch { return []; }
  })();
  const heroImage = product.image || galleryImages[0] || '';
  const allImages = heroImage ? [heroImage, ...galleryImages.filter(img => img !== heroImage)] : galleryImages;

  const openLightbox = (index: number) => setLightboxIndex(index);
  const closeLightbox = () => setLightboxIndex(null);

  const nextLightbox = useCallback(() => {
    if (lightboxIndex !== null) setLightboxIndex((lightboxIndex + 1) % allImages.length);
  }, [lightboxIndex, allImages.length]);

  const prevLightbox = useCallback(() => {
    if (lightboxIndex !== null) setLightboxIndex((lightboxIndex - 1 + allImages.length) % allImages.length);
  }, [lightboxIndex, allImages.length]);

  useEffect(() => {
    if (lightboxIndex === null) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeLightbox();
      if (e.key === 'ArrowRight') nextLightbox();
      if (e.key === 'ArrowLeft') prevLightbox();
    };
    document.addEventListener('keydown', handleKeyDown);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = '';
    };
  }, [lightboxIndex, nextLightbox, prevLightbox]);

  const displayName = lang === 'ru'
    ? (product.nameRu || product.name)
    : (product.name || product.nameRu || '');
  const displayDesc = lang === 'ru'
    ? (product.descriptionRu || product.description)
    : (product.description || product.descriptionRu || '');
  const price = product.price;

  const characteristics: Array<{ key: string; keyEn?: string; value: string; valueEn?: string }> = (() => {
    try { return JSON.parse(product.characteristics || '[]'); } catch { return []; }
  })();

  const handleAddOrGoToCart = () => {
    if (inCart) {
      window.location.href = '/cart';
      return;
    }
    addToCart({
      productId: product.id,
      name: displayName,
      price,
      currency: 'RUB',
      image: heroImage,
      isPreorder: product.isPreorder,
    });
    setInCart(true);
  };

  const carouselPrev = () => setCarouselIndex((carouselIndex - 1 + allImages.length) % allImages.length);
  const carouselNext = () => setCarouselIndex((carouselIndex + 1) % allImages.length);

  return (
    <main>
      {/* Hero: Carousel + Info */}
      <section className="product-hero">
        <div className="product-image-col">
          {allImages.length > 0 && (
            <div className="product-carousel">
              <Image
                src={allImages[carouselIndex]}
                alt={displayName}
                fill
                className="object-contain"
                sizes="(max-width: 768px) 100vw, 50vw"
                priority
                quality={90}
                onClick={() => openLightbox(carouselIndex)}
                style={{ cursor: 'zoom-in' }}
              />
              {allImages.length > 1 && (
                <>
                  <button className="carousel-nav prev" onClick={carouselPrev} aria-label="Предыдущее">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <polyline points="15 18 9 12 15 6" />
                    </svg>
                  </button>
                  <button className="carousel-nav next" onClick={carouselNext} aria-label="Следующее">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <polyline points="9 18 15 12 9 6" />
                    </svg>
                  </button>
                  <div className="carousel-dots">
                    {allImages.map((_, i) => (
                      <button
                        key={i}
                        className={`carousel-dot ${i === carouselIndex ? 'active' : ''}`}
                        onClick={() => setCarouselIndex(i)}
                        aria-label={`Фото ${i + 1}`}
                      />
                    ))}
                  </div>
                </>
              )}
            </div>
          )}
        </div>

        <div className="product-info-col">
          {/* Categories/badges */}
          <div className="product-badges anim-fade-up">
            {product.isAuthor && (
              <span className="product-badge product-badge-author">
                <i className="fi fi-rr-thumbtack" style={{ fontSize: 10, marginRight: 4 }} />
                {lang === 'ru' ? 'Авторская колода' : 'Author deck'}
              </span>
            )}
            {product.isPreorder && (
              <span className="product-badge product-badge-preorder">
                {lang === 'ru' ? 'ПРЕДЗАКАЗ' : 'PRE-ORDER'}
              </span>
            )}
          </div>

          <h1 className="product-title anim-fade-up anim-fade-up-d1">{displayName}</h1>

          <div className="product-price anim-fade-up anim-fade-up-d3">
            <span className="product-current-price">{`${price.toLocaleString('ru-RU')} ₽`}</span>
            {product.oldPrice && (
              <span className="product-old-price">{`${product.oldPrice.toLocaleString('ru-RU')} ₽`}</span>
            )}
            {product.discount > 0 && (
              <span className="product-discount-badge">-{product.discount}%</span>
            )}
          </div>

          {/* Single add-to-cart / go-to-cart button */}
          <div className="product-actions anim-fade-up anim-fade-up-d4">
            <button
              type="button"
              className={`product-btn ${inCart ? 'in-cart' : ''}`}
              onClick={handleAddOrGoToCart}
            >
              {inCart ? t(lang, 'product.goToCart') : t(lang, 'product.addToCart')}
            </button>
          </div>
        </div>
      </section>

      {/* About / Description */}
      {displayDesc && (
        <section className="description-section">
          <h2 className="description-heading">
            {lang === 'ru' ? 'О колоде' : 'About the deck'}
          </h2>
          <div className="description-content">
            {displayDesc.split('\n').filter(Boolean).map((p, i) => (
              <p key={i}>{p}</p>
            ))}
          </div>

          {/* Limited edition banner */}
          {product.isLimited && (
            <div className="limited-edition-banner">
              <h3>{t(lang, 'product.limited.title')}</h3>
              <p>{product.limitedEditionText || t(lang, 'product.limited.text')}</p>
            </div>
          )}
        </section>
      )}

      {/* Characteristics — shown regardless of whether description exists */}
      {characteristics.length > 0 && (
        <section className="description-section" style={{ paddingTop: '3rem' }}>
          <h2 className="description-heading" style={{ fontSize: '0.85rem', fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase' }}>
            {lang === 'ru' ? 'Характеристики' : 'Specifications'}
          </h2>
          <div style={{ display: 'grid', gap: '0' }}>
            {characteristics.map((c, i) => (
              <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '0.6rem 0', borderBottom: '1px solid rgba(255,255,255,0.06)', fontSize: '0.9rem' }}>
                <span style={{ color: 'var(--text-secondary)' }}>{lang === 'en' && c.keyEn ? c.keyEn : c.key}</span>
                <span style={{ color: 'var(--text-primary)', fontWeight: 500, textAlign: 'right' }}>{lang === 'en' && c.valueEn ? c.valueEn : c.value}</span>
              </div>
            ))}
          </div>
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
            <button className="lightbox-nav prev" onClick={prevLightbox}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polyline points="15 18 9 12 15 6" />
              </svg>
            </button>
            <img
              src={allImages[lightboxIndex]}
              alt={`${displayName} — ${lightboxIndex + 1}`}
              className="lightbox-image"
            />
            <button className="lightbox-nav next" onClick={nextLightbox}>
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
