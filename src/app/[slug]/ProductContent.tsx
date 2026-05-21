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
  shippingFee?: number;
  shippingConditions?: string;
  oldPrice: number | null;
  discount: number;
  image: string;
  images: string;
  inStock: boolean;
  isPreorder: boolean;
  preorderClosed?: boolean;
  preorderAvailableDate?: string | null;
  isLimited: boolean;
  limitedEditionText: string;
  limitedEditionTextEn?: string;
  noticeText?: string;
  noticeTextEn?: string;
  isAuthor: boolean;
  characteristics: string;
  colors?: string;
}

interface PublicReview {
  id: string;
  customerName: string;
  rating: number;
  text: string;
  media: string[];
  approvedAt?: string;
  createdAt?: string;
}

export function ProductContent({ product }: { product: Product }) {
  const { lang } = useLanguage();
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const [carouselIndex, setCarouselIndex] = useState(0);
  const [inCart, setInCart] = useState(false);
  const [selectedColor, setSelectedColor] = useState<string>('');
  const [colorOverrideImage, setColorOverrideImage] = useState<string | null>(null);
  const [showWaitlistModal, setShowWaitlistModal] = useState(false);
  const [waitlistName, setWaitlistName] = useState('');
  const [waitlistEmail, setWaitlistEmail] = useState('');
  const [waitlistConsent, setWaitlistConsent] = useState(false);
  const [waitlistLoading, setWaitlistLoading] = useState(false);
  const [waitlistSuccess, setWaitlistSuccess] = useState('');
  const [waitlistError, setWaitlistError] = useState('');
  const [reviews, setReviews] = useState<PublicReview[]>([]);
  const [reviewsLoading, setReviewsLoading] = useState(true);

  // Check if product is already in cart on mount / when selectedColor changes
  useEffect(() => {
    const cart = getCart();
    if (cart.some(item => item.productId === product.id && (item.selectedColor || '') === (selectedColor || ''))) {
      setInCart(true);
    } else {
      setInCart(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [product.id, selectedColor]);

  const galleryImages: string[] = (() => {
    try { return JSON.parse(product.images) || []; } catch { return []; }
  })();
  const heroImage = product.image || galleryImages[0] || '';
  const allImages = heroImage ? [heroImage, ...galleryImages.filter(img => img !== heroImage)] : galleryImages;
  const displayedImage = colorOverrideImage || allImages[carouselIndex] || '';

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
  const canJoinWaitlist = !product.inStock && !product.isPreorder;
  const noticeText = lang === 'ru'
    ? (product.noticeText || '')
    : (product.noticeTextEn || product.noticeText || '');

  const formatPreorderDate = (dateStr: string) => {
    const d = new Date(dateStr);
    const day = d.getDate().toString().padStart(2, '0');
    const month = (d.getMonth() + 1).toString().padStart(2, '0');
    return `${day}.${month}`;
  };

  const characteristics: Array<{ key: string; keyEn?: string; value: string; valueEn?: string }> = (() => {
    try { return JSON.parse(product.characteristics || '[]'); } catch { return []; }
  })();

  const colorOptions: Array<{name: string; nameEn?: string; hex: string; stock?: number; photo?: string}> = (() => {
    try {
      const parsed = JSON.parse(product.colors || '[]');
      if (!Array.isArray(parsed)) return [];
      return parsed
        .map((item) => ({
          name: String(item?.name || '').trim(),
          nameEn: String(item?.nameEn || '').trim() || undefined,
          hex: String(item?.hex || '#ffffff'),
          stock: typeof item?.stock === 'number' ? item.stock : undefined,
          photo: typeof item?.photo === 'string' && item.photo ? item.photo : undefined,
        }))
        .filter((item) => item.name && item.hex);
    } catch {
      return [];
    }
  })();

  const selectedColorObj = colorOptions.find(c => c.name === selectedColor);
  const hasPerColorStock = colorOptions.some(c => typeof c.stock === 'number');
  const selectedColorOutOfStock = Boolean(
    selectedColor && selectedColorObj && hasPerColorStock &&
    typeof selectedColorObj.stock === 'number' && selectedColorObj.stock <= 0
  );

  const handleAddOrGoToCart = () => {
    if (inCart) {
      window.location.href = '/cart';
      return;
    }
    addToCart({
      productId: product.id,
      name: displayName,
      price,
      shippingFee: Number(product.shippingFee || 0),
      currency: 'RUB',
      image: heroImage,
      isPreorder: product.isPreorder,
      selectedColor: selectedColor || undefined,
    });
    setInCart(true);
  };

  const carouselPrev = () => setCarouselIndex((carouselIndex - 1 + allImages.length) % allImages.length);
  const carouselNext = () => setCarouselIndex((carouselIndex + 1) % allImages.length);

  useEffect(() => {
    let canceled = false;
    const loadReviews = async () => {
      setReviewsLoading(true);
      try {
        const res = await fetch(`/api/reviews/public?slug=${encodeURIComponent(product.slug)}`);
        const data = await res.json();
        if (!res.ok || !data.success) return;
        if (!canceled) setReviews(Array.isArray(data.reviews) ? data.reviews : []);
      } catch {
        // ignore
      } finally {
        if (!canceled) setReviewsLoading(false);
      }
    };
    loadReviews();
    return () => { canceled = true; };
  }, [product.slug]);

  return (
    <main>
      {/* Hero: Carousel + Info */}
      <section className="product-hero">
        <div className="product-image-col">
          {allImages.length > 0 && (
            <div className="product-carousel">
              <Image
                src={displayedImage || allImages[0]}
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

          {price > 0 && (
            <div className="product-price anim-fade-up anim-fade-up-d3">
              <span className="product-current-price">{`${price.toLocaleString('ru-RU')} ₽`}</span>
              {product.oldPrice && (
                <span className="product-old-price">{`${product.oldPrice.toLocaleString('ru-RU')} ₽`}</span>
              )}
              {product.discount > 0 && (
                <span className="product-discount-badge">-{product.discount}%</span>
              )}
            </div>
          )}

          {/* Color selector */}
          {colorOptions.length > 0 && (
            <div className="product-colors anim-fade-up anim-fade-up-d3" style={{ margin: '16px 0' }}>
              <p style={{ fontSize: '0.8rem', fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--text-secondary)', marginBottom: '10px' }}>
                {lang === 'ru' ? 'Цвет' : 'Color'}
                {selectedColor
                  ? `: ${(() => {
                      if (!selectedColorObj) return selectedColor;
                      return lang === 'ru' ? selectedColorObj.name : (selectedColorObj.nameEn || selectedColorObj.name);
                    })()}`
                  : ''}
              </p>
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                {colorOptions.map((c) => {
                  const outOfStock = hasPerColorStock && typeof c.stock === 'number' && c.stock <= 0;
                  const isSelected = selectedColor === c.name;
                  return (
                    <button
                      key={c.name}
                      type="button"
                      title={outOfStock ? (lang === 'ru' ? `${c.name} — нет в наличии` : `${c.nameEn || c.name} — out of stock`) : (lang === 'ru' ? c.name : (c.nameEn || c.name))}
                      onClick={() => {
                        const next = isSelected ? '' : c.name;
                        setSelectedColor(next);
                        const photo = colorOptions.find(x => x.name === next)?.photo;
                        setColorOverrideImage(photo || null);
                        if (!photo) {
                          const idx = allImages.findIndex(img => img === (next ? c.photo : ''));
                          if (idx >= 0) setCarouselIndex(idx); else setCarouselIndex(0);
                        }
                      }}
                      style={{
                        position: 'relative',
                        width: '32px', height: '32px', borderRadius: '50%',
                        background: c.hex,
                        border: isSelected ? '3px solid #fff' : '3px solid transparent',
                        outline: isSelected ? '2px solid rgba(255,255,255,0.5)' : '2px solid transparent',
                        cursor: 'pointer', transition: 'all 0.15s',
                        opacity: outOfStock ? 0.4 : 1,
                      }}
                    >
                      {outOfStock && (
                        <span style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.8)" strokeWidth="2.5">
                            <line x1="4" y1="4" x2="20" y2="20" /><line x1="20" y1="4" x2="4" y2="20" />
                          </svg>
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
              {hasPerColorStock && !selectedColor && (
                <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: 8 }}>
                  {lang === 'ru' ? 'Выберите цвет для заказа' : 'Select a color to order'}
                </p>
              )}
            </div>
          )}

          {/* Per-product notice badge */}
          {noticeText && (
            <div className="anim-fade-up anim-fade-up-d3" style={{
              margin: '12px 0 4px',
              padding: '10px 14px',
              background: 'rgba(255, 180, 0, 0.10)',
              border: '1px solid rgba(255, 180, 0, 0.35)',
              borderRadius: '8px',
              color: '#ffb400',
              fontSize: '0.82rem',
              fontWeight: 700,
              lineHeight: 1.5,
            }}>
              ⚠️&nbsp;{noticeText}
            </div>
          )}

          {/* Single add-to-cart / go-to-cart button */}
          <div className="product-actions anim-fade-up anim-fade-up-d4">
            {/* Color must be selected when colors have per-color stock */}
            {hasPerColorStock && !selectedColor ? (
              <div style={{ padding: '14px 20px', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '10px', fontSize: '14px', color: 'var(--text-secondary)', textAlign: 'center' }}>
                {lang === 'ru' ? 'Выберите цвет для добавления в корзину' : 'Select a color to add to cart'}
              </div>
            ) : hasPerColorStock && selectedColorOutOfStock ? (
              /* Selected color is out of stock — show notify */
              <div style={{ padding: '14px 20px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: '10px', fontSize: '14px', lineHeight: 1.6, color: 'var(--text-secondary)' }}>
                <strong style={{ color: 'var(--text-primary)', display: 'block', marginBottom: '4px' }}>
                  {lang === 'ru' ? `Цвет "${selectedColorObj?.name || selectedColor}" нет в наличии.` : `Color "${selectedColorObj?.nameEn || selectedColorObj?.name || selectedColor}" is out of stock.`}
                </strong>
                {lang === 'ru' ? 'Оставьте заявку, и мы сообщим, когда появится.' : 'Join the waitlist and we will notify you when it is back.'}
                <button
                  type="button"
                  className="product-btn"
                  style={{ marginTop: '14px', width: '100%', borderColor: 'rgba(255,255,255,0.18)' }}
                  onClick={() => { setShowWaitlistModal(true); setWaitlistError(''); setWaitlistSuccess(''); }}
                >
                  {lang === 'ru' ? 'Уведомить о поступлении' : 'Notify me when restocked'}
                </button>
              </div>
            ) : hasPerColorStock && selectedColor && !selectedColorOutOfStock ? (
              /* Color selected and in stock — allow add to cart regardless of product.inStock */
              <button
                type="button"
                className={`product-btn ${inCart ? 'in-cart' : ''}`}
                onClick={handleAddOrGoToCart}
              >
                {inCart ? t(lang, 'product.goToCart') : t(lang, 'product.addToCart')}
              </button>
            ) : !product.inStock ? (
              <div style={{
                padding: '14px 20px',
                background: 'rgba(255,255,255,0.05)',
                border: '1px solid rgba(255,255,255,0.12)',
                borderRadius: '10px',
                fontSize: '14px',
                lineHeight: 1.6,
                color: 'var(--text-secondary)',
              }}>
                <strong style={{ color: 'var(--text-primary)', display: 'block', marginBottom: '4px' }}>
                  {lang === 'ru' ? 'Товар недоступен для заказа.' : 'Product is unavailable for ordering.'}
                </strong>
                {lang === 'ru' ? 'Оставьте заявку, и мы сообщим, когда товар появится в наличии.' : 'Join the waitlist and we will notify you when the item is back in stock.'}
                {canJoinWaitlist && (
                  <button
                    type="button"
                    className="product-btn"
                    style={{ marginTop: '14px', width: '100%', borderColor: 'rgba(255,255,255,0.18)' }}
                    onClick={() => {
                      setShowWaitlistModal(true);
                      setWaitlistError('');
                      setWaitlistSuccess('');
                    }}
                  >
                    {lang === 'ru' ? 'Уведомить о поступлении' : 'Notify me when restocked'}
                  </button>
                )}
                {waitlistSuccess && (
                  <p style={{ marginTop: '12px', color: '#8ec07c', fontSize: '13px' }}>{waitlistSuccess}</p>
                )}
                {waitlistError && (
                  <p style={{ marginTop: '12px', color: '#f28b82', fontSize: '13px' }}>{waitlistError}</p>
                )}
              </div>
            ) : product.isPreorder && product.preorderClosed ? (
              <div style={{
                padding: '14px 20px',
                background: 'rgba(255,255,255,0.05)',
                border: '1px solid rgba(255,255,255,0.12)',
                borderRadius: '10px',
                fontSize: '14px',
                lineHeight: 1.6,
                color: 'var(--text-secondary)',
              }}>
                <strong style={{ color: 'var(--text-primary)', display: 'block', marginBottom: '4px' }}>Предзаказ закрыт.</strong>
                {product.preorderAvailableDate
                  ? `Доступна к продаже будет с ${formatPreorderDate(product.preorderAvailableDate)}`
                  : 'Следите за обновлениями.'}
              </div>
            ) : (
              <button
                type="button"
                className={`product-btn ${inCart ? 'in-cart' : ''}`}
                onClick={handleAddOrGoToCart}
              >
                {inCart ? t(lang, 'product.goToCart') : t(lang, 'product.addToCart')}
              </button>
            )}
          </div>
        </div>
      </section>

      {showWaitlistModal && (
        <div
          className="product-modal-overlay"
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.65)', zIndex: 2000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px' }}
          onClick={() => setShowWaitlistModal(false)}
        >
          <div
            style={{ width: '100%', maxWidth: '520px', background: '#111', borderRadius: '18px', padding: '28px', boxShadow: '0 30px 90px rgba(0,0,0,0.45)', position: 'relative' }}
            onClick={(e) => e.stopPropagation()}
          >
            <button
              style={{ position: 'absolute', top: '16px', right: '16px', border: 'none', background: 'transparent', color: '#fff', fontSize: '24px', cursor: 'pointer' }}
              onClick={() => setShowWaitlistModal(false)}
              aria-label="Close"
            >
              ×
            </button>
            <h2 style={{ margin: 0, marginBottom: '12px', fontSize: '22px', color: '#fff' }}>
              {lang === 'ru' ? 'Уведомить о поступлении' : 'Notify when back in stock'}
            </h2>
            <p style={{ margin: '0 0 18px', color: '#bbb', lineHeight: 1.6 }}>
              {lang === 'ru'
                ? 'Оставьте имя и email, и мы сообщим вам, когда товар снова появится в продаже.'
                : 'Leave your name and email, and we will notify you when this item is back in stock.'}
            </p>
            <div style={{ display: 'grid', gap: '14px' }}>
              <label style={{ display: 'block' }}>
                <span style={{ display: 'block', color: '#ddd', marginBottom: '6px' }}>{lang === 'ru' ? 'Имя' : 'Name'}</span>
                <input
                  type="text"
                  value={waitlistName}
                  onChange={(e) => setWaitlistName(e.target.value)}
                  placeholder={lang === 'ru' ? 'Ваше имя' : 'Your name'}
                  style={{ width: '100%', padding: '12px 14px', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.12)', background: '#121212', color: '#fff' }}
                />
              </label>
              <label style={{ display: 'block' }}>
                <span style={{ display: 'block', color: '#ddd', marginBottom: '6px' }}>{lang === 'ru' ? 'Email' : 'Email'}</span>
                <input
                  type="email"
                  value={waitlistEmail}
                  onChange={(e) => setWaitlistEmail(e.target.value)}
                  placeholder="name@example.com"
                  style={{ width: '100%', padding: '12px 14px', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.12)', background: '#121212', color: '#fff' }}
                />
              </label>
              <label style={{ display: 'flex', gap: '10px', alignItems: 'flex-start', color: '#ddd', fontSize: '13px', lineHeight: 1.5 }}>
                <input
                  type="checkbox"
                  checked={waitlistConsent}
                  onChange={(e) => setWaitlistConsent(e.target.checked)}
                  style={{ marginTop: '2px' }}
                />
                <span>
                  {lang === 'ru'
                    ? 'Я даю согласие на обработку персональных данных.'
                    : 'I consent to the processing of personal data.'}{' '}
                  <Link href="/privacy" target="_blank" rel="noreferrer" style={{ color: '#fff', textDecoration: 'underline' }}>
                    {lang === 'ru' ? 'Политика конфиденциальности' : 'Privacy policy'}
                  </Link>
                </span>
              </label>
              <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'center' }}>
                <button
                  type="button"
                  onClick={async () => {
                    setWaitlistError('');
                    setWaitlistSuccess('');
                    if (!waitlistName.trim() || !waitlistEmail.trim()) {
                      setWaitlistError(lang === 'ru' ? 'Имя и email обязательны.' : 'Name and email are required.');
                      return;
                    }
                    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(waitlistEmail.trim())) {
                      setWaitlistError(lang === 'ru' ? 'Введите корректный email.' : 'Please enter a valid email.');
                      return;
                    }
                    if (!waitlistConsent) {
                      setWaitlistError(
                        lang === 'ru'
                          ? 'Нужно согласие на обработку персональных данных.'
                          : 'Personal data consent is required.'
                      );
                      return;
                    }
                    setWaitlistLoading(true);
                    try {
                      const res = await fetch('/api/waitlist', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                          productId: product.id,
                          productSlug: product.slug,
                          productName: product.nameRu || product.name,
                          name: waitlistName.trim(),
                          email: waitlistEmail.trim(),
                          consentPersonalData: true,
                          selectedColor: selectedColor || '',
                        }),
                      });
                      const data = await res.json();
                      if (res.ok) {
                        setWaitlistSuccess(lang === 'ru'
                          ? 'Вы добавлены в список ожидания. Мы сообщим, когда товар будет в наличии.'
                          : 'You are on the waitlist. We will notify you when the item is back in stock.');
                        setWaitlistName('');
                        setWaitlistEmail('');
                        setWaitlistConsent(false);
                      } else {
                        setWaitlistError(data.error || (lang === 'ru' ? 'Не удалось добавить в список.' : 'Failed to join the waitlist.'));
                      }
                    } catch {
                      setWaitlistError(lang === 'ru' ? 'Ошибка сети. Попробуйте ещё раз.' : 'Network error. Please try again.');
                    }
                    setWaitlistLoading(false);
                  }}
                  className="product-btn"
                  style={{ width: '100%', opacity: waitlistLoading || !waitlistConsent ? 0.7 : 1 }}
                  disabled={waitlistLoading || !waitlistConsent}
                >
                  {waitlistLoading
                    ? (lang === 'ru' ? 'Отправка...' : 'Sending...')
                    : (lang === 'ru' ? 'Отправить' : 'Submit')}
                </button>
                <button
                  type="button"
                  className="product-btn"
                  style={{ width: '100%', background: 'transparent', border: '1px solid rgba(255,255,255,0.12)', color: '#fff' }}
                  onClick={() => setShowWaitlistModal(false)}
                >
                  {lang === 'ru' ? 'Отмена' : 'Cancel'}
                </button>
              </div>
              {(waitlistSuccess || waitlistError) && (
                <p style={{ color: waitlistSuccess ? '#8ec07c' : '#f28b82', margin: '0 0 0', fontSize: '13px' }}>
                  {waitlistSuccess || waitlistError}
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* About / Description */}
      {displayDesc && (
        <section className="description-section">
          <h2 className="description-heading">
            {lang === 'ru' ? 'Описание' : 'Description'}
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
          <h2 className="description-heading">
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
      <section className="description-section" style={{ paddingTop: '3rem' }}>
        <h2 className="description-heading">{lang === 'ru' ? 'Отзывы' : 'Reviews'}</h2>
        {reviewsLoading ? (
          <p style={{ color: 'var(--text-secondary)' }}>{lang === 'ru' ? 'Загрузка отзывов...' : 'Loading reviews...'}</p>
        ) : reviews.length === 0 ? (
          <p style={{ color: 'var(--text-secondary)' }}>{lang === 'ru' ? 'Пока нет опубликованных отзывов.' : 'No published reviews yet.'}</p>
        ) : (
          <div style={{ display: 'grid', gap: '12px' }}>
            {reviews.map((review) => (
              <article key={review.id} style={{ border: '1px solid rgba(255,255,255,0.1)', borderRadius: '12px', padding: '14px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px', flexWrap: 'wrap', marginBottom: '8px' }}>
                  <strong>{review.customerName || (lang === 'ru' ? 'Клиент' : 'Customer')}</strong>
                  <span style={{ color: '#ffcc66' }}>{review.rating.toFixed(1)} ★</span>
                </div>
                {review.text && <p style={{ margin: 0, whiteSpace: 'pre-wrap', lineHeight: 1.6 }}>{review.text}</p>}
                {Array.isArray(review.media) && review.media.length > 0 && (
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))', gap: '8px', marginTop: '10px' }}>
                    {review.media.map((url) => {
                      const isVideo = /\\.(mp4|webm|mov)$/i.test(url);
                      return isVideo ? (
                        <video key={url} src={url} controls style={{ width: '100%', borderRadius: '8px' }} />
                      ) : (
                        <img key={url} src={url} alt="review media" style={{ width: '100%', height: '120px', objectFit: 'cover', borderRadius: '8px' }} />
                      );
                    })}
                  </div>
                )}
              </article>
            ))}
          </div>
        )}
      </section>

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
