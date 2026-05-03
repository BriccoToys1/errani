'use client';

import { useState, useEffect } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { getCart, updateQuantity, removeFromCart, clearCart, getCartTotal, CartItem } from '@/lib/cart';
import { formatPrice, COUNTRIES, SHIPPING_METHODS_RU, SHIPPING_METHODS_INT, getShippingCost } from '@/lib/utils';
import { useLanguage } from '@/contexts/LanguageContext';
import { t } from '@/lib/i18n';
import { PhoneInput } from '@/components/PhoneInput';

export default function CartPage() {
  const { lang } = useLanguage();
  const [cart, setCart] = useState<CartItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [step, setStep] = useState<'cart' | 'checkout' | 'done'>('cart');
  const [submitting, setSubmitting] = useState(false);
  const [orderNumber, setOrderNumber] = useState('');
  const [formData, setFormData] = useState({
    lastName: '',
    firstName: '',
    middleName: '',
    noMiddleName: false,
    email: '',
    phone: '',
    country: 'RU',
    customCountry: '',
    oblast: '',
    city: '',
    zipCode: '',
    street: '',
    house: '',
    apartment: '',
    noApartment: false,
    shippingMethod: 'pochta_ru',
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [consentOferta, setConsentOferta] = useState(false);
  const [consentData, setConsentData] = useState(false);
  const [unavailableProductIds, setUnavailableProductIds] = useState<Set<string>>(new Set());
  const [availabilityChecked, setAvailabilityChecked] = useState(false);

  const [deliveryEstimate, setDeliveryEstimate] = useState('Ориентировочный срок доставки ~ начало Мая');

  // Foreign card modal
  const [showForeignCard, setShowForeignCard] = useState(false);
  const [foreignForm, setForeignForm] = useState({ name: '', phone: '', email: '', contact: 'telegram', consent: false });
  const [foreignSubmitting, setForeignSubmitting] = useState(false);
  const [foreignDone, setForeignDone] = useState(false);

  useEffect(() => {
    setCart(getCart());
    setLoading(false);
  }, []);

  useEffect(() => {
    const checkAvailability = async () => {
      if (loading) return;
      if (cart.length === 0) {
        setUnavailableProductIds(new Set());
        setAvailabilityChecked(true);
        return;
      }

      try {
        const res = await fetch('/api/products?showAll=true');
        const products = await res.json();
        if (!Array.isArray(products)) {
          setAvailabilityChecked(true);
          return;
        }

        const byId = new Map<string, { id: string; inStock: boolean; isActive: boolean; stock: number; isSaleDisabled?: boolean }>(
          products.map((p: { id: string; inStock: boolean; isActive: boolean; stock: number; isSaleDisabled?: boolean }) => [p.id, p])
        );

        const blocked = new Set<string>();
        for (const item of cart) {
          const p = byId.get(item.productId);
          if (!p || !p.isActive || !p.inStock || p.isSaleDisabled || p.stock <= 0 || item.quantity > p.stock) {
            blocked.add(item.productId);
          }
        }
        setUnavailableProductIds(blocked);
      } catch {
        // If check fails, keep existing state and avoid false-negative ordering.
      } finally {
        setAvailabilityChecked(true);
      }
    };

    checkAvailability();
  }, [cart, loading]);

  useEffect(() => {
    fetch('/api/admin/settings?key=deliveryEstimate')
      .then(r => r.json())
      .then(d => { if (d.value) setDeliveryEstimate(d.value); })
      .catch(() => {});
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
  const itemCount = cart.reduce((sum, i) => sum + i.quantity, 0);
  const shippingCost = isRussia ? getShippingCost(itemCount) : 0;
  const grandTotal = total + shippingCost;
  const unavailableItems = cart.filter(item => unavailableProductIds.has(item.productId));
  const hasUnavailableItems = unavailableItems.length > 0;

  const validate = () => {
    const e: Record<string, string> = {};
    
    // Last name validation
    if (!formData.lastName.trim()) {
      e.lastName = 'Введите фамилию';
    } else if (!/^[\p{L}\s\-']+$/u.test(formData.lastName.trim())) {
      e.lastName = 'Фамилия может содержать только буквы';
    }

    // First name validation
    if (!formData.firstName.trim()) {
      e.firstName = 'Введите имя';
    } else if (!/^[\p{L}\s\-']+$/u.test(formData.firstName.trim())) {
      e.firstName = 'Имя может содержать только буквы';
    }

    // Middle name validation (if not checked "no middle name")
    if (!formData.noMiddleName && !formData.middleName.trim()) {
      e.middleName = 'Введите отчество';
    }
    
    // Email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
    if (!formData.email.trim()) {
      e.email = 'Введите email';
    } else if (!emailRegex.test(formData.email.trim())) {
      e.email = 'Введите корректный email';
    }
    
    // Phone validation - minimum 10 digits
    const phoneDigits = formData.phone.replace(/\D/g, '');
    if (phoneDigits.length < 10) {
      e.phone = 'Введите корректный телефон (минимум 10 цифр)';
    }

    // Custom country validation
    if (formData.country === 'OTHER' && !formData.customCountry.trim()) {
      e.customCountry = 'Введите название страны';
    }
    
    // City validation
    if (!formData.city.trim()) {
      e.city = 'Введите город';
    } else if (formData.city.trim().length < 2) {
      e.city = 'Название города слишком короткое';
    }
    
    // Zip code validation
    const zipTrimmed = formData.zipCode.trim();
    if (!zipTrimmed) {
      e.zipCode = 'Введите индекс';
    } else if (formData.country === 'RU' && !/^\d{6}$/.test(zipTrimmed)) {
      e.zipCode = 'Индекс должен содержать 6 цифр';
    } else if (formData.country !== 'RU' && zipTrimmed.length < 3) {
      e.zipCode = 'Введите корректный индекс';
    }
    
    // Street validation
    if (!formData.street.trim()) {
      e.street = 'Введите улицу';
    }
    
    // House validation
    if (!formData.house.trim()) {
      e.house = 'Введите дом';
    }

    // Consent validation
    if (!consentOferta) e.consentOferta = 'Необходимо принять условия оферты';
    if (!consentData) e.consentData = 'Необходимо дать согласие на обработку данных';
    
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (hasUnavailableItems) {
      alert('Некоторые товары в корзине сейчас недоступны. Удалите их, чтобы продолжить оформление.');
      return;
    }
    if (!validate()) return;
    setSubmitting(true);

    try {
      const res = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          name: [formData.lastName, formData.firstName, formData.noMiddleName ? '' : formData.middleName].filter(Boolean).join(' '),
          items: cart.map(item => ({ productId: item.productId, quantity: item.quantity })),
          shippingCost,
          totalAmount: grandTotal,
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

  const handleForeignSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setForeignSubmitting(true);
    try {
      await fetch('/api/inquiries', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: foreignForm.name,
          email: foreignForm.email,
          phone: foreignForm.phone || undefined,
          message: `Иностранная карта — заявка на оплату. Предпочтительный способ связи: ${foreignForm.contact}`,
          source: 'foreign_card',
        }),
      });
      setForeignDone(true);
    } catch {
      alert('Ошибка при отправке. Попробуйте ещё раз.');
    } finally {
      setForeignSubmitting(false);
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
        <div style={{ fontSize: '3rem', marginBottom: '1.5rem' }}><i className="fi fi-rr-check" style={{ color: '#22c55e' }} /></div>
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
      {/* Step Indicator */}
      <div className="checkout-steps">
        <div className={`checkout-step ${step === 'cart' ? 'active' : 'completed'}`}>
          <span className="checkout-step-number">
            {step === 'cart' ? '1' : <i className="fi fi-rr-check" style={{ fontSize: 13, display: 'flex' }} />}
          </span>
          <span>{t(lang, 'cart.title')}</span>
        </div>
        <div className={`checkout-step-connector ${step !== 'cart' ? 'completed' : ''}`} />
        <div className={`checkout-step ${step === 'checkout' ? 'active' : ''}`}>
          <span className="checkout-step-number">2</span>
          <span>{t(lang, 'cart.checkout.heading')}</span>
        </div>
        <div className="checkout-step-connector" />
        <div className="checkout-step">
          <span className="checkout-step-number">3</span>
          <span>{lang === 'ru' ? 'Оплата' : 'Payment'}</span>
        </div>
      </div>

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
                {unavailableProductIds.has(item.productId) && (
                  <span className="cart-item-tag" style={{ background: 'rgba(239,68,68,0.18)', color: '#fda4af' }}>
                    {lang === 'ru' ? 'Недоступно к заказу' : 'Unavailable'}
                  </span>
                )}
                <div className="cart-item-price">{formatPrice(item.price * item.quantity, item.currency)}</div>
              </div>
              <div className="cart-item-actions">
                <div className="cart-qty">
                  <button onClick={() => handleQty(item.productId, item.quantity - 1)}>−</button>
                  <span>{item.quantity}</span>
                  <button onClick={() => handleQty(item.productId, item.quantity + 1)}>+</button>
                </div>
                <button className="cart-remove-btn" onClick={() => handleRemove(item.productId)}>
                  <i className="fi fi-rr-trash" style={{ fontSize: 16 }} />
                </button>
              </div>
            </div>
          ))}

          {/* Summary */}
          {hasUnavailableItems && (
            <div style={{
              marginTop: '0.7rem',
              marginBottom: '0.8rem',
              padding: '0.9rem 1rem',
              background: 'rgba(239,68,68,0.10)',
              border: '1px solid rgba(239,68,68,0.35)',
              borderRadius: '10px',
              fontSize: '0.82rem',
              lineHeight: 1.7,
              color: '#fecaca',
            }}>
              {lang === 'ru'
                ? 'В корзине есть недоступные товары. Удалите их, чтобы перейти к оформлению.'
                : 'Your cart contains unavailable products. Remove them to continue checkout.'}
            </div>
          )}
          <div className="cart-summary-inline">
            <span className="cart-total-label-inline">{t(lang, 'cart.total')}</span>
            <span className="cart-total-price-inline">{formatPrice(total)}</span>
            <button
              type="button"
              className="cart-checkout-btn"
              onClick={() => setStep('checkout')}
              disabled={hasUnavailableItems || !availabilityChecked}
            >
              {t(lang, 'cart.checkout')}
            </button>
          </div>
        </>
      ) : (
        <form onSubmit={handleSubmit}>
          {hasUnavailableItems && (
            <div style={{
              marginBottom: '1rem',
              padding: '0.95rem 1rem',
              background: 'rgba(239,68,68,0.10)',
              border: '1px solid rgba(239,68,68,0.35)',
              borderRadius: '10px',
              fontSize: '0.82rem',
              lineHeight: 1.75,
              color: '#fecaca',
            }}>
              {lang === 'ru'
                ? 'Оформление недоступно: часть товаров в корзине отключена администратором. Удалите недоступные позиции и повторите попытку.'
                : 'Checkout is unavailable: some products in your cart are disabled by admin. Remove unavailable items and try again.'}
            </div>
          )}
          <div className="checkout-form" style={{ borderTop: 'none', marginTop: 0, paddingTop: 0 }}>
            <h2 className="checkout-heading">{lang === 'ru' ? 'Контактные данные' : 'Contact details'}</h2>
            <div className="checkout-grid">
              <Field label={lang === 'ru' ? 'Фамилия' : 'Last name'} value={formData.lastName} error={errors.lastName}
                onChange={(v) => setFormData({ ...formData, lastName: v })} />
              <Field label={lang === 'ru' ? 'Имя' : 'First name'} value={formData.firstName} error={errors.firstName}
                onChange={(v) => setFormData({ ...formData, firstName: v })} />
              <div>
                <Field label={lang === 'ru' ? 'Отчество' : 'Middle name'} value={formData.middleName} error={!formData.noMiddleName ? errors.middleName : undefined}
                  onChange={(v) => setFormData({ ...formData, middleName: v })} />
                <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', cursor: 'pointer', fontSize: '0.78rem', color: 'var(--text-secondary)', marginTop: '0.4rem' }}>
                  <input
                    type="checkbox"
                    checked={formData.noMiddleName}
                    onChange={(e) => setFormData({ ...formData, noMiddleName: e.target.checked, middleName: '' })}
                    style={{ accentColor: 'var(--orange)' }}
                  />
                  {lang === 'ru' ? 'Нет отчества' : 'No middle name'}
                </label>
              </div>
              <Field label="Email" type="email" value={formData.email} error={errors.email}
                onChange={(v) => setFormData({ ...formData, email: v })} />
              <PhoneInput
                label="Телефон"
                value={formData.phone}
                onChange={(v) => setFormData({ ...formData, phone: v })}
                countryCode={formData.country}
                error={errors.phone}
              />
            </div>
          </div>

          <div className="checkout-form">
            <h2 className="checkout-heading">{lang === 'ru' ? 'Адрес доставки' : 'Shipping address'}</h2>
            <div className="checkout-grid">
              <div className="full-width">
                <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '0.5rem' }}>{lang === 'ru' ? 'Страна' : 'Country'}</label>
                <select
                  className="form-field"
                  value={formData.country}
                  onChange={(e) => setFormData({ ...formData, country: e.target.value, customCountry: '' })}
                >
                  {COUNTRIES.map(c => <option key={c.code} value={c.code}>{c.name}</option>)}
                </select>
                {formData.country === 'OTHER' && (
                  <div style={{ marginTop: '0.75rem' }}>
                    <input
                      type="text"
                      className="form-field"
                      placeholder={lang === 'ru' ? 'Название страны' : 'Country name'}
                      value={formData.customCountry}
                      onChange={(e) => setFormData({ ...formData, customCountry: e.target.value })}
                      style={errors.customCountry ? { borderColor: '#ef4444' } : undefined}
                    />
                    {errors.customCountry && <p style={{ fontSize: '0.75rem', color: '#ef4444', marginTop: '0.25rem' }}>{errors.customCountry}</p>}
                  </div>
                )}
              </div>
              {isRussia && <>
              <Field
                label={lang === 'ru' ? 'Область / Регион (по желанию)' : 'Oblast / Region (optional)'}
                value={formData.oblast}
                onChange={(v) => setFormData({ ...formData, oblast: v })}
              />
              <Field label={lang === 'ru' ? 'Город' : 'City'} value={formData.city} error={errors.city}
                onChange={(v) => setFormData({ ...formData, city: v })} />
              <Field label={lang === 'ru' ? 'Индекс' : 'ZIP / Postal code'} value={formData.zipCode} error={errors.zipCode}
                onChange={(v) => setFormData({ ...formData, zipCode: v })} />
              <Field label={lang === 'ru' ? 'Улица' : 'Street'} value={formData.street} error={errors.street}
                onChange={(v) => setFormData({ ...formData, street: v })} />
              <Field label={lang === 'ru' ? 'Дом' : 'House / Apt'} value={formData.house} error={errors.house}
                onChange={(v) => setFormData({ ...formData, house: v })} />
              <div>
                <Field label={lang === 'ru' ? 'Квартира (если есть)' : 'Apartment (if any)'} value={formData.apartment}
                  onChange={(v) => setFormData({ ...formData, apartment: v })} />
              </div>
              </>
              }
            </div>
          </div>

          {isRussia && <div className="checkout-form">
            <h2 className="checkout-heading">{lang === 'ru' ? 'Способ доставки' : 'Shipping method'}</h2>
            <div>
              <select
                className="form-field"
                value={formData.shippingMethod}
                onChange={(e) => setFormData({ ...formData, shippingMethod: e.target.value })}
              >
                {shippingMethods.map(m => (
                  <option key={m.key} value={m.key}>{m.label}</option>
                ))}
              </select>
            </div>
            {isRussia && (
              <div style={{ marginTop: '0.85rem', padding: '0.75rem 1rem', background: 'rgba(232,114,42,0.07)', borderRadius: '8px', fontSize: '0.82rem', color: 'var(--text-secondary)', lineHeight: 1.8 }}>
                {cart.map(item => (
                  <div key={item.productId} style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span>{item.name} — {item.quantity} шт.</span>
                    <span>{formatPrice(item.price * item.quantity)}</span>
                  </div>
                ))}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.4rem' }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                    <span>Доставка</span>
                    {deliveryEstimate && (
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem', padding: '0.15rem 0.6rem', background: 'rgba(255,255,255,0.04)', borderRadius: '20px', border: '1px solid rgba(255,255,255,0.08)', fontSize: '0.72rem', color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>
                        🗓 {deliveryEstimate}
                      </span>
                    )}
                  </span>
                  <span>{formatPrice(shippingCost)}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span>Способ оплаты</span>
                  <span>ЮKassa</span>
                </div>
              </div>
            )}
          </div>}

          {/* Non-Russia: show only foreign form prompt, hide everything else */}
          {!isRussia && (
            <div style={{ marginTop: '1rem', padding: '1.25rem', background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.25)', borderRadius: '10px' }}>
              <div style={{ display: 'flex', gap: '0.6rem', alignItems: 'flex-start', marginBottom: '1rem' }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, marginTop: '2px' }}>
                  <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/>
                  <line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
                </svg>
                <div>
                  <p style={{ fontSize: '0.85rem', color: 'var(--text-primary)', margin: '0 0 4px' }}><strong>Оплата принимается только российскими картами.</strong></p>
                  <p style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', margin: 0, lineHeight: 1.5 }}>Если у вас иностранная карта и/или доставка зарубеж — оставьте заявку.</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowForeignCard(true)}
                style={{ width: '100%', background: 'var(--orange)', border: 'none', color: '#fff', borderRadius: '7px', padding: '0.65rem 1rem', fontSize: '0.85rem', fontWeight: 600, cursor: 'pointer', transition: 'background 0.2s' }}
              >
                Оставить заявку
              </button>
            </div>
          )}
          {/* Consent checkboxes — only for Russia */}
          {isRussia && (
          <div style={{ marginTop: '1.5rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            <label style={{ display: 'flex', alignItems: 'flex-start', gap: '0.6rem', cursor: 'pointer', fontSize: '0.82rem', lineHeight: 1.5, color: 'var(--text-secondary)' }}>
              <input
                type="checkbox"
                checked={consentOferta}
                onChange={(e) => setConsentOferta(e.target.checked)}
                style={{ marginTop: '2px', flexShrink: 0, accentColor: 'var(--orange)' }}
              />
              <span>
                Я принимаю условия{' '}
                <a href="/oferta" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--orange)', textDecoration: 'underline' }}>Публичной оферты</a>
              </span>
            </label>
            {errors.consentOferta && <p style={{ fontSize: '0.75rem', color: '#ef4444', marginTop: '-0.5rem' }}>{errors.consentOferta}</p>}

            <label style={{ display: 'flex', alignItems: 'flex-start', gap: '0.6rem', cursor: 'pointer', fontSize: '0.82rem', lineHeight: 1.5, color: 'var(--text-secondary)' }}>
              <input
                type="checkbox"
                checked={consentData}
                onChange={(e) => setConsentData(e.target.checked)}
                style={{ marginTop: '2px', flexShrink: 0, accentColor: 'var(--orange)' }}
              />
              <span>
                Я согласен на обработку{' '}
                <a href="/privacy" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--orange)', textDecoration: 'underline' }}>персональных данных</a>
              </span>
            </label>
            {errors.consentData && <p style={{ fontSize: '0.75rem', color: '#ef4444', marginTop: '-0.5rem' }}>{errors.consentData}</p>}
          </div>
          )}

          {isRussia && <div className="cart-summary-inline" style={{ marginTop: '2rem', flexWrap: 'wrap', gap: '0.75rem' }}>
            <button type="button" onClick={() => setStep('cart')} className="cart-back-btn">
              ← Назад
            </button>
            <span style={{ flex: 1 }} />
            <span className="cart-total-label-inline">К оплате</span>
            <span className="cart-total-price-inline">{formatPrice(grandTotal)}</span>
            <button type="submit" className="cart-checkout-btn" disabled={submitting || hasUnavailableItems || !availabilityChecked}>
              {submitting ? 'Обработка...' : 'Перейти к оплате'}
            </button>
          </div>}

        </form>
      )}
      {showForeignCard && (
        <ForeignCardModal
          onClose={() => { setShowForeignCard(false); setForeignDone(false); }}
          foreignForm={foreignForm}
          setForeignForm={setForeignForm}
          submitting={foreignSubmitting}
          done={foreignDone}
          onSubmit={handleForeignSubmit}
        />
      )}
    </main>
  );
}
function ForeignCardModal({ onClose, foreignForm, setForeignForm, submitting, done, onSubmit }: {
  onClose: () => void;
  foreignForm: { name: string; phone: string; email: string; contact: string; consent: boolean };
  setForeignForm: (f: { name: string; phone: string; email: string; contact: string; consent: boolean }) => void;
  submitting: boolean;
  done: boolean;
  onSubmit: (e: React.FormEvent) => void;
}) {
  return (
    <div
      style={{ position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(0,0,0,0.65)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div style={{ background: 'var(--bg-card, #1a1a1a)', borderRadius: '14px', padding: '1.75rem 1.5rem', width: '100%', maxWidth: '420px', position: 'relative' }}>
        <button
          onClick={onClose}
          style={{ position: 'absolute', top: '1rem', right: '1rem', background: 'none', border: 'none', fontSize: '1.3rem', cursor: 'pointer', color: 'var(--text-secondary)' }}
          aria-label="Закрыть"
        >×</button>
        <h3 style={{ fontSize: '1.05rem', fontWeight: 700, marginBottom: '0.5rem' }}>Зарубеж</h3>
        <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', marginBottom: '1.25rem', lineHeight: 1.5 }}>
          Оставьте контакт — мы свяжемся и поможем оформить оплату удобным способом.
        </p>
        {done ? (
          <div style={{ textAlign: 'center', padding: '1.5rem 0' }}>
            <div style={{
              width: '64px', height: '64px', borderRadius: '50%',
              background: 'var(--orange)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              margin: '0 auto 1.25rem',
            }}>
              <svg width="28" height="28" fill="none" stroke="#fff" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <p style={{ fontWeight: 600, marginBottom: '0.4rem' }}>Заявка отправлена!</p>
            <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)' }}>Мы свяжемся с вами в ближайшее время.</p>
          </div>
        ) : (
          <form onSubmit={onSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.78rem', color: 'var(--text-secondary)', marginBottom: '0.35rem' }}>Имя *</label>
              <input
                type="text"
                className="form-field"
                value={foreignForm.name}
                onChange={(e) => setForeignForm({ ...foreignForm, name: e.target.value })}
                required
              />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '0.78rem', color: 'var(--text-secondary)', marginBottom: '0.35rem' }}>Email *</label>
              <input
                type="email"
                className="form-field"
                value={foreignForm.email}
                onChange={(e) => setForeignForm({ ...foreignForm, email: e.target.value })}
                required
              />
            </div>
            <PhoneInput
              label="Телефон"
              value={foreignForm.phone}
              onChange={(v) => setForeignForm({ ...foreignForm, phone: v })}
              countryCode=""
            />
            <div>
              <label style={{ display: 'block', fontSize: '0.78rem', color: 'var(--text-secondary)', marginBottom: '0.35rem' }}>Предпочтительный способ связи</label>
              <select
                className="form-field"
                value={foreignForm.contact}
                onChange={(e) => setForeignForm({ ...foreignForm, contact: e.target.value })}
              >
                <option value="telegram">Telegram</option>
                <option value="email">Email</option>
                <option value="phone">Телефон</option>
              </select>
            </div>
            <label style={{ display: 'flex', alignItems: 'flex-start', gap: '0.5rem', fontSize: '0.77rem', color: 'var(--text-secondary)', cursor: 'pointer', lineHeight: 1.5 }}>
              <input
                type="checkbox"
                checked={foreignForm.consent}
                onChange={(e) => setForeignForm({ ...foreignForm, consent: e.target.checked })}
                required
                style={{ marginTop: '2px', flexShrink: 0, accentColor: 'var(--orange)' }}
              />
              Согласен на обработку персональных данных
            </label>
            <button
              type="submit"
              className="cart-checkout-btn"
              disabled={submitting}
              style={{ width: '100%', marginTop: '2rem' }}
            >
              {submitting ? 'Отправка...' : 'Отправить заявку'}
            </button>
          </form>
        )}
      </div>
    </div>
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
