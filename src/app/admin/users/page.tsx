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

export default function AdminUsersPage() {
  const router = useRouter();
  const [users, setUsers] = useState<User[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<User | null>(null);
  const [checkedIds, setCheckedIds] = useState<Set<string>>(new Set());
  const [deleteConfirm, setDeleteConfirm] = useState<string[] | null>(null);
  const [notification, setNotification] = useState("");

  const getToken = useCallback(() => localStorage.getItem("admin_token"), []);

  const fetchUsers = useCallback(async (q = "") => {
    const token = getToken();
    if (!token) { router.push("/admin/login"); return; }
    setLoading(true);
    const res = await fetch(`/api/admin/users?search=${encodeURIComponent(q)}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (res.status === 401) { localStorage.removeItem("admin_token"); router.push("/admin/login"); return; }
    const data = await res.json();
    setUsers(data.users || []);
    setTotal(data.total || 0);
    setLoading(false);
  }, [getToken, router]);

  useEffect(() => { fetchUsers(); }, [fetchUsers]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    fetchUsers(search);
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
    setNotification(`Удалено пользователей: ${ids.length}`);
    setTimeout(() => setNotification(""), 3000);
    fetchUsers(search);
  };

  return (
    <div className="cms-layout">
      <AdminSidebar />
      <main className="cms-main">
        <div className="cms-topbar">
          <div>
            <h1 className="cms-page-title">Пользователи</h1>
            <p className="cms-page-subtitle">{total} зарегистрированных</p>
          </div>
          {checkedIds.size > 0 && (
            <button className="cms-btn cms-btn-danger" onClick={() => setDeleteConfirm([...checkedIds])}>
              Удалить выбранных ({checkedIds.size})
            </button>
          )}
        </div>

        {notification && (
          <div className="cms-notification">{notification}</div>
        )}

        {/* Search */}
        <form onSubmit={handleSearch} style={{ marginBottom: "16px", display: "flex", gap: "8px" }}>
          <input
            className="cms-input"
            style={{ maxWidth: "320px" }}
            placeholder="Поиск по имени, email, городу..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
          <button type="submit" className="cms-btn cms-btn-secondary">Найти</button>
          {search && (
            <button type="button" className="cms-btn cms-btn-ghost" onClick={() => { setSearch(""); fetchUsers(""); }}>
              Сбросить
            </button>
          )}
        </form>

        <div style={{ display: "flex", gap: "16px", alignItems: "flex-start" }}>
          {/* Table */}
          <div className="cms-card" style={{ flex: 1, overflow: "auto" }}>
            {loading ? (
              <div style={{ padding: "32px", textAlign: "center", color: "var(--cms-text-muted)" }}>Загрузка...</div>
            ) : users.length === 0 ? (
              <div style={{ padding: "48px", textAlign: "center", color: "var(--cms-text-muted)" }}>
                <div style={{ marginBottom: "8px" }}><svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="var(--cms-text-muted)" strokeWidth="1.5"><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/></svg></div>
                {search ? "Ничего не найдено" : "Нет зарегистрированных пользователей"}
              </div>
            ) : (
              <table className="cms-table">
                <thead>
                  <tr>
                    <th style={{ width: 32 }}>
                      <input type="checkbox" checked={checkedIds.size === users.length && users.length > 0}
                        onChange={toggleAll} />
                    </th>
                    <th>Имя / Email</th>
                    <th>Телефон</th>
                    <th>Страна / Город</th>
                    <th>Заказы</th>
                    <th>Последний заказ</th>
                    <th>Регистрация</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map(user => (
                    <tr
                      key={user.id}
                      className={selected?.id === user.id ? "cms-row-active" : ""}
                      style={{ cursor: "pointer" }}
                    >
                      <td onClick={e => e.stopPropagation()}>
                        <input type="checkbox" checked={checkedIds.has(user.id)} onChange={() => toggleCheck(user.id)} />
                      </td>
                      <td onClick={() => setSelected(user)}>
                        <div style={{ fontWeight: 500 }}>{user.name}</div>
                        <div style={{ fontSize: "12px", color: "var(--cms-text-muted)" }}>{user.email}</div>
                      </td>
                      <td onClick={() => setSelected(user)} style={{ color: "var(--cms-text-muted)", fontSize: "13px" }}>
                        {user.phone || "—"}
                      </td>
                      <td onClick={() => setSelected(user)} style={{ fontSize: "13px" }}>
                        <div>{COUNTRY_NAMES[user.country] || user.country || "—"}</div>
                        <div style={{ color: "var(--cms-text-muted)" }}>{user.city || "—"}</div>
                      </td>
                      <td onClick={() => setSelected(user)} style={{ textAlign: "center" }}>
                        {user._count.orders > 0 ? (
                          <span className="cms-badge cms-badge-green">{user._count.orders}</span>
                        ) : (
                          <span style={{ color: "var(--cms-text-muted)", fontSize: "13px" }}>0</span>
                        )}
                      </td>
                      <td onClick={() => setSelected(user)} style={{ fontSize: "13px" }}>
                        {user.orders[0] ? (
                          <>
                            <div>{formatMoney(user.orders[0].totalAmount, user.orders[0].currency)}</div>
                            <div style={{ color: "var(--cms-text-muted)" }}>{formatDate(user.orders[0].createdAt)}</div>
                          </>
                        ) : "—"}
                      </td>
                      <td onClick={() => setSelected(user)} style={{ fontSize: "12px", color: "var(--cms-text-muted)" }}>
                        {formatDate(user.createdAt)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          {/* Detail panel */}
          {selected && (
            <div className="cms-card" style={{ width: "300px", flexShrink: 0 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
                <h3 style={{ fontSize: "15px", fontWeight: 600 }}>Профиль</h3>
                <button className="cms-btn-icon" onClick={() => setSelected(null)}>✕</button>
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: "10px", fontSize: "13px" }}>
                <div>
                  <div style={{ color: "var(--cms-text-muted)", marginBottom: "2px" }}>Имя</div>
                  <div style={{ fontWeight: 500 }}>{selected.name}</div>
                </div>
                <div>
                  <div style={{ color: "var(--cms-text-muted)", marginBottom: "2px" }}>Email</div>
                  <div>{selected.email}</div>
                </div>
                {selected.phone && (
                  <div>
                    <div style={{ color: "var(--cms-text-muted)", marginBottom: "2px" }}>Телефон</div>
                    <div>{selected.phone}</div>
                  </div>
                )}

                <div style={{ borderTop: "1px solid var(--cms-border)", paddingTop: "10px" }}>
                  <div style={{ color: "var(--cms-text-muted)", marginBottom: "4px" }}>Адрес</div>
                  <div>
                    {[
                      COUNTRY_NAMES[selected.country] || selected.country,
                      selected.zipCode,
                      selected.city,
                      selected.street,
                      selected.house && `д. ${selected.house}`,
                      selected.apartment && `кв. ${selected.apartment}`,
                    ].filter(Boolean).join(", ") || "—"}
                  </div>
                </div>

                <div style={{ borderTop: "1px solid var(--cms-border)", paddingTop: "10px" }}>
                  <div style={{ color: "var(--cms-text-muted)", marginBottom: "4px" }}>Заказы</div>
                  <div style={{ fontWeight: 600, fontSize: "20px" }}>{selected._count.orders}</div>
                  {selected.orders[0] && (
                    <div style={{ color: "var(--cms-text-muted)", fontSize: "12px", marginTop: "2px" }}>
                      Последний: {formatMoney(selected.orders[0].totalAmount, selected.orders[0].currency)} · {formatDate(selected.orders[0].createdAt)}
                    </div>
                  )}
                </div>

                <div style={{ borderTop: "1px solid var(--cms-border)", paddingTop: "10px" }}>
                  <div style={{ color: "var(--cms-text-muted)", marginBottom: "2px" }}>Зарегистрирован</div>
                  <div>{formatDate(selected.createdAt)}</div>
                </div>

                <button
                  className="cms-btn cms-btn-danger"
                  style={{ marginTop: "8px", width: "100%", justifyContent: "center" }}
                  onClick={() => setDeleteConfirm([selected.id])}
                >
                  Удалить пользователя
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Delete confirm */}
        {deleteConfirm && (
          <div className="cms-modal-overlay" onClick={() => setDeleteConfirm(null)}>
            <div className="cms-modal" onClick={e => e.stopPropagation()}>
              <h3 style={{ marginBottom: "12px" }}>Удалить {deleteConfirm.length === 1 ? "пользователя" : `${deleteConfirm.length} пользователей`}?</h3>
              <p style={{ color: "var(--cms-text-muted)", marginBottom: "20px", fontSize: "13px" }}>
                Все данные и заказы будут удалены безвозвратно.
              </p>
              <div style={{ display: "flex", gap: "8px", justifyContent: "flex-end" }}>
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
