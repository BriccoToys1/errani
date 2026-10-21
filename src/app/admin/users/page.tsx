"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { AdminPage } from "../AdminPage";
import { HeaderActions, IconButton, SearchField, Toolbar, ScrollArea, useContactSheet, PageLoading } from "@/components/admin";

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
      background: "var(--cms-accent)",
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
  const contactSheet = useContactSheet();
  const [users, setUsers] = useState<CustomerProfile[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [view, setView] = useState<"active" | "archived" | "all" | "blocked">("active");
  const [notification, setNotification] = useState("");
  const [pending, setPending] = useState<string | null>(null);
  const [badgeInputs, setBadgeInputs] = useState<Record<string, string>>({});
  const [products, setProducts] = useState<ProductSummary[]>([]);
  const [selectedProductId, setSelectedProductId] = useState("");
  const [selectedEmails, setSelectedEmails] = useState<Record<string, boolean>>({});
  const [sendingInvites, setSendingInvites] = useState(false);
  const [showNewClient, setShowNewClient] = useState(false);
  const [newClientForm, setNewClientForm] = useState({ name: "", email: "", phone: "", country: "RU", city: "", zipCode: "", street: "", house: "", apartment: "" });
  const [creatingClient, setCreatingClient] = useState(false);

  const getToken = useCallback(() => localStorage.getItem("admin_token"), []);

  const notify = (msg: string) => {
    setNotification(msg);
    setTimeout(() => setNotification(""), 3500);
  };

  const fetchUsers = useCallback(async (q = "", p = 1, v: "active" | "archived" | "all" | "blocked" = view) => {
    const token = getToken();
    if (!token) {
      router.push("/admin/login");
      return;
    }

    setLoading(true);
    const apiView = v === "blocked" ? "all" : v;
    const res = await fetch(`/api/admin/users?search=${encodeURIComponent(q)}&page=${p}&view=${apiView}`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (res.status === 401) {
      localStorage.removeItem("admin_token");
      router.push("/admin/login");
      return;
    }

    if (!res.ok) {
      notify("Не удалось загрузить клиентов — показаны последние данные");
      setLoading(false);
      return;
    }

    const data = await res.json();
    const allUsers: CustomerProfile[] = Array.isArray(data.users) ? data.users : [];
    // Keep previous list if the payload is empty due to a transient failure shape.
    if (!Array.isArray(data.users)) {
      notify("Не удалось загрузить клиентов — показаны последние данные");
      setLoading(false);
      return;
    }
    const filtered = v === "blocked" ? allUsers.filter(u => u.badges?.includes("__blocked__")) : allUsers;
    setUsers(filtered);
    setTotal(v === "blocked" ? filtered.length : (data.total || 0));
    setPage(data.page || 1);
    setPages(v === "blocked" ? 1 : (data.pages || 1));
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

  const handleCreateClient = async () => {
    if (!newClientForm.name.trim() || !newClientForm.email.trim()) {
      notify("Имя и email обязательны");
      return;
    }
    const token = getToken();
    if (!token) return;
    setCreatingClient(true);
    try {
      const res = await fetch("/api/admin/users", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(newClientForm),
      });
      const data = await res.json();
      if (!res.ok) { notify(data.error || "Ошибка создания"); return; }
      notify(`Клиент ${newClientForm.email} создан`);
      setShowNewClient(false);
      setNewClientForm({ name: "", email: "", phone: "", country: "RU", city: "", zipCode: "", street: "", house: "", apartment: "" });
      fetchUsers(search, 1, view);
    } finally {
      setCreatingClient(false);
    }
  };

  const selectedRecipientList = users
    .filter((profile) => selectedEmails[profile.email])
    .map((profile) => ({ email: profile.email, name: profile.name || profile.email }));

  if (loading && users.length === 0) return <PageLoading />;

  return (
    <AdminPage
      title="Клиенты"
      count={total}
      fill
      actions={
        <HeaderActions>
          <IconButton icon="add" label="Добавить" shape="plain" onClick={() => setShowNewClient(true)} />
          <IconButton icon="export" label="Скачать" shape="plain" onClick={() => { window.location.href = "/api/admin/export?type=users&format=xls"; }} />
          <IconButton icon="refresh" label="Обновить" shape="plain" onClick={() => window.location.reload()} />
        </HeaderActions>
      }
    >

          <Toolbar>
            <SearchField value={search} onChange={setSearch} style={{ width: 280 }} />
            <IconButton icon="block" label="Заблокированные" shape="square" active={view === 'blocked'} onClick={() => setView(view === 'blocked' ? 'active' : 'blocked')} />
            <IconButton icon="archive" label="Архив" shape="square" active={view === 'archived'} onClick={() => setView(view === 'archived' ? 'active' : 'archived')} />
{search && (
              <button type="button" className="cms-btn cms-btn-sm cms-btn-ghost" onClick={() => { setSearch(""); fetchUsers("", 1, view); }}>
                Сбросить
              </button>
            )}
          </Toolbar>

          <ScrollArea>
          {users.length === 0 ? (
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
                    <div style={{ display: "flex", alignItems: "flex-start", gap: "12px", marginBottom: "10px" }}>
                      <UserAvatar name={profile.name || profile.email} />
                      <div style={{ minWidth: 0, flex: 1 }}>
                        <div style={{ fontWeight: 700, fontSize: "14px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{profile.name || "Без имени"}</div>
                        <div style={{ fontSize: "12px", color: "var(--cms-text-muted)", marginTop: 4, lineHeight: 1.4 }}>
                          {[
                            profile.street,
                            profile.house && `д. ${profile.house}`,
                            profile.apartment && `кв. ${profile.apartment}`,
                            profile.zipCode,
                            profile.city,
                            COUNTRY_NAMES[profile.country] || profile.country,
                          ].filter(Boolean).join(", ") || "Адрес не указан"}
                        </div>
                        <div style={{ display: "flex", gap: 14, marginTop: 8, fontSize: 12 }}>
                          <span><strong>Заказы:</strong> {profile._count.orders}</span>
                          <span><strong>Сумма:</strong> {formatMoney(profile.totalSpent || 0, latest?.currency || "RUB")}</span>
                        </div>
                      </div>
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 4, flexShrink: 0 }}>
                        <IconButton icon="archive" label={profile.archived ? "Восстановить" : "В архив"} shape="square" onClick={() => toggleArchive(profile)} disabled={pending === profile.email} />
                        <IconButton
                          icon="block"
                          label={profile.badges?.includes('__blocked__') ? "Разблокировать" : "Заблокировать"}
                          shape="square"
                          tone={profile.badges?.includes('__blocked__') ? 'danger' : 'default'}
                          onClick={() => {
                            const isBlocked = profile.badges?.includes('__blocked__');
                            if (!confirm(isBlocked ? `Подтвердите разблокировку клиента ${profile.email}` : `Подтвердите блокировку клиента ${profile.email}`)) return;
                            setUsers(prev => prev.map(u => {
                              if (u.email !== profile.email) return u;
                              const badges = isBlocked
                                ? (u.badges || []).filter(b => b !== '__blocked__')
                                : [...(u.badges || []).filter(b => b !== '__blocked__'), '__blocked__'];
                              return { ...u, badges };
                            }));
                            patchProfile(profile.email, { blocked: !isBlocked }, isBlocked ? "Клиент разблокирован" : "Клиент заблокирован");
                          }}
                          disabled={pending === profile.email}
                        />
                        <IconButton icon="phone" label={profile.phone || "Нет телефона"} shape="square" disabled={!profile.phone} onClick={() => profile.phone && navigator.clipboard.writeText(profile.phone)} />
                        <IconButton icon="mail" label={profile.email} shape="square" onClick={() => contactSheet.open({ type: "email", value: profile.email })} />
                      </div>
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
          </ScrollArea>

      {/* New Client Modal */}
      {showNewClient && (
        <div className="cms-modal-overlay" onClick={() => setShowNewClient(false)}>
          <div className="cms-modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 560 }}>
            <div className="cms-modal-header">
              <h3>Добавить клиента</h3>
              <button className="cms-modal-close" onClick={() => setShowNewClient(false)}>&times;</button>
            </div>
            <div className="cms-modal-body" style={{ maxHeight: "65vh", overflowY: "auto" }}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
                <label className="cms-label" style={{ gridColumn: "span 2" }}>
                  Имя и фамилия *
                  <input className="cms-input" value={newClientForm.name} onChange={(e) => setNewClientForm({ ...newClientForm, name: e.target.value })} placeholder="Иван Иванов" style={{ marginTop: 4 }} />
                </label>
                <label className="cms-label" style={{ gridColumn: "span 2" }}>
                  Email *
                  <input className="cms-input" type="email" value={newClientForm.email} onChange={(e) => setNewClientForm({ ...newClientForm, email: e.target.value })} placeholder="ivan@example.com" style={{ marginTop: 4 }} />
                </label>
                <label className="cms-label">
                  Телефон
                  <input className="cms-input" value={newClientForm.phone} onChange={(e) => setNewClientForm({ ...newClientForm, phone: e.target.value })} placeholder="+7 999 000 00 00" style={{ marginTop: 4 }} />
                </label>
                <label className="cms-label">
                  Страна
                  <select className="cms-select" value={newClientForm.country} onChange={(e) => setNewClientForm({ ...newClientForm, country: e.target.value })} style={{ marginTop: 4 }}>
                    <option value="RU">Россия</option>
                    <option value="BY">Беларусь</option>
                    <option value="KZ">Казахстан</option>
                    <option value="UA">Украина</option>
                    <option value="UZ">Узбекистан</option>
                    <option value="DE">Германия</option>
                    <option value="FR">Франция</option>
                    <option value="US">США</option>
                    <option value="OTHER">Другая</option>
                  </select>
                </label>
                <label className="cms-label">
                  Город
                  <input className="cms-input" value={newClientForm.city} onChange={(e) => setNewClientForm({ ...newClientForm, city: e.target.value })} placeholder="Москва" style={{ marginTop: 4 }} />
                </label>
                <label className="cms-label">
                  Индекс
                  <input className="cms-input" value={newClientForm.zipCode} onChange={(e) => setNewClientForm({ ...newClientForm, zipCode: e.target.value })} placeholder="123456" style={{ marginTop: 4 }} />
                </label>
                <label className="cms-label" style={{ gridColumn: "span 2" }}>
                  Улица
                  <input className="cms-input" value={newClientForm.street} onChange={(e) => setNewClientForm({ ...newClientForm, street: e.target.value })} placeholder="ул. Ленина" style={{ marginTop: 4 }} />
                </label>
                <label className="cms-label">
                  Дом
                  <input className="cms-input" value={newClientForm.house} onChange={(e) => setNewClientForm({ ...newClientForm, house: e.target.value })} placeholder="1А" style={{ marginTop: 4 }} />
                </label>
                <label className="cms-label">
                  Квартира
                  <input className="cms-input" value={newClientForm.apartment} onChange={(e) => setNewClientForm({ ...newClientForm, apartment: e.target.value })} placeholder="10" style={{ marginTop: 4 }} />
                </label>
              </div>
              <p style={{ fontSize: 12, color: "var(--cms-text-muted)", marginTop: 12 }}>
                После создания клиента вы сможете добавить ему заказы вручную на странице «Заказы».
              </p>
            </div>
            <div className="cms-modal-actions">
              <button className="cms-btn cms-btn-primary" onClick={handleCreateClient} disabled={creatingClient}>
                {creatingClient ? "Создание..." : "Создать клиента"}
              </button>
              <button className="cms-btn" onClick={() => setShowNewClient(false)}>Отмена</button>
            </div>
          </div>
        </div>
      )}
      {contactSheet.node}
    </AdminPage>
  );
}
