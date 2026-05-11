"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { AdminSidebar } from "../AdminSidebar";

interface OrderItem {
  productName: string;
  quantity: number;
  price: number;
}

interface CustomerOrder {
  id: string;
  orderNumber: string;
  createdAt: string;
  status: string;
  totalAmount: number;
  currency: string;
  items: OrderItem[];
}

interface CustomerProfile {
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
  updatedAt: string;
  badges: string[];
  archived: boolean;
  archivedAt: string | null;
  totalSpent: number;
  _count: { orders: number };
  orders: CustomerOrder[];
  cartItems: OrderItem[];
}

interface ProductSummary {
  id: string;
  slug: string;
  name: string;
  nameRu: string | null;
}

const COUNTRY_NAMES: Record<string, string> = {
  RU: "Россия", US: "США", DE: "Германия", FR: "Франция", IT: "Италия",
  ES: "Испания", TR: "Турция", GB: "Великобритания", KZ: "Казахстан",
  UA: "Украина", BY: "Беларусь", PL: "Польша", NL: "Нидерланды",
};

const QUICK_BADGES = [
  "Постоянный покупатель",
  "VIP",
  "Collector",
  "Priority",
];

function formatDate(s: string) {
  return new Date(s).toLocaleDateString("ru-RU", { day: "2-digit", month: "2-digit", year: "numeric" });
}

function formatMoney(amount: number, currency = "RUB") {
  return new Intl.NumberFormat("ru-RU", { style: "currency", currency, maximumFractionDigits: 0 }).format(amount);
}

function UserAvatar({ name }: { name: string }) {
  const initials = name.split(" ").filter(Boolean).slice(0, 2).map((n) => n[0]).join("").toUpperCase() || "?";
  return (
    <div style={{
      width: 44,
      height: 44,
      borderRadius: "50%",
      background: "linear-gradient(135deg, var(--cms-accent) 0%, #2d98da 100%)",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      color: "#fff",
      fontWeight: 700,
      fontSize: "14px",
      flexShrink: 0,
    }}>
      {initials}
    </div>
  );
}

export default function AdminUsersPage() {
  const router = useRouter();
  const [users, setUsers] = useState<CustomerProfile[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [view, setView] = useState<"active" | "archived" | "all">("active");
  const [notification, setNotification] = useState("");
  const [pending, setPending] = useState<string | null>(null);
  const [badgeInputs, setBadgeInputs] = useState<Record<string, string>>({});
  const [products, setProducts] = useState<ProductSummary[]>([]);
  const [selectedProductId, setSelectedProductId] = useState("");
  const [selectedEmails, setSelectedEmails] = useState<Record<string, boolean>>({});
  const [sendingInvites, setSendingInvites] = useState(false);

  const getToken = useCallback(() => localStorage.getItem("admin_token"), []);

  const notify = (msg: string) => {
    setNotification(msg);
    setTimeout(() => setNotification(""), 3500);
  };

  const fetchUsers = useCallback(async (q = "", p = 1, v: "active" | "archived" | "all" = view) => {
    const token = getToken();
    if (!token) {
      router.push("/admin/login");
      return;
    }

    setLoading(true);
    const res = await fetch(`/api/admin/users?search=${encodeURIComponent(q)}&page=${p}&view=${v}`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (res.status === 401) {
      localStorage.removeItem("admin_token");
      router.push("/admin/login");
      return;
    }

    const data = await res.json();
    setUsers(data.users || []);
    setTotal(data.total || 0);
    setPage(data.page || 1);
    setPages(data.pages || 1);
    setLoading(false);
  }, [getToken, router, view]);

  useEffect(() => {
    fetchUsers("", 1, view);
  }, [fetchUsers, view]);

  useEffect(() => {
    const adminToken = localStorage.getItem("admin_token");
    if (!adminToken) return;
    fetch("/api/products?summary=1&includeArchived=true&showAll=true")
      .then((res) => res.json())
      .then((data: ProductSummary[]) => {
        if (!Array.isArray(data)) return;
        setProducts(data);
        if (!selectedProductId && data.length > 0) setSelectedProductId(data[0].id);
      })
      .catch(() => {});
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    setSelectedEmails({});
  }, [users, page, view, search]);

  const onSearch = (e: React.FormEvent) => {
    e.preventDefault();
    fetchUsers(search, 1, view);
  };

  const patchProfile = async (email: string, payload: Record<string, unknown>, successMsg: string) => {
    const token = getToken();
    if (!token) return;

    setPending(email);
    try {
      const res = await fetch("/api/admin/users", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ email, ...payload }),
      });
      const data = await res.json();
      if (!res.ok) {
        notify(data.error || "Ошибка сохранения");
        return;
      }
      notify(successMsg);
      fetchUsers(search, page, view);
    } finally {
      setPending(null);
    }
  };

  const toggleSelectedEmail = (email: string, checked: boolean) => {
    setSelectedEmails((prev) => ({ ...prev, [email]: checked }));
  };

  const sendReviewInvites = async (recipients: Array<{ email: string; name?: string }>) => {
    const adminToken = getToken();
    if (!adminToken) return;
    if (!selectedProductId) {
      notify("Выберите товар для отзыва");
      return;
    }
    if (recipients.length === 0) {
      notify("Не выбраны получатели");
      return;
    }

    setSendingInvites(true);
    try {
      const res = await fetch("/api/admin/reviews/invites", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${adminToken}`,
        },
        body: JSON.stringify({
          productId: selectedProductId,
          recipients,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        notify(data.message || "Ошибка отправки ссылок");
        return;
      }
      notify(`Отправлено: ${data.sentCount}. Ошибок: ${data.failedCount}.`);
      setSelectedEmails({});
    } catch {
      notify("Ошибка сети при отправке ссылок");
    } finally {
      setSendingInvites(false);
    }
  };

  const addBadge = (profile: CustomerProfile, badge: string) => {
    const clean = badge.trim();
    if (!clean) return;
    const badges = Array.from(new Set([...(profile.badges || []), clean]));
    patchProfile(profile.email, { badges }, "Бейдж добавлен");
    setBadgeInputs((prev) => ({ ...prev, [profile.email]: "" }));
  };

  const removeBadge = (profile: CustomerProfile, badge: string) => {
    const badges = (profile.badges || []).filter((b) => b !== badge);
    patchProfile(profile.email, { badges }, "Бейдж удалён");
  };

  const toggleArchive = (profile: CustomerProfile) => {
    patchProfile(
      profile.email,
      { archived: !profile.archived },
      profile.archived ? "Профиль восстановлен из архива" : "Профиль архивирован"
    );
  };

  const purgeProfile = (profile: CustomerProfile) => {
    if (!profile.archived) {
      notify("Сначала перенесите профиль в архив");
      return;
    }
    if (!confirm(`Удалить профиль ${profile.email} и связанные данные навсегда?`)) return;
    patchProfile(profile.email, { purge: true }, "Профиль удалён навсегда");
  };

  const selectedRecipientList = users
    .filter((profile) => selectedEmails[profile.email])
    .map((profile) => ({ email: profile.email, name: profile.name || profile.email }));

  return (
    <div className="cms-root">
      <AdminSidebar />
      <main className="cms-main">
        <div className="cms-header">
          <div>
            <h1 className="cms-header-title">Клиенты</h1>
            <p style={{ fontSize: "13px", color: "var(--cms-text-muted)", marginTop: "2px" }}>{total} профилей</p>
          </div>
        </div>

        {notification && <div className="cms-notification">{notification}</div>}

        <div className="cms-content">
          <form onSubmit={onSearch} style={{ marginBottom: "16px", display: "flex", gap: "8px", flexWrap: "wrap" }}>
            <input
              className="cms-input"
              style={{ width: "320px" }}
              placeholder="Поиск по имени, email, городу, бейджу..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            <select className="cms-select" value={view} onChange={(e) => setView(e.target.value as "active" | "archived" | "all")}>
              <option value="active">Активные</option>
              <option value="archived">Архив</option>
              <option value="all">Все</option>
            </select>
            <button type="submit" className="cms-btn cms-btn-sm cms-btn-secondary">Найти</button>
            {search && (
              <button type="button" className="cms-btn cms-btn-sm cms-btn-ghost" onClick={() => { setSearch(""); fetchUsers("", 1, view); }}>
                Сбросить
              </button>
            )}
          </form>

          <div className="cms-card" style={{ marginBottom: "14px", padding: "12px", border: "1px solid var(--cms-border)" }}>
            <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", alignItems: "center" }}>
              <strong style={{ fontSize: "13px" }}>Ссылки на отзыв:</strong>
              <select
                className="cms-select"
                value={selectedProductId}
                onChange={(e) => setSelectedProductId(e.target.value)}
                style={{ minWidth: "220px" }}
              >
                <option value="">Выберите товар</option>
                {products.map((product) => (
                  <option key={product.id} value={product.id}>
                    {product.nameRu || product.name}
                  </option>
                ))}
              </select>
              <button
                type="button"
                className="cms-btn cms-btn-sm"
                disabled={sendingInvites || selectedRecipientList.length === 0 || !selectedProductId}
                onClick={() => void sendReviewInvites(selectedRecipientList)}
              >
                {sendingInvites ? "Отправка..." : `Отправить выбранным (${selectedRecipientList.length})`}
              </button>
              <button
                type="button"
                className="cms-btn cms-btn-sm cms-btn-ghost"
                onClick={() => {
                  const all: Record<string, boolean> = {};
                  for (const u of users) all[u.email] = true;
                  setSelectedEmails(all);
                }}
              >
                Выбрать всех на странице
              </button>
              <button
                type="button"
                className="cms-btn cms-btn-sm cms-btn-ghost"
                onClick={() => setSelectedEmails({})}
              >
                Снять выбор
              </button>
            </div>
          </div>

          {loading ? (
            <div style={{ padding: "48px", textAlign: "center", color: "var(--cms-text-muted)" }}>
              <div className="cms-spinner" style={{ margin: "0 auto 12px" }} />
              Загрузка...
            </div>
          ) : users.length === 0 ? (
            <div className="cms-card" style={{ padding: "44px", textAlign: "center", color: "var(--cms-text-muted)" }}>
              Профили не найдены
            </div>
          ) : (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(330px, 1fr))", gap: "14px" }}>
              {users.map((profile) => {
                const latest = profile.orders[0];
                const canGetRegularBadge = profile._count.orders >= 10 && !profile.badges.includes("Постоянный покупатель");
                return (
                  <div key={profile.id} className="cms-card" style={{ border: "1px solid var(--cms-border)", padding: "14px" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "12px" }}>
                      <input
                        type="checkbox"
                        checked={Boolean(selectedEmails[profile.email])}
                        onChange={(e) => toggleSelectedEmail(profile.email, e.target.checked)}
                        title="Выбрать для массовой отправки ссылки на отзыв"
                      />
                      <UserAvatar name={profile.name || profile.email} />
                      <div style={{ minWidth: 0, flex: 1 }}>
                        <div style={{ fontWeight: 700, fontSize: "14px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{profile.name || "Без имени"}</div>
                        <div style={{ fontSize: "12px", color: "var(--cms-text-muted)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{profile.email}</div>
                      </div>
                      {profile.archived && <span className="cms-badge">Архив</span>}
                    </div>

                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px", marginBottom: "10px", fontSize: "12px" }}>
                      <div><strong>Заказы:</strong> {profile._count.orders}</div>
                      <div><strong>Сумма:</strong> {formatMoney(profile.totalSpent || 0, latest?.currency || "RUB")}</div>
                      <div><strong>Телефон:</strong> {profile.phone || "—"}</div>
                      <div><strong>Город:</strong> {profile.city || "—"}</div>
                      <div><strong>Страна:</strong> {COUNTRY_NAMES[profile.country] || profile.country || "—"}</div>
                      <div><strong>Последний:</strong> {latest ? formatDate(latest.createdAt) : "—"}</div>
                    </div>

                    <div style={{ fontSize: "12px", marginBottom: "10px", color: "var(--cms-text-muted)" }}>
                      Адрес: {[profile.street, profile.house && `д. ${profile.house}`, profile.apartment && `кв. ${profile.apartment}`, profile.zipCode].filter(Boolean).join(", ") || "—"}
                    </div>

                    <div style={{ marginBottom: "10px" }}>
                      <div style={{ fontSize: "11px", textTransform: "uppercase", letterSpacing: "0.05em", color: "var(--cms-text-muted)", marginBottom: "6px" }}>Бейджи</div>
                      <div style={{ display: "flex", flexWrap: "wrap", gap: "6px", marginBottom: "8px" }}>
                        {(profile.badges || []).length > 0 ? profile.badges.map((badge) => (
                          <span key={badge} className="cms-badge cms-badge-blue" style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}>
                            {badge}
                            <button onClick={() => removeBadge(profile, badge)} style={{ background: "none", border: "none", color: "inherit", cursor: "pointer", lineHeight: 1 }}>×</button>
                          </span>
                        )) : <span style={{ fontSize: "12px", color: "var(--cms-text-muted)" }}>нет бейджей</span>}
                      </div>

                      <div style={{ display: "flex", gap: "6px", marginBottom: "6px" }}>
                        <input
                          className="cms-input cms-input-sm"
                          placeholder="Новый бейдж"
                          value={badgeInputs[profile.email] || ""}
                          onChange={(e) => setBadgeInputs((prev) => ({ ...prev, [profile.email]: e.target.value }))}
                        />
                        <button
                          className="cms-btn cms-btn-xs"
                          disabled={pending === profile.email}
                          onClick={() => addBadge(profile, badgeInputs[profile.email] || "")}
                        >
                          +
                        </button>
                      </div>

                      <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
                        {QUICK_BADGES.map((b) => (
                          <button key={b} className="cms-btn cms-btn-xs cms-btn-ghost" onClick={() => addBadge(profile, b)} disabled={pending === profile.email}>
                            {b}
                          </button>
                        ))}
                        {canGetRegularBadge && (
                          <button className="cms-btn cms-btn-xs" onClick={() => addBadge(profile, "Постоянный покупатель")} disabled={pending === profile.email}>
                            + Постоянный покупатель (10+)
                          </button>
                        )}
                      </div>
                    </div>

                    <div style={{ marginBottom: "10px" }}>
                      <div style={{ fontSize: "11px", textTransform: "uppercase", letterSpacing: "0.05em", color: "var(--cms-text-muted)", marginBottom: "6px" }}>Items on cart (последний заказ)</div>
                      {profile.cartItems.length > 0 ? (
                        <ul style={{ margin: 0, paddingLeft: "18px", fontSize: "12px" }}>
                          {profile.cartItems.slice(0, 6).map((item, idx) => (
                            <li key={`${profile.id}-${idx}`}>{item.productName} × {item.quantity}</li>
                          ))}
                        </ul>
                      ) : (
                        <div style={{ fontSize: "12px", color: "var(--cms-text-muted)" }}>нет данных</div>
                      )}
                    </div>

                    <div style={{ marginBottom: "12px" }}>
                      <div style={{ fontSize: "11px", textTransform: "uppercase", letterSpacing: "0.05em", color: "var(--cms-text-muted)", marginBottom: "6px" }}>Заказы</div>
                      {profile.orders.length > 0 ? (
                        <div style={{ display: "flex", flexDirection: "column", gap: "6px", maxHeight: "140px", overflow: "auto" }}>
                          {profile.orders.slice(0, 4).map((order) => (
                            <div key={order.id} style={{ border: "1px solid var(--cms-border)", borderRadius: "8px", padding: "8px" }}>
                              <div style={{ display: "flex", justifyContent: "space-between", gap: "8px", fontSize: "12px" }}>
                                <strong>#{order.orderNumber}</strong>
                                <span>{formatMoney(order.totalAmount, order.currency)}</span>
                              </div>
                              <div style={{ fontSize: "11px", color: "var(--cms-text-muted)", marginTop: "2px" }}>
                                {formatDate(order.createdAt)} • {order.status}
                              </div>
                              <div style={{ fontSize: "11px", marginTop: "4px", color: "var(--cms-text-muted)" }}>
                                {order.items.map((i) => `${i.productName} × ${i.quantity}`).join("; ")}
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div style={{ fontSize: "12px", color: "var(--cms-text-muted)" }}>заказов нет</div>
                      )}
                    </div>

                    <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
                      <button
                        className="cms-btn cms-btn-xs cms-btn-secondary"
                        disabled={sendingInvites || !selectedProductId}
                        onClick={() => void sendReviewInvites([{ email: profile.email, name: profile.name || profile.email }])}
                      >
                        Ссылка на отзыв
                      </button>
                      <button className="cms-btn cms-btn-xs" onClick={() => toggleArchive(profile)} disabled={pending === profile.email}>
                        {profile.archived ? "Восстановить" : "В архив"}
                      </button>
                      <button
                        className="cms-btn cms-btn-xs cms-btn-danger"
                        onClick={() => purgeProfile(profile)}
                        disabled={pending === profile.email || !profile.archived}
                        title="Полное удаление доступно только из архива"
                      >
                        Удалить навсегда
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {pages > 1 && (
            <div style={{ display: "flex", justifyContent: "center", alignItems: "center", gap: "8px", marginTop: "16px" }}>
              <button className="cms-btn cms-btn-sm cms-btn-ghost" disabled={page <= 1} onClick={() => fetchUsers(search, page - 1, view)}>←</button>
              <span style={{ fontSize: "13px", color: "var(--cms-text-muted)" }}>Стр. {page} из {pages}</span>
              <button className="cms-btn cms-btn-sm cms-btn-ghost" disabled={page >= pages} onClick={() => fetchUsers(search, page + 1, view)}>→</button>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
