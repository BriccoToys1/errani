"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { AdminPage } from "../AdminPage";
import { HeaderActions, IconButton, SearchField, Toolbar, DataList, useContactSheet, PageLoading } from "@/components/admin";
import { adminToastClass, refreshAdminCounts } from "@/lib/admin-client";

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
  archived: { label: "Архив", cls: "cms-badge" },
};

const ALL_STATUSES = ["new", "read", "replied", "closed", "archived"];

export default function AdminInquiriesPage() {
  const router = useRouter();
  const contactSheet = useContactSheet();
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

  const notify = useCallback((msg: string) => {
    setNotification(msg);
    setTimeout(() => setNotification(""), 3000);
  }, []);

  const fetchInquiries = useCallback(async () => {
    const token = getToken();
    if (!token) { router.push("/admin/login"); return; }
    try {
      const res = await fetch("/api/inquiries?includeArchived=true", { cache: "no-store", headers: { Authorization: `Bearer ${token}` } });
      if (res.status === 401) { localStorage.removeItem("admin_token"); router.push("/admin/login"); return; }
      const data = await res.json().catch(() => ({}));
      if (res.ok && Array.isArray(data)) {
        setInquiries(data);
      } else {
        notify("Не удалось загрузить заявки");
      }
    } catch {
      notify("Не удалось загрузить заявки");
    } finally {
      setLoading(false);
    }
  }, [getToken, notify, router]);

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
      notify("Заявка обновлена");
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
    notify(`${ids.length} заявок обработано`);
    setDeleteConfirm(null);
    setCheckedIds(new Set());
    fetchInquiries();
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

  const markAllRead = async () => {
    const token = getToken();
    try {
      await fetch("/api/inquiries", { method: "PUT", headers: { Authorization: `Bearer ${token}` } });
      notify("Все заявки отмечены как прочитанные");
      refreshAdminCounts();
      fetchInquiries();
    } catch { /* ignore */ }
  };

  const newCount = inquiries.filter((i) => i.status === "new").length;

  if (loading) return <PageLoading />;

  return (
    <AdminPage
      title="Заявки"
      fill
      notifyCount={newCount > 0 ? newCount : undefined}
      actions={
        <HeaderActions>
          <IconButton icon="export" label="Скачать" shape="plain" onClick={() => { window.location.href = "/api/admin/export?type=inquiries&format=xls"; }} />
          <IconButton icon="refresh" label="Обновить" shape="plain" onClick={() => { setLoading(true); fetchInquiries(); }} />
          {newCount > 0 && (
            <IconButton icon="view" label="Просмотреть" shape="plain" onClick={() => { void markAllRead(); setFilterStatus("new"); }} />
          )}
        </HeaderActions>
      }
    >

          <Toolbar>
            <SearchField value={search} onChange={setSearch} style={{ width: 220 }} />
            <select className="cms-select cms-select-sm" value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)}>
              <option value="all">Все статусы</option>
              {ALL_STATUSES.map((s) => <option key={s} value={s}>{STATUS_MAP[s]?.label ?? s}</option>)}
            </select>
            {checkedIds.size > 0 && (
              <button className="cms-btn cms-btn-sm cms-btn-danger" onClick={() => setDeleteConfirm(Array.from(checkedIds))}>
                {filterStatus === "archived" ? `Удалить навсегда (${checkedIds.size})` : `В архив (${checkedIds.size})`}
              </button>
            )}
          </Toolbar>

          <DataList>
            <table className="cms-table">
              <thead>
                <tr>
                  <th className="cms-col-check">
                    <input type="checkbox" checked={checkedIds.size === filtered.length && filtered.length > 0} onChange={toggleAll} />
                  </th>
                  <th style={{ width: "16%" }}>Имя</th>
                  <th style={{ width: "16%" }}>Email</th>
                  <th style={{ width: "12%" }}>Телефон</th>
                  <th style={{ width: "20%" }}>Сообщение</th>
                  <th className="cms-col-status">Статус</th>
                  <th style={{ width: "10%" }}>Источник</th>
                  <th style={{ width: "10%" }}>Дата</th>
                  <th className="cms-col-actions" />
                </tr>
              </thead>
              <tbody>
                {filtered.map((inquiry) => (
                  <tr key={inquiry.id} className={`${checkedIds.has(inquiry.id) ? "cms-row-selected" : ""} ${inquiry.status === "new" ? "cms-row-new" : ""}`}>
                    <td className="cms-col-check"><input type="checkbox" checked={checkedIds.has(inquiry.id)} onChange={() => toggleCheck(inquiry.id)} /></td>
                    <td>
                      <div className="cms-list-client">
                        <span className="cms-list-client-actions">
                          {inquiry.phone ? (
                            <IconButton icon="phone" label={inquiry.phone} shape="square" size="sm" onClick={() => contactSheet.open({ type: "phone", value: inquiry.phone! })} />
                          ) : null}
                          <IconButton icon="mail" label={inquiry.email} shape="square" size="sm" onClick={() => contactSheet.open({ type: "email", value: inquiry.email })} />
                        </span>
                        <span className="cms-list-client-name">{inquiry.name}</span>
                      </div>
                    </td>
                    <td className="cms-list-clamp-24">{inquiry.email}</td>
                    <td>{inquiry.phone || "—"}</td>
                    <td><div className="cms-list-clamp-35">{inquiry.message}</div></td>
                    <td className="cms-col-status">
                      <span className={`cms-badge ${STATUS_MAP[inquiry.status]?.cls ?? "cms-badge"}`}>
                        {STATUS_MAP[inquiry.status]?.label ?? inquiry.status}
                      </span>
                    </td>
                    <td style={{ color: "var(--cms-text-muted)" }}>{inquiry.source}</td>
                    <td>{new Date(inquiry.createdAt).toLocaleDateString("ru-RU")}</td>
                    <td className="cms-col-actions">
                      <div className="cms-row-actions">
                        <IconButton icon="view" label="Просмотр" shape="square" onClick={() => openInquiry(inquiry)} />
                        <IconButton icon="archive" label="Архив" shape="square" tone="danger" onClick={() => setDeleteConfirm([inquiry.id])} />
                      </div>
                    </td>
                  </tr>
                ))}
                {filtered.length === 0 && (
                  <tr><td colSpan={9} style={{ textAlign: "center", padding: "32px", color: "var(--cms-text-muted)" }}>Заявок не найдено</td></tr>
                )}
              </tbody>
            </table>
          </DataList>

        {/* Detail Modal */}
        {selected && (
          <div className="cms-modal-overlay" onClick={() => setSelected(null)}>
            <div className="cms-modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: "600px" }}>
              <div className="cms-modal-header">
                <h2 className="cms-modal-title">Заявка от {selected.name}</h2>
                <button className="cms-modal-close" onClick={() => setSelected(null)}>×</button>
              </div>
              <div className="cms-modal-body">
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px", marginBottom: "20px" }}>
                  <div>
                    <label className="cms-label">Email</label>
                    <button
                      type="button"
                      className="cms-linkbtn"
                      onClick={() => router.push(`/admin/email?thread=${encodeURIComponent(selected.email.trim().toLowerCase())}`)}
                    >
                      {selected.email}
                    </button>
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
                <h2 className="cms-modal-title">{filterStatus === "archived" ? "Удаление из архива" : "Архивация"}</h2>
                <button className="cms-modal-close" onClick={() => setDeleteConfirm(null)}>×</button>
              </div>
              <div className="cms-modal-body">
                <p>
                  {filterStatus === "archived"
                    ? <>Вы уверены, что хотите удалить навсегда {deleteConfirm.length} заявок из архива?</>
                    : <>Вы уверены, что хотите перенести в архив {deleteConfirm.length} заявок?</>}
                </p>
                <p style={{ fontSize: "13px", color: "var(--cms-text-muted)" }}>
                  {filterStatus === "archived" ? "Это действие нельзя отменить." : "Полное удаление доступно только из архива."}
                </p>
              </div>
              <div className="cms-modal-footer">
                <button className="cms-btn" onClick={() => setDeleteConfirm(null)}>Отмена</button>
                <button className="cms-btn cms-btn-danger" onClick={() => handleDelete(deleteConfirm)}>
                  {filterStatus === "archived" ? "Удалить навсегда" : "В архив"}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Notification */}
        {notification && (
          <div className={adminToastClass(notification)}>{notification}</div>
        )}
      {contactSheet.node}
    </AdminPage>
  );
}
