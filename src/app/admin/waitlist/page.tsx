"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { AdminSidebar } from "../AdminSidebar";

interface WaitlistRequest {
  id: string;
  productId: string | null;
  productSlug: string;
  productName: string;
  requestTag: string;
  name: string;
  email: string;
  consentPersonalData: boolean;
  selectedColor: string;
  status: string;
  createdAt: string;
  notifiedAt: string | null;
}

type GroupedWaitlist = {
  productSlug: string;
  productName: string;
  requests: WaitlistRequest[];
};

type ViewMode = "active" | "archived" | "all";

const STATUS_MAP: Record<string, { label: string; cls: string }> = {
  pending: { label: "Ожидает", cls: "cms-badge-yellow" },
  notified: { label: "Уведомлено", cls: "cms-badge-green" },
  archived: { label: "Архив", cls: "cms-badge" },
};

export default function AdminWaitlistPage() {
  const router = useRouter();
  const [requests, setRequests] = useState<WaitlistRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [checkedIds, setCheckedIds] = useState<Set<string>>(new Set());
  const [deleteConfirm, setDeleteConfirm] = useState<string[] | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>("active");
  const [search, setSearch] = useState("");
  const [notification, setNotification] = useState("");
  const [notifyProductConfirm, setNotifyProductConfirm] = useState<GroupedWaitlist | null>(null);
  const [notifyingProductSlug, setNotifyingProductSlug] = useState<string | null>(null);

  const getToken = useCallback(() => localStorage.getItem("admin_token"), []);

  const fetchRequests = useCallback(async () => {
    const token = getToken();
    if (!token) {
      router.push("/admin/login");
      return;
    }

    const res = await fetch("/api/waitlist?includeArchived=true", {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (res.status === 401) {
      localStorage.removeItem("admin_token");
      router.push("/admin/login");
      return;
    }
    const data = await res.json();
    setRequests(Array.isArray(data) ? data : []);
    setLoading(false);
  }, [getToken, router]);

  useEffect(() => {
    fetchRequests();
  }, [fetchRequests]);

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

  const filtered = requests.filter((item) => {
    if (viewMode === "active" && item.status === "archived") return false;
    if (viewMode === "archived" && item.status !== "archived") return false;
    if (search) {
      const q = search.toLowerCase();
      return (
        item.productName.toLowerCase().includes(q) ||
        item.productSlug.toLowerCase().includes(q) ||
        item.requestTag.toLowerCase().includes(q) ||
        item.name.toLowerCase().includes(q) ||
        item.email.toLowerCase().includes(q)
      );
    }
    return true;
  });

  const toggleAll = () => {
    if (checkedIds.size === filtered.length) setCheckedIds(new Set());
    else setCheckedIds(new Set(filtered.map((item) => item.id)));
  };

  const grouped: GroupedWaitlist[] = Object.values(
    filtered.reduce<Record<string, GroupedWaitlist>>((acc, item) => {
      if (!acc[item.productSlug]) {
        acc[item.productSlug] = {
          productSlug: item.productSlug,
          productName: item.productName,
          requests: [],
        };
      }
      acc[item.productSlug].requests.push(item);
      return acc;
    }, {})
  ).sort((a, b) => a.productName.localeCompare(b.productName, "ru"));

  const handleArchiveOrDelete = async (ids: string[]) => {
    const token = getToken();
    for (const id of ids) {
      await fetch(`/api/waitlist/${id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
    }
    notify(`${ids.length} запись(ей) обработано`);
    setDeleteConfirm(null);
    setCheckedIds(new Set());
    fetchRequests();
  };

  const handleNotifyByProduct = async (group: GroupedWaitlist) => {
    const token = getToken();
    if (!token) return;

    setNotifyingProductSlug(group.productSlug);
    try {
      const res = await fetch("/api/waitlist/notify-product", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ productSlug: group.productSlug }),
      });
      const data = await res.json();
      if (res.ok) {
        notify(`Отправлено уведомлений: ${data.notified || 0}`);
        setNotifyProductConfirm(null);
        fetchRequests();
      } else {
        notify(data.error || "Не удалось отправить уведомления");
      }
    } catch {
      notify("Ошибка сети при отправке уведомлений");
    } finally {
      setNotifyingProductSlug(null);
    }
  };

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
          <div style={{ display: "flex", gap: "8px", alignItems: "center", marginBottom: "12px", flexWrap: "wrap" }}>
            <input
              className="cms-input cms-input-sm"
              placeholder="Поиск..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{ width: "260px" }}
            />
            <select className="cms-select cms-select-sm" value={viewMode} onChange={(e) => setViewMode(e.target.value as ViewMode)}>
              <option value="active">Активные</option>
              <option value="archived">Архив</option>
              <option value="all">Все</option>
            </select>
            {filtered.length > 0 && (
              <label style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "13px", color: "var(--cms-text-muted)" }}>
                <input
                  type="checkbox"
                  checked={checkedIds.size === filtered.length && filtered.length > 0}
                  onChange={toggleAll}
                />
                Выбрать все
              </label>
            )}
            {checkedIds.size > 0 && (
              <button className="cms-btn cms-btn-sm cms-btn-danger" onClick={() => setDeleteConfirm(Array.from(checkedIds))}>
                {viewMode === "archived" ? `Удалить навсегда (${checkedIds.size})` : `В архив (${checkedIds.size})`}
              </button>
            )}
          </div>

          {grouped.map((group) => {
            const pendingCount = group.requests.filter((r) => r.status === "pending").length;
            return (
              <div key={group.productSlug} className="cms-card" style={{ marginBottom: "14px", border: "1px solid var(--cms-border)" }}>
                <div style={{ padding: "12px 14px", borderBottom: "1px solid var(--cms-border)", display: "flex", justifyContent: "space-between", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>
                  <div>
                    <div style={{ fontWeight: 700 }}>{group.productName}</div>
                    <div style={{ fontSize: "12px", color: "var(--cms-text-muted)" }}>{group.productSlug}</div>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                    <div style={{ fontSize: "12px", color: "var(--cms-text-muted)" }}>
                      {group.requests.length} заявка(ок)
                    </div>
                    {pendingCount > 0 && viewMode !== "archived" && (
                      <button
                        className="cms-btn cms-btn-xs"
                        disabled={notifyingProductSlug === group.productSlug}
                        onClick={() => setNotifyProductConfirm(group)}
                        title="Отправить уведомление всем ожидающим по этому товару"
                      >
                        Уведомить о поступлении ({pendingCount})
                      </button>
                    )}
                  </div>
                </div>

                <div className="cms-table-wrap">
                  <table className="cms-table">
                    <thead>
                      <tr>
                        <th style={{ width: 36 }} />
                        <th>Тег</th>
                        <th>Имя</th>
                        <th>Email</th>
                        <th>Цвет</th>
                        <th>Согласие</th>
                        <th>Статус</th>
                        <th>Дата</th>
                        <th style={{ width: 170 }}>Действия</th>
                      </tr>
                    </thead>
                    <tbody>
                      {group.requests.map((item) => (
                        <tr key={item.id} className={checkedIds.has(item.id) ? "cms-row-selected" : ""}>
                          <td><input type="checkbox" checked={checkedIds.has(item.id)} onChange={() => toggleCheck(item.id)} /></td>
                          <td style={{ fontFamily: "monospace", fontSize: "12px" }}>{item.requestTag || `WaitlistRequest_${item.productSlug}`}</td>
                          <td className="cms-td-bold">{item.name}</td>
                          <td><a href={`mailto:${item.email}`} style={{ color: "var(--cms-accent)" }}>{item.email}</a></td>
                          <td>{item.selectedColor || "—"}</td>
                          <td>{item.consentPersonalData ? "Да" : "Нет"}</td>
                          <td><span className={`cms-badge ${STATUS_MAP[item.status]?.cls || "cms-badge"}`}>{STATUS_MAP[item.status]?.label || item.status}</span></td>
                          <td>{new Date(item.createdAt).toLocaleDateString("ru-RU")}</td>
                          <td style={{ display: "flex", gap: "8px" }}>
                            <button
                              className="cms-btn cms-btn-xs cms-btn-ghost"
                              onClick={() => setDeleteConfirm([item.id])}
                              style={{ color: "var(--cms-danger)" }}
                            >
                              {item.status === "archived" ? "Удалить навсегда" : "В архив"}
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            );
          })}

          {grouped.length === 0 && (
            <div className="cms-card" style={{ padding: "24px", textAlign: "center", color: "var(--cms-text-muted)" }}>
              Записей не найдено
            </div>
          )}
        </div>
      </main>

      {notifyProductConfirm && (
        <div className="cms-modal-overlay" onClick={() => setNotifyProductConfirm(null)}>
          <div className="cms-modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 520 }}>
            <div className="cms-modal-header">
              <h3>Подтвердите отправку</h3>
              <button className="cms-modal-close" onClick={() => setNotifyProductConfirm(null)}>&times;</button>
            </div>
            <div className="cms-modal-body">
              <p style={{ fontSize: "14px", marginBottom: "6px" }}>
                Отправить уведомления о поступлении товара всем ожидающим:
              </p>
              <p style={{ fontWeight: 700, marginBottom: "10px" }}>{notifyProductConfirm.productName}</p>
              <p style={{ fontSize: "13px", color: "var(--cms-text-muted)" }}>
                Получателей: {notifyProductConfirm.requests.filter((r) => r.status === "pending").length}
              </p>
            </div>
            <div className="cms-modal-actions">
              <button
                className="cms-btn cms-btn-primary"
                disabled={notifyingProductSlug === notifyProductConfirm.productSlug}
                onClick={() => handleNotifyByProduct(notifyProductConfirm)}
              >
                {notifyingProductSlug === notifyProductConfirm.productSlug ? "Отправка..." : "Да, отправить"}
              </button>
              <button className="cms-btn" onClick={() => setNotifyProductConfirm(null)}>Отмена</button>
            </div>
          </div>
        </div>
      )}

      {deleteConfirm && (
        <div className="cms-modal-overlay" onClick={() => setDeleteConfirm(null)}>
          <div className="cms-modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 440 }}>
            <div className="cms-modal-header">
              <h3>{viewMode === "archived" ? "Удаление из архива" : "Архивация"}</h3>
              <button className="cms-modal-close" onClick={() => setDeleteConfirm(null)}>&times;</button>
            </div>
            <div className="cms-modal-body">
              <p style={{ fontSize: "14px" }}>
                {viewMode === "archived"
                  ? <>Удалить навсегда <strong>{deleteConfirm.length}</strong> запись(ей) из архива?</>
                  : <>Перенести в архив <strong>{deleteConfirm.length}</strong> запись(ей)?</>}
              </p>
            </div>
            <div className="cms-modal-actions">
              <button className="cms-btn cms-btn-danger" onClick={() => handleArchiveOrDelete(deleteConfirm)}>
                {viewMode === "archived" ? "Удалить навсегда" : "В архив"}
              </button>
              <button className="cms-btn" onClick={() => setDeleteConfirm(null)}>Отмена</button>
            </div>
          </div>
        </div>
      )}

      {notification && <div className="cms-toast">{notification}</div>}
    </div>
  );
}
