'use client';

import { useSearchParams } from 'next/navigation';
import { useContext, useEffect, Suspense } from 'react';
import Link from 'next/link';
import { LanguageContext } from '@/contexts/LanguageContext';
import { t } from '@/lib/i18n';
import { clearCart } from '@/lib/cart';

function SuccessContent() {
  const { lang } = useContext(LanguageContext);
  const params = useSearchParams();
  const orderNumber = params.get('order');

  useEffect(() => {
    clearCart();
  }, []);

  return (
    <main style={{
      minHeight: '70vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '2rem',
      textAlign: 'center',
    }}>
      <div style={{ maxWidth: '480px' }}>
        <div style={{
          width: '64px',
          height: '64px',
          borderRadius: '50%',
          background: 'var(--orange)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          margin: '0 auto 2rem',
        }}>
          <svg width="28" height="28" fill="none" stroke="#fff" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
          </svg>
        </div>

        <h1 style={{ fontSize: '1.5rem', fontWeight: 700, marginBottom: '1rem' }}>
          {lang === 'ru' ? 'Заказ оформлен!' : 'Order placed!'}
        </h1>

        {orderNumber && (
          <p style={{ color: 'var(--text-secondary)', marginBottom: '0.5rem', fontSize: '0.9rem' }}>
            {lang === 'ru' ? 'Номер заказа' : 'Order number'}:{' '}
            <strong style={{ color: 'var(--text)' }}>#{orderNumber}</strong>
          </p>
        )}

        <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', lineHeight: 1.7, marginBottom: '2.5rem' }}>
          {lang === 'ru'
            ? 'Спасибо за покупку! Мы отправим подтверждение на вашу почту и свяжемся с вами после комплектации заказа.'
            : 'Thank you for your purchase! We will send a confirmation to your email and contact you once the order is ready.'}
        </p>

        <Link href="/" className="product-btn" style={{ display: 'inline-flex', justifyContent: 'center' }}>
          {lang === 'ru' ? 'На главную' : 'Back to home'}
        </Link>
      </div>
    </main>
  );
}

export default function SuccessPage() {
  return (
    <Suspense>
      <SuccessContent />
    </Suspense>
  );
}
