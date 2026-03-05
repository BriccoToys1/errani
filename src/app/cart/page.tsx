'use client';

import { useState, useEffect } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { getCart, updateQuantity, removeFromCart, clearCart, getCartTotal, CartItem } from '@/lib/cart';
import { formatPrice, COUNTRIES, SHIPPING_METHODS_RU, SHIPPING_METHODS_INT } from '@/lib/utils';
import { useLanguage } from '@/contexts/LanguageContext';
import { t } from '@/lib/i18n';

export default function CartPage() {
  const { lang } = useLanguage();
  const [cart, setCart] = useState<CartItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [step, setStep] = useState<'cart' | 'checkout' | 'done'>('cart');
  const [submitting, setSubmitting] = useState(false);
  const [orderNumber, setOrderNumber] = useState('');
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    country: 'RU',
    city: '',
    zipCode: '',
    street: '',
    house: '',
    apartment: '',
    shippingMethod: 'ozon',
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    setCart(getCart());
    setLoading(false);
  }, []);

  const isRussia = formData.country === 'RU';
  const shippingMethods = isRussia ? SHIPPING_METHODS_RU : SHIPPING_METHODS_INT;

  useEffect(() => {
    const methods = formData.country === 'RU' ? SHIPPING_METHODS_RU : SHIPPING_METHODS_INT;
    if (!methods.some(m => m.key === formData.shippingMethod)) {
      setFormData(prev => ({ ...prev, shippingMethod: methods[0]?.key || '' }));
    }
  }, [formData.country, formData.shippingMethod]);

  const handleQty = (id: string, qty: number) => setCart(updateQuantity(id, qty));
  const handleRemove = (id: string) => setCart(removeFromCart(id));
  const total = getCartTotal(cart);

  const validate = () => {
    const e: Record<string, string> = {};
    if (!formData.name.trim()) e.name = 'Введите ФИО';
    if (!formData.email.trim() || !/\S+@\S+\.\S+/.test(formData.email)) e.email = 'Введите корректный email';
    if (!formData.phone.trim()) e.phone = 'Введите телефон';
    if (!formData.city.trim()) e.city = 'Введите город';
    if (!formData.zipCode.trim()) e.zipCode = 'Введите индекс';
    if (!formData.street.trim()) e.street = 'Введите улицу';
    if (!formData.house.trim()) e.house = 'Введите дом';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    setSubmitting(true);

    try {
      const res = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          items: cart.map(item => ({ productId: item.productId, quantity: item.quantity })),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      if (data.paymentUrl) {
        clearCart();
        window.location.href = data.paymentUrl;
        return;
      }

      setOrderNumber(data.orderNumber || '');
      clearCart();
      setCart([]);
      setStep('done');
    } catch {
      alert('Ошибка при оформлении заказа. Попробуйте ещё раз.');
    } finally {
      setSubmitting(false);
    }
  };

  /* Loading */
  if (loading) {
    return <div className="loader-wrap"><div className="loader-bar" /></div>;
  }

  /* Done */
  if (step === 'done') {
    return (
      <main className="cart-section" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '80vh', textAlign: 'center' }}>
        <div style={{ fontSize: '3rem', marginBottom: '1.5rem' }}>✓</div>
        <h1 className="cart-heading" style={{ marginBottom: '0.75rem' }}>{t(lang, 'cart.success.title')}</h1>
        {orderNumber && (
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginBottom: '0.5rem' }}>
            #{orderNumber}
          </p>
        )}
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginBottom: '2rem' }}>
          {t(lang, 'cart.success.text')}
        </p>
        <Link href="/" className="home-cta">{t(lang, 'cart.goHome')}</Link>
      </main>
    );
  }

  /* Empty */
  if (cart.length === 0) {
    return (
      <main className="cart-section" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '80vh', textAlign: 'center' }}>
        <h1 className="cart-heading">{t(lang, 'cart.empty')}</h1>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginBottom: '2rem' }}>
          {t(lang, 'nav.catalog')}
        </p>
        <Link href="/catalog" className="home-cta">
          {t(lang, 'nav.catalog')}
          <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
          </svg>
        </Link>
      </main>
    );
  }

  return (
    <main className="cart-section">
      <h1 className="cart-heading">
        {step === 'cart' ? t(lang, 'cart.title') : t(lang, 'cart.checkout.heading')}
      </h1>

      {step === 'cart' ? (
        <>
          {/* Items */}
          {cart.map((item) => (
            <div key={item.productId} className="cart-item">
              <div className="cart-item-image">
                <Image src={item.image} alt={item.name} fill className="object-cover" sizes="100px" />
              </div>
              <div className="cart-item-info">
                <div className="cart-item-name">{item.name}</div>
                {item.isPreorder && <span className="cart-item-tag">{t(lang, 'cart.preorder')}</span>}
                <div className="cart-item-price">{formatPrice(item.price * item.quantity, item.currency)}</div>
              </div>
              <div className="cart-item-actions">
                <button className="cart-remove-btn" onClick={() => handleRemove(item.productId)}>
                  <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
                <div className="cart-qty">
                  <button onClick={() => handleQty(item.productId, item.quantity - 1)}>−</button>
                  <span>{item.quantity}</span>
                  <button onClick={() => handleQty(item.productId, item.quantity + 1)}>+</button>
                </div>
              </div>
            </div>
          ))}

          {/* Summary */}
          <div className="cart-summary">
            <div className="cart-total-row">
              <span className="cart-total-label">{t(lang, 'cart.total')}</span>
              <span className="cart-total-price">{formatPrice(total)}</span>
            </div>
          </div>

          <button
            type="button"
            className="product-btn"
            style={{ width: '100%', marginTop: '2rem', justifyContent: 'center' }}
            onClick={() => setStep('checkout')}
          >
            {t(lang, 'cart.checkout')}
          </button>
        </>
      ) : (
        <form onSubmit={handleSubmit}>
          <div className="checkout-form" style={{ borderTop: 'none', marginTop: 0, paddingTop: 0 }}>
            <h2 className="checkout-heading">Контактные данные</h2>
            <div className="checkout-grid">
              <Field label="ФИО" value={formData.name} error={errors.name} className="full-width"
                onChange={(v) => setFormData({ ...formData, name: v })} />
              <Field label="Email" type="email" value={formData.email} error={errors.email}
                onChange={(v) => setFormData({ ...formData, email: v })} />
              <Field label="Телефон" type="tel" value={formData.phone} error={errors.phone}
                onChange={(v) => setFormData({ ...formData, phone: v })} />
            </div>
          </div>

          <div className="checkout-form">
            <h2 className="checkout-heading">Адрес доставки</h2>
            <div className="checkout-grid">
              <div className="full-width">
                <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '0.5rem' }}>Страна</label>
                <select
                  className="form-field"
                  value={formData.country}
                  onChange={(e) => setFormData({ ...formData, country: e.target.value })}
                >
                  {COUNTRIES.map(c => <option key={c.code} value={c.code}>{c.name}</option>)}
                </select>
              </div>
              <Field label="Город" value={formData.city} error={errors.city}
                onChange={(v) => setFormData({ ...formData, city: v })} />
              <Field label="Индекс" value={formData.zipCode} error={errors.zipCode}
                onChange={(v) => setFormData({ ...formData, zipCode: v })} />
              <Field label="Улица" value={formData.street} error={errors.street}
                onChange={(v) => setFormData({ ...formData, street: v })} />
              <Field label="Дом" value={formData.house} error={errors.house}
                onChange={(v) => setFormData({ ...formData, house: v })} />
              <Field label="Квартира" value={formData.apartment}
                onChange={(v) => setFormData({ ...formData, apartment: v })} />
            </div>
          </div>

          <div className="checkout-form">
            <h2 className="checkout-heading">Способ доставки</h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              {shippingMethods.map(m => (
                <label
                  key={m.key}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.75rem',
                    padding: '1rem',
                    border: `1px solid ${formData.shippingMethod === m.key ? 'var(--orange)' : 'var(--border)'}`,
                    cursor: 'pointer',
                    transition: 'border-color 0.2s',
                  }}
                >
                  <input
                    type="radio"
                    name="shipping"
                    checked={formData.shippingMethod === m.key}
                    onChange={() => setFormData({ ...formData, shippingMethod: m.key })}
                    style={{ accentColor: 'var(--orange)' }}
                  />
                  <span style={{ fontSize: '0.9rem', fontWeight: 500 }}>{m.label}</span>
                </label>
              ))}
            </div>
          </div>

          {/* Order total */}
          <div className="cart-summary">
            <div className="cart-total-row">
              <span className="cart-total-label">К оплате</span>
              <span className="cart-total-price">{formatPrice(total)}</span>
            </div>
            <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.75rem' }}>
              {isRussia ? 'Оплата через ЮKassa' : 'Оплата картой'}
            </p>
          </div>

          <div style={{ display: 'flex', gap: '1rem', marginTop: '2rem', flexWrap: 'wrap' }}>
            <button
              type="button"
              onClick={() => setStep('cart')}
              style={{
                background: 'none',
                border: '1px solid var(--border)',
                padding: '0.9rem 2rem',
                color: 'var(--text-secondary)',
                cursor: 'pointer',
                fontSize: '0.8rem',
                fontWeight: 600,
                letterSpacing: '0.15em',
                textTransform: 'uppercase' as const,
              }}
            >
              ← Назад
            </button>
            <button
              type="submit"
              className="product-btn"
              disabled={submitting}
              style={{ flex: 1, justifyContent: 'center' }}
            >
              {submitting ? 'Обработка...' : 'Перейти к оплате'}
            </button>
          </div>
        </form>
      )}
    </main>
  );
}

/* --- Mini Field Component --- */
function Field({ label, value, onChange, error, type = 'text', className = '' }: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  error?: string;
  type?: string;
  className?: string;
}) {
  return (
    <div className={className}>
      <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '0.5rem' }}>
        {label}
      </label>
      <input
        type={type}
        className="form-field"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        style={error ? { borderColor: '#ef4444' } : undefined}
      />
      {error && <p style={{ fontSize: '0.75rem', color: '#ef4444', marginTop: '0.25rem' }}>{error}</p>}
    </div>
  );
}
