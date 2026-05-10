"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { AdminSidebar } from "../AdminSidebar";

interface OrderItem {
  id: string;
  productId: string;
  quantity: number;
  price: number;
  product: { name: string };
}

interface Order {
  id: string;
  orderNumber: string;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  country: string;
  oblast: string;
  city: string;
  zipCode: string;
  street: string;
  house: string;
  apartment: string;
  shippingMethod: string;
  status: string;
  paymentMethod: string;
  totalAmount: number;
  currency: string;
  notes: string;
  isManual: boolean;
  items: OrderItem[];
  createdAt: string;
}

interface Product {
  id: string;
  name: string;
  nameRu: string;
  price: number;
}

const STATUS_MAP: Record<string, { label: string; cls: string }> = {
  unpaid:     { label: "Не оплачен",  cls: "cms-badge-red" },
  paid:       { label: "Оплачен",     cls: "cms-badge-green" },
  assembling: { label: "Сборка",      cls: "cms-badge-yellow" },
  shipped:    { label: "Отправлен",   cls: "cms-badge-blue" },
  in_transit: { label: "В пути",      cls: "cms-badge-blue" },
  delivered:  { label: "Доставлен",   cls: "cms-badge-green" },
  cancelled:  { label: "Отменён",     cls: "cms-badge-red" },
};

const ALL_STATUSES = ["unpaid", "paid", "assembling", "shipped", "in_transit", "delivered", "cancelled"];

const emptyManualForm = {
  customerName: "",
  customerEmail: "",
  customerPhone: "",
  country: "RU",
  oblast: "",
  city: "",
  zipCode: "",
  street: "",
  house: "",
  apartment: "",
  shippingMethod: "",
  paymentMethod: "cash",
  currency: "RUB",
  notes: "",
  status: "unpaid",
  totalAmount: "",
  items: [{ productId: "", quantity: 1, price: 0, name: "" }],
};

export default function AdminOrdersPage() {
  const router = useRouter();
  const [orders, setOrders] = useState<Order[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Order | null>(null);
  const [editStatus, setEditStatus] = useState("");
  const [editNotes, setEditNotes] = useState("");
  const [editTotalAmount, setEditTotalAmount] = useState("");
  const [saving, setSaving] = useState(false);
  const [notification, setNotification] = useState("");
  const [search, setSearch] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [showNewOrder, setShowNewOrder] = useState(false);
  const [manualForm, setManualForm] = useState<typeof emptyManualForm>(emptyManualForm);
  const [creatingManual, setCreatingManual] = useState(false);

  const getToken = useCallback(() => localStorage.getItem("admin_token"), []);

  const ensureAuthorized = useCallback((token: string | null) => {
    if (!token) {
      router.push("/admin/login");
      return false;
    }
    return true;
  }, [router]);

  const fetchOrders = useCallback(async () => {
    const token = getToken();
    if (!token) { router.push("/admin/login"); return; }
    try {
      const res = await fetch("/api/orders", { headers: { Authorization: `Bearer ${token}` } });
      if (res.status === 401) { localStorage.removeItem("admin_token"); router.push("/admin/login"); return; }
      const data = await res.json();
      setOrders(Array.isArray(data) ? data : []);
    } catch { /* ignore */ }
    setLoading(false);
  }, [getToken, router]);

  const fetchProducts = useCallback(async () => {
    try {
      const res = await fetch("/api/products?summary=1");
      const data = await res.json();
      setProducts(Array.isArray(data) ? data : []);
    } catch { /* ignore */ }
  }, []);

  useEffect(() => { fetchOrders(); fetchProducts(); }, [fetchOrders, fetchProducts]);

  const openOrder = (order: Order) => {
    setSelected(order);
    setEditStatus(order.status);
    setEditNotes(order.notes);
    setEditTotalAmount(String(order.totalAmount));
  };

  const handleSave = async () => {
    if (!selected) return;
    setSaving(true);
    const token = getToken();
    const res = await fetch(`/api/orders/${selected.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({
        status: editStatus,
        notes: editNotes,
        ...(selected.isManual ? { totalAmount: Number(editTotalAmount) } : {}),
      }),
    });
    if (res.ok) {
      notify(`Заказ ${selected.orderNumber} обновлён`);
      setSelected(null);
      fetchOrders();
    }
    setSaving(false);
  };

  const deleteOrder = async (order: Order) => {
    if (!confirm(`Удалить заказ ${order.orderNumber}?`)) return;
    const token = getToken();
    const res = await fetch(`/api/orders/${order.id}`, { method: "DELETE", headers: { Authorization: `Bearer ${token}` } });
    if (res.ok) {
      notify(`Заказ ${order.orderNumber} удалён`);
      fetchOrders();
    }
  };

  const notify = (msg: string) => {
    setNotification(msg);
    setTimeout(() => setNotification(""), 3000);
  };

  const downloadOrdersExport = async (format: "csv" | "xls") => {
    const token = getToken();
    if (!ensureAuthorized(token)) return;

    try {
      const res = await fetch(`/api/admin/export?type=orders&format=${format}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.status === 401) {
        localStorage.removeItem("admin_token");
        router.push("/admin/login");
        return;
      }
      if (!res.ok) {
        notify("Не удалось скачать экспорт");
        return;
      }

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `orders_${new Date().toISOString().slice(0, 10)}.${format}`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
    } catch {
      notify("Ошибка сети");
    }
  };

  const openReceipt = async (orderId: string) => {
    const token = getToken();
    if (!ensureAuthorized(token)) return;

    try {
      const res = await fetch(`/api/admin/orders/${orderId}/receipt`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.status === 401) {
        localStorage.removeItem("admin_token");
        router.push("/admin/login");
        return;
      }
      if (!res.ok) {
        notify("Не удалось открыть чек");
        return;
      }

      const html = await res.text();
      const blobUrl = URL.createObjectURL(new Blob([html], { type: "text/html;charset=utf-8" }));
      const opened = window.open(blobUrl, "_blank", "noopener,noreferrer");
      if (!opened) {
        notify("Браузер заблокировал открытие вкладки");
      }
      setTimeout(() => URL.revokeObjectURL(blobUrl), 60_000);
    } catch {
      notify("Ошибка сети");
    }
  };

  const deleteUnpaid = async () => {
    if (!confirm("Удалить все неоплаченные (pending) заказы?")) return;
    setDeleting(true);
    const token = getToken();
    try {
      const res = await fetch("/api/orders", { method: "DELETE", headers: { Authorization: `Bearer ${token}` } });
      if (res.ok) {
        const data = await res.json();
        notify(`Удалено ${data.deleted} неоплаченных заказов`);
        fetchOrders();
      } else {
        notify("Ошибка при удалении");
      }
    } catch {
      notify("Ошибка сети");
    }
    setDeleting(false);
  };

  const formatPrice = (n: number) =>
    new Intl.NumberFormat("ru-RU", { style: "currency", currency: "RUB", minimumFractionDigits: 0 }).format(n);

  const markAllRead = async () => {
    const token = getToken();
    try {
      await fetch("/api/orders/viewed", { method: "POST", headers: { Authorization: `Bearer ${token}` } });
      notify("Все заказы отмечены как просмотренные");
    } catch { /* ignore */ }
  };

  const updateManualItem = (idx: number, field: string, value: string | number) => {
    const items = manualForm.items.map((item, i) => {
      if (i !== idx) return item;
      const updated = { ...item, [field]: value };
      if (field === "productId") {
        const prod = products.find((p) => p.id === value);
        if (prod) { updated.price = prod.price; updated.name = prod.nameRu || prod.name; }
      }
      return updated;
    });
    const total = items.reduce((s, it) => s + Number(it.price) * Number(it.quantity), 0);
    setManualForm({ ...manualForm, items, totalAmount: total > 0 ? String(total) : manualForm.totalAmount });
  };

  const handleCreateManual = async () => {
    if (!manualForm.customerName || !manualForm.totalAmount) {
      notify("Укажите имя клиента и сумму");
      return;
    }
    setCreatingManual(true);
    const token = getToken();
    const validItems = manualForm.items.filter((i) => i.productId && i.price > 0);
    const res = await fetch("/api/admin/orders", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({
        customerName: manualForm.customerName,
        customerEmail: manualForm.customerEmail,
        customerPhone: manualForm.customerPhone,
        country: manualForm.country,
        oblast: manualForm.oblast,
        city: manualForm.city,
        zipCode: manualForm.zipCode,
        street: manualForm.street,
        house: manualForm.house,
        apartment: manualForm.apartment,
        shippingMethod: manualForm.shippingMethod,
        paymentMethod: manualForm.paymentMethod,
        currency: manualForm.currency,
        notes: manualForm.notes,
        status: manualForm.status,
        totalAmount: Number(manualForm.totalAmount),
        items: validItems.map((i) => ({ productId: i.productId, quantity: Number(i.quantity), price: Number(i.price) })),
      }),
    });
    if (res.ok) {
      notify("Заказ создан");
      setShowNewOrder(false);
      setManualForm(emptyManualForm);
      fetchOrders();
    } else {
      const err = await res.json();
      notify(`Ошибка: ${err.error || "неизвестная ошибка"}`);
    }
    setCreatingManual(false);
  };

  const newCount = orders.filter((o) => o.status === "paid" || o.status === "assembling").length;

  const filtered = orders.filter((o) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return o.orderNumber.toLowerCase().includes(q) || o.customerName.toLowerCase().includes(q) || (o.customerEmail || "").toLowerCase().includes(q);
  });

  const sorted = [...filtered].sort((a, b) => {
    if (a.isManual && !b.isManual) return -1;
    if (!a.isManual && b.isManual) return 1;
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
  });

  const totalItems = filtered.reduce((sum, o) => sum + o.items.reduce((s, i) => s + i.quantity, 0), 0);
  const totalSum = filtered.reduce((sum, o) => sum + o.totalAmount, 0);

  if (loading) return <div className="cms-loading"><div className="cms-spinner" /> Загрузка...</div>;

  return (
    <div className="cms-root">
      <AdminSidebar />
      <main className="cms-main">
        <div className="cms-header">
          <h1 className="cms-header-title">
            Заказы
            {newCount > 0 && <span className="cms-badge cms-badge-blue" style={{ marginLeft: "10px", fontSize: "12px" }}>{newCount}</span>}
          </h1>
          <div className="cms-header-actions">
            <span style={{ fontSize: "13px", color: "var(--cms-text-muted)" }}>{orders.length} всего</span>
            <button className="cms-btn cms-btn-sm cms-btn-primary" onClick={() => setShowNewOrder(true)}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ marginRight: 5 }}><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
              Добавить вручную
            </button>
            <button className="cms-btn cms-btn-sm cms-btn-danger" onClick={deleteUnpaid} disabled={deleting}>
              {deleting ? "Удаление..." : "Удалить неоплаченные"}
            </button>
            <button className="cms-btn cms-btn-sm" onClick={() => downloadOrdersExport("csv")}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ marginRight: 4 }}><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>CSV
            </button>
            <button className="cms-btn cms-btn-sm" onClick={() => downloadOrdersExport("xls")}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ marginRight: 4 }}><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>XLS
            </button>
            <button className="cms-btn cms-btn-sm" onClick={() => { setLoading(true); fetchOrders(); }} title="Обновить">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M23 4v6h-6M1 20v-6h6"/><path d="M3.51 9a9 9 0 0114.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0020.49 15"/></svg>
            </button>
            <button className="cms-btn cms-btn-sm" onClick={markAllRead} title="Отметить просмотренными">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
            </button>
          </div>
        </div>

        <div className="cms-content">
          <div style={{ display: "flex", gap: "8px", alignItems: "center", marginBottom: "12px", flexWrap: "wrap" }}>
            <input
              className="cms-input cms-input-sm"
              placeholder="Поиск по номеру, имени, email..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{ width: "240px" }}
            />
            {sorted.some((o) => o.isManual) && (
              <span style={{ fontSize: "11px", display: "flex", alignItems: "center", gap: 5, color: "var(--cms-text-muted)" }}>
                <span style={{ background: "rgba(139,92,246,0.15)", border: "1px solid rgba(139,92,246,0.4)", color: "#a78bfa", borderRadius: 4, padding: "1px 6px", fontSize: 10, fontWeight: 700 }}>РУЧНОЙ</span>
                — добавлен вручную, закреплён наверху
              </span>
            )}
          </div>

          <div className="cms-table-wrap">
            <table className="cms-table">
              <thead>
                <tr>
                  <th>Order #</th>
                  <th>Клиент ({filtered.length})</th>
                  <th>Товары ({totalItems})</th>
                  <th>Сумма ({formatPrice(totalSum)})</th>
                  <th>Статус</th>
                  <th>Доставка</th>
                  <th>Дата</th>
                  <th style={{ width: 80 }}>Действия</th>
                </tr>
              </thead>
              <tbody>
                {sorted.map((order) => (
                  <tr
                    key={order.id}
                    style={order.isManual ? { background: "rgba(139,92,246,0.06)", borderLeft: "3px solid rgba(139,92,246,0.5)" } : undefined}
                  >
                    <td className="cms-td-mono">
                      <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                        {order.isManual && (
                          <span style={{ background: "rgba(139,92,246,0.15)", border: "1px solid rgba(139,92,246,0.4)", color: "#a78bfa", borderRadius: 3, padding: "0 5px", fontSize: 9, fontWeight: 700, letterSpacing: "0.05em", flexShrink: 0 }}>
                            РУЧНОЙ
                          </span>
                        )}
                        {order.orderNumber}
                      </div>
                    </td>
                    <td className="cms-td-bold">
                      {order.customerName}
                      {order.customerEmail && <div style={{ fontSize: "11px", color: "var(--cms-text-muted)" }}>{order.customerEmail}</div>}
                    </td>
                    <td>
                      {order.items.length > 0 ? order.items.map((item) => (
                        <div key={item.id} style={{ fontSize: "12px" }}>{item.product.name} ×{item.quantity}</div>
                      )) : <span style={{ color: "var(--cms-text-muted)", fontSize: 12 }}>—</span>}
                    </td>
                    <td style={{ fontWeight: 600 }}>{formatPrice(order.totalAmount)}</td>
                    <td>
                      <span className={`cms-badge ${STATUS_MAP[order.status]?.cls ?? "cms-badge-yellow"}`}>
                        {STATUS_MAP[order.status]?.label ?? order.status}
                      </span>
                    </td>
                    <td>{order.shippingMethod || "—"}</td>
                    <td>{new Date(order.createdAt).toLocaleDateString("ru-RU")}</td>
                    <td>
                      <div style={{ display: "flex", gap: "4px", alignItems: "center" }}>
                        <button className="cms-btn cms-btn-xs cms-btn-ghost" onClick={() => openOrder(order)} title="Изменить">
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 013 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>
                        </button>
                        <button className="cms-btn cms-btn-xs cms-btn-ghost" title="Чек" onClick={() => openReceipt(order.id)}>
                          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>
                        </button>
                        {(order.isManual || order.status === "pending" || order.status === "cancelled" || order.status === "unpaid") && (
                          <button className="cms-btn cms-btn-xs cms-btn-danger" onClick={() => deleteOrder(order)} title="Удалить">
                            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/></svg>
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
                {sorted.length === 0 && (
                  <tr><td colSpan={8} style={{ textAlign: "center", padding: "32px", color: "var(--cms-text-muted)" }}>Заказы не найдены</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </main>

      {/* Order Edit Modal */}
      {selected && (
        <div className="cms-modal-overlay" onClick={() => setSelected(null)}>
          <div className="cms-modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 600 }}>
            <div className="cms-modal-header">
              <h3>
                Заказ {selected.orderNumber}
                {selected.isManual && <span style={{ marginLeft: 8, background: "rgba(139,92,246,0.15)", color: "#a78bfa", borderRadius: 4, padding: "1px 7px", fontSize: 11, fontWeight: 600 }}>Ручной</span>}
              </h3>
              <button className="cms-modal-close" onClick={() => setSelected(null)}>&times;</button>
            </div>
            <div className="cms-modal-body" style={{ maxHeight: "65vh", overflowY: "auto" }}>
              <div style={{ display: "grid", gridTemplateColumns: "110px 1fr", gap: "6px 14px", fontSize: "13px", marginBottom: "14px" }}>
                <strong>Клиент:</strong> <span>{selected.customerName}</span>
                <strong>Email:</strong> <span>{selected.customerEmail || "—"}</span>
                <strong>Телефон:</strong> <span>{selected.customerPhone || "—"}</span>
                <strong>Город:</strong> <span>{selected.city || "—"}</span>
                {!selected.isManual && <><strong>Доставка:</strong> <span>{selected.shippingMethod || "—"}</span></>}
                <strong>Оплата:</strong> <span>{selected.paymentMethod || "—"}</span>
              </div>

              {selected.isManual && (
                <label className="cms-label" style={{ marginBottom: "12px", display: "block" }}>
                  Сумма заказа (₽)
                  <input className="cms-input" type="number" value={editTotalAmount} onChange={(e) => setEditTotalAmount(e.target.value)} style={{ marginTop: 4 }} />
                </label>
              )}

              {!selected.isManual && selected.items.length > 0 && (
                <div style={{ marginBottom: "14px" }}>
                  <strong style={{ fontSize: "13px" }}>Товары:</strong>
                  <table className="cms-table" style={{ marginTop: "6px" }}>
                    <thead><tr><th>Название</th><th>Кол-во</th><th>Цена</th></tr></thead>
                    <tbody>
                      {selected.items.map((item) => (
                        <tr key={item.id}><td>{item.product.name}</td><td>{item.quantity}</td><td>{formatPrice(item.price)}</td></tr>
                      ))}
                    </tbody>
                  </table>
                  <div style={{ textAlign: "right", fontWeight: 700, padding: "6px 0", borderTop: "1px solid var(--cms-border)", marginTop: 4, fontSize: 13 }}>
                    Итого: {formatPrice(selected.totalAmount)}
                  </div>
                </div>
              )}

              <label className="cms-label" style={{ marginBottom: "12px", display: "block" }}>
                Статус
                <select className="cms-select" value={editStatus} onChange={(e) => setEditStatus(e.target.value)} style={{ marginTop: 4, width: "100%" }}>
                  {ALL_STATUSES.map((s) => (
                    <option key={s} value={s}>{STATUS_MAP[s]?.label ?? s}</option>
                  ))}
                </select>
              </label>

              <label style={{ fontSize: "13px", display: "block" }}>
                <strong>Заметки:</strong>
                <textarea className="cms-textarea" value={editNotes} onChange={(e) => setEditNotes(e.target.value)} rows={3} style={{ display: "block", marginTop: "6px", width: "100%" }} />
              </label>
            </div>
            <div className="cms-modal-actions">
              <button className="cms-btn cms-btn-primary" onClick={handleSave} disabled={saving}>{saving ? "Сохранение..." : "Сохранить"}</button>
              <button className="cms-btn" onClick={() => openReceipt(selected.id)}>📄 Чек</button>
              <button className="cms-btn" onClick={() => setSelected(null)}>Отмена</button>
            </div>
          </div>
        </div>
      )}

      {/* New Manual Order Modal */}
      {showNewOrder && (
        <div className="cms-modal-overlay" onClick={() => setShowNewOrder(false)}>
          <div className="cms-modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 680 }}>
            <div className="cms-modal-header">
              <h3>Добавить заказ вручную</h3>
              <button className="cms-modal-close" onClick={() => setShowNewOrder(false)}>&times;</button>
            </div>
            <div className="cms-modal-body" style={{ maxHeight: "72vh", overflowY: "auto" }}>
              {/* ── Клиент ── */}
              <div style={{ fontSize: 11, fontWeight: 700, color: "var(--cms-text-muted)", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 8 }}>Клиент</div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 16 }}>
                <label className="cms-label">
                  Имя и фамилия *
                  <input className="cms-input" value={manualForm.customerName} onChange={(e) => setManualForm({ ...manualForm, customerName: e.target.value })} placeholder="Имя Фамилия" style={{ marginTop: 4 }} />
                </label>
                <label className="cms-label">
                  Email
                  <input className="cms-input" type="email" value={manualForm.customerEmail} onChange={(e) => setManualForm({ ...manualForm, customerEmail: e.target.value })} placeholder="email@example.com" style={{ marginTop: 4 }} />
                </label>
                <label className="cms-label">
                  Телефон
                  <input className="cms-input" value={manualForm.customerPhone} onChange={(e) => setManualForm({ ...manualForm, customerPhone: e.target.value })} placeholder="+7 999 000 00 00" style={{ marginTop: 4 }} />
                </label>
              </div>

              {/* ── Адрес доставки ── */}
              <div style={{ fontSize: 11, fontWeight: 700, color: "var(--cms-text-muted)", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 8 }}>Адрес доставки</div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 16 }}>
                <label className="cms-label">
                  Страна
                  <select className="cms-select" value={manualForm.country} onChange={(e) => setManualForm({ ...manualForm, country: e.target.value })} style={{ marginTop: 4 }}>
                    <option value="RU">Россия</option>
                    <option value="BY">Беларусь</option>
                    <option value="KZ">Казахстан</option>
                    <option value="UA">Украина</option>
                    <option value="UZ">Узбекистан</option>
                    <option value="AZ">Азербайджан</option>
                    <option value="DE">Германия</option>
                    <option value="FR">Франция</option>
                    <option value="US">США</option>
                    <option value="OTHER">Другая</option>
                  </select>
                </label>
                <label className="cms-label">
                  Регион / Область
                  <input className="cms-input" value={manualForm.oblast} onChange={(e) => setManualForm({ ...manualForm, oblast: e.target.value })} placeholder="Московская область" style={{ marginTop: 4 }} />
                </label>
                <label className="cms-label">
                  Город
                  <input className="cms-input" value={manualForm.city} onChange={(e) => setManualForm({ ...manualForm, city: e.target.value })} placeholder="Москва" style={{ marginTop: 4 }} />
                </label>
                <label className="cms-label">
                  Индекс
                  <input className="cms-input" value={manualForm.zipCode} onChange={(e) => setManualForm({ ...manualForm, zipCode: e.target.value })} placeholder="123456" style={{ marginTop: 4 }} />
                </label>
                <label className="cms-label" style={{ gridColumn: "span 2" }}>
                  Улица
                  <input className="cms-input" value={manualForm.street} onChange={(e) => setManualForm({ ...manualForm, street: e.target.value })} placeholder="ул. Ленина" style={{ marginTop: 4 }} />
                </label>
                <label className="cms-label">
                  Дом
                  <input className="cms-input" value={manualForm.house} onChange={(e) => setManualForm({ ...manualForm, house: e.target.value })} placeholder="42" style={{ marginTop: 4 }} />
                </label>
                <label className="cms-label">
                  Квартира / офис
                  <input className="cms-input" value={manualForm.apartment} onChange={(e) => setManualForm({ ...manualForm, apartment: e.target.value })} placeholder="15" style={{ marginTop: 4 }} />
                </label>
              </div>

              {/* ── Доставка и оплата ── */}
              <div style={{ fontSize: 11, fontWeight: 700, color: "var(--cms-text-muted)", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 8 }}>Доставка и оплата</div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 16 }}>
                <label className="cms-label">
                  Способ доставки
                  <select className="cms-select" value={manualForm.shippingMethod} onChange={(e) => setManualForm({ ...manualForm, shippingMethod: e.target.value })} style={{ marginTop: 4 }}>
                    <option value="">— не указан —</option>
                    <option value="cdek">СДЭК</option>
                    <option value="russianpost">Почта России</option>
                    <option value="pochta_int">Почта России (межд.)</option>
                    <option value="ozon">OZON</option>
                    <option value="yandex">Яндекс Маркет</option>
                    <option value="dhl">DHL</option>
                    <option value="fedex">FedEx</option>
                    <option value="pickup">Самовывоз</option>
                    <option value="courier">Курьер</option>
                  </select>
                </label>
                <label className="cms-label">
                  Способ оплаты
                  <select className="cms-select" value={manualForm.paymentMethod} onChange={(e) => setManualForm({ ...manualForm, paymentMethod: e.target.value })} style={{ marginTop: 4 }}>
                    <option value="cash">Наличные</option>
                    <option value="card">Карта (офлайн)</option>
                    <option value="transfer">Перевод на карту</option>
                    <option value="yukassa">ЮКасса</option>
                    <option value="stripe">Stripe</option>
                    <option value="manual">Другое</option>
                  </select>
                </label>
                <label className="cms-label">
                  Валюта
                  <select className="cms-select" value={manualForm.currency} onChange={(e) => setManualForm({ ...manualForm, currency: e.target.value })} style={{ marginTop: 4 }}>
                    <option value="RUB">₽ RUB</option>
                    <option value="USD">$ USD</option>
                    <option value="EUR">€ EUR</option>
                  </select>
                </label>
                <label className="cms-label">
                  Статус
                  <select className="cms-select" value={manualForm.status} onChange={(e) => setManualForm({ ...manualForm, status: e.target.value })} style={{ marginTop: 4 }}>
                    <option value="unpaid">Не оплачен</option>
                    <option value="paid">Оплачен</option>
                    <option value="assembling">Сборка</option>
                    <option value="shipped">Отправлен</option>
                    <option value="delivered">Доставлен</option>
                    <option value="cancelled">Отменён</option>
                  </select>
                </label>
              </div>

              {/* ── Товары ── */}
              <div style={{ fontSize: 11, fontWeight: 700, color: "var(--cms-text-muted)", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 8 }}>Товары (необязательно)</div>
              <div style={{ marginBottom: 14 }}>
                {manualForm.items.map((item, idx) => (
                  <div key={idx} style={{ display: "grid", gridTemplateColumns: "2fr 60px 90px auto", gap: 6, marginBottom: 6, alignItems: "center" }}>
                    <select className="cms-select" value={item.productId} onChange={(e) => updateManualItem(idx, "productId", e.target.value)}>
                      <option value="">— выберите товар —</option>
                      {products.map((p) => (
                        <option key={p.id} value={p.id}>{p.nameRu || p.name}</option>
                      ))}
                    </select>
                    <input className="cms-input" type="number" min="1" value={item.quantity} onChange={(e) => updateManualItem(idx, "quantity", Number(e.target.value))} title="Кол-во" />
                    <input className="cms-input" type="number" value={item.price} onChange={(e) => updateManualItem(idx, "price", Number(e.target.value))} placeholder="Цена ₽" />
                    <button type="button" className="cms-btn cms-btn-xs cms-btn-danger" onClick={() => setManualForm({ ...manualForm, items: manualForm.items.filter((_, i) => i !== idx) })}>×</button>
                  </div>
                ))}
                <button type="button" className="cms-btn cms-btn-xs" onClick={() => setManualForm({ ...manualForm, items: [...manualForm.items, { productId: "", quantity: 1, price: 0, name: "" }] })}>
                  + Добавить строку
                </button>
              </div>

              {/* ── Сумма и заметки ── */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: 10, marginBottom: 14, marginTop: 4 }}>
                <label className="cms-label">
                  Сумма заказа (в выбранной валюте) *
                  <input className="cms-input" type="number" value={manualForm.totalAmount} onChange={(e) => setManualForm({ ...manualForm, totalAmount: e.target.value })} placeholder="0" style={{ marginTop: 4 }} />
                </label>
              </div>

              <label className="cms-label" style={{ display: "block" }}>
                Заметки / комментарий
                <textarea className="cms-textarea" rows={2} value={manualForm.notes} onChange={(e) => setManualForm({ ...manualForm, notes: e.target.value })} style={{ marginTop: 4, width: "100%" }} />
              </label>
            </div>
            <div className="cms-modal-actions">
              <button className="cms-btn cms-btn-primary" onClick={handleCreateManual} disabled={creatingManual}>
                {creatingManual ? "Создание..." : "Создать заказ"}
              </button>
              <button className="cms-btn" onClick={() => setShowNewOrder(false)}>Отмена</button>
            </div>
          </div>
        </div>
      )}

      {notification && <div className="cms-toast">{notification}</div>}
    </div>
  );
}
