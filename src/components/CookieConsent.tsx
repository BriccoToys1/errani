'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useLanguage } from '@/contexts/LanguageContext';
import { t } from '@/lib/i18n';

export function CookieConsent() {
  const { lang } = useLanguage();
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const accepted = localStorage.getItem('cookie_consent');
    if (!accepted) {
      // Small delay so it doesn't flash on page load
      const timer = setTimeout(() => setVisible(true), 800);
      return () => clearTimeout(timer);
    }
  }, []);

  const handleAccept = () => {
    localStorage.setItem('cookie_consent', '1');
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
