"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { AdminSidebar } from "../AdminSidebar";

interface UserOrder {
  createdAt: string;
  totalAmount: number;
  currency: string;
  status: string;
}

interface User {
  id: string;
  email: string;
  name: string;
  phone: string;
  country: string;
  city: string;
  zipCode: string;
  street: string;
  house: string;
  apartment: string;
  createdAt: string;
  _count: { orders: number };
  orders: UserOrder[];
}

const COUNTRY_NAMES: Record<string, string> = {
  RU: "Россия", US: "США", DE: "Германия", FR: "Франция", IT: "Италия",
  ES: "Испания", TR: "Турция", GB: "Великобритания", KZ: "Казахстан",
  UA: "Украина", BY: "Беларусь", PL: "Польша", NL: "Нидерланды",
};

function formatDate(s: string) {
  return new Date(s).toLocaleDateString("ru-RU", { day: "2-digit", month: "2-digit", year: "numeric" });
}

function formatMoney(amount: number, currency = "RUB") {
  return new Intl.NumberFormat("ru-RU", { style: "currency", currency, maximumFractionDigits: 0 }).format(amount);
}

function UserAvatar({ name }: { name: string }) {
  const initials = name.split(" ").slice(0, 2).map(n => n[0]).join("").toUpperCase() || "?";
  return (
    <div style={{
      width: 40, height: 40, borderRadius: "50%",
      background: "linear-gradient(135deg, var(--cms-accent) 0%, #c084fc 100%)",
      display: "flex", alignItems: "center", justifyContent: "center",
      color: "#fff", fontWeight: 700, fontSize: "14px", flexShrink: 0,
    }}>{initials}</div>
  );
}

export default function AdminUsersPage() {
  const router = useRouter();
  const [users, setUsers] = useState<User[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<User | null>(null);
  const [checkedIds, setCheckedIds] = useState<Set<string>>(new Set());
  const [deleteConfirm, setDeleteConfirm] = useState<string[] | null>(null);
  const [notification, setNotification] = useState("");

  const getToken = useCallback(() => localStorage.getItem("admin_token"), []);

  const fetchUsers = useCallback(async (q = "", p = 1) => {
    const token = getToken();
    if (!token) { router.push("/admin/login"); return; }
    setLoading(true);
    const res = await fetch(`/api/admin/users?search=${encodeURIComponent(q)}&page=${p}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (res.status === 401) { localStorage.removeItem("admin_token"); router.push("/admin/login"); return; }
    const data = await res.json();
    setUsers(data.users || []);
    setTotal(data.total || 0);
    setPage(data.page || 1);
    setPages(data.pages || 1);
    setLoading(false);
  }, [getToken, router]);

  useEffect(() => { fetchUsers(); }, [fetchUsers]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    fetchUsers(search, 1);
  };

  const toggleCheck = (id: string) => {
    setCheckedIds(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const toggleAll = () => {
    if (checkedIds.size === users.length) setCheckedIds(new Set());
    else setCheckedIds(new Set(users.map(u => u.id)));
  };

  const handleDelete = async (ids: string[]) => {
    const token = getToken();
    if (!token) return;
    await fetch("/api/admin/users", {
      method: "DELETE",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ ids }),
    });
    setDeleteConfirm(null);
    setCheckedIds(new Set());
    if (selected && ids.includes(selected.id)) setSelected(null);
    setNotification(`Удалено: ${ids.length} ${ids.length === 1 ? "пользователь" : "пользователей"}`);
    setTimeout(() => setNotification(""), 3000);
    fetchUsers(search, page);
  };

  const notify = (msg: string) => { setNotification(msg); setTimeout(() => setNotification(""), 3000); };

  return (
    <div className="cms-root">
      <AdminSidebar />
      <main className="cms-main">
        <div className="cms-header">
          <div>
            <h1 className="cms-header-title">Пользователи</h1>
            <p style={{ fontSize: "13px", color: "var(--cms-text-muted)", marginTop: "2px" }}>
              {total} зарегистрированных
            </p>
          </div>
          <div className="cms-header-actions">
            {checkedIds.size > 0 && (
              <button className="cms-btn cms-btn-sm cms-btn-danger" onClick={() => setDeleteConfirm([...checkedIds])}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4h6v2"/></svg>
                Удалить ({checkedIds.size})
              </button>
            )}
          </div>
        </div>

        {notification && <div className="cms-notification">{notification}</div>}

        <div className="cms-content">
          {/* Search */}
          <form onSubmit={handleSearch} style={{ marginBottom: "16px", display: "flex", gap: "8px" }}>
            <div style={{ position: "relative", flex: 1, maxWidth: "380px" }}>
              <svg style={{ position: "absolute", left: "10px", top: "50%", transform: "translateY(-50%)", pointerEvents: "none" }} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--cms-text-muted)" strokeWidth="2"><circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/></svg>
              <input
                className="cms-input"
                style={{ paddingLeft: "34px" }}
                placeholder="Поиск по имени, email, городу..."
                value={search}
                onChange={e => setSearch(e.target.value)}
              />
            </div>
            <button type="submit" className="cms-btn cms-btn-sm cms-btn-secondary">Найти</button>
            {search && (
              <button type="button" className="cms-btn cms-btn-sm cms-btn-ghost" onClick={() => { setSearch(""); fetchUsers("", 1); }}>
                Сбросить
              </button>
            )}
          </form>

          <div style={{ display: "flex", gap: "16px", alignItems: "flex-start" }}>
            {/* Table */}
            <div className="cms-table-wrap" style={{ flex: 1, overflow: "auto" }}>
              {loading ? (
                <div style={{ padding: "48px", textAlign: "center", color: "var(--cms-text-muted)" }}>
                  <div className="cms-spinner" style={{ margin: "0 auto 12px" }} />
                  Загрузка...
                </div>
              ) : users.length === 0 ? (
                <div style={{ padding: "64px", textAlign: "center", color: "var(--cms-text-muted)" }}>
                  <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="var(--cms-text-muted)" strokeWidth="1" style={{ marginBottom: "12px", opacity: 0.5 }}><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
                  <div style={{ fontWeight: 600, marginBottom: "4px" }}>{search ? "Ничего не найдено" : "Нет пользователей"}</div>
                  <div style={{ fontSize: "12px" }}>{search ? "Попробуйте другой запрос" : "Пользователи появятся после оформления первого заказа"}</div>
                </div>
              ) : (
                <>
                  <table className="cms-table">
                    <thead>
                      <tr>
                        <th style={{ width: 36 }}>
                          <input type="checkbox" checked={checkedIds.size === users.length && users.length > 0} onChange={toggleAll} />
                        </th>
                        <th>Пользователь</th>
                        <th>Контакты</th>
                        <th>Местоположение</th>
                        <th style={{ textAlign: "center" }}>Заказы</th>
                        <th>Последний заказ</th>
                        <th>Joined</th>
                        <th style={{ width: 40 }}></th>
                      </tr>
                    </thead>
                    <tbody>
                      {users.map(user => (
                        <tr key={user.id} className={selected?.id === user.id ? "cms-row-active" : ""} style={{ cursor: "pointer" }}>
                          <td onClick={e => e.stopPropagation()}>
                            <input type="checkbox" checked={checkedIds.has(user.id)} onChange={() => toggleCheck(user.id)} />
                          </td>
                          <td onClick={() => setSelected(user)}>
                            <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                              <UserAvatar name={user.name} />
                              <div>
                                <div style={{ fontWeight: 600, fontSize: "13px" }}>{user.name}</div>
                                <div style={{ fontSize: "11px", color: "var(--cms-text-muted)" }}>{user.email}</div>
                              </div>
                            </div>
                          </td>
                          <td onClick={() => setSelected(user)} style={{ fontSize: "12px" }}>
                            {user.phone ? <div style={{ color: "var(--cms-text)" }}>{user.phone}</div> : <span style={{ color: "var(--cms-text-muted)" }}>—</span>}
                          </td>
                          <td onClick={() => setSelected(user)} style={{ fontSize: "12px" }}>
                            <div style={{ fontWeight: 500 }}>{COUNTRY_NAMES[user.country] || user.country || "—"}</div>
                            <div style={{ color: "var(--cms-text-muted)" }}>{user.city || ""}</div>
                          </td>
                          <td onClick={() => setSelected(user)} style={{ textAlign: "center" }}>
                            {user._count.orders > 0 ? (
                              <span className="cms-badge cms-badge-green">{user._count.orders}</span>
                            ) : (
                              <span style={{ color: "var(--cms-text-muted)", fontSize: "12px" }}>0</span>
                            )}
                          </td>
                          <td onClick={() => setSelected(user)} style={{ fontSize: "12px" }}>
                            {user.orders[0] ? (
                              <div>
                                <div style={{ fontWeight: 500 }}>{formatMoney(user.orders[0].totalAmount, user.orders[0].currency)}</div>
                                <div style={{ color: "var(--cms-text-muted)" }}>{formatDate(user.orders[0].createdAt)}</div>
                              </div>
                            ) : <span style={{ color: "var(--cms-text-muted)" }}>—</span>}
                          </td>
                          <td onClick={() => setSelected(user)} style={{ fontSize: "11px", color: "var(--cms-text-muted)", whiteSpace: "nowrap" }}>
                            {formatDate(user.createdAt)}
                          </td>
                          <td onClick={e => e.stopPropagation()}>
                            <button
                              className="cms-btn-icon"
                              title="Удалить"
                              onClick={() => setDeleteConfirm([user.id])}
                            >
                              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M9 6V4h6v2"/></svg>
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>

                  {/* Pagination */}
                  {pages > 1 && (
                    <div style={{ display: "flex", justifyContent: "center", alignItems: "center", gap: "8px", padding: "14px 0", borderTop: "1px solid var(--cms-border)" }}>
                      <button className="cms-btn cms-btn-sm cms-btn-ghost" disabled={page <= 1} onClick={() => fetchUsers(search, page - 1)}>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="15 18 9 12 15 6"/></svg>
                      </button>
                      <span style={{ fontSize: "13px", color: "var(--cms-text-muted)" }}>
                        Стр. {page} из {pages}
                      </span>
                      <button className="cms-btn cms-btn-sm cms-btn-ghost" disabled={page >= pages} onClick={() => fetchUsers(search, page + 1)}>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="9 18 15 12 9 6"/></svg>
                      </button>
                    </div>
                  )}
                </>
              )}
            </div>

            {/* Detail panel */}
            {selected && (
              <div className="cms-table-wrap" style={{ width: "300px", flexShrink: 0, alignSelf: "flex-start" }}>
                {/* Profile header */}
                <div style={{ padding: "20px", borderBottom: "1px solid var(--cms-border)", display: "flex", alignItems: "center", gap: "12px" }}>
                  <UserAvatar name={selected.name} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 700, fontSize: "14px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{selected.name}</div>
                    <div style={{ fontSize: "11px", color: "var(--cms-text-muted)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{selected.email}</div>
                  </div>
                  <button
                    onClick={() => setSelected(null)}
                    style={{ background: "none", border: "none", cursor: "pointer", color: "var(--cms-text-muted)", padding: "4px", borderRadius: "6px", display: "flex" }}
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                  </button>
                </div>

                {/* Stats row */}
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", borderBottom: "1px solid var(--cms-border)" }}>
                  <div style={{ padding: "14px 16px", borderRight: "1px solid var(--cms-border)", textAlign: "center" }}>
                    <div style={{ fontSize: "22px", fontWeight: 700 }}>{selected._count.orders}</div>
                    <div style={{ fontSize: "11px", color: "var(--cms-text-muted)" }}>заказов</div>
                  </div>
                  <div style={{ padding: "14px 16px", textAlign: "center" }}>
                    <div style={{ fontSize: "16px", fontWeight: 700, color: "var(--cms-accent)" }}>
                      {selected.orders[0] ? formatMoney(selected.orders[0].totalAmount, selected.orders[0].currency) : "—"}
                    </div>
                    <div style={{ fontSize: "11px", color: "var(--cms-text-muted)" }}>посл. заказ</div>
                  </div>
                </div>

                {/* Details */}
                <div style={{ padding: "16px", display: "flex", flexDirection: "column", gap: "12px", fontSize: "12px" }}>
                  {[
                    { label: "Телефон", value: selected.phone || "—" },
                    { label: "Страна", value: COUNTRY_NAMES[selected.country] || selected.country || "—" },
                    { label: "Город", value: selected.city || "—" },
                    {
                      label: "Адрес",
                      value: [selected.street, selected.house && `д. ${selected.house}`, selected.apartment && `кв. ${selected.apartment}`, selected.zipCode].filter(Boolean).join(", ") || "—"
                    },
                    { label: "Зарегистрирован", value: formatDate(selected.createdAt) },
                  ].map(row => (
                    <div key={row.label}>
                      <div style={{ color: "var(--cms-text-muted)", marginBottom: "2px", textTransform: "uppercase", fontSize: "10px", letterSpacing: "0.05em" }}>{row.label}</div>
                      <div style={{ fontWeight: 500 }}>{row.value}</div>
                    </div>
                  ))}
                </div>

                <div style={{ padding: "0 16px 16px" }}>
                  <button
                    className="cms-btn cms-btn-sm cms-btn-danger"
                    style={{ width: "100%", justifyContent: "center" }}
                    onClick={() => setDeleteConfirm([selected.id])}
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M9 6V4h6v2"/></svg>
                    Удалить пользователя
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Delete confirm modal */}
        {deleteConfirm && (
          <div className="cms-modal-overlay" onClick={() => setDeleteConfirm(null)}>
            <div className="cms-modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 400 }}>
              <div className="cms-modal-header">
                <h3>Удалить {deleteConfirm.length === 1 ? "пользователя" : `${deleteConfirm.length} пользователей`}?</h3>
                <button className="cms-modal-close" onClick={() => setDeleteConfirm(null)}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                </button>
              </div>
              <div className="cms-modal-body">
                <p style={{ color: "var(--cms-text-muted)", fontSize: "13px" }}>
                  Все данные о пользователе и связанные заказы будут удалены безвозвратно.
                </p>
              </div>
              <div className="cms-modal-footer">
                <button className="cms-btn cms-btn-ghost" onClick={() => setDeleteConfirm(null)}>Отмена</button>
                <button className="cms-btn cms-btn-danger" onClick={() => handleDelete(deleteConfirm)}>Удалить</button>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
