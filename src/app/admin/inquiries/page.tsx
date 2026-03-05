"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { AdminSidebar } from "../AdminSidebar";

interface Inquiry {
  id: string;
  name: string;
  email: string;
  phone: string;
  message: string;
  status: string;
  notes: string | null;
  source: string;
  ip: string | null;
  userAgent: string | null;
  createdAt: string;
  updatedAt: string;
}

const STATUS_MAP: Record<string, { label: string; cls: string }> = {
  new: { label: "Новое", cls: "cms-badge-blue" },
  read: { label: "Прочитано", cls: "cms-badge-yellow" },
  replied: { label: "Отвечено", cls: "cms-badge-green" },
  closed: { label: "Закрыто", cls: "cms-badge" },
};

const ALL_STATUSES = ["new", "read", "replied", "closed"];

export default function AdminInquiriesPage() {
  const router = useRouter();
  const [inquiries, setInquiries] = useState<Inquiry[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Inquiry | null>(null);
  const [editStatus, setEditStatus] = useState("");
  const [editNotes, setEditNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [notification, setNotification] = useState("");
  const [checkedIds, setCheckedIds] = useState<Set<string>>(new Set());
  const [deleteConfirm, setDeleteConfirm] = useState<string[] | null>(null);
  const [filterStatus, setFilterStatus] = useState("all");
  const [search, setSearch] = useState("");

  const getToken = useCallback(() => localStorage.getItem("admin_token"), []);

  const fetchInquiries = useCallback(async () => {
    const token = getToken();
    if (!token) { router.push("/admin/login"); return; }
    const res = await fetch("/api/inquiries", { headers: { Authorization: `Bearer ${token}` } });
    if (res.status === 401) { localStorage.removeItem("admin_token"); router.push("/admin/login"); return; }
    const data = await res.json();
    setInquiries(Array.isArray(data) ? data : []);
    setLoading(false);
  }, [getToken, router]);

  useEffect(() => { fetchInquiries(); }, [fetchInquiries]);

  const openInquiry = (inquiry: Inquiry) => {
    setSelected(inquiry);
    setEditStatus(inquiry.status);
    setEditNotes(inquiry.notes || "");
    // Автоматически помечаем как прочитанное
    if (inquiry.status === "new") {
      updateStatus(inquiry.id, "read");
    }
  };

  const updateStatus = async (id: string, status: string) => {
    const token = getToken();
    await fetch(`/api/inquiries/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ status }),
    });
    fetchInquiries();
  };

  const handleSave = async () => {
    if (!selected) return;
    setSaving(true);
    const token = getToken();
    const res = await fetch(`/api/inquiries/${selected.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ status: editStatus, notes: editNotes }),
    });
    if (res.ok) {
      notify("Обращение обновлено");
      setSelected(null);
      fetchInquiries();
    }
    setSaving(false);
  };

  const handleDelete = async (ids: string[]) => {
    const token = getToken();
    for (const id of ids) {
      await fetch(`/api/inquiries/${id}`, { method: "DELETE", headers: { Authorization: `Bearer ${token}` } });
    }
    notify(`${ids.length} обращение(й) удалено`);
    setDeleteConfirm(null);
    setCheckedIds(new Set());
    fetchInquiries();
  };

  const notify = (msg: string) => {
    setNotification(msg);
    setTimeout(() => setNotification(""), 3000);
  };

  const toggleCheck = (id: string) => {
    setCheckedIds((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const toggleAll = () => {
    if (checkedIds.size === filtered.length) setCheckedIds(new Set());
    else setCheckedIds(new Set(filtered.map((o) => o.id)));
  };

  const filtered = inquiries.filter((i) => {
    if (filterStatus !== "all" && i.status !== filterStatus) return false;
    if (search) {
      const q = search.toLowerCase();
      return i.name.toLowerCase().includes(q) || i.email.toLowerCase().includes(q) || i.message.toLowerCase().includes(q);
    }
    return true;
  });

  const newCount = inquiries.filter((i) => i.status === "new").length;

  if (loading) return <div className="cms-loading"><div className="cms-spinner" /> Загрузка...</div>;

  return (
    <div className="cms-root">
      <AdminSidebar />
      <main className="cms-main">
        <div className="cms-header">
          <h1 className="cms-header-title">
            Обращения
            {newCount > 0 && <span className="cms-badge cms-badge-blue" style={{ marginLeft: "10px", fontSize: "12px" }}>{newCount} новых</span>}
          </h1>
          <div className="cms-header-actions">
            <span style={{ fontSize: "13px", color: "var(--cms-text-muted)" }}>{inquiries.length} всего</span>
            <a href="/api/admin/export?type=inquiries&format=csv" className="cms-btn cms-btn-sm" download>📥 CSV</a>
            <a href="/api/admin/export?type=inquiries&format=xls" className="cms-btn cms-btn-sm" download>📊 XLS</a>
            <button className="cms-btn cms-btn-sm" onClick={fetchInquiries}>Обновить</button>
          </div>
        </div>

        <div className="cms-content">
          {/* Toolbar */}
          <div style={{ display: "flex", gap: "8px", alignItems: "center", marginBottom: "12px" }}>
            <input
              className="cms-input cms-input-sm"
              placeholder="Поиск..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{ width: "180px" }}
            />
            <select className="cms-select cms-select-sm" value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)}>
              <option value="all">Все статусы</option>
              {ALL_STATUSES.map((s) => <option key={s} value={s}>{STATUS_MAP[s]?.label ?? s}</option>)}
            </select>
            {checkedIds.size > 0 && (
              <button className="cms-btn cms-btn-sm cms-btn-danger" onClick={() => setDeleteConfirm(Array.from(checkedIds))}>
                Удалить ({checkedIds.size})
              </button>
            )}
          </div>

          {/* Table */}
          <div className="cms-table-wrap">
            <table className="cms-table">
              <thead>
                <tr>
                  <th style={{ width: 36 }}>
                    <input type="checkbox" checked={checkedIds.size === filtered.length && filtered.length > 0} onChange={toggleAll} />
                  </th>
                  <th>Имя</th>
                  <th>Email</th>
                  <th>Телефон</th>
                  <th style={{ width: "30%" }}>Сообщение</th>
                  <th>Статус</th>
                  <th>Источник</th>
                  <th>Дата</th>
                  <th style={{ width: 80 }}>Действия</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((inquiry) => (
                  <tr key={inquiry.id} className={`${checkedIds.has(inquiry.id) ? "cms-row-selected" : ""} ${inquiry.status === "new" ? "cms-row-new" : ""}`}>
                    <td><input type="checkbox" checked={checkedIds.has(inquiry.id)} onChange={() => toggleCheck(inquiry.id)} /></td>
                    <td className="cms-td-bold">{inquiry.name}</td>
                    <td>
                      <a href={`mailto:${inquiry.email}`} style={{ color: "var(--cms-accent)" }}>{inquiry.email}</a>
                    </td>
                    <td>
                      {inquiry.phone ? (
                        <a href={`tel:${inquiry.phone}`} style={{ color: "var(--cms-accent)" }}>{inquiry.phone}</a>
                      ) : "—"}
                    </td>
                    <td style={{ maxWidth: "300px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {inquiry.message.substring(0, 80)}{inquiry.message.length > 80 ? "..." : ""}
                    </td>
                    <td>
                      <span className={`cms-badge ${STATUS_MAP[inquiry.status]?.cls ?? "cms-badge"}`}>
                        {STATUS_MAP[inquiry.status]?.label ?? inquiry.status}
                      </span>
                    </td>
                    <td style={{ fontSize: "12px", color: "var(--cms-text-muted)" }}>{inquiry.source}</td>
                    <td>{new Date(inquiry.createdAt).toLocaleDateString("ru-RU")}</td>
                    <td>
                      <button className="cms-btn cms-btn-xs cms-btn-ghost" onClick={() => openInquiry(inquiry)} title="Просмотр">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                      </button>
                      <button className="cms-btn cms-btn-xs cms-btn-ghost" onClick={() => setDeleteConfirm([inquiry.id])} title="Удалить" style={{ color: "var(--cms-danger)" }}>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/></svg>
                      </button>
                    </td>
                  </tr>
                ))}
                {filtered.length === 0 && (
                  <tr><td colSpan={9} style={{ textAlign: "center", padding: "32px", color: "var(--cms-text-muted)" }}>Обращений не найдено</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Detail Modal */}
        {selected && (
          <div className="cms-modal-overlay" onClick={() => setSelected(null)}>
            <div className="cms-modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: "600px" }}>
              <div className="cms-modal-header">
                <h2 className="cms-modal-title">Обращение от {selected.name}</h2>
                <button className="cms-modal-close" onClick={() => setSelected(null)}>×</button>
              </div>
              <div className="cms-modal-body">
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px", marginBottom: "20px" }}>
                  <div>
                    <label className="cms-label">Email</label>
                    <a href={`mailto:${selected.email}`} style={{ color: "var(--cms-accent)" }}>{selected.email}</a>
                  </div>
                  <div>
                    <label className="cms-label">Телефон</label>
                    <div>{selected.phone || "—"}</div>
                  </div>
                  <div>
                    <label className="cms-label">Источник</label>
                    <div>{selected.source}</div>
                  </div>
                  <div>
                    <label className="cms-label">Дата</label>
                    <div>{new Date(selected.createdAt).toLocaleString("ru-RU")}</div>
                  </div>
                </div>

                <div style={{ marginBottom: "20px" }}>
                  <label className="cms-label">Сообщение</label>
                  <div style={{ background: "var(--cms-surface)", padding: "12px", borderRadius: "6px", whiteSpace: "pre-wrap" }}>
                    {selected.message}
                  </div>
                </div>

                {selected.ip && (
                  <div style={{ marginBottom: "20px", fontSize: "12px", color: "var(--cms-text-muted)" }}>
                    <strong>IP:</strong> {selected.ip} | <strong>User Agent:</strong> {selected.userAgent?.substring(0, 60)}...
                  </div>
                )}

                <div style={{ display: "grid", gridTemplateColumns: "1fr 2fr", gap: "16px" }}>
                  <div>
                    <label className="cms-label">Статус</label>
                    <select className="cms-select" value={editStatus} onChange={(e) => setEditStatus(e.target.value)} style={{ width: "100%" }}>
                      {ALL_STATUSES.map((s) => <option key={s} value={s}>{STATUS_MAP[s]?.label ?? s}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="cms-label">Заметки (внутренние)</label>
                    <textarea
                      className="cms-textarea"
                      value={editNotes}
                      onChange={(e) => setEditNotes(e.target.value)}
                      rows={2}
                      placeholder="Заметки для команды..."
                      style={{ width: "100%" }}
                    />
                  </div>
                </div>
              </div>
              <div className="cms-modal-footer">
                <button className="cms-btn" onClick={() => setSelected(null)}>Отмена</button>
                <button className="cms-btn cms-btn-primary" onClick={handleSave} disabled={saving}>
                  {saving ? "Сохранение..." : "Сохранить"}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Delete Confirm Modal */}
        {deleteConfirm && (
          <div className="cms-modal-overlay" onClick={() => setDeleteConfirm(null)}>
            <div className="cms-modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: "400px" }}>
              <div className="cms-modal-header">
                <h2 className="cms-modal-title">Подтверждение удаления</h2>
                <button className="cms-modal-close" onClick={() => setDeleteConfirm(null)}>×</button>
              </div>
              <div className="cms-modal-body">
                <p>Вы уверены, что хотите удалить {deleteConfirm.length} обращение(й)?</p>
                <p style={{ fontSize: "13px", color: "var(--cms-text-muted)" }}>Это действие нельзя отменить.</p>
              </div>
              <div className="cms-modal-footer">
                <button className="cms-btn" onClick={() => setDeleteConfirm(null)}>Отмена</button>
                <button className="cms-btn cms-btn-danger" onClick={() => handleDelete(deleteConfirm)}>Удалить</button>
              </div>
            </div>
          </div>
        )}

        {/* Notification */}
        {notification && (
          <div className="cms-notification">{notification}</div>
        )}
      </main>
    </div>
  );
}
