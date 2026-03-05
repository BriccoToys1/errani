'use client';

import { useState } from 'react';
import Link from 'next/link';
import { addToCart } from '@/lib/cart';
import { useLanguage } from '@/contexts/LanguageContext';
import { t } from '@/lib/i18n';

export function AddToCartSection() {
  const { lang } = useLanguage();
  const [quantity, setQuantity] = useState(1);
  const [added, setAdded] = useState(false);
  const [showGoToCart, setShowGoToCart] = useState(false);

  const handleAdd = () => {
    for (let i = 0; i < quantity; i++) {
      addToCart({
        productId: 'tenderly-vibe',
        name: 'Tenderly Vibe — Авторская колода Таро',
        price: 4990,
        currency: 'RUB',
        image: '/media/photo-4.jpeg',
        isPreorder: true,
      });
    }

    setAdded(true);
    setShowGoToCart(true);
    setTimeout(() => setAdded(false), 2000);
  };

  const decrease = () => setQuantity((q) => Math.max(1, q - 1));
  const increase = () => setQuantity((q) => q + 1);

  return (
    <div className="product-actions anim-fade-up anim-fade-up-d4">
      {/* Quantity selector */}
      <div className="product-qty">
        <button type="button" onClick={decrease} aria-label="−">−</button>
        <span>{quantity}</span>
        <button type="button" onClick={increase} aria-label="+">+</button>
      </div>

      {/* Add to cart */}
      <button
        type="button"
        className={`product-btn ${added ? 'added' : ''}`}
        onClick={handleAdd}
      >
        {added ? t(lang, 'product.added') : t(lang, 'product.addToCart')}
      </button>

      {/* Go to cart link */}
      {showGoToCart && (
        <Link href="/cart" className="product-btn-secondary">
          {t(lang, 'product.goToCart')}
        </Link>
      )}
    </div>
  );
}
