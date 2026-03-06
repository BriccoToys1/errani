'use client';

import { useState, useRef, useEffect } from 'react';

export const PHONE_CODES = [
  { code: 'RU', dial: '+7', flag: '🇷🇺', mask: '(___) ___-__-__' },
  { code: 'BY', dial: '+375', flag: '🇧🇾', mask: '(__) ___-__-__' },
  { code: 'KZ', dial: '+7', flag: '🇰🇿', mask: '(___) ___-__-__' },
  { code: 'UA', dial: '+380', flag: '🇺🇦', mask: '(__) ___-__-__' },
  { code: 'UZ', dial: '+998', flag: '🇺🇿', mask: '(__) ___-__-__' },
  { code: 'KG', dial: '+996', flag: '🇰🇬', mask: '(___) ___-___' },
  { code: 'TJ', dial: '+992', flag: '🇹🇯', mask: '(__) ___-____' },
  { code: 'AM', dial: '+374', flag: '🇦🇲', mask: '(__) ___-___' },
  { code: 'AZ', dial: '+994', flag: '🇦🇿', mask: '(__) ___-__-__' },
  { code: 'GE', dial: '+995', flag: '🇬🇪', mask: '(___) ___-___' },
  { code: 'MD', dial: '+373', flag: '🇲🇩', mask: '(__) ___-___' },
  { code: 'DE', dial: '+49', flag: '🇩🇪', mask: '' },
  { code: 'FR', dial: '+33', flag: '🇫🇷', mask: '' },
  { code: 'IT', dial: '+39', flag: '🇮🇹', mask: '' },
  { code: 'ES', dial: '+34', flag: '🇪🇸', mask: '' },
  { code: 'GB', dial: '+44', flag: '🇬🇧', mask: '' },
  { code: 'US', dial: '+1', flag: '🇺🇸', mask: '(___) ___-____' },
  { code: 'CA', dial: '+1', flag: '🇨🇦', mask: '(___) ___-____' },
  { code: 'AU', dial: '+61', flag: '🇦🇺', mask: '' },
  { code: 'JP', dial: '+81', flag: '🇯🇵', mask: '' },
  { code: 'CN', dial: '+86', flag: '🇨🇳', mask: '' },
  { code: 'KR', dial: '+82', flag: '🇰🇷', mask: '' },
  { code: 'TR', dial: '+90', flag: '🇹🇷', mask: '' },
  { code: 'AE', dial: '+971', flag: '🇦🇪', mask: '' },
  { code: 'IL', dial: '+972', flag: '🇮🇱', mask: '' },
  { code: 'TH', dial: '+66', flag: '🇹🇭', mask: '' },
  { code: 'IN', dial: '+91', flag: '🇮🇳', mask: '' },
  { code: 'BR', dial: '+55', flag: '🇧🇷', mask: '' },
  { code: 'PL', dial: '+48', flag: '🇵🇱', mask: '' },
  { code: 'OTHER', dial: '+', flag: '🌍', mask: '' },
];

interface PhoneInputProps {
  value: string;
  onChange: (value: string) => void;
  countryCode?: string;
  error?: string;
  label?: string;
}

export function PhoneInput({ value, onChange, countryCode = 'RU', error, label }: PhoneInputProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [selectedCode, setSelectedCode] = useState(() => {
    return PHONE_CODES.find(p => p.code === countryCode) || PHONE_CODES[0];
  });
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Update selected code when countryCode prop changes
  useEffect(() => {
    const found = PHONE_CODES.find(p => p.code === countryCode);
    if (found) setSelectedCode(found);
  }, [countryCode]);

  // Close dropdown on click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSelectCode = (code: typeof PHONE_CODES[0]) => {
    setSelectedCode(code);
    setIsOpen(false);
    // Keep only numbers from existing value
    const numbers = value.replace(/\D/g, '').replace(/^7|^8/, '');
    onChange(`${code.dial}${numbers}`);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const input = e.target.value;
    // Allow only numbers, spaces, dashes, and parentheses
    const cleaned = input.replace(/[^\d\s\-()]/g, '');
    onChange(`${selectedCode.dial}${cleaned}`);
  };

  // Extract number part without dial code
  const getDisplayValue = () => {
    if (value.startsWith(selectedCode.dial)) {
      return value.slice(selectedCode.dial.length);
    }
    return value.replace(/^\+\d+/, '');
  };

  return (
    <div className="phone-input-wrapper">
      {label && <label className="phone-input-label">{label}</label>}
      <div className={`phone-input-container ${error ? 'phone-input-error' : ''}`} ref={dropdownRef}>
        <button
          type="button"
          className="phone-input-code-btn"
          onClick={() => setIsOpen(!isOpen)}
        >
          <span className="phone-input-flag">{selectedCode.flag}</span>
          <span className="phone-input-dial">{selectedCode.dial}</span>
          <svg className="phone-input-chevron" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <polyline points="6 9 12 15 18 9" />
          </svg>
        </button>
        <input
          type="tel"
          className="phone-input-field"
          value={getDisplayValue()}
          onChange={handleInputChange}
          placeholder={selectedCode.mask || '000000000'}
        />
        {isOpen && (
          <div className="phone-input-dropdown">
            {PHONE_CODES.map((code) => (
              <button
                key={code.code}
                type="button"
                className={`phone-input-option ${code.code === selectedCode.code ? 'active' : ''}`}
                onClick={() => handleSelectCode(code)}
              >
                <span className="phone-input-flag">{code.flag}</span>
                <span className="phone-input-dial">{code.dial}</span>
              </button>
            ))}
          </div>
        )}
      </div>
      {error && <span className="phone-input-error-text">{error}</span>}
    </div>
  );
}

export default PhoneInput;
