"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { AdminPage } from "../AdminPage";
import { HeaderActions, IconButton, SearchField, Toolbar, DataList, ScrollArea, useContactSheet, PageLoading } from "@/components/admin";
import { adminToastClass, adminFetch, refreshAdminCounts } from "@/lib/admin-client";

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
  const contactSheet = useContactSheet();
  const [requests, setRequests] = useState<WaitlistRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [checkedIds, setCheckedIds] = useState<Set<string>>(new Set());
  const [deleteConfirm, setDeleteConfirm] = useState<string[] | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>("all");
  const [search, setSearch] = useState("");
  const [notification, setNotification] = useState("");
  const [notifyProductConfirm, setNotifyProductConfirm] = useState<GroupedWaitlist | null>(null);
  const [notifyingProductSlug, setNotifyingProductSlug] = useState<string | null>(null);
  const [waitlistViewedAt, setWaitlistViewedAt] = useState<Date>(() => new Date(0));

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

  useEffect(() => {
    const token = getToken();
    if (!token) return;
    adminFetch("/api/admin/settings?key=waitlistViewedAt")
      .then((r) => r.json())
      .then((d) => {
        if (d?.value) setWaitlistViewedAt(new Date(d.value));
      })
      .catch(() => undefined);
  }, [getToken]);

  const markAllViewed = async () => {
    try {
      const res = await adminFetch("/api/admin/viewed", {
        method: "POST",
        body: JSON.stringify({ section: "waitlist" }),
      });
      const data = await res.json().catch(() => ({}));
      setWaitlistViewedAt(data?.value ? new Date(data.value) : new Date());
      setViewMode("active");
      refreshAdminCounts();
      notify("Заявки отмечены как просмотренные");
    } catch { /* ignore */ }
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

  const pendingTotal = requests.filter(
    (r) => r.status === "pending" && new Date(r.createdAt) > waitlistViewedAt
  ).length;

  if (loading) return <PageLoading />;

  return (
    <AdminPage
      title="В ожидании"
      fill
      notifyCount={pendingTotal > 0 ? pendingTotal : undefined}
      actions={
        <HeaderActions>
          <IconButton icon="export" label="Скачать" shape="plain" onClick={() => { window.location.href = "/api/admin/export?type=waitlist&format=xls"; }} />
          <IconButton icon="refresh" label="Обновить" shape="plain" onClick={() => { setLoading(true); fetchRequests(); }} />
          {pendingTotal > 0 && (
            <IconButton icon="view" label="Просмотреть" shape="plain" onClick={() => { void markAllViewed(); }} />
          )}
        </HeaderActions>
      }
    >

          <Toolbar>
            <SearchField value={search} onChange={setSearch} style={{ width: 260 }} />
            <select className="cms-select cms-select-sm" value={viewMode} onChange={(e) => setViewMode(e.target.value as ViewMode)}>
              <option value="all">Все</option>
              <option value="active">Активные</option>
              <option value="archived">Архив</option>
            </select>
            {checkedIds.size > 0 && (
              <button className="cms-btn cms-btn-sm cms-btn-danger" onClick={() => setDeleteConfirm(Array.from(checkedIds))}>
                {viewMode === "archived" ? `Удалить навсегда (${checkedIds.size})` : `В архив (${checkedIds.size})`}
              </button>
            )}
          </Toolbar>

          <ScrollArea>
          {grouped.map((group) => {
            const pendingCount = group.requests.filter((r) => r.status === "pending").length;
            return (
              <div key={group.productSlug} className="cms-card" style={{ marginBottom: "14px", border: "1px solid var(--cms-border)" }}>
                <div style={{ padding: "12px 14px", borderBottom: "1px solid var(--cms-border)", display: "flex", justifyContent: "space-between", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <input
                      type="checkbox"
                      checked={group.requests.length > 0 && group.requests.every((r) => checkedIds.has(r.id))}
                      onChange={() => {
                        setCheckedIds((prev) => {
                          const next = new Set(prev);
                          const allOn = group.requests.every((r) => next.has(r.id));
                          group.requests.forEach((r) => { if (allOn) next.delete(r.id); else next.add(r.id); });
                          return next;
                        });
                      }}
                      title="Выбрать все в группе"
                    />
                    <div>
                      <div style={{ fontWeight: 700 }}>{group.productName}</div>
                      <div style={{ fontSize: "12px", color: "var(--cms-text-muted)" }}>{group.productSlug}</div>
                    </div>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                    {pendingCount > 0 && viewMode !== "archived" && (
                      <button
                        className="cms-btn cms-btn-xs"
                        disabled={notifyingProductSlug === group.productSlug}
                        onClick={() => setNotifyProductConfirm(group)}
                        style={{ display: "inline-flex", alignItems: "center", gap: 6 }}
                      >
                        <i className="fi fi-rr-bell" style={{ fontSize: 13 }} />
                        Уведомить о поступлении
                      </button>
                    )}
                  </div>
                </div>

                <DataList>
                  <table className="cms-table">
                    <thead>
                      <tr>
                        <th className="cms-col-check" />
                        <th>Имя</th>
                        <th>Email</th>
                        <th>Цвет</th>
                        <th>Статус</th>
                        <th>Дата</th>
                        <th style={{ width: 48 }} />
                      </tr>
                    </thead>
                    <tbody>
                      {group.requests.map((item) => (
                        <tr key={item.id} className={checkedIds.has(item.id) ? "cms-row-selected" : ""} style={item.selectedColor === "под заказ" ? { background: 'rgba(245,139,220,0.13)', borderLeft: '3px solid #f58bdc' } : {}}>
                          <td className="cms-col-check"><input type="checkbox" checked={checkedIds.has(item.id)} onChange={() => toggleCheck(item.id)} /></td>
                          <td>
                            <div className="cms-list-client">
                              <span className="cms-list-client-actions">
                                <IconButton icon="mail" label={item.email} shape="square" size="sm" onClick={() => contactSheet.open({ type: "email", value: item.email })} />
                              </span>
                              <span className="cms-list-client-name">{item.name}</span>
                            </div>
                          </td>
                          <td className="cms-list-clamp-24">{item.email}</td>
                          <td>{item.selectedColor || "—"}</td>
                          <td className="cms-col-status"><span className={`cms-badge ${STATUS_MAP[item.status]?.cls || "cms-badge"}`}>{STATUS_MAP[item.status]?.label || item.status}</span></td>
                          <td>{new Date(item.createdAt).toLocaleDateString("ru-RU")}</td>
                          <td className="cms-col-actions">
                            <div className="cms-row-actions">
                              <IconButton icon="archive" label={item.status === "archived" ? "Удалить" : "В архив"} shape="square" tone="danger" onClick={() => setDeleteConfirm([item.id])} />
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </DataList>
              </div>
            );
          })}

          {grouped.length === 0 && (
            <div className="cms-card" style={{ padding: "24px", textAlign: "center", color: "var(--cms-text-muted)" }}>
              Записей не найдено
            </div>
          )}
          </ScrollArea>

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

      {notification && <div className={adminToastClass(notification)}>{notification}</div>}
      {contactSheet.node}
    </AdminPage>
  );
}
