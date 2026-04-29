"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { AdminSidebar } from "../AdminSidebar";

interface WaitlistRequest {
  id: string;
  productId: string | null;
  productSlug: string;
  productName: string;
  name: string;
  email: string;
  status: string;
  createdAt: string;
}

const STATUS_MAP: Record<string, { label: string; cls: string }> = {
  pending: { label: "Ожидает", cls: "cms-badge-yellow" },
  notified: { label: "Уведомлено", cls: "cms-badge-green" },
};

const ALL_STATUSES = ["all", "pending", "notified"];

export default function AdminWaitlistPage() {
  const router = useRouter();
  const [requests, setRequests] = useState<WaitlistRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [checkedIds, setCheckedIds] = useState<Set<string>>(new Set());
  const [deleteConfirm, setDeleteConfirm] = useState<string[] | null>(null);
  const [filterStatus, setFilterStatus] = useState("all");
  const [search, setSearch] = useState("");
  const [notification, setNotification] = useState("");

  const getToken = useCallback(() => localStorage.getItem("admin_token"), []);

  const fetchRequests = useCallback(async () => {
    const token = getToken();
    if (!token) { router.push("/admin/login"); return; }
    const res = await fetch("/api/waitlist", { headers: { Authorization: `Bearer ${token}` } });
    if (res.status === 401) { localStorage.removeItem("admin_token"); router.push("/admin/login"); return; }
    const data = await res.json();
    setRequests(Array.isArray(data) ? data : []);
    setLoading(false);
  }, [getToken, router]);

  useEffect(() => { fetchRequests(); }, [fetchRequests]);

  const toggleCheck = (id: string) => {
    setCheckedIds((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const toggleAll = () => {
    if (checkedIds.size === filtered.length) setCheckedIds(new Set());
    else setCheckedIds(new Set(filtered.map((item) => item.id)));
  };

  const handleDelete = async (ids: string[]) => {
    const token = getToken();
    for (const id of ids) {
      await fetch(`/api/waitlist/${id}`, { method: "DELETE", headers: { Authorization: `Bearer ${token}` } });
    }
    notify(`${ids.length} заявка(ок) удалена`);
    setDeleteConfirm(null);
    setCheckedIds(new Set());
    fetchRequests();
  };

  const notify = (msg: string) => {
    setNotification(msg);
    setTimeout(() => setNotification(""), 3000);
  };

  const filtered = requests.filter((item) => {
    if (filterStatus !== "all" && item.status !== filterStatus) return false;
    if (search) {
      const q = search.toLowerCase();
      return item.productName.toLowerCase().includes(q) || item.productSlug.toLowerCase().includes(q) || item.name.toLowerCase().includes(q) || item.email.toLowerCase().includes(q);
    }
    return true;
  });

  if (loading) return <div className="cms-loading"><div className="cms-spinner" /> Загрузка...</div>;

  return (
    <div className="cms-root">
      <AdminSidebar />
      <main className="cms-main">
        <div className="cms-header">
          <h1 className="cms-header-title">В ожидании</h1>
          <div className="cms-header-actions">
            <span style={{ fontSize: "13px", color: "var(--cms-text-muted)" }}>{requests.length} всего</span>
            <button className="cms-refresh-btn" onClick={fetchRequests} title="Обновить">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M23 4v6h-6M1 20v-6h6"/><path d="M3.51 9a9 9 0 0114.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0020.49 15"/></svg>
            </button>
          </div>
        </div>

        <div className="cms-content">
          <div style={{ display: "flex", gap: "8px", alignItems: "center", marginBottom: "12px" }}>
            <input
              className="cms-input cms-input-sm"
              placeholder="Поиск..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{ width: "220px" }}
            />
            <select className="cms-select cms-select-sm" value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)}>
              {ALL_STATUSES.map((status) => (
                <option key={status} value={status}>{status === 'all' ? 'Все статусы' : STATUS_MAP[status]?.label || status}</option>
              ))}
            </select>
            {checkedIds.size > 0 && (
              <button className="cms-btn cms-btn-sm cms-btn-danger" onClick={() => setDeleteConfirm(Array.from(checkedIds))}>
                Удалить ({checkedIds.size})
              </button>
            )}
          </div>

          <div className="cms-table-wrap">
            <table className="cms-table">
              <thead>
                <tr>
                  <th style={{ width: 36 }}><input type="checkbox" checked={checkedIds.size === filtered.length && filtered.length > 0} onChange={toggleAll} /></th>
                  <th>Товар</th>
                  <th>Имя</th>
                  <th>Email</th>
                  <th>Статус</th>
                  <th>Дата</th>
                  <th style={{ width: 90 }}>Действия</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((item) => (
                  <tr key={item.id} className={checkedIds.has(item.id) ? 'cms-row-selected' : ''}>
                    <td><input type="checkbox" checked={checkedIds.has(item.id)} onChange={() => toggleCheck(item.id)} /></td>
                    <td>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                        <span className="cms-td-bold">{item.productName}</span>
                        <a href={`/${item.productSlug}`} target="_blank" rel="noreferrer" style={{ fontSize: '12px', color: 'var(--cms-accent)' }}>{item.productSlug}</a>
                      </div>
                    </td>
                    <td className="cms-td-bold">{item.name}</td>
                    <td><a href={`mailto:${item.email}`} style={{ color: 'var(--cms-accent)' }}>{item.email}</a></td>
                    <td><span className={`cms-badge ${STATUS_MAP[item.status]?.cls || 'cms-badge'}`}>{STATUS_MAP[item.status]?.label || item.status}</span></td>
                    <td>{new Date(item.createdAt).toLocaleDateString('ru-RU')}</td>
                    <td>
                      <button className="cms-btn cms-btn-xs cms-btn-ghost" onClick={() => setDeleteConfirm([item.id])} title="Удалить" style={{ color: 'var(--cms-danger)' }}>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/></svg>
                      </button>
                    </td>
                  </tr>
                ))}
                {filtered.length === 0 && (
                  <tr><td colSpan={7} style={{ textAlign: 'center', padding: '32px', color: 'var(--cms-text-muted)' }}>Записей не найдено</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </main>

      {deleteConfirm && (
        <div className="cms-modal-overlay" onClick={() => setDeleteConfirm(null)}>
          <div className="cms-modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 440 }}>
            <div className="cms-modal-header">
              <h3>Удаление запроса</h3>
              <button className="cms-modal-close" onClick={() => setDeleteConfirm(null)}>&times;</button>
            </div>
            <div className="cms-modal-body">
              <p style={{ fontSize: '14px' }}>
                Вы уверены, что хотите удалить <strong>{deleteConfirm.length}</strong> запись(ей)?
              </p>
            </div>
            <div className="cms-modal-actions">
              <button className="cms-btn cms-btn-danger" onClick={() => handleDelete(deleteConfirm)}>Удалить</button>
              <button className="cms-btn" onClick={() => setDeleteConfirm(null)}>Отмена</button>
            </div>
          </div>
        </div>
      )}

      {notification && <div className="cms-toast">{notification}</div>}
    </div>
  );
}
