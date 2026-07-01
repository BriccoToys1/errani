'use client';

import { useState, useEffect, useCallback } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { getCart, updateQuantity, removeFromCart, clearCart, getCartTotal, CartItem } from '@/lib/cart';
import { formatPrice, COUNTRIES } from '@/lib/utils';
import { useLanguage } from '@/contexts/LanguageContext';
import { t } from '@/lib/i18n';
import { PhoneInput } from '@/components/PhoneInput';
import { CdekPickupLocation, CdekPickupMap, CdekPickupPoint } from '@/components/CdekPickupMap';

interface CdekDeliveryQuote {
  amount: number;
  periodMin: number;
  periodMax: number;
  tariffCode: number;
  mode: 'courier' | 'pickup';
}

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
    shippingMethod: 'cdek_courier',
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitError, setSubmitError] = useState('');
  const [consentOferta, setConsentOferta] = useState(false);
  const [consentData, setConsentData] = useState(false);
  const [unavailableProductIds, setUnavailableProductIds] = useState<Set<string>>(new Set());
  const [availabilityChecked, setAvailabilityChecked] = useState(false);
  type ProductData = { id: string; inStock: boolean; isActive: boolean; stock: number; isSaleDisabled?: boolean; shippingFee?: number; freeDelivery?: boolean; noticeText?: string; noticeTextEn?: string };
  const [productMap, setProductMap] = useState<Map<string, ProductData>>(new Map());
  const [selectedPickupPoint, setSelectedPickupPoint] = useState<CdekPickupPoint | null>(null);
  const [deliveryQuote, setDeliveryQuote] = useState<CdekDeliveryQuote | null>(null);
  const [deliveryLoading, setDeliveryLoading] = useState(false);
  const [deliveryError, setDeliveryError] = useState('');

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

        type ProductData = { id: string; inStock: boolean; isActive: boolean; stock: number; isSaleDisabled?: boolean; shippingFee?: number; freeDelivery?: boolean; noticeText?: string; noticeTextEn?: string };
        const byId = new Map<string, ProductData>(
          products.map((p: ProductData) => [p.id, p])
        );

        const blocked = new Set<string>();
        for (const item of cart) {
          const p = byId.get(item.productId);
          if (!p || !p.isActive || !p.inStock || p.isSaleDisabled || p.stock <= 0 || item.quantity > p.stock) {
            blocked.add(item.productId);
          }
        }
        setUnavailableProductIds(blocked);
        setProductMap(byId);
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
  const deliveryMode = formData.shippingMethod === 'cdek_pvz' ? 'pickup' : 'courier';

  useEffect(() => {
    if (formData.country === 'RU' && !['cdek_courier', 'cdek_pvz'].includes(formData.shippingMethod)) {
      setFormData(prev => ({ ...prev, shippingMethod: 'cdek_courier' }));
    }
  }, [formData.country, formData.shippingMethod]);

  const handleQty = (id: string, qty: number) => setCart(updateQuantity(id, qty));
  const handleRemove = (id: string) => setCart(removeFromCart(id));
  const total = getCartTotal(cart);
  const shippingCost = isRussia ? (deliveryQuote?.amount || 0) : 0;

  const cartNotices = cart
    .map(item => {
      const pData = productMap.get(item.productId);
      return lang === 'ru' ? (pData?.noticeText || '') : (pData?.noticeTextEn || '');
    })
    .filter((t, i, arr) => t && arr.indexOf(t) === i);
  const grandTotal = total + shippingCost;
  const unavailableItems = cart.filter(item => unavailableProductIds.has(item.productId));
  const hasUnavailableItems = unavailableItems.length > 0;

  const handlePickupLocationChange = useCallback((location: CdekPickupLocation | null) => {
    setSelectedPickupPoint(null);
    setDeliveryQuote(null);
    setDeliveryError('');
    if (!location) return;
    setFormData(prev => ({
      ...prev,
      oblast: location.region || prev.oblast,
      city: location.city,
      zipCode: location.postalCode || location.postalCodes[0] || '',
      street: '',
      house: '',
      apartment: '',
    }));
  }, []);

  const handlePickupSelect = useCallback((point: CdekPickupPoint) => {
    setSelectedPickupPoint(point);
    setDeliveryQuote(null);
    setDeliveryError('');
    setFormData(prev => ({
      ...prev,
      city: point.city,
      zipCode: point.postalCode || prev.zipCode,
    }));
  }, []);

  useEffect(() => {
    if (!isRussia || cart.length === 0) {
      setDeliveryQuote(null);
      setDeliveryError('');
      setDeliveryLoading(false);
      return;
    }

    const courierReady = formData.city.trim().length >= 2
      && formData.street.trim().length >= 2
      && formData.house.trim().length >= 1;
    const pickupReady = Boolean(selectedPickupPoint);
    if ((deliveryMode === 'courier' && !courierReady) || (deliveryMode === 'pickup' && !pickupReady)) {
      setDeliveryQuote(null);
      setDeliveryError('');
      setDeliveryLoading(false);
      return;
    }

    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      setDeliveryLoading(true);
      setDeliveryError('');
      try {
        const response = await fetch('/api/delivery/cdek', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          signal: controller.signal,
          body: JSON.stringify({
            country: 'RU',
            shippingMethod: formData.shippingMethod,
            city: formData.city,
            oblast: formData.oblast,
            zipCode: formData.zipCode,
            street: formData.street,
            house: formData.house,
            items: cart.map(item => ({ productId: item.productId, quantity: item.quantity })),
            cdekDeliveryPoint: selectedPickupPoint,
          }),
        });
        const data = await response.json();
        if (!response.ok) throw new Error(lang === 'ru'
          ? (data.error || 'Не удалось рассчитать доставку СДЭК.')
          : 'Could not calculate CDEK delivery.');
        setDeliveryQuote(data);
      } catch (error) {
        if (error instanceof Error && error.name === 'AbortError') return;
        setDeliveryQuote(null);
        setDeliveryError(error instanceof Error
          ? error.message
          : (lang === 'ru' ? 'Не удалось рассчитать доставку СДЭК.' : 'Could not calculate CDEK delivery.'));
      } finally {
        if (!controller.signal.aborted) setDeliveryLoading(false);
      }
    }, 550);

    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [cart, deliveryMode, formData.city, formData.country, formData.house, formData.shippingMethod, formData.street, formData.zipCode, isRussia, lang, selectedPickupPoint]);

  const validate = () => {
    const e: Record<string, string> = {};
    
    // Last name validation
    if (!formData.lastName.trim()) {
      e.lastName = lang === 'ru' ? 'Введите фамилию' : 'Enter your last name';
    } else if (!/^[\p{L}\s\-']+$/u.test(formData.lastName.trim())) {
      e.lastName = lang === 'ru' ? 'Фамилия может содержать только буквы' : 'Last name may contain letters only';
    }

    // First name validation
    if (!formData.firstName.trim()) {
      e.firstName = lang === 'ru' ? 'Введите имя' : 'Enter your first name';
    } else if (!/^[\p{L}\s\-']+$/u.test(formData.firstName.trim())) {
      e.firstName = lang === 'ru' ? 'Имя может содержать только буквы' : 'First name may contain letters only';
    }

    // Middle name validation (if not checked "no middle name")
    if (!formData.noMiddleName && !formData.middleName.trim()) {
      e.middleName = lang === 'ru' ? 'Введите отчество' : 'Enter your middle name';
    }
    
    // Email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
    if (!formData.email.trim()) {
      e.email = lang === 'ru' ? 'Введите email' : 'Enter your email';
    } else if (!emailRegex.test(formData.email.trim())) {
      e.email = lang === 'ru' ? 'Введите корректный email' : 'Enter a valid email';
    }
    
    // Phone validation - minimum 10 digits
    const phoneDigits = formData.phone.replace(/\D/g, '');
    if (phoneDigits.length < 10) {
      e.phone = lang === 'ru' ? 'Введите корректный телефон (минимум 10 цифр)' : 'Enter a valid phone number (at least 10 digits)';
    }

    // Custom country validation
    if (formData.country === 'OTHER' && !formData.customCountry.trim()) {
      e.customCountry = lang === 'ru' ? 'Введите название страны' : 'Enter the country name';
    }
    
    if (deliveryMode === 'courier') {
      if (!formData.city.trim()) {
        e.city = lang === 'ru' ? 'Введите город' : 'Enter your city';
      } else if (formData.city.trim().length < 2) {
        e.city = lang === 'ru' ? 'Название города слишком короткое' : 'City name is too short';
      }
      const zipTrimmed = formData.zipCode.trim();
      if (zipTrimmed && !/^\d{6}$/.test(zipTrimmed)) {
        e.zipCode = lang === 'ru' ? 'Индекс должен содержать 6 цифр' : 'Postal code must contain 6 digits';
      }
      if (!formData.street.trim()) e.street = lang === 'ru' ? 'Введите улицу' : 'Enter your street';
      if (!formData.house.trim()) e.house = lang === 'ru' ? 'Введите дом' : 'Enter your house number';
    } else if (!selectedPickupPoint) {
      e.delivery = lang === 'ru' ? 'Выберите пункт выдачи СДЭК' : 'Choose a CDEK pickup point';
    }

    const hasDeliveryFieldError = ['city', 'zipCode', 'street', 'house', 'delivery'].some(field => e[field]);
    if (isRussia && !hasDeliveryFieldError && !deliveryQuote) {
      e.delivery = deliveryLoading
        ? (lang === 'ru' ? 'Дождитесь завершения расчёта доставки' : 'Wait for the delivery calculation to finish')
        : deliveryError || (lang === 'ru' ? 'Не удалось подтвердить адрес и рассчитать доставку' : 'Could not verify the address and calculate delivery');
    }

    // Consent validation
    if (!consentOferta) e.consentOferta = lang === 'ru' ? 'Необходимо принять условия оферты' : 'You must accept the public offer';
    if (!consentData) e.consentData = lang === 'ru' ? 'Необходимо дать согласие на обработку данных' : 'You must consent to personal data processing';
    
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitError('');
    if (hasUnavailableItems) {
      alert(lang === 'ru'
        ? 'Некоторые товары в корзине сейчас недоступны. Удалите их, чтобы продолжить оформление.'
        : 'Some products in your cart are currently unavailable. Remove them to continue.');
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
          items: cart.map(item => ({ productId: item.productId, quantity: item.quantity, selectedColor: item.selectedColor })),
          cdekDeliveryPoint: selectedPickupPoint,
          language: lang,
          shippingCost,
          totalAmount: grandTotal,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(lang === 'ru'
        ? (data.error || 'Ошибка при оформлении заказа. Попробуйте ещё раз.')
        : 'Could not place the order. Check your details and try again.');

      if (data.paymentUrl) {
        clearCart();
        window.location.href = data.paymentUrl;
        return;
      }

      setOrderNumber(data.orderNumber || '');
      clearCart();
      setCart([]);
      setStep('done');
    } catch (err) {
      const message = err instanceof Error
        ? err.message
        : (lang === 'ru' ? 'Ошибка при оформлении заказа. Попробуйте ещё раз.' : 'Could not place the order. Try again.');
      setSubmitError(message);
      alert(message);
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
      alert(lang === 'ru' ? 'Ошибка при отправке. Попробуйте ещё раз.' : 'Could not send your request. Try again.');
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
        <div style={{ fontSize: '3rem', marginBottom: '1.5rem' }}><svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#22c55e" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg></div>
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
            {step === 'cart' ? '1' : <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>}
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
                {item.selectedColor && (
                  <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', marginTop: '3px' }}>
                    {lang === 'ru' ? 'Цвет' : 'Color'}: {item.selectedColor}
                  </div>
                )}
                {(() => { const pData = productMap.get(item.productId); const notice = lang === 'ru' ? pData?.noticeText : pData?.noticeTextEn; return notice ? <div style={{ fontSize: '0.75rem', color: '#ffb400', fontWeight: 600, marginTop: 4 }}>⚠ {notice}</div> : null; })()}
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
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4a1 1 0 011-1h4a1 1 0 011 1v2"/></svg>
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
                label={lang === 'ru' ? 'Телефон' : 'Phone'}
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
                  {COUNTRIES.map(c => <option key={c.code} value={c.code}>{lang === 'ru' ? c.name : c.nameEn}</option>)}
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
              {isRussia && (
                <>
                  <div className="full-width">
                    <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '0.5rem' }}>
                      {lang === 'ru' ? 'Способ доставки СДЭК' : 'CDEK delivery method'}
                    </label>
                    <div className="cdek-delivery-switch" role="group" aria-label={lang === 'ru' ? 'Способ доставки СДЭК' : 'CDEK delivery method'}>
                      <button
                        type="button"
                        className={deliveryMode === 'courier' ? 'active' : ''}
                        aria-pressed={deliveryMode === 'courier'}
                        onClick={() => {
                          setFormData(prev => ({ ...prev, shippingMethod: 'cdek_courier', zipCode: '' }));
                          setSelectedPickupPoint(null);
                          setDeliveryQuote(null);
                          setDeliveryError('');
                        }}
                      >
                        {lang === 'ru' ? 'Курьером' : 'Courier'}
                      </button>
                      <button
                        type="button"
                        className={deliveryMode === 'pickup' ? 'active' : ''}
                        aria-pressed={deliveryMode === 'pickup'}
                        onClick={() => {
                          setFormData(prev => ({ ...prev, shippingMethod: 'cdek_pvz' }));
                          setDeliveryQuote(null);
                          setDeliveryError('');
                        }}
                      >
                        {lang === 'ru' ? 'Пункт выдачи' : 'Pickup point'}
                      </button>
                    </div>
                  </div>

                  {deliveryMode === 'courier' ? (
                    <>
                      <Field
                        label={lang === 'ru' ? 'Область / Регион (по желанию)' : 'Oblast / Region (optional)'}
                        value={formData.oblast}
                        onChange={(v) => setFormData({ ...formData, oblast: v })}
                      />
                      <Field label={lang === 'ru' ? 'Город' : 'City'} value={formData.city} error={errors.city}
                        onChange={(v) => setFormData({ ...formData, city: v })} />
                      <Field label={lang === 'ru' ? 'Улица' : 'Street'} value={formData.street} error={errors.street}
                        onChange={(v) => setFormData({ ...formData, street: v })} />
                      <Field label={lang === 'ru' ? 'Дом' : 'House'} value={formData.house} error={errors.house}
                        onChange={(v) => setFormData({ ...formData, house: v })} />
                      <div>
                        <Field label={lang === 'ru' ? 'Квартира (если есть)' : 'Apartment (if any)'} value={formData.apartment}
                          onChange={(v) => setFormData({ ...formData, apartment: v })} />
                      </div>
                    </>
                  ) : (
                    <div className="full-width">
                      <CdekPickupMap
                        selectedPoint={selectedPickupPoint}
                        onSelect={handlePickupSelect}
                        onLocationChange={handlePickupLocationChange}
                        lang={lang}
                      />
                    </div>
                  )}
                  {errors.delivery && <p className="full-width" style={{ fontSize: '0.75rem', color: '#ef4444', marginTop: '-0.25rem' }}>{errors.delivery}</p>}
                </>
              )}
            </div>
          </div>

          {isRussia && <div className="checkout-form">
            <h2 className="checkout-heading">{lang === 'ru' ? 'Ваш заказ' : 'Your order'}</h2>
            {isRussia && (
              <div style={{ marginTop: '0.85rem', padding: '0.75rem 1rem', background: 'rgba(232,114,42,0.07)', borderRadius: '8px', fontSize: '0.82rem', color: 'var(--text-secondary)', lineHeight: 1.8 }}>
                {cart.map(item => (
                  <div key={item.productId} style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span>{item.name} — {item.quantity} {lang === 'ru' ? 'шт.' : 'pcs.'}</span>
                    <span>{formatPrice(item.price * item.quantity)}</span>
                  </div>
                ))}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.4rem' }}>
                  <span>{lang === 'ru' ? 'Доставка' : 'Delivery'}</span>
                  <span style={{ color: deliveryError ? '#ef4444' : undefined }}>
                    {deliveryLoading
                      ? (lang === 'ru' ? 'Рассчитываем…' : 'Calculating…')
                      : deliveryQuote
                        ? (deliveryQuote.amount === 0
                          ? (lang === 'ru' ? 'Бесплатно' : 'Free')
                          : formatPrice(shippingCost))
                        : deliveryError || (lang === 'ru'
                          ? (deliveryMode === 'pickup' ? 'Выберите пункт выдачи' : 'Введите адрес')
                          : (deliveryMode === 'pickup' ? 'Choose a pickup point' : 'Enter an address'))}
                  </span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span>{lang === 'ru' ? 'Способ оплаты' : 'Payment method'}</span>
                  <span>{lang === 'ru' ? 'Картой/СБП' : 'Card / SBP'}</span>
                </div>
                {cartNotices.length > 0 && (
                  <div style={{ marginTop: '0.6rem', paddingTop: '0.6rem', borderTop: '1px solid var(--border)' }}>
                    {cartNotices.map((n, i) => (
                      <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: '0.4rem', color: '#ffb400', fontSize: '0.78rem', fontWeight: 600, lineHeight: 1.5 }}>
                        <span style={{ flexShrink: 0 }}>⚠️</span><span>{n}</span>
                      </div>
                    ))}
                  </div>
                )}
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
                  <p style={{ fontSize: '0.85rem', color: 'var(--text-primary)', margin: '0 0 4px' }}><strong>
                    {lang === 'ru' ? 'Оплата принимается только российскими картами.' : 'Only Russian bank cards are accepted online.'}
                  </strong></p>
                  <p style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', margin: 0, lineHeight: 1.5 }}>
                    {lang === 'ru'
                      ? 'Если у вас иностранная карта и/или доставка зарубеж — оставьте заявку.'
                      : 'If you have a foreign card and/or need international delivery, send us a request.'}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowForeignCard(true)}
                style={{ width: '100%', background: 'var(--orange)', border: 'none', color: '#fff', borderRadius: '7px', padding: '0.65rem 1rem', fontSize: '0.85rem', fontWeight: 600, cursor: 'pointer', transition: 'background 0.2s' }}
              >
                {lang === 'ru' ? 'Оставить заявку' : 'Send a request'}
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
                {lang === 'ru' ? 'Я принимаю условия ' : 'I accept the terms of the '}
                <a href="/oferta" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--orange)', textDecoration: 'underline' }}>
                  {lang === 'ru' ? 'Публичной оферты' : 'Public Offer'}
                </a>
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
                {lang === 'ru' ? 'Я согласен на обработку ' : 'I consent to the processing of my '}
                <a href="/privacy" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--orange)', textDecoration: 'underline' }}>
                  {lang === 'ru' ? 'персональных данных' : 'personal data'}
                </a>
              </span>
            </label>
            {errors.consentData && <p style={{ fontSize: '0.75rem', color: '#ef4444', marginTop: '-0.5rem' }}>{errors.consentData}</p>}
          </div>
          )}

          {isRussia && <div className="cart-summary-inline" style={{ marginTop: '2rem', flexWrap: 'wrap', gap: '0.75rem' }}>
            {submitError && (
              <div style={{ width: '100%', padding: '0.85rem 1rem', borderRadius: '10px', border: '1px solid rgba(239,68,68,0.35)', background: 'rgba(239,68,68,0.08)', color: '#ef4444', fontSize: '0.84rem', lineHeight: 1.5 }}>
                {submitError}
              </div>
            )}
            <button type="button" onClick={() => setStep('cart')} className="cart-back-btn">
              ← {lang === 'ru' ? 'Назад' : 'Back'}
            </button>
            <span style={{ flex: 1 }} />
            <span className="cart-total-label-inline">{lang === 'ru' ? 'К оплате' : 'Total due'}</span>
            <span className="cart-total-price-inline">{formatPrice(grandTotal)}</span>
            <button type="submit" className="cart-checkout-btn" disabled={submitting || hasUnavailableItems || !availabilityChecked}>
              {submitting
                ? (lang === 'ru' ? 'Обработка...' : 'Processing...')
                : (lang === 'ru' ? 'Перейти к оплате' : 'Proceed to payment')}
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
          lang={lang}
        />
      )}
    </main>
  );
}
function ForeignCardModal({ onClose, foreignForm, setForeignForm, submitting, done, onSubmit, lang }: {
  onClose: () => void;
  foreignForm: { name: string; phone: string; email: string; contact: string; consent: boolean };
  setForeignForm: (f: { name: string; phone: string; email: string; contact: string; consent: boolean }) => void;
  submitting: boolean;
  done: boolean;
  onSubmit: (e: React.FormEvent) => void;
  lang: 'ru' | 'en';
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
          aria-label={lang === 'ru' ? 'Закрыть' : 'Close'}
        >×</button>
        <h3 style={{ fontSize: '1.05rem', fontWeight: 700, marginBottom: '0.5rem' }}>
          {lang === 'ru' ? 'Зарубеж' : 'International order'}
        </h3>
        <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', marginBottom: '1.25rem', lineHeight: 1.5 }}>
          {lang === 'ru'
            ? 'Оставьте контакт — мы свяжемся и поможем оформить оплату удобным способом.'
            : 'Leave your contact details and we will help arrange a convenient payment method.'}
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
            <p style={{ fontWeight: 600, marginBottom: '0.4rem' }}>{lang === 'ru' ? 'Заявка отправлена!' : 'Request sent!'}</p>
            <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
              {lang === 'ru' ? 'Мы свяжемся с вами в ближайшее время.' : 'We will contact you soon.'}
            </p>
          </div>
        ) : (
          <form onSubmit={onSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.78rem', color: 'var(--text-secondary)', marginBottom: '0.35rem' }}>
                {lang === 'ru' ? 'Имя *' : 'Name *'}
              </label>
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
              label={lang === 'ru' ? 'Телефон' : 'Phone'}
              value={foreignForm.phone}
              onChange={(v) => setForeignForm({ ...foreignForm, phone: v })}
              countryCode=""
            />
            <div>
              <label style={{ display: 'block', fontSize: '0.78rem', color: 'var(--text-secondary)', marginBottom: '0.35rem' }}>
                {lang === 'ru' ? 'Предпочтительный способ связи' : 'Preferred contact method'}
              </label>
              <select
                className="form-field"
                value={foreignForm.contact}
                onChange={(e) => setForeignForm({ ...foreignForm, contact: e.target.value })}
              >
                <option value="telegram">Telegram</option>
                <option value="email">Email</option>
                <option value="phone">{lang === 'ru' ? 'Телефон' : 'Phone'}</option>
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
              {lang === 'ru' ? 'Согласен на обработку персональных данных' : 'I consent to personal data processing'}
            </label>
            <button
              type="submit"
              className="cart-checkout-btn"
              disabled={submitting}
              style={{ width: '100%', marginTop: '2rem' }}
            >
              {submitting
                ? (lang === 'ru' ? 'Отправка...' : 'Sending...')
                : (lang === 'ru' ? 'Отправить заявку' : 'Send request')}
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
