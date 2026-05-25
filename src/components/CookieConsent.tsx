'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useLanguage } from '@/contexts/LanguageContext';
import { t } from '@/lib/i18n';

const CONSENT_KEY = 'errani_consent';

function hasConsent(): boolean {
  try {
    if (localStorage.getItem(CONSENT_KEY) === '1') return true;
  } catch { /* ignore */ }
  try {
    return document.cookie.split(';').some(c => c.trim().startsWith(`${CONSENT_KEY}=1`));
  } catch { /* ignore */ }
  return false;
}

function saveConsent() {
  try {
    localStorage.setItem(CONSENT_KEY, '1');
  } catch { /* ignore */ }
  try {
    const exp = new Date();
    exp.setFullYear(exp.getFullYear() + 1);
    document.cookie = `${CONSENT_KEY}=1; expires=${exp.toUTCString()}; path=/; SameSite=Lax`;
  } catch { /* ignore */ }
}

export function CookieConsent() {
  const { lang } = useLanguage();
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!hasConsent()) {
      const timer = setTimeout(() => setVisible(true), 800);
      return () => clearTimeout(timer);
    }
  }, []);

  const handleAccept = () => {
    saveConsent();
    setVisible(false);
  };

  if (!visible) return null;

  return (
    <div className="cookie-banner">
      <p className="cookie-text">
        {t(lang, 'cookie.text')}{' '}
        <Link href="/privacy" className="cookie-link">
          {t(lang, 'cookie.privacy')}
        </Link>
      </p>
      <button className="cookie-accept" onClick={handleAccept}>
        {t(lang, 'cookie.accept')}
      </button>
    </div>
  );
}
