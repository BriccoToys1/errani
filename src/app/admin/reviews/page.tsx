'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { AdminPage } from '../AdminPage';
import { HeaderActions, IconButton, SearchField, Toolbar, ScrollArea, useContactSheet, PageLoading } from '@/components/admin';
import { adminFetch, adminToastClass, refreshAdminCounts } from '@/lib/admin-client';

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
  approvedMedia: string[];
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
  const contactSheet = useContactSheet();

  const [reviews, setReviews] = useState<ReviewRow[]>([]);
  const [products, setProducts] = useState<ProductOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [pendingCount, setPendingCount] = useState(0);
  const [unviewedPending, setUnviewedPending] = useState(0);
  const [reviewsViewedAt, setReviewsViewedAt] = useState<Date>(() => new Date(0));
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
      const pending = data.pending || 0;
      setPendingCount(pending);
      setPage(data.page || 1);
      setPages(data.pages || 1);
      // Unviewed badge: pending created after last "Просмотреть"
      const viewedMs = reviewsViewedAt.getTime();
      if (viewedMs <= 0) setUnviewedPending(pending);
      else {
        const rows = (data.reviews || []) as ReviewRow[];
        const newer = rows.filter((r) => r.status === 'pending' && new Date(r.createdAt).getTime() > viewedMs).length;
        // If filtered list isn't all-pending, keep previous or use API pending when never acknowledged
        setUnviewedPending((prev) => (status === 'pending' ? newer : Math.min(prev, pending)));
      }
    } catch {
      notify('Ошибка сети');
    } finally {
      setLoading(false);
    }
  }, [page, productId, query, reviewsViewedAt, router, status]);

  useEffect(() => {
    if (!token) {
      router.push('/admin/login');
      return;
    }
    void load(1);
  }, [load, router, token]);

  useEffect(() => {
    if (!token) return;
    adminFetch('/api/admin/settings?key=reviewsViewedAt')
      .then((r) => r.json())
      .then((d) => {
        if (d?.value) setReviewsViewedAt(new Date(d.value));
      })
      .catch(() => undefined);
  }, [token]);

  const markAllViewed = async () => {
    try {
      const res = await adminFetch('/api/admin/viewed', {
        method: 'POST',
        body: JSON.stringify({ section: 'reviews' }),
      });
      const data = await res.json().catch(() => ({}));
      setReviewsViewedAt(data?.value ? new Date(data.value) : new Date());
      setUnviewedPending(0);
      setTab('reviews');
      setStatus('pending');
      refreshAdminCounts();
      notify('Отзывы отмечены как просмотренные');
    } catch { /* ignore */ }
  };

  const moderateMedia = async (reviewId: string, mediaUrl: string, action: 'approveMedia' | 'rejectMedia') => {
    const adminToken = localStorage.getItem('admin_token');
    if (!adminToken) return;
    try {
      const res = await fetch('/api/admin/reviews', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
        body: JSON.stringify({ reviewId, action, mediaUrl }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setReviews((prev) => prev.map((r) => r.id === reviewId ? { ...r, approvedMedia: data.approvedMedia } : r));
      } else {
        notify(data.message || 'Ошибка');
      }
    } catch {
      notify('Ошибка сети');
    }
  };

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

  if (loading && reviews.length === 0 && tab === 'reviews') return <PageLoading />;

  return (
    <AdminPage
      title="Отзывы"
      fill
      notifyCount={unviewedPending > 0 ? unviewedPending : undefined}
      actions={
        <HeaderActions>
          <IconButton icon="add" label="Добавить" shape="plain" onClick={() => setTab('send')} />
          <IconButton icon="refresh" label="Обновить" shape="plain" onClick={() => window.location.reload()} />
          {unviewedPending > 0 && (
            <IconButton icon="view" label="Просмотреть" shape="plain" onClick={() => { void markAllViewed(); }} />
          )}
        </HeaderActions>
      }
    >

          {tab === 'send' && (
            <ScrollArea>
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
                                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                                      <i className="fi fi-rr-link" style={{ fontSize: 13 }} />
                                      {item.hasActiveInvite && (
                                        <>
                                          <i className="fi fi-rr-check" style={{ fontSize: 12, color: '#4ade80' }} />
                                          <span style={{ fontSize: 11, fontWeight: 700 }}>x1</span>
                                        </>
                                      )}
                                    </span>
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
            </ScrollArea>
          )}

          {tab === 'reviews' && (<>
          <Toolbar>
            <SearchField value={query} onChange={(v) => { setQuery(v); }} onSubmit={() => void load(1)} style={{ minWidth: 250 }} />
            <select className="cms-select" value={status} onChange={(e) => { setStatus(e.target.value as typeof status); }}>
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
          </Toolbar>

          <ScrollArea>
          {reviews.length === 0 ? (
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
                      <div style={{ fontSize: '12px', color: 'var(--cms-text-muted)', display: 'flex', alignItems: 'center', gap: 6 }}>
                        <button
                          type="button"
                          className="cms-linkbtn"
                          onClick={() => contactSheet.open({ type: "email", value: review.customerEmail })}
                        >
                          {review.customerEmail}
                        </button>
                        <IconButton
                          icon="mail"
                          label={review.customerEmail}
                          shape="square"
                          size="sm"
                          onClick={() => contactSheet.open({ type: "email", value: review.customerEmail })}
                        />
                      </div>
                      <div style={{ fontSize: '12px', color: 'var(--cms-text-muted)' }}>
                        Товар: {review.product?.nameRu || review.product?.name || review.productId}
                      </div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div
                        className="cms-badge"
                        style={{
                          background: review.status === 'approved' ? 'rgba(34,197,94,0.18)' : review.status === 'rejected' ? 'rgba(239,68,68,0.18)' : 'rgba(234,179,8,0.18)',
                          color: review.status === 'approved' ? '#4ade80' : review.status === 'rejected' ? '#f87171' : '#facc15',
                          borderColor: review.status === 'approved' ? 'rgba(34,197,94,0.4)' : review.status === 'rejected' ? 'rgba(239,68,68,0.4)' : 'rgba(234,179,8,0.4)',
                        }}
                      >
                        {STATUS_LABELS[review.status] || review.status}
                      </div>
                    </div>
                  </div>

                  {review.text && (
                    <p style={{ whiteSpace: 'pre-wrap', lineHeight: 1.6, margin: '10px 0 0' }}>{review.text}</p>
                  )}

                  {review.media.length > 0 && (
                    <div style={{ marginTop: '10px' }}>
                      <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--cms-text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>
                        Медиа ({review.media.length}) — одобрено: {review.approvedMedia.length}
                      </div>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: '8px' }}>
                        {review.media.map((url) => {
                          const isApproved = review.approvedMedia.includes(url);
                          const isVideo = /\.(mp4|webm|mov)$/i.test(url) || url.includes('video');
                          return (
                            <div key={url} style={{ position: 'relative', borderRadius: 10, overflow: 'hidden', border: `2px solid ${isApproved ? '#22c55e' : 'rgba(255,255,255,0.08)'}` }}>
                              {isVideo ? (
                                <video src={url} controls style={{ width: '100%', display: 'block', background: '#111' }} />
                              ) : (
                                <img src={url} alt="review media" style={{ width: '100%', height: '120px', objectFit: 'cover', display: 'block' }} />
                              )}
                              <div style={{ display: 'flex', gap: 4, padding: '4px 6px', background: 'rgba(0,0,0,0.7)' }}>
                                <button
                                  onClick={() => void moderateMedia(review.id, url, 'approveMedia')}
                                  disabled={isApproved}
                                  style={{ flex: 1, fontSize: 11, padding: '3px 0', background: isApproved ? 'rgba(34,197,94,0.3)' : '#16a34a', color: '#fff', border: 'none', borderRadius: 4, cursor: isApproved ? 'default' : 'pointer', fontWeight: 600 }}
                                >✓</button>
                                <button
                                  onClick={() => void moderateMedia(review.id, url, 'rejectMedia')}
                                  disabled={!isApproved}
                                  style={{ flex: 1, fontSize: 11, padding: '3px 0', background: !isApproved ? 'rgba(239,68,68,0.3)' : '#dc2626', color: '#fff', border: 'none', borderRadius: 4, cursor: !isApproved ? 'default' : 'pointer', fontWeight: 600 }}
                                >✕</button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginTop: '12px', alignItems: 'flex-end' }}>
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
                    <div style={{ marginLeft: 'auto', textAlign: 'right', fontSize: 11, color: 'var(--cms-text-muted)', lineHeight: 1.5 }}>
                      <div>Создан: {fmtDate(review.createdAt)}</div>
                      {review.approvedAt && <div>Одобрен: {fmtDate(review.approvedAt)}</div>}
                      {review.rejectedAt && <div>Отклонён: {fmtDate(review.rejectedAt)}</div>}
                    </div>
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
          </ScrollArea>
          </>)}
      {notification && <div className={adminToastClass(notification)}>{notification}</div>}
      {contactSheet.node}
    </AdminPage>
  );
}
