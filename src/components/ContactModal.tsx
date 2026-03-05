'use client';

import { useState, useEffect, useRef } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { t } from '@/lib/i18n';

interface ContactModalProps {
  onClose: () => void;
}

export function ContactModal({ onClose }: ContactModalProps) {
  const { lang } = useLanguage();
  const [form, setForm] = useState({ name: '', email: '', message: '' });
  const [sent, setSent] = useState(false);
  const [sending, setSending] = useState(false);
  const overlayRef = useRef<HTMLDivElement>(null);

  // Close on Escape
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [onClose]);

  const handleOverlayClick = (e: React.MouseEvent) => {
    if (e.target === overlayRef.current) onClose();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim() || !form.email.trim() || !form.message.trim()) return;

    setSending(true);
    try {
      const res = await fetch('/api/inquiries', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      if (res.ok) {
        setSent(true);
      } else {
        alert('Error sending message');
      }
    } catch {
      alert('Error sending message');
    }
    setSending(false);
  };

  return (
    <div className="modal-overlay" ref={overlayRef} onClick={handleOverlayClick}>
      <div className="modal-content">
        <button className="modal-close" onClick={onClose} aria-label="Close">
          <svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>

        {sent ? (
          <div className="text-center" style={{ padding: '2rem 0' }}>
            <div style={{ fontSize: '3rem', marginBottom: '1rem', color: '#22c55e' }}>✓</div>
            <h3 className="modal-title" style={{ textAlign: 'center' }}>{t(lang, 'contact.success.title')}</h3>
            <p className="modal-subtitle" style={{ textAlign: 'center' }}>
              {t(lang, 'contact.success.text')}
            </p>
            <button
              type="button"
              className="form-btn"
              onClick={onClose}
              style={{ marginTop: '1.5rem' }}
            >
              OK
            </button>
          </div>
        ) : (
          <>
            <h3 className="modal-title">{t(lang, 'contact.title')}</h3>
            <p className="modal-subtitle">{t(lang, 'contact.subtitle')}</p>

            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <input
                type="text"
                className="form-field"
                placeholder={t(lang, 'contact.name')}
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                required
              />
              <input
                type="email"
                className="form-field"
                placeholder={t(lang, 'contact.email')}
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                required
              />
              <textarea
                className="form-field"
                placeholder={t(lang, 'contact.message')}
                rows={4}
                value={form.message}
                onChange={(e) => setForm({ ...form, message: e.target.value })}
                required
                style={{ resize: 'vertical', minHeight: '100px' }}
              />
              <button
                type="submit"
                className="form-btn"
                disabled={sending}
              >
                {sending ? '...' : t(lang, 'contact.send')}
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  );
}
