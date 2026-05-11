'use client';

import { useEffect, useMemo, useState } from 'react';

type InviteState = {
  valid: boolean;
  expired: boolean;
  alreadyUsed: boolean;
  invite?: { email: string; customerName: string; expiresAt: string | null };
  product?: { id: string; slug: string; name: string; nameRu: string | null; image: string };
};

export default function ReviewForm({ token }: { token: string }) {
  const [loading, setLoading] = useState(true);
  const [state, setState] = useState<InviteState | null>(null);
  const [error, setError] = useState('');

  const [customerName, setCustomerName] = useState('');
  const [rating, setRating] = useState('5');
  const [text, setText] = useState('');

  const [media, setMedia] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState('');

  useEffect(() => {
    let canceled = false;
    const load = async () => {
      setLoading(true);
      setError('');
      try {
        const res = await fetch(`/api/reviews?token=${encodeURIComponent(token)}`);
        const data = await res.json();
        if (!res.ok) {
          if (!canceled) setError(data.message || 'Не удалось проверить ссылку');
          return;
        }
        if (!canceled) {
          setState(data);
          setCustomerName(data?.invite?.customerName || '');
        }
      } catch {
        if (!canceled) setError('Ошибка сети. Попробуйте позже.');
      } finally {
        if (!canceled) setLoading(false);
      }
    };
    load();
    return () => { canceled = true; };
  }, [token]);

  const canSubmit = useMemo(() => {
    if (!state?.valid) return false;
    if (submitting || uploading) return false;
    const ratingNumber = Number(rating);
    if (!Number.isFinite(ratingNumber) || ratingNumber < 1 || ratingNumber > 5) return false;
    return text.trim().length > 0 || media.length > 0;
  }, [state?.valid, submitting, uploading, rating, text, media.length]);

  async function handleFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    setUploading(true);
    setError('');

    try {
      for (const file of Array.from(files).slice(0, 8)) {
        const form = new FormData();
        form.append('token', token);
        form.append('file', file);

        const res = await fetch('/api/reviews/upload', {
          method: 'POST',
          body: form,
        });
        const data = await res.json();
        if (!res.ok) {
          setError(data.message || `Не удалось загрузить ${file.name}`);
          continue;
        }
        if (typeof data.url === 'string') {
          setMedia((prev) => (prev.length < 8 ? [...prev, data.url] : prev));
        }
      }
    } catch {
      setError('Ошибка загрузки файлов');
    } finally {
      setUploading(false);
    }
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;

    setSubmitting(true);
    setError('');
    setSuccess('');

    try {
      const res = await fetch('/api/reviews', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token,
          customerName: customerName.trim(),
          rating: Number(rating),
          text: text.trim(),
          media,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.message || 'Не удалось отправить отзыв');
        return;
      }

      setSuccess('Спасибо! Отзыв отправлен на модерацию.');
      setText('');
      setMedia([]);
      setState((prev) => (prev ? { ...prev, valid: false, alreadyUsed: true } : prev));
    } catch {
      setError('Ошибка сети. Попробуйте позже.');
    } finally {
      setSubmitting(false);
    }
  }

  const title = state?.product?.nameRu || state?.product?.name || 'товаре';

  return (
    <main style={{ minHeight: '100vh', padding: '24px 16px', background: '#0d0d0d', color: '#fff' }}>
      <div style={{ maxWidth: '760px', margin: '0 auto', background: '#141414', borderRadius: '18px', border: '1px solid rgba(255,255,255,0.08)', padding: '24px' }}>
        <h1 style={{ margin: 0, fontSize: '28px', fontWeight: 800 }}>Отзыв о {title}</h1>
        <p style={{ marginTop: '10px', color: '#bdbdbd', lineHeight: 1.7 }}>
          Ссылка персональная и одноразовая. После отправки изменить отзыв нельзя.
        </p>

        {loading && <p style={{ color: '#bdbdbd' }}>Проверяем ссылку...</p>}
        {error && <p style={{ color: '#ff9a9a' }}>{error}</p>}

        {!loading && state && !state.valid && !success && (
          <div style={{ marginTop: '14px', padding: '14px', borderRadius: '10px', border: '1px solid rgba(255,255,255,0.12)', background: 'rgba(255,255,255,0.04)' }}>
            {state.alreadyUsed ? 'Эта ссылка уже использована.' : state.expired ? 'Срок действия ссылки истёк.' : 'Ссылка недействительна.'}
          </div>
        )}

        {success && (
          <div style={{ marginTop: '14px', padding: '14px', borderRadius: '10px', border: '1px solid rgba(142,192,124,0.45)', background: 'rgba(142,192,124,0.12)', color: '#8ec07c' }}>
            {success}
          </div>
        )}

        {!loading && state?.valid && (
          <form onSubmit={onSubmit} style={{ marginTop: '18px', display: 'grid', gap: '14px' }}>
            <label style={{ display: 'grid', gap: '6px' }}>
              <span style={{ color: '#d4d4d4' }}>Ваше имя</span>
              <input
                className="cms-input"
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                placeholder="Имя"
                style={{ background: '#111', color: '#fff' }}
              />
            </label>

            <label style={{ display: 'grid', gap: '6px' }}>
              <span style={{ color: '#d4d4d4' }}>Оценка (1-5, можно дробную)</span>
              <input
                type="number"
                min="1"
                max="5"
                step="0.1"
                value={rating}
                onChange={(e) => setRating(e.target.value)}
                className="cms-input"
                style={{ background: '#111', color: '#fff', maxWidth: '180px' }}
              />
            </label>

            <label style={{ display: 'grid', gap: '6px' }}>
              <span style={{ color: '#d4d4d4' }}>Текст отзыва</span>
              <textarea
                value={text}
                onChange={(e) => setText(e.target.value)}
                rows={6}
                className="cms-textarea"
                placeholder="Поделитесь впечатлениями"
                style={{ background: '#111', color: '#fff' }}
              />
            </label>

            <div>
              <label style={{ display: 'block', marginBottom: '8px', color: '#d4d4d4' }}>Фото / Видео</label>
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp,video/mp4,video/webm,video/quicktime"
                multiple
                onChange={(e) => void handleFiles(e.target.files)}
              />
              <p style={{ marginTop: '6px', color: '#9a9a9a', fontSize: '13px' }}>
                До 8 файлов: изображения до 12 MB, видео до 40 MB.
              </p>
            </div>

            {media.length > 0 && (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))', gap: '10px' }}>
                {media.map((url) => {
                  const isVideo = /\.(mp4|webm|mov)$/i.test(url);
                  return (
                    <div key={url} style={{ position: 'relative', border: '1px solid rgba(255,255,255,0.12)', borderRadius: '10px', overflow: 'hidden', minHeight: '120px', background: '#0e0e0e' }}>
                      {isVideo ? (
                        <video src={url} controls style={{ width: '100%', height: '120px', objectFit: 'cover' }} />
                      ) : (
                        <img src={url} alt="review media" style={{ width: '100%', height: '120px', objectFit: 'cover' }} />
                      )}
                      <button
                        type="button"
                        onClick={() => setMedia((prev) => prev.filter((x) => x !== url))}
                        style={{
                          position: 'absolute',
                          top: '6px',
                          right: '6px',
                          border: 'none',
                          borderRadius: '999px',
                          width: '24px',
                          height: '24px',
                          background: 'rgba(0,0,0,0.7)',
                          color: '#fff',
                          cursor: 'pointer',
                        }}
                      >
                        ×
                      </button>
                    </div>
                  );
                })}
              </div>
            )}

            <button
              type="submit"
              className="cms-btn"
              disabled={!canSubmit}
              style={{ opacity: canSubmit ? 1 : 0.6 }}
            >
              {submitting ? 'Отправка...' : uploading ? 'Загрузка файлов...' : 'Отправить отзыв'}
            </button>
          </form>
        )}
      </div>
    </main>
  );
}
