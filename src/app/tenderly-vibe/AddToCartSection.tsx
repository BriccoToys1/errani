'use client';

import { useState } from 'react';
import Link from 'next/link';
import { addToCart } from '@/lib/cart';
import { useLanguage } from '@/contexts/LanguageContext';
import { t } from '@/lib/i18n';

// Tenderly Vibe: preorder price 4590, regular price 5690
const IS_PREORDER = true;
const PRICE = IS_PREORDER ? 4590 : 5690;

export function AddToCartSection() {
  const { lang } = useLanguage();
  const [added, setAdded] = useState(false);
  const [showGoToCart, setShowGoToCart] = useState(false);

  const handleAdd = () => {
    addToCart({
      productId: 'tenderly-vibe',
      name: 'Tenderly Vibe — Авторская колода Таро',
      price: PRICE,
      currency: 'RUB',
      image: '/media/photo-4.jpeg',
      isPreorder: IS_PREORDER,
    });

    setAdded(true);
    setShowGoToCart(true);
    setTimeout(() => setAdded(false), 2000);
  };

  return (
    <div className="product-actions anim-fade-up anim-fade-up-d4">
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
