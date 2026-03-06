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
  assembling: { label: "Сборка", cls: "cms-badge-yellow" },
  shipped: { label: "Отправлен", cls: "cms-badge-blue" },
  in_transit: { label: "В пути", cls: "cms-badge-blue" },
  delivered: { label: "Доставлен", cls: "cms-badge-green" },
  cancelled: { label: "Отменён", cls: "cms-badge-red" },
};

const ALL_STATUSES = ["assembling", "shipped", "in_transit", "delivered", "cancelled"];

export default function AdminOrdersPage() {
  const router = useRouter();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Order | null>(null);
  const [editStatus, setEditStatus] = useState("");
  const [editNotes, setEditNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [notification, setNotification] = useState("");
  const [checkedIds, setCheckedIds] = useState<Set<string>>(new Set());
  const [deleteConfirm, setDeleteConfirm] = useState<string[] | null>(null);
  const [filterStatus, setFilterStatus] = useState("all");
  const [search, setSearch] = useState("");

  const getToken = useCallback(() => localStorage.getItem("admin_token"), []);

  const fetchOrders = useCallback(async () => {
    const token = getToken();
    if (!token) { router.push("/admin/login"); return; }
    const res = await fetch("/api/orders", { headers: { Authorization: `Bearer ${token}` } });
    if (res.status === 401) { localStorage.removeItem("admin_token"); router.push("/admin/login"); return; }
    const data = await res.json();
    setOrders(Array.isArray(data) ? data : []);
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

  const handleDelete = async (ids: string[]) => {
    const token = getToken();
    for (const id of ids) {
      await fetch(`/api/orders/${id}`, { method: "DELETE", headers: { Authorization: `Bearer ${token}` } });
    }
    notify(`${ids.length} заказ(ов) удалено`);
    setDeleteConfirm(null);
    setCheckedIds(new Set());
    fetchOrders();
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

  const formatPrice = (n: number) =>
    new Intl.NumberFormat("ru-RU", { style: "currency", currency: "RUB", minimumFractionDigits: 0 }).format(n);

  const filtered = orders.filter((o) => {
    if (filterStatus !== "all" && o.status !== filterStatus) return false;
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
          <h1 className="cms-header-title">Заказы</h1>
          <div className="cms-header-actions">
            <span style={{ fontSize: "13px", color: "var(--cms-text-muted)" }}>{orders.length} всего</span>
            <a href="/api/admin/export?type=orders&format=csv" className="cms-btn cms-btn-sm" download><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg> CSV</a>
            <a href="/api/admin/export?type=orders&format=xls" className="cms-btn cms-btn-sm" download><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg> XLS</a>
            <button className="cms-btn cms-btn-sm" onClick={fetchOrders}>Обновить</button>
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
                  <tr key={order.id} className={checkedIds.has(order.id) ? "cms-row-selected" : ""}>
                    <td><input type="checkbox" checked={checkedIds.has(order.id)} onChange={() => toggleCheck(order.id)} /></td>
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
                    <td>
                      <button className="cms-btn cms-btn-xs cms-btn-ghost" onClick={() => openOrder(order)} title="Edit">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 013 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>
                      </button>
                      <button className="cms-btn cms-btn-xs cms-btn-ghost" onClick={() => setDeleteConfirm([order.id])} title="Delete" style={{ color: "var(--cms-danger)" }}>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/></svg>
                      </button>
                    </td>
                  </tr>
                ))}
                {filtered.length === 0 && (
                  <tr><td colSpan={9} style={{ textAlign: "center", padding: "32px", color: "var(--cms-text-muted)" }}>Заказы не найдены</td></tr>
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
                <label style={{ fontSize: "13px" }}>
                  <strong>Статус:</strong>
                  <select className="cms-select" value={editStatus} onChange={(e) => setEditStatus(e.target.value)} style={{ display: "block", marginTop: "6px", width: "180px" }}>
                    {ALL_STATUSES.map((s) => <option key={s} value={s}>{STATUS_MAP[s]?.label ?? s}</option>)}
                  </select>
                </label>
                <label style={{ flex: 1, fontSize: "13px" }}>
                  <strong>Заметки:</strong>
                  <textarea className="cms-textarea" value={editNotes} onChange={(e) => setEditNotes(e.target.value)} rows={3} style={{ display: "block", marginTop: "6px", width: "100%" }} />
                </label>
              </div>
            </div>
            <div className="cms-modal-actions">
              <button className="cms-btn cms-btn-primary" onClick={handleSave} disabled={saving}>{saving ? "Сохранение..." : "Сохранить"}</button>
              <button className="cms-btn" onClick={() => setSelected(null)}>Отмена</button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirm Modal */}
      {deleteConfirm && (
        <div className="cms-modal-overlay" onClick={() => setDeleteConfirm(null)}>
          <div className="cms-modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 420 }}>
            <div className="cms-modal-header">
              <h3>Подтверждение удаления</h3>
              <button className="cms-modal-close" onClick={() => setDeleteConfirm(null)}>&times;</button>
            </div>
            <div className="cms-modal-body">
              <p style={{ fontSize: "14px" }}>
                Вы уверены, что хотите удалить <strong>{deleteConfirm.length}</strong> заказ(ов)?<br />
                Это действие нельзя отменить.
              </p>
            </div>
            <div className="cms-modal-actions">
              <button className="cms-btn cms-btn-danger" onClick={() => handleDelete(deleteConfirm)}>Удалить</button>
              <button className="cms-btn" onClick={() => setDeleteConfirm(null)}>Отмена</button>
            </div>
          </div>
        </div>
      )}

      {/* Toast */}
      {notification && <div className="cms-toast">{notification}</div>}
    </div>
  );
}
