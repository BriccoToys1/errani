'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';

type InviteState = {
  valid: boolean;
  expired: boolean;
  alreadyUsed: boolean;
  invite?: { email: string; customerName: string; expiresAt: string | null };
  product?: { id: string; slug: string; name: string; nameRu: string | null; image: string };
};

// ─── Half-star rating ─────────────────────────────────────────────────────────
function StarRating({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  const [hover, setHover] = useState<number | null>(null);

  const display = hover ?? value;

  return (
    <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
      {[1, 2, 3, 4, 5].map((star) => {
        const full = display >= star;
        const half = !full && display >= star - 0.5;
        return (
          <span
            key={star}
            style={{ position: 'relative', width: 36, height: 36, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 28 }}
            onMouseLeave={() => setHover(null)}
          >
            {/* Left half — half star */}
            <span
              style={{ position: 'absolute', left: 0, top: 0, width: '50%', height: '100%', zIndex: 1 }}
              onMouseEnter={() => setHover(star - 0.5)}
              onClick={() => onChange(star - 0.5)}
            />
            {/* Right half — full star */}
            <span
              style={{ position: 'absolute', right: 0, top: 0, width: '50%', height: '100%', zIndex: 1 }}
              onMouseEnter={() => setHover(star)}
              onClick={() => onChange(star)}
            />
            {full ? (
              <svg width="28" height="28" viewBox="0 0 24 24" fill="#FFD700" stroke="#FFD700" strokeWidth="1">
                <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
              </svg>
            ) : half ? (
              <svg width="28" height="28" viewBox="0 0 24 24" stroke="#FFD700" strokeWidth="1">
                <defs>
                  <linearGradient id={`half-${star}`}>
                    <stop offset="50%" stopColor="#FFD700" />
                    <stop offset="50%" stopColor="transparent" />
                  </linearGradient>
                </defs>
                <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"
                  fill={`url(#half-${star})`} />
              </svg>
            ) : (
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="rgba(255,215,0,0.3)" strokeWidth="1">
                <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
              </svg>
            )}
          </span>
        );
      })}
      <span style={{ fontSize: 14, color: 'rgba(255,215,0,0.8)', marginLeft: 6, fontWeight: 600 }}>
        {display > 0 ? display.toFixed(1) : ''}
      </span>
    </div>
  );
}

// ─── Main form ────────────────────────────────────────────────────────────────
export default function ReviewForm({ token }: { token: string }) {
  const { lang } = useLanguage();
  const [loading, setLoading] = useState(true);
  const [state, setState] = useState<InviteState | null>(null);
  const [error, setError] = useState('');

  const [customerName, setCustomerName] = useState('');
  const [rating, setRating] = useState(0);
  const [text, setText] = useState('');

  const [media, setMedia] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  const T = {
    title: lang === 'ru' ? 'Отзыв о' : 'Review for',
    subtitle: lang === 'ru'
      ? 'Ссылка персональная и одноразовая. После отправки изменить отзыв нельзя.'
      : 'The link is personal and one-time. The review cannot be changed after submission.',
    checking: lang === 'ru' ? 'Проверяем ссылку...' : 'Checking link...',
    alreadyUsed: lang === 'ru' ? 'Эта ссылка уже использована.' : 'This link has already been used.',
    expired: lang === 'ru' ? 'Срок действия ссылки истёк.' : 'This link has expired.',
    invalid: lang === 'ru' ? 'Ссылка недействительна.' : 'The link is invalid.',
    successMsg: lang === 'ru' ? 'Спасибо! Отзыв отправлен на модерацию.' : 'Thank you! Your review has been submitted for moderation.',
    yourName: lang === 'ru' ? 'Ваше имя' : 'Your name',
    rating: lang === 'ru' ? 'Оценка' : 'Rating',
    reviewText: lang === 'ru' ? 'Текст отзыва' : 'Review text',
    reviewPlaceholder: lang === 'ru' ? 'Поделитесь впечатлениями...' : 'Share your impressions...',
    mediaLabel: lang === 'ru' ? 'Фото и видео' : 'Photos & Videos',
    attachFiles: lang === 'ru' ? 'Прикрепить файлы' : 'Attach files',
    mediaHint: lang === 'ru' ? 'До 8 файлов: фото (JPG, PNG, WEBP до 12 MB) или видео до 1 минуты (MP4, MOV до 40 MB)' : 'Up to 8 files: photos (JPG, PNG, WEBP up to 12 MB) or videos up to 1 min (MP4, MOV up to 40 MB)',
    submit: lang === 'ru' ? 'Отправить отзыв' : 'Submit review',
    sending: lang === 'ru' ? 'Отправка...' : 'Sending...',
    uploading: lang === 'ru' ? 'Загрузка файлов...' : 'Uploading files...',
    networkError: lang === 'ru' ? 'Ошибка сети. Попробуйте позже.' : 'Network error. Please try again.',
  };

  useEffect(() => {
    let canceled = false;
    const load = async () => {
      setLoading(true); setError('');
      try {
        const res = await fetch(`/api/reviews?token=${encodeURIComponent(token)}`);
        const data = await res.json();
        if (!res.ok) { if (!canceled) setError(data.message || T.networkError); return; }
        if (!canceled) { setState(data); setCustomerName(data?.invite?.customerName || ''); }
      } catch { if (!canceled) setError(T.networkError); }
      finally { if (!canceled) setLoading(false); }
    };
    load();
    return () => { canceled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  const canSubmit = useMemo(() => {
    if (!state?.valid) return false;
    if (submitting || uploading) return false;
    if (rating < 0.5 || rating > 5) return false;
    return text.trim().length > 0 || media.length > 0;
  }, [state?.valid, submitting, uploading, rating, text, media.length]);

  async function checkVideoDuration(file: File): Promise<boolean> {
    return new Promise((resolve) => {
      const url = URL.createObjectURL(file);
      const video = document.createElement('video');
      video.preload = 'metadata';
      video.onloadedmetadata = () => { URL.revokeObjectURL(url); resolve(video.duration <= 60); };
      video.onerror = () => { URL.revokeObjectURL(url); resolve(false); };
      video.src = url;
    });
  }

  async function handleFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    setUploading(true); setError('');
    try {
      for (const file of Array.from(files).slice(0, 8)) {
        const isVideo = file.type.startsWith('video/');
        if (isVideo) {
          const ok = await checkVideoDuration(file);
          if (!ok) {
            setError(lang === 'ru' ? `Видео "${file.name}" длиннее 1 минуты — не загружено.` : `Video "${file.name}" is longer than 1 minute — skipped.`);
            continue;
          }
        }
        const form = new FormData();
        form.append('token', token);
        form.append('file', file);
        const res = await fetch('/api/reviews/upload', { method: 'POST', body: form });
        const data = await res.json();
        if (!res.ok) { setError(data.message || `${lang === 'ru' ? 'Не удалось загрузить' : 'Failed to upload'} ${file.name}`); continue; }
        if (typeof data.url === 'string') setMedia((prev) => (prev.length < 8 ? [...prev, data.url] : prev));
      }
    } catch { setError(lang === 'ru' ? 'Ошибка загрузки файлов' : 'File upload error'); }
    finally { setUploading(false); }
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;
    setSubmitting(true); setError(''); setSuccess('');
    try {
      const res = await fetch('/api/reviews', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, customerName: customerName.trim(), rating, text: text.trim(), media }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.message || T.networkError); return; }
      setSuccess(T.successMsg);
      setText(''); setMedia([]);
      setState((prev) => (prev ? { ...prev, valid: false, alreadyUsed: true } : prev));
    } catch { setError(T.networkError); }
    finally { setSubmitting(false); }
  }

  const title = state?.product?.nameRu || state?.product?.name || (lang === 'ru' ? 'товаре' : 'product');
  const productImage = state?.product?.image;

  return (
    <main style={{
      minHeight: '100vh',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'flex-start',
      padding: '96px 16px 48px',
      background: 'radial-gradient(ellipse at 50% 0%, rgba(232,114,42,0.06) 0%, #0a0a0f 60%)',
    }}>
      <div style={{
        width: '100%',
        maxWidth: '560px',
        background: 'rgba(255,255,255,0.03)',
        borderRadius: '24px',
        border: '1px solid rgba(255,255,255,0.09)',
        boxShadow: '0 32px 80px rgba(0,0,0,0.5)',
        overflow: 'hidden',
      }}>
        {/* Header */}
        <div style={{ padding: '32px 32px 24px', borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
          <h1 style={{ margin: 0, fontSize: '22px', fontWeight: 800, letterSpacing: '-0.02em', color: '#fff' }}>
            {T.title} <span style={{ color: '#E8722A' }}>{title}</span>
          </h1>
          <p style={{ margin: '8px 0 0', color: 'rgba(255,255,255,0.45)', fontSize: '13px', lineHeight: 1.6 }}>
            {T.subtitle}
          </p>
        </div>

        <div style={{ padding: '28px 32px 32px' }}>
          {loading && (
            <div style={{ textAlign: 'center', padding: '24px 0', color: 'rgba(255,255,255,0.45)' }}>
              <div style={{ width: 32, height: 32, border: '2px solid rgba(155,135,245,0.3)', borderTopColor: '#9b87f5', borderRadius: '50%', margin: '0 auto 12px', animation: 'spin 0.8s linear infinite' }} />
              {T.checking}
            </div>
          )}

          {error && (
            <div style={{ marginBottom: 16, padding: '12px 16px', borderRadius: 12, background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.25)', color: '#fca5a5', fontSize: 13, lineHeight: 1.6 }}>
              {error}
            </div>
          )}

          {!loading && state && !state.valid && !success && (
            <div style={{ padding: '20px', borderRadius: 14, border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.03)', color: 'rgba(255,255,255,0.6)', textAlign: 'center' }}>
              {state.alreadyUsed ? T.alreadyUsed : state.expired ? T.expired : T.invalid}
            </div>
          )}

          {success && (
            <div style={{ padding: '20px', borderRadius: 14, background: 'rgba(34,197,94,0.08)', border: '1px solid rgba(34,197,94,0.25)', color: '#86efac', textAlign: 'center', fontSize: 15, lineHeight: 1.7 }}>
              <div style={{ fontSize: 32, marginBottom: 8 }}>✓</div>
              {success}
            </div>
          )}

          {!loading && state?.valid && (
            <form onSubmit={onSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
              {/* Name — read-only */}
              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, letterSpacing: '0.07em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.4)', marginBottom: 8 }}>
                  {T.yourName}
                </label>
                <div style={{ padding: '12px 16px', borderRadius: 12, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.7)', fontSize: 15 }}>
                  {customerName || '—'}
                </div>
              </div>

              {/* Star rating */}
              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, letterSpacing: '0.07em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.4)', marginBottom: 10 }}>
                  {T.rating}
                </label>
                <StarRating value={rating} onChange={setRating} />
              </div>

              {/* Review text */}
              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, letterSpacing: '0.07em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.4)', marginBottom: 8 }}>
                  {T.reviewText}
                </label>
                <textarea
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  rows={5}
                  placeholder={T.reviewPlaceholder}
                  style={{
                    width: '100%', boxSizing: 'border-box',
                    padding: '14px 16px', borderRadius: 12,
                    background: 'rgba(255,255,255,0.04)',
                    border: '1px solid rgba(255,255,255,0.1)',
                    color: '#fff', fontSize: 15, lineHeight: 1.7,
                    resize: 'vertical', outline: 'none',
                    fontFamily: 'inherit',
                    transition: 'border-color 0.2s',
                  }}
                  onFocus={(e) => { e.target.style.borderColor = 'rgba(155,135,245,0.5)'; }}
                  onBlur={(e) => { e.target.style.borderColor = 'rgba(255,255,255,0.1)'; }}
                />
              </div>

              {/* Media */}
              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, letterSpacing: '0.07em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.4)', marginBottom: 10 }}>
                  {T.mediaLabel}
                </label>

                {media.length > 0 && (
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(110px, 1fr))', gap: 8, marginBottom: 12 }}>
                    {media.map((url) => {
                      const isVideo = /\.(mp4|webm|mov)$/i.test(url);
                      return (
                        <div key={url} style={{ position: 'relative', borderRadius: 10, overflow: 'hidden', aspectRatio: '1', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 4 }}>
                          {isVideo ? (
                            <>
                              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#E8722A" strokeWidth="1.5"><rect x="2" y="2" width="20" height="20" rx="3"/><path d="M10 8l6 4-6 4V8z" fill="#E8722A" stroke="none"/></svg>
                              <span style={{ fontSize: 9, color: 'rgba(255,255,255,0.4)', textAlign: 'center', padding: '0 4px', lineHeight: 1.3 }}>{url.split('/').pop()?.slice(0, 16)}</span>
                            </>
                          ) : (
                            <img src={url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', position: 'absolute', inset: 0 }} />
                          )}
                          <button
                            type="button"
                            onClick={() => setMedia((prev) => prev.filter((x) => x !== url))}
                            style={{ position: 'absolute', top: 5, right: 5, background: 'rgba(0,0,0,0.7)', border: 'none', borderRadius: '50%', width: 22, height: 22, color: '#fff', cursor: 'pointer', fontSize: 14, lineHeight: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                          >×</button>
                        </div>
                      );
                    })}
                  </div>
                )}

                <button
                  type="button"
                  onClick={() => fileRef.current?.click()}
                  disabled={uploading || media.length >= 8}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 10,
                    padding: '11px 18px', borderRadius: 12,
                    background: 'rgba(232,114,42,0.06)',
                    border: '1px dashed rgba(232,114,42,0.4)',
                    color: '#E8722A', cursor: uploading ? 'wait' : 'pointer',
                    fontSize: 14, fontFamily: 'inherit', transition: 'all 0.2s',
                    opacity: media.length >= 8 ? 0.4 : 1,
                  }}
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="url(#clip-grad)" strokeWidth="2">
                    <defs>
                      <linearGradient id="clip-grad" x1="0%" y1="0%" x2="100%" y2="100%">
                        <stop offset="0%" stopColor="#9b87f5" />
                        <stop offset="100%" stopColor="#f5a087" />
                      </linearGradient>
                    </defs>
                    <path d="M21.44 11.05l-9.19 9.19a6 6 0 01-8.49-8.49l9.19-9.19a4 4 0 015.66 5.66l-9.2 9.19a2 2 0 01-2.83-2.83l8.49-8.48" />
                  </svg>
                  {uploading ? T.uploading : T.attachFiles}
                  {media.length > 0 && !uploading && (
                    <span style={{ marginLeft: 'auto', fontSize: 12, color: 'rgba(255,255,255,0.35)' }}>{media.length}/8</span>
                  )}
                </button>

                <p style={{ margin: '8px 0 0', fontSize: 12, color: 'rgba(255,255,255,0.3)', lineHeight: 1.6 }}>
                  {T.mediaHint}
                </p>

                <input
                  ref={fileRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp,video/mp4,video/webm,video/quicktime"
                  multiple
                  style={{ display: 'none' }}
                  onChange={(e) => { void handleFiles(e.target.files); e.target.value = ''; }}
                />
              </div>

              {/* Submit */}
              <button
                type="submit"
                disabled={!canSubmit}
                style={{
                  padding: '15px 24px',
                  borderRadius: 14,
                  border: 'none',
                  background: canSubmit
                    ? 'linear-gradient(135deg, #E8722A 0%, #C45A1A 100%)'
                    : 'rgba(255,255,255,0.07)',
                  color: canSubmit ? '#fff' : 'rgba(255,255,255,0.3)',
                  fontSize: 15, fontWeight: 700,
                  cursor: canSubmit ? 'pointer' : 'not-allowed',
                  transition: 'all 0.2s',
                  boxShadow: canSubmit ? '0 4px 20px rgba(232,114,42,0.4)' : 'none',
                  fontFamily: 'inherit',
                }}
              >
                {submitting ? T.sending : uploading ? T.uploading : T.submit}
              </button>
            </form>
          )}
        </div>
      </div>

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        textarea::placeholder { color: rgba(255,255,255,0.2); }
      `}</style>
    </main>
  );
}
