'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';

import { AdminSidebar } from '../AdminSidebar';

// ─── Получить отзыв tab types ──────────────────────────────────────────────
type CandidateItem = { productId: string; productName: string; hasActiveInvite: boolean };
type CandidateOrder = { orderId: string; orderNumber: string; items: CandidateItem[] };
type Candidate = { email: string; name: string; orders: CandidateOrder[] };

type ProductOption = { id: string; slug: string; name: string; nameRu: string | null };

type ReviewRow = {
  id: string;
  productId: string;
  product: ProductOption;
  customerEmail: string;
  customerName: string;
  rating: number;
  text: string;
  media: string[];
  status: 'pending' | 'approved' | 'rejected';
  createdAt: string;
  approvedAt: string | null;
  rejectedAt: string | null;
  moderatedBy: string;
};

const STATUS_LABELS: Record<string, string> = {
  pending: 'На модерации',
  approved: 'Одобрен',
  rejected: 'Отклонён',
};

function fmtDate(input: string | null | undefined) {
  if (!input) return '—';
  return new Date(input).toLocaleString('ru-RU');
}

export default function AdminReviewsPage() {
  const router = useRouter();

  const [reviews, setReviews] = useState<ReviewRow[]>([]);
  const [products, setProducts] = useState<ProductOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [pendingCount, setPendingCount] = useState(0);
  const [notification, setNotification] = useState('');

  const [status, setStatus] = useState<'all' | 'pending' | 'approved' | 'rejected'>('all');
  const [productId, setProductId] = useState('');
  const [query, setQuery] = useState('');

  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);

  const [busyId, setBusyId] = useState<string | null>(null);

  const [tab, setTab] = useState<'reviews' | 'send'>('reviews');
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [candidatesLoading, setCandidatesLoading] = useState(false);
  const [sendingKey, setSendingKey] = useState<string | null>(null); // "email:productId"
  const [confirmKey, setConfirmKey] = useState<string | null>(null);

  const token = useMemo(() => {
    if (typeof window === 'undefined') return null;
    return localStorage.getItem('admin_token');
  }, []);

  const notify = (message: string) => {
    setNotification(message);
    setTimeout(() => setNotification(''), 3500);
  };

  const load = useCallback(async (nextPage = page) => {
    const adminToken = localStorage.getItem('admin_token');
    if (!adminToken) {
      router.push('/admin/login');
      return;
    }

    setLoading(true);

    const params = new URLSearchParams();
    params.set('page', String(nextPage));
    if (status !== 'all') params.set('status', status);
    if (productId) params.set('productId', productId);
    if (query.trim()) params.set('q', query.trim());

    try {
      const res = await fetch(`/api/admin/reviews?${params.toString()}`, {
        headers: { Authorization: `Bearer ${adminToken}` },
      });

      if (res.status === 401) {
        localStorage.removeItem('admin_token');
        router.push('/admin/login');
        return;
      }

      const data = await res.json();
      if (!res.ok || !data.success) {
        notify(data.message || 'Ошибка загрузки отзывов');
        return;
      }

      setReviews(data.reviews || []);
      setProducts(data.products || []);
      setPendingCount(data.pending || 0);
      setPage(data.page || 1);
      setPages(data.pages || 1);
    } catch {
      notify('Ошибка сети');
    } finally {
      setLoading(false);
    }
  }, [page, productId, query, router, status]);

  useEffect(() => {
    if (!token) {
      router.push('/admin/login');
      return;
    }
    void load(1);
  }, [load, router, token]);

  const moderate = async (reviewId: string, action: 'approve' | 'reject' | 'pending') => {
    const adminToken = localStorage.getItem('admin_token');
    if (!adminToken) return;

    setBusyId(reviewId);
    try {
      const res = await fetch('/api/admin/reviews', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${adminToken}`,
        },
        body: JSON.stringify({ reviewId, action }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        notify(data.message || 'Не удалось изменить статус');
        return;
      }

      notify('Статус обновлён');
      await load(page);
    } catch {
      notify('Ошибка сети');
    } finally {
      setBusyId(null);
    }
  };

  const loadCandidates = useCallback(async () => {
    const adminToken = localStorage.getItem('admin_token');
    if (!adminToken) return;
    setCandidatesLoading(true);
    try {
      const res = await fetch('/api/admin/reviews/candidates', { headers: { Authorization: `Bearer ${adminToken}` } });
      if (res.ok) setCandidates(await res.json());
    } catch { /* ignore */ } finally { setCandidatesLoading(false); }
  }, []);

  useEffect(() => {
    if (tab === 'send' && candidates.length === 0) void loadCandidates();
  }, [tab, candidates.length, loadCandidates]);

  const sendInvite = async (email: string, name: string, productId: string, productName: string) => {
    const adminToken = localStorage.getItem('admin_token');
    if (!adminToken) return;
    const key = `${email}:${productId}`;
    setSendingKey(key);
    setConfirmKey(null);
    try {
      const res = await fetch('/api/admin/reviews/invites', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
        body: JSON.stringify({ productId, recipients: [{ email, name }] }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        notify(`Ссылка отправлена: ${email}`);
        // mark as sent locally
        setCandidates(prev => prev.map(c => c.email === email ? {
          ...c,
          orders: c.orders.map(o => ({
            ...o,
            items: o.items.map(i => i.productId === productId ? { ...i, hasActiveInvite: true } : i),
          })),
        } : c));
      } else {
        notify(data.message || data.failed?.[0]?.reason || 'Ошибка отправки');
      }
    } catch { notify('Ошибка сети'); } finally { setSendingKey(null); }
  };

  return (
    <div className="cms-root">
      <AdminSidebar />
      <main className="cms-main">
        <div className="cms-header">
          <div>
            <h1 className="cms-header-title">Отзывы</h1>
            <p style={{ fontSize: '13px', color: 'var(--cms-text-muted)', marginTop: '2px' }}>
              На модерации: {pendingCount}
            </p>
          </div>
        </div>

        {notification && <div className="cms-notification">{notification}</div>}

        {/* Tabs */}
        <div style={{ display: 'flex', gap: 0, borderBottom: '1px solid var(--cms-border)', marginBottom: 0, padding: '0 24px' }}>
          {(['reviews', 'send'] as const).map(t => (
            <button key={t} onClick={() => setTab(t)} style={{
              padding: '10px 18px', border: 'none', background: 'none', cursor: 'pointer',
              fontWeight: 600, fontSize: 13, color: tab === t ? 'var(--cms-accent)' : 'var(--cms-text-muted)',
              borderBottom: tab === t ? '2px solid var(--cms-accent)' : '2px solid transparent',
              transition: 'all 0.15s',
            }}>
              {t === 'reviews' ? 'Все отзывы' : 'Получить отзыв'}
            </button>
          ))}
        </div>

        <div className="cms-content">
          {tab === 'send' && (
            <div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 12 }}>
                <button className="cms-btn cms-btn-sm cms-btn-ghost" onClick={() => void loadCandidates()}>Обновить</button>
              </div>
              {candidatesLoading ? (
                <div style={{ padding: 40, textAlign: 'center', color: 'var(--cms-text-muted)' }}>Загрузка...</div>
              ) : candidates.length === 0 ? (
                <div className="cms-card" style={{ padding: 32, textAlign: 'center', color: 'var(--cms-text-muted)' }}>Нет клиентов с заказами</div>
              ) : (
                <div style={{ display: 'grid', gap: 12 }}>
                  {candidates.map(c => (
                    <div key={c.email} className="cms-card" style={{ border: '1px solid var(--cms-border)', padding: 14 }}>
                      <div style={{ fontWeight: 700, marginBottom: 4 }}>{c.name || c.email}</div>
                      <div style={{ fontSize: 12, color: 'var(--cms-text-muted)', marginBottom: 10 }}>{c.email}</div>
                      {c.orders.map(o => (
                        <div key={o.orderId} style={{ marginBottom: 10 }}>
                          <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--cms-text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>
                            Заказ #{o.orderNumber}
                          </div>
                          {o.items.map(item => {
                            const key = `${c.email}:${item.productId}`;
                            const busy = sendingKey === key;
                            return (
                              <div key={item.productId} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, padding: '6px 10px', background: 'rgba(255,255,255,0.02)', borderRadius: 8, marginBottom: 4, border: '1px solid rgba(255,255,255,0.05)' }}>
                                <span style={{ fontSize: 13 }}>{item.productName}</span>
                                {confirmKey === key ? (
                                  <div style={{ display: 'flex', gap: 6 }}>
                                    <button className="cms-btn cms-btn-xs cms-btn-primary" disabled={busy}
                                      onClick={() => void sendInvite(c.email, c.name, item.productId, item.productName)}>
                                      {busy ? '...' : 'Отправить'}
                                    </button>
                                    <button className="cms-btn cms-btn-xs" onClick={() => setConfirmKey(null)}>Отмена</button>
                                  </div>
                                ) : (
                                  <button
                                    className="cms-btn cms-btn-xs"
                                    disabled={busy}
                                    onClick={() => setConfirmKey(key)}
                                    title={item.hasActiveInvite ? 'Переотправить ссылку' : 'Отправить ссылку на отзыв'}
                                    style={{ color: item.hasActiveInvite ? 'var(--cms-text-muted)' : undefined }}
                                  >
                                    {item.hasActiveInvite ? (
                                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M23 4v6h-6M1 20v-6h6M3.51 9a9 9 0 0114.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0020.49 15"/></svg>
                                    ) : (
                                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M10 13a5 5 0 007.54.54l3-3a5 5 0 00-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 00-7.54-.54l-3 3a5 5 0 007.07 7.07l1.71-1.71"/></svg>
                                    )}
                                  </button>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      ))}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {tab === 'reviews' && (<>
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '14px' }}>
            <select className="cms-select" value={status} onChange={(e) => setStatus(e.target.value as typeof status)}>
              <option value="all">Все</option>
              <option value="pending">На модерации</option>
              <option value="approved">Одобренные</option>
              <option value="rejected">Отклонённые</option>
            </select>

            <select className="cms-select" value={productId} onChange={(e) => setProductId(e.target.value)}>
              <option value="">Все товары</option>
              {products.map((product) => (
                <option key={product.id} value={product.id}>
                  {product.nameRu || product.name}
                </option>
              ))}
            </select>

            <input
              className="cms-input"
              placeholder="Поиск по email, имени, тексту"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              style={{ minWidth: '250px' }}
            />

            <button className="cms-btn cms-btn-sm cms-btn-secondary" onClick={() => void load(1)}>
              Применить
            </button>
          </div>

          {loading ? (
            <div style={{ padding: '48px', textAlign: 'center', color: 'var(--cms-text-muted)' }}>Загрузка...</div>
          ) : reviews.length === 0 ? (
            <div className="cms-card" style={{ padding: '38px', textAlign: 'center', color: 'var(--cms-text-muted)' }}>
              Отзывов не найдено
            </div>
          ) : (
            <div style={{ display: 'grid', gap: '14px' }}>
              {reviews.map((review) => (
                <div key={review.id} className="cms-card" style={{ border: '1px solid var(--cms-border)', padding: '14px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: '10px', flexWrap: 'wrap', marginBottom: '8px' }}>
                    <div>
                      <div style={{ fontWeight: 700 }}>{review.customerName || 'Без имени'} · {review.rating.toFixed(1)} ★</div>
                      <div style={{ fontSize: '12px', color: 'var(--cms-text-muted)' }}>{review.customerEmail}</div>
                      <div style={{ fontSize: '12px', color: 'var(--cms-text-muted)' }}>
                        Товар: {review.product?.nameRu || review.product?.name || review.productId}
                      </div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div className="cms-badge">{STATUS_LABELS[review.status] || review.status}</div>
                      <div style={{ fontSize: '12px', color: 'var(--cms-text-muted)', marginTop: '6px' }}>
                        Создан: {fmtDate(review.createdAt)}
                      </div>
                      {review.approvedAt && (
                        <div style={{ fontSize: '12px', color: 'var(--cms-text-muted)' }}>Одобрен: {fmtDate(review.approvedAt)}</div>
                      )}
                      {review.rejectedAt && (
                        <div style={{ fontSize: '12px', color: 'var(--cms-text-muted)' }}>Отклонён: {fmtDate(review.rejectedAt)}</div>
                      )}
                    </div>
                  </div>

                  {review.text && (
                    <p style={{ whiteSpace: 'pre-wrap', lineHeight: 1.6, margin: '10px 0 0' }}>{review.text}</p>
                  )}

                  {review.media.length > 0 && (
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: '8px', marginTop: '10px' }}>
                      {review.media.map((url) => {
                        const isVideo = /\.(mp4|webm|mov)$/i.test(url);
                        return isVideo ? (
                          <video key={url} src={url} controls style={{ width: '100%', borderRadius: '10px', background: '#111' }} />
                        ) : (
                          <img key={url} src={url} alt="review media" style={{ width: '100%', height: '120px', objectFit: 'cover', borderRadius: '10px' }} />
                        );
                      })}
                    </div>
                  )}

                  <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginTop: '12px' }}>
                    <button
                      className="cms-btn cms-btn-sm"
                      disabled={busyId === review.id || review.status === 'approved'}
                      onClick={() => void moderate(review.id, 'approve')}
                      style={{ background: review.status !== 'approved' ? '#16a34a' : undefined, color: review.status !== 'approved' ? '#fff' : undefined, border: 'none' }}
                    >
                      Одобрить
                    </button>
                    <button
                      className="cms-btn cms-btn-sm cms-btn-danger"
                      disabled={busyId === review.id || review.status === 'rejected'}
                      onClick={() => void moderate(review.id, 'reject')}
                    >
                      Отклонить
                    </button>
                    <button
                      className="cms-btn cms-btn-sm cms-btn-ghost"
                      disabled={busyId === review.id || review.status === 'pending'}
                      onClick={() => void moderate(review.id, 'pending')}
                    >
                      Вернуть
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {pages > 1 && (
            <div style={{ marginTop: '14px', display: 'flex', gap: '8px', alignItems: 'center' }}>
              <button className="cms-btn cms-btn-sm cms-btn-ghost" disabled={page <= 1} onClick={() => void load(page - 1)}>
                Назад
              </button>
              <span style={{ fontSize: '13px', color: 'var(--cms-text-muted)' }}>Страница {page} из {pages}</span>
              <button className="cms-btn cms-btn-sm cms-btn-ghost" disabled={page >= pages} onClick={() => void load(page + 1)}>
                Далее
              </button>
            </div>
          )}
          </>)}
        </div>
      </main>
    </div>
  );
}
