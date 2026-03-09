"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { AdminSidebar } from "../AdminSidebar";

interface TableStats {
  products: number;
  orders: number;
  users: number;
  admins: number;
  orderItems: number;
  analytics: number;
  inquiries: number;
}

interface RecentOrder {
  id: string;
  orderNumber: string;
  customerName: string;
  customerEmail: string;
  totalAmount: number;
  status: string;
  createdAt: string;
}

interface RecentProduct {
  id: string;
  name: string;
  slug: string;
  price: number;
  stock: number;
  isActive: boolean;
  isPreorder: boolean;
  isLimited: boolean;
  createdAt: string;
}

export default function AdminDatabasePage() {
  const router = useRouter();
  const [stats, setStats] = useState<TableStats | null>(null);
  const [orders, setOrders] = useState<RecentOrder[]>([]);
  const [products, setProducts] = useState<RecentProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"overview" | "orders" | "products">("overview");
  const [notification, setNotification] = useState("");

  const getToken = useCallback(() => localStorage.getItem("admin_token"), []);

  const fetchData = useCallback(async () => {
    const token = getToken();
    if (!token) { router.push("/admin/login"); return; }

    try {
      const [dashRes, productsRes, ordersRes] = await Promise.all([
        fetch("/api/admin/dashboard", { headers: { Authorization: `Bearer ${token}` } }),
        fetch("/api/products"),
        fetch("/api/orders", { headers: { Authorization: `Bearer ${token}` } }),
      ]);

      if (dashRes.ok) {
        const dash = await dashRes.json();
        setStats({
          products: dash.stats?.products ?? 0,
          orders: dash.stats?.orders ?? 0,
          users: dash.stats?.users ?? 0,
          admins: 1,
          orderItems: 0,
          analytics: dash.stats?.pageViews ?? 0,
          inquiries: dash.stats?.inquiries ?? 0,
        });
      }

      if (productsRes.ok) {
        const data = await productsRes.json();
        setProducts(data.slice(0, 20));
      }

      if (ordersRes.ok) {
        const data = await ordersRes.json();
        setOrders((Array.isArray(data) ? data : data.orders || []).slice(0, 20));
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [getToken, router]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const notify = (msg: string) => {
    setNotification(msg);
    setTimeout(() => setNotification(""), 3000);
  };

  const formatDate = (d: string) =>
    new Date(d).toLocaleString("ru-RU", { day: "2-digit", month: "2-digit", year: "2-digit", hour: "2-digit", minute: "2-digit" });

  const formatPrice = (n: number) =>
    new Intl.NumberFormat("ru-RU", { style: "currency", currency: "RUB", minimumFractionDigits: 0 }).format(n);

  const STATUS_LABELS: Record<string, string> = {
    assembling: "Сборка", shipped: "Отправлен", in_transit: "В пути",
    delivered: "Доставлен", cancelled: "Отменён",
  };

  if (loading) return <div className="cms-loading"><div className="cms-spinner" /> Загрузка...</div>;

  return (
    <div className="cms-root">
      <AdminSidebar />
      <main className="cms-main">
        <div className="cms-header">
          <h1 className="cms-header-title">База данных</h1>
          <div className="cms-header-actions">
            <button className="cms-btn cms-btn-sm" onClick={() => { setLoading(true); fetchData(); }}>
              ↺ Обновить
            </button>
          </div>
        </div>

        <div className="cms-content">
          {/* Stats Grid */}
          {stats && (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))", gap: "12px", marginBottom: "24px" }}>
              {[
                { label: "Товаров", value: stats.products },
                { label: "Заказов", value: stats.orders },
                { label: "Пользователей", value: stats.users },
                { label: "Запросов", value: stats.inquiries },
                { label: "Просмотров (аналитика)", value: stats.analytics },
              ].map((s) => (
                <div key={s.label} className="cms-stat-card">
                  <div className="cms-stat-label">{s.label}</div>
                  <div className="cms-stat-value">{s.value.toLocaleString("ru-RU")}</div>
                </div>
              ))}
            </div>
          )}

          {/* Tabs */}
          <div style={{ display: "flex", gap: "8px", marginBottom: "16px", borderBottom: "1px solid var(--cms-border)", paddingBottom: "8px" }}>
            {(["overview", "orders", "products"] as const).map((tab) => (
              <button
                key={tab}
                className={`cms-btn cms-btn-sm ${activeTab === tab ? "cms-btn-primary" : ""}`}
                onClick={() => setActiveTab(tab)}
              >
                {tab === "overview" ? "Обзор" : tab === "orders" ? "Заказы" : "Товары"}
              </button>
            ))}
          </div>

          {/* Overview Tab */}
          {activeTab === "overview" && (
            <div>
              <h2 style={{ fontSize: "14px", fontWeight: 600, marginBottom: "12px", color: "var(--cms-text-muted)" }}>Структура таблиц</h2>
              <div className="cms-table-wrap">
                <table className="cms-table">
                  <thead>
                    <tr>
                      <th>Таблица</th>
                      <th>Описание</th>
                      <th>Записей</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[
                      { name: "Product", desc: "Товары каталога", count: stats?.products ?? "—" },
                      { name: "Order", desc: "Заказы покупателей", count: stats?.orders ?? "—" },
                      { name: "User", desc: "Зарегистрированные пользователи", count: stats?.users ?? "—" },
                      { name: "Admin", desc: "Администраторы", count: stats?.admins ?? "—" },
                      { name: "Inquiry", desc: "Обращения через форму контактов", count: stats?.inquiries ?? "—" },
                      { name: "Analytics", desc: "Просмотры страниц (аналитика)", count: stats?.analytics ?? "—" },
                    ].map((row) => (
                      <tr key={row.name}>
                        <td className="cms-td-mono">{row.name}</td>
                        <td style={{ color: "var(--cms-text-muted)", fontSize: "13px" }}>{row.desc}</td>
                        <td><span className="cms-badge cms-badge-blue">{row.count.toLocaleString ? row.count.toLocaleString("ru-RU") : row.count}</span></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Orders Tab */}
          {activeTab === "orders" && (
            <div className="cms-table-wrap">
              <table className="cms-table">
                <thead>
                  <tr>
                    <th>№ заказа</th>
                    <th>Клиент</th>
                    <th>Email</th>
                    <th>Сумма</th>
                    <th>Статус</th>
                    <th>Дата</th>
                  </tr>
                </thead>
                <tbody>
                  {orders.map((o) => (
                    <tr key={o.id}>
                      <td className="cms-td-mono" style={{ fontSize: "11px" }}>{o.orderNumber}</td>
                      <td className="cms-td-bold">{o.customerName}</td>
                      <td style={{ fontSize: "12px", color: "var(--cms-text-muted)" }}>{o.customerEmail}</td>
                      <td>{formatPrice(o.totalAmount)}</td>
                      <td>
                        <span className={`cms-badge ${o.status === "delivered" ? "cms-badge-green" : o.status === "cancelled" ? "cms-badge-red" : "cms-badge-blue"}`}>
                          {STATUS_LABELS[o.status] || o.status}
                        </span>
                      </td>
                      <td style={{ fontSize: "12px", color: "var(--cms-text-muted)" }}>{formatDate(o.createdAt)}</td>
                    </tr>
                  ))}
                  {orders.length === 0 && (
                    <tr><td colSpan={6} style={{ textAlign: "center", padding: "32px", color: "var(--cms-text-muted)" }}>Заказов нет</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          )}

          {/* Products Tab */}
          {activeTab === "products" && (
            <div className="cms-table-wrap">
              <table className="cms-table">
                <thead>
                  <tr>
                    <th>Название</th>
                    <th>Slug</th>
                    <th>Цена</th>
                    <th>Остаток</th>
                    <th>Активен</th>
                    <th>Предзаказ</th>
                    <th>Лимит</th>
                    <th>Создан</th>
                  </tr>
                </thead>
                <tbody>
                  {products.map((p) => (
                    <tr key={p.id}>
                      <td className="cms-td-bold">{p.name}</td>
                      <td className="cms-td-mono" style={{ fontSize: "11px" }}>{p.slug}</td>
                      <td>{formatPrice(p.price)}</td>
                      <td>{p.stock}</td>
                      <td>{p.isActive ? <span className="cms-badge cms-badge-green">Да</span> : <span className="cms-badge cms-badge-red">Нет</span>}</td>
                      <td>{p.isPreorder ? <span className="cms-badge cms-badge-blue">Да</span> : "—"}</td>
                      <td>{p.isLimited ? <span className="cms-badge cms-badge-green">Да</span> : "—"}</td>
                      <td style={{ fontSize: "12px", color: "var(--cms-text-muted)" }}>{formatDate(p.createdAt)}</td>
                    </tr>
                  ))}
                  {products.length === 0 && (
                    <tr><td colSpan={8} style={{ textAlign: "center", padding: "32px", color: "var(--cms-text-muted)" }}>Товаров нет</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </main>
      {notification && <div className="cms-toast">{notification}</div>}
    </div>
  );
}
