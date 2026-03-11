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
  items: OrderItem[];
  createdAt: string;
}

const STATUS_MAP: Record<string, { label: string; cls: string }> = {
  paid: { label: "Оплачен", cls: "cms-badge-green" },
  assembling: { label: "Сборка", cls: "cms-badge-yellow" },
  shipped: { label: "Отправлен", cls: "cms-badge-blue" },
  in_transit: { label: "В пути", cls: "cms-badge-blue" },
  delivered: { label: "Доставлен", cls: "cms-badge-green" },
  cancelled: { label: "Отменён", cls: "cms-badge-red" },
};

const ALL_STATUSES = ["paid", "assembling", "shipped", "in_transit", "delivered", "cancelled"];

export default function AdminOrdersPage() {
  const router = useRouter();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Order | null>(null);
  const [editStatus, setEditStatus] = useState("");
  const [editNotes, setEditNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [notification, setNotification] = useState("");
  const [search, setSearch] = useState("");
  const [deleting, setDeleting] = useState(false);

  const getToken = useCallback(() => localStorage.getItem("admin_token"), []);

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

  useEffect(() => { fetchOrders(); }, [fetchOrders]);

  const openOrder = (order: Order) => {
    setSelected(order);
    setEditStatus(order.status);
    setEditNotes(order.notes);
  };

  const handleSave = async () => {
    if (!selected) return;
    setSaving(true);
    const token = getToken();
    const res = await fetch(`/api/orders/${selected.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ status: editStatus, notes: editNotes }),
    });
    if (res.ok) {
      notify(`Order ${selected.orderNumber} updated`);
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

  const newCount = orders.filter((o) => o.status === "paid" || o.status === "assembling").length;

  const filtered = orders.filter((o) => {
    if (search) {
      const q = search.toLowerCase();
      return o.orderNumber.toLowerCase().includes(q) || o.customerName.toLowerCase().includes(q) || o.customerEmail.toLowerCase().includes(q);
    }
    return true;
  });

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
            <button
              className="cms-btn cms-btn-sm cms-btn-danger"
              onClick={deleteUnpaid}
              disabled={deleting}
            >{deleting ? "Удаление..." : "Удалить неоплаченные"}</button>
            <button className={`cms-refresh-btn`} onClick={() => { setLoading(true); fetchOrders(); }} title="Обновить">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M23 4v6h-6M1 20v-6h6"/><path d="M3.51 9a9 9 0 0114.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0020.49 15"/></svg>
            </button>
            <button className="cms-btn cms-btn-sm" onClick={markAllRead} title="Отметить все как просмотренные">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
            </button>
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
          </div>

          {/* Table */}
          <div className="cms-table-wrap">
            <table className="cms-table">
              <thead>
                <tr>
                  <th>Order #</th>
                  <th>Клиент</th>
                  <th>Товары</th>
                  <th>Сумма</th>
                  <th>Статус</th>
                  <th>Доставка</th>
                  <th>Дата</th>
                  <th style={{ width: 80 }}>Действия</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((order) => (
                  <tr key={order.id}>
                    <td className="cms-td-mono">{order.orderNumber}</td>
                    <td className="cms-td-bold">
                      {order.customerName}
                      <div style={{ fontSize: "11px", color: "var(--cms-text-muted)" }}>{order.customerEmail}</div>
                    </td>
                    <td>
                      {order.items.map((item) => (
                        <div key={item.id} style={{ fontSize: "12px" }}>{item.product.name} x{item.quantity}</div>
                      ))}
                    </td>
                    <td style={{ fontWeight: 600 }}>{formatPrice(order.totalAmount)}</td>
                    <td>
                      <span className={`cms-badge ${STATUS_MAP[order.status]?.cls ?? "cms-badge-yellow"}`}>
                        {STATUS_MAP[order.status]?.label ?? order.status}
                      </span>
                    </td>
                    <td>{order.shippingMethod || "\u2014"}</td>
                    <td>{new Date(order.createdAt).toLocaleDateString("ru-RU")}</td>
                    <td style={{ display: "flex", gap: "4px", alignItems: "center" }}>
                      <button className="cms-btn cms-btn-xs cms-btn-ghost" onClick={() => openOrder(order)} title="Изменить">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 013 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>
                      </button>
                      <a
                        href={`/api/admin/orders/${order.id}/receipt?token=${getToken()}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="cms-btn cms-btn-xs cms-btn-ghost"
                        title="Чек"
                      >
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>
                      </a>
                      {(order.status === "pending" || order.status === "cancelled") && (
                        <button className="cms-btn cms-btn-xs cms-btn-danger" onClick={() => deleteOrder(order)} title="Удалить">
                          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/></svg>
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
                {filtered.length === 0 && (
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
              <h3>Заказ {selected.orderNumber}</h3>
              <button className="cms-modal-close" onClick={() => setSelected(null)}>&times;</button>
            </div>
            <div className="cms-modal-body">
              <div style={{ display: "grid", gridTemplateColumns: "120px 1fr", gap: "6px 14px", fontSize: "13px", marginBottom: "16px" }}>
                <strong>Клиент:</strong> <span>{selected.customerName}</span>
                <strong>Email:</strong> <span>{selected.customerEmail}</span>
                <strong>Телефон:</strong> <span>{selected.customerPhone || "\u2014"}</span>
                <strong>Страна:</strong> <span>{selected.country}</span>
                <strong>Город:</strong> <span>{selected.city || "\u2014"}</span>
                <strong>Адрес:</strong>
                <span>{[selected.zipCode, selected.street, selected.house, selected.apartment].filter(Boolean).join(", ") || "\u2014"}</span>
                <strong>Доставка:</strong> <span>{selected.shippingMethod || "\u2014"}</span>
                <strong>Оплата:</strong> <span>{selected.paymentMethod || "\u2014"}</span>
                <strong>Сумма:</strong> <span style={{ fontWeight: 700 }}>{formatPrice(selected.totalAmount)}</span>
              </div>

              <div style={{ borderTop: "1px solid var(--cms-border)", paddingTop: "12px", marginBottom: "16px" }}>
                <strong style={{ fontSize: "13px" }}>Товары:</strong>
                <table className="cms-table" style={{ marginTop: "8px" }}>
                  <thead><tr><th>Название</th><th>Кол-во</th><th>Цена</th></tr></thead>
                  <tbody>
                    {selected.items.map((item) => (
                      <tr key={item.id}>
                        <td>{item.product.name}</td>
                        <td>{item.quantity}</td>
                        <td>{formatPrice(item.price)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div style={{ display: "flex", gap: "14px", alignItems: "flex-start" }}>
                <label style={{ flex: 1, fontSize: "13px" }}>
                  <strong>Заметки:</strong>
                  <textarea className="cms-textarea" value={editNotes} onChange={(e) => setEditNotes(e.target.value)} rows={3} style={{ display: "block", marginTop: "6px", width: "100%" }} />
                </label>
              </div>
            </div>
            <div className="cms-modal-actions">
              <button className="cms-btn cms-btn-primary" onClick={handleSave} disabled={saving}>{saving ? "Сохранение..." : "Сохранить"}</button>
              <a
                href={`/api/admin/orders/${selected.id}/receipt?token=${getToken()}`}
                target="_blank"
                rel="noopener noreferrer"
                className="cms-btn"
              >
                📄 Чек (PDF)
              </a>
              <button className="cms-btn" onClick={() => setSelected(null)}>Отмена</button>
            </div>
          </div>
        </div>
      )}

      {/* Toast */}
      {notification && <div className="cms-toast">{notification}</div>}
    </div>
  );
}
