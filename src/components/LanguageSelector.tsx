'use client';

import { useState, useRef, useEffect } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { LANGUAGES } from '@/lib/i18n';

export function LanguageSelector() {
  const { lang, setLang } = useLanguage();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  return (
    <div className="lang-selector" ref={ref}>
      <button
        type="button"
        className={`lang-btn bottom-nav-icon ${open ? 'open' : ''}`}
        onClick={() => setOpen((o) => !o)}
        aria-label="Language"
      >
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 2a15.3 15.3 0 014 10 15.3 15.3 0 01-4 10 15.3 15.3 0 01-4-10 15.3 15.3 0 014-10z"/><path d="M2 12h20"/></svg>
      </button>

      {open && (
        <div className="lang-dropdown">
          {LANGUAGES.map((l) => (
            <button
              key={l.code}
              type="button"
              className={`lang-option ${l.code === lang ? 'active' : ''}`}
              onClick={() => {
                setLang(l.code);
                setOpen(false);
              }}
            >
              {l.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
