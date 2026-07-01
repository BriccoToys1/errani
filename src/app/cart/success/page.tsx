'use client';

import { useSearchParams } from 'next/navigation';
import { useEffect, useState, Suspense } from 'react';
import Link from 'next/link';
import { useLanguage } from '@/contexts/LanguageContext';
import { clearCart } from '@/lib/cart';

function SuccessContent() {
  const { lang } = useLanguage();
  const params = useSearchParams();
  const orderNumber = params.get('order');
  const [status, setStatus] = useState<'loading' | 'paid' | 'pending' | 'error'>('loading');
  const [emailStatus, setEmailStatus] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle');

  useEffect(() => {
    if (!orderNumber) { setStatus('error'); return; }

    let attempts = 0;
    const check = async () => {
      try {
        const res = await fetch(`/api/orders/status?number=${orderNumber}`);
        if (!res.ok) { setStatus('error'); return; }
        const data = await res.json();
        if (data.status && data.status !== 'pending') {
          clearCart();
          setStatus('paid');
        } else if (attempts < 4) {
          // YuKassa webhook may arrive a few seconds after redirect — retry up to 4 times
          attempts++;
          setTimeout(check, 2000);
        } else {
          setStatus('pending');
        }
      } catch {
        setStatus('error');
      }
    };
    check();
  }, [orderNumber]);

  const sendReceipt = async () => {
    if (!orderNumber || emailStatus === 'sending') return;

    setEmailStatus('sending');
    try {
      const response = await fetch('/api/orders/receipt/email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderNumber }),
      });

      if (!response.ok) throw new Error('Failed to send receipt');
      setEmailStatus('sent');
    } catch {
      setEmailStatus('error');
    }
  };

  if (status === 'loading') {
    return (
      <main style={{ minHeight: '70vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>
          {lang === 'ru' ? 'Проверяем оплату…' : 'Checking payment…'}
        </p>
      </main>
    );
  }

  if (status === 'pending') {
    return (
      <main style={{ minHeight: '70vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '2rem', textAlign: 'center' }}>
        <div style={{ maxWidth: '480px' }}>
          <div style={{ width: '64px', height: '64px', borderRadius: '50%', background: '#ef444420', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 2rem' }}>
            <svg width="28" height="28" fill="none" stroke="#ef4444" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </div>
          <h1 style={{ fontSize: '1.5rem', fontWeight: 700, marginBottom: '1rem' }}>
            {lang === 'ru' ? 'Оплата не завершена' : 'Payment not completed'}
          </h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', lineHeight: 1.7, marginBottom: '2.5rem' }}>
            {lang === 'ru'
              ? 'Вы не завершили оплату. Вернитесь в корзину и попробуйте снова.'
              : 'You did not complete the payment. Go back to cart and try again.'}
          </p>
          <Link href="/cart" className="product-btn" style={{ display: 'inline-flex', justifyContent: 'center' }}>
            {lang === 'ru' ? 'Вернуться в корзину' : 'Back to cart'}
          </Link>
        </div>
      </main>
    );
  }

  if (status === 'error') {
    return (
      <main style={{ minHeight: '70vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '2rem', textAlign: 'center' }}>
        <div style={{ maxWidth: '480px' }}>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginBottom: '2rem' }}>
            {lang === 'ru' ? 'Не удалось проверить статус заказа.' : 'Could not verify order status.'}
          </p>
          <Link href="/" className="product-btn" style={{ display: 'inline-flex', justifyContent: 'center' }}>
            {lang === 'ru' ? 'На главную' : 'Back to home'}
          </Link>
        </div>
      </main>
    );
  }

  // paid
  return (
    <main style={{
      minHeight: '100svh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: 'calc(72px + 2rem) 2rem 8rem',
      textAlign: 'center',
      boxSizing: 'border-box',
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
          {lang === 'ru' ? 'Успешная оплата' : 'Payment successful'}
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

        {orderNumber && (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.9rem', flexWrap: 'wrap', marginBottom: '1.25rem' }}>
            <a
              href={`/api/orders/receipt?number=${encodeURIComponent(orderNumber)}`}
              aria-label={lang === 'ru' ? 'Скачать чек' : 'Download receipt'}
              title={lang === 'ru' ? 'Скачать чек' : 'Download receipt'}
              style={{
                width: '48px',
                height: '48px',
                borderRadius: '50%',
                background: 'var(--orange)',
                color: '#fff',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                flex: '0 0 auto',
              }}
            >
              <svg width="21" height="21" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v12m0 0 4-4m-4 4-4-4M5 21h14" />
              </svg>
            </a>
            <span style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>
              {lang === 'ru' ? 'или' : 'or'}
            </span>
            <button
              type="button"
              onClick={sendReceipt}
              disabled={emailStatus === 'sending' || emailStatus === 'sent'}
              className="product-btn"
              style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '0.55rem', border: 0, cursor: emailStatus === 'sending' || emailStatus === 'sent' ? 'default' : 'pointer' }}
            >
              <svg width="18" height="18" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="m3 11 18-8-8 18-2-8-8-2Zm8 2 4-4" />
              </svg>
              {emailStatus === 'sending'
                ? (lang === 'ru' ? 'Отправляем…' : 'Sending…')
                : emailStatus === 'sent'
                  ? (lang === 'ru' ? 'Чек отправлен' : 'Receipt sent')
                  : (lang === 'ru' ? 'Отправить чек по почте' : 'Email receipt')}
            </button>
          </div>
        )}

        {emailStatus === 'error' && (
          <p style={{ color: '#ef4444', fontSize: '0.85rem', margin: '-0.5rem 0 1.25rem' }}>
            {lang === 'ru' ? 'Не удалось отправить чек. Попробуйте ещё раз.' : 'Could not send the receipt. Please try again.'}
          </p>
        )}

        <Link href="/" className="product-btn" style={{ display: 'inline-flex', justifyContent: 'center', marginTop: '0.75rem' }}>
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
