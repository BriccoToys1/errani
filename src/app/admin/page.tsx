"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { AdminSidebar } from "./AdminSidebar";

interface DashboardData {
  orderCount: number;
  productCount: number;
  totalRevenue: number;
  inquiryCount: number;
  newInquiryCount: number;
  recentOrders: Array<{
    id: string;
    orderNumber: string;
    customerName: string;
    totalAmount: number;
    status: string;
    createdAt: string;
  }>;
}

interface AnalyticsData {
  realtime: { onlineNow: number };
  today: { views: number; visitors: number; orders: number; avgDuration: number };
  chart: Array<{ date: string; views: number; visitors: number; orders: number; revenue: number }>;
  topPages: Array<{ path: string; views: number }>;
  countries: Array<{ country: string; count: number }>;
  devices: Array<{ device: string; count: number }>;
  totals: { views: number; orders: number; revenue: number; products: number; uniqueIPs: number };
}

interface ServerStats {
  cpu: { usage: number; cores: number };
  memory: { total: string; used: string; free: string; usage: number };
  system: { platform: string; uptime: string; nodeVersion: string };
  loadAverage: { '1m': number; '5m': number; '15m': number };
}

const STATUS_MAP: Record<string, { label: string; cls: string }> = {
  assembling: { label: "Сборка", cls: "cms-badge-yellow" },
  shipped: { label: "Отправлен", cls: "cms-badge-blue" },
  in_transit: { label: "В пути", cls: "cms-badge-blue" },
  delivered: { label: "Доставлен", cls: "cms-badge-green" },
  cancelled: { label: "Отменён", cls: "cms-badge-red" },
};

const COUNTRY_NAMES: Record<string, string> = {
  RU: "Россия", US: "США", DE: "Германия", FR: "Франция", IT: "Италия",
  ES: "Испания", TR: "Турция", CN: "Китай", GB: "Великобритания", KZ: "Казахстан",
};

function MiniBarChart({ data, valueKey, color = "var(--cms-accent)" }: {
  data: Record<string, string | number>[]; valueKey: string; color?: string;
}) {
  const max = Math.max(...data.map((d) => Number(d[valueKey]) || 0), 1);
  return (
    <div style={{ display: "flex", alignItems: "flex-end", gap: "2px", height: "80px" }}>
      {data.map((d, i) => {
        const val = Number(d[valueKey]) || 0;
        const pct = (val / max) * 100;
        return (
          <div key={i} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", height: "100%", justifyContent: "flex-end" }}
            title={`${d.date}: ${val}`}>
            <div style={{ width: "100%", minWidth: "2px", height: `${Math.max(pct, 4)}%`, background: color, borderRadius: "2px 2px 0 0", transition: "height 0.3s" }} />
          </div>
        );
      })}
    </div>
  );
}

function StatCard({ icon, label, value, sub, trend, color }: { 
  icon: React.ReactNode; label: string; value: string | number; sub?: string; trend?: string; color?: string;
}) {
  return (
    <div className="cms-stat-card" style={{ padding: "12px 14px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
        <div style={{ width: 32, height: 32, borderRadius: "8px", background: color || "rgba(232, 114, 42, 0.15)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
          {icon}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "6px" }}>
            <div className="cms-stat-value" style={{ fontSize: "18px", lineHeight: 1.2 }}>{value}</div>
            {trend && (
              <span style={{ fontSize: "10px", color: trend.startsWith("+") ? "#22c55e" : trend.startsWith("-") ? "#ef4444" : "var(--cms-text-muted)", fontWeight: 600 }}>
                {trend}
              </span>
            )}
          </div>
          <div className="cms-stat-label" style={{ fontSize: "11px", marginTop: "2px" }}>{label}</div>
          {sub && <div style={{ fontSize: "10px", color: "var(--cms-text-muted)" }}>{sub}</div>}
        </div>
      </div>
    </div>
  );
}

export default function AdminDashboard() {
  const router = useRouter();
  const [data, setData] = useState<DashboardData | null>(null);
  const [analytics, setAnalytics] = useState<AnalyticsData | null>(null);
  const [serverStats, setServerStats] = useState<ServerStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [chartMode, setChartMode] = useState<"views" | "visitors" | "orders">("views");
  const [period, setPeriod] = useState<"7" | "14" | "30" | "90">("30");

  const getToken = useCallback(() => localStorage.getItem("admin_token"), []);

  const fetchData = useCallback(async () => {
    const token = getToken();
    if (!token) { router.push("/admin/login"); return; }

    const [dashRes, analyticsRes, serverRes] = await Promise.all([
      fetch("/api/admin/dashboard", { headers: { Authorization: `Bearer ${token}` } }),
      fetch(`/api/admin/analytics?period=${period}`, { headers: { Authorization: `Bearer ${token}` } }),
      fetch("/api/admin/server-stats", { headers: { Authorization: `Bearer ${token}` } }),
    ]);

    if (dashRes.status === 401) { localStorage.removeItem("admin_token"); router.push("/admin/login"); return; }
    
    const dashData = await dashRes.json();
    const analyticsData = await analyticsRes.json();
    const serverData = await serverRes.json();

    if (dashData) setData(dashData);
    if (analyticsData && !analyticsData.error) setAnalytics(analyticsData);
    if (serverData && !serverData.error) setServerStats(serverData);
    setLoading(false);
  }, [getToken, router, period]);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 30000);
    return () => clearInterval(interval);
  }, [fetchData, period]);

  const formatPrice = (n: number) =>
    new Intl.NumberFormat("ru-RU", { style: "currency", currency: "RUB", minimumFractionDigits: 0 }).format(n);

  const formatDuration = (s: number) => s < 60 ? `${s}с` : `${Math.floor(s / 60)}м ${s % 60}с`;

  if (loading) {
    return <div className="cms-loading"><div className="cms-spinner" /> Загрузка...</div>;
  }

  const chartColors: Record<string, string> = { views: "var(--cms-accent)", visitors: "#22c55e", orders: "#3b82f6" };

  return (
    <div className="cms-root">
      <AdminSidebar />
      <main className="cms-main">
        <div className="cms-header">
          <div>
            <h1 className="cms-header-title" style={{ display: "flex", alignItems: "center", gap: "12px" }}>
              Дашборд
              {analytics?.realtime.onlineNow ? (
                <span style={{ fontSize: "13px", color: "#22c55e", fontWeight: 500, display: "flex", alignItems: "center", gap: "6px" }}>
                  <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#22c55e", animation: "pulse 2s infinite" }} />
                  {analytics.realtime.onlineNow} онлайн
                </span>
              ) : null}
            </h1>
            <p style={{ fontSize: "13px", color: "var(--cms-text-muted)", marginTop: "4px" }}>
              Обзор магазина errani
            </p>
          </div>
          <div className="cms-header-actions">
            <Link href="/" target="_blank" className="cms-btn cms-btn-sm">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ marginRight: "6px" }}><path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6"/><path d="M15 3h6v6M10 14L21 3"/></svg>
              Открыть сайт
            </Link>
            <button className="cms-btn cms-btn-sm cms-btn-ghost" onClick={fetchData}>Обновить</button>
          </div>
        </div>

        <div className="cms-content">
          {/* Main Stat Cards */}
          <div className="cms-stat-grid" style={{ display: "grid", gridTemplateColumns: "repeat(6, 1fr)", gap: "8px" }}>
            <StatCard
              icon={<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#e8722a" strokeWidth="2"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M8 7h8M8 11h8M8 15h4"/></svg>}
              label="Заказы"
              value={data?.orderCount ?? 0}
              sub={`${analytics?.today.orders ?? 0} сегодня`}
              color="rgba(232, 114, 42, 0.15)"
            />
            <StatCard
              icon={<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#22c55e" strokeWidth="2"><path d="M12 2v20M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6"/></svg>}
              label="Выручка"
              value={formatPrice(data?.totalRevenue ?? 0)}
              sub="всего"
              color="rgba(34, 197, 94, 0.15)"
            />
            <StatCard
              icon={<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#3b82f6" strokeWidth="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>}
              label="Просмотры"
              value={analytics?.totals.views ?? 0}
              sub={`${analytics?.today.views ?? 0} сегодня`}
              trend={analytics?.today.views ? `+${((analytics.today.views / (analytics.totals.views || 1)) * 100).toFixed(1)}%` : undefined}
              color="rgba(59, 130, 246, 0.15)"
            />
            <StatCard
              icon={<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#8b5cf6" strokeWidth="2"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75"/></svg>}
              label="Уник. посетители"
              value={analytics?.totals.uniqueIPs ?? analytics?.today.visitors ?? 0}
              sub="по IP"
              color="rgba(139, 92, 246, 0.15)"
            />
            <StatCard
              icon={<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" strokeWidth="2"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><path d="M22 6l-10 7L2 6"/></svg>}
              label="Обращения"
              value={data?.inquiryCount ?? 0}
              sub={data?.newInquiryCount ? `${data.newInquiryCount} новых` : "все прочитаны"}
              color="rgba(245, 158, 11, 0.15)"
            />
            <StatCard
              icon={<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#06b6d4" strokeWidth="2"><path d="M20.59 13.41l-7.17 7.17a2 2 0 01-2.83 0L2 12V2h10l8.59 8.59a2 2 0 010 2.82z"/><circle cx="7" cy="7" r="1.5" fill="currentColor"/></svg>}
              label="Товары"
              value={data?.productCount ?? 0}
              sub="в каталоге"
              color="rgba(6, 182, 212, 0.15)"
            />
          </div>

          {/* Chart + Quick Stats Row */}
          <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: "16px", marginTop: "20px" }}>
            {/* Chart */}
            <div className="cms-table-wrap" style={{ padding: "20px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px", flexWrap: "wrap", gap: "8px" }}>
                <span style={{ fontWeight: 700, fontSize: "15px" }}>Тренд за {period} дней</span>
                <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
                  <select
                    className="cms-select"
                    value={period}
                    onChange={(e) => setPeriod(e.target.value as typeof period)}
                    style={{ padding: "4px 8px", fontSize: "12px" }}
                  >
                    <option value="7">7 дней</option>
                    <option value="14">14 дней</option>
                    <option value="30">30 дней</option>
                    <option value="90">90 дней</option>
                  </select>
                  <div className="cms-tabs">
                    {(["views", "visitors", "orders"] as const).map((m) => (
                      <button key={m} className={`cms-tab ${chartMode === m ? "active" : ""}`} onClick={() => setChartMode(m)}>
                        {m === "views" ? "Просмотры" : m === "visitors" ? "Посетители" : "Заказы"}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
              {analytics?.chart && (
                <>
                  <MiniBarChart data={analytics.chart as unknown as Record<string, string | number>[]} valueKey={chartMode} color={chartColors[chartMode]} />
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: "11px", color: "var(--cms-text-muted)", marginTop: "6px" }}>
                    <span>{analytics.chart[0]?.date?.slice(5)}</span>
                    <span>{analytics.chart[analytics.chart.length - 1]?.date?.slice(5)}</span>
                  </div>
                </>
              )}
            </div>

            {/* Quick Stats */}
            <div className="cms-table-wrap" style={{ padding: "20px" }}>
              <div style={{ fontWeight: 700, fontSize: "15px", marginBottom: "16px" }}>Сегодня</div>
              <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 0", borderBottom: "1px solid var(--cms-border)" }}>
                  <span style={{ color: "var(--cms-text-muted)" }}>Просмотры</span>
                  <span style={{ fontWeight: 600, fontSize: "18px" }}>{analytics?.today.views ?? 0}</span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 0", borderBottom: "1px solid var(--cms-border)" }}>
                  <span style={{ color: "var(--cms-text-muted)" }}>Посетители</span>
                  <span style={{ fontWeight: 600, fontSize: "18px" }}>{analytics?.today.visitors ?? 0}</span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 0", borderBottom: "1px solid var(--cms-border)" }}>
                  <span style={{ color: "var(--cms-text-muted)" }}>Заказы</span>
                  <span style={{ fontWeight: 600, fontSize: "18px" }}>{analytics?.today.orders ?? 0}</span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 0" }}>
                  <span style={{ color: "var(--cms-text-muted)" }}>Ср. время на сайте</span>
                  <span style={{ fontWeight: 600, fontSize: "18px" }}>{formatDuration(analytics?.today.avgDuration ?? 0)}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Recent Orders + Top Stats */}
          <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: "16px", marginTop: "16px" }}>
            {/* Recent Orders */}
            <div className="cms-table-wrap">
              <div style={{ padding: "14px 18px", borderBottom: "1px solid var(--cms-border)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ fontWeight: 700, fontSize: "14px" }}>Последние заказы</span>
                <Link href="/admin/orders" className="cms-btn cms-btn-sm cms-btn-ghost">Все заказы →</Link>
              </div>
              <table className="cms-table">
                <thead>
                  <tr>
                    <th>№</th>
                    <th>Клиент</th>
                    <th>Сумма</th>
                    <th>Статус</th>
                    <th>Дата</th>
                  </tr>
                </thead>
                <tbody>
                  {data?.recentOrders && data.recentOrders.length > 0 ? (
                    data.recentOrders.map((order) => (
                      <tr key={order.id}>
                        <td className="cms-td-mono">{order.orderNumber}</td>
                        <td className="cms-td-bold">{order.customerName}</td>
                        <td>{formatPrice(order.totalAmount)}</td>
                        <td>
                          <span className={`cms-badge ${STATUS_MAP[order.status]?.cls ?? "cms-badge-yellow"}`}>
                            {STATUS_MAP[order.status]?.label ?? order.status}
                          </span>
                        </td>
                        <td>{new Date(order.createdAt).toLocaleDateString("ru-RU")}</td>
                      </tr>
                    ))
                  ) : (
                    <tr><td colSpan={5} style={{ textAlign: "center", padding: "32px", color: "var(--cms-text-muted)" }}>Заказов пока нет</td></tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Geography + Devices + Server */}
            <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
              <div className="cms-table-wrap" style={{ padding: "16px" }}>
                <div style={{ fontWeight: 700, fontSize: "14px", marginBottom: "12px" }}>🖥️ Сервер</div>
                {serverStats ? (
                  <>
                    <div style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", fontSize: "13px" }}>
                      <span>CPU</span>
                      <span style={{ color: serverStats.cpu.usage > 80 ? "#ef4444" : "var(--cms-text-muted)" }}>{serverStats.cpu.usage}%</span>
                    </div>
                    <div style={{ height: "4px", background: "var(--cms-border)", borderRadius: "2px", marginBottom: "8px" }}>
                      <div style={{ height: "100%", width: `${Math.min(serverStats.cpu.usage, 100)}%`, background: serverStats.cpu.usage > 80 ? "#ef4444" : "#22c55e", borderRadius: "2px" }} />
                    </div>
                    <div style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", fontSize: "13px" }}>
                      <span>Память</span>
                      <span style={{ color: serverStats.memory.usage > 80 ? "#ef4444" : "var(--cms-text-muted)" }}>{serverStats.memory.usage}%</span>
                    </div>
                    <div style={{ height: "4px", background: "var(--cms-border)", borderRadius: "2px", marginBottom: "8px" }}>
                      <div style={{ height: "100%", width: `${Math.min(serverStats.memory.usage, 100)}%`, background: serverStats.memory.usage > 80 ? "#ef4444" : "#3b82f6", borderRadius: "2px" }} />
                    </div>
                    <div style={{ display: "flex", justifyContent: "space-between", padding: "4px 0", fontSize: "11px", color: "var(--cms-text-muted)" }}>
                      <span>Uptime: {serverStats.system.uptime}</span>
                      <span>Load: {serverStats.loadAverage['1m']}</span>
                    </div>
                  </>
                ) : (
                  <div style={{ color: "var(--cms-text-muted)", fontSize: "13px" }}>Загрузка...</div>
                )}
              </div>

              <div className="cms-table-wrap" style={{ padding: "16px" }}>
                <div style={{ fontWeight: 700, fontSize: "14px", marginBottom: "12px" }}>География</div>
                {analytics?.countries.slice(0, 5).map((c, i) => (
                  <div key={i} style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", fontSize: "13px" }}>
                    <span>{COUNTRY_NAMES[c.country] || c.country}</span>
                    <span style={{ color: "var(--cms-text-muted)" }}>{c.count}</span>
                  </div>
                ))}
                {(!analytics?.countries || analytics.countries.length === 0) && (
                  <div style={{ color: "var(--cms-text-muted)", fontSize: "13px" }}>Нет данных</div>
                )}
              </div>

              <div className="cms-table-wrap" style={{ padding: "16px" }}>
                <div style={{ fontWeight: 700, fontSize: "14px", marginBottom: "12px" }}>Устройства</div>
                {analytics?.devices?.slice(0, 3).map((d, i) => (
                  <div key={i} style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", fontSize: "13px" }}>
                    <span style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                      {d.device === "mobile" ? (
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="5" y="2" width="14" height="20" rx="2"/><path d="M12 18h.01"/></svg>
                      ) : (
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 21h8M12 17v4"/></svg>
                      )}
                      {d.device === "mobile" ? "Мобильные" : "Десктоп"}
                    </span>
                    <span style={{ color: "var(--cms-text-muted)" }}>{d.count}</span>
                  </div>
                ))}
                {(!analytics?.devices || analytics.devices.length === 0) && (
                  <div style={{ color: "var(--cms-text-muted)", fontSize: "13px" }}>Нет данных</div>
                )}
              </div>
            </div>
          </div>

          {/* Quick Links */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: "12px", marginTop: "20px" }}>
            {[
              { href: "/admin/orders", icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M8 7h8M8 11h8M8 15h4"/></svg>, label: "Заказы" },
              { href: "/admin/products", icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M20.59 13.41l-7.17 7.17a2 2 0 01-2.83 0L2 12V2h10l8.59 8.59a2 2 0 010 2.82z"/><circle cx="7" cy="7" r="1.5" fill="currentColor"/></svg>, label: "Товары" },
              { href: "/admin/inquiries", icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><path d="M22 6l-10 7L2 6"/></svg>, label: "Обращения" },
              { href: "/admin/content", icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 013 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>, label: "Контент" },
              { href: "/admin/analytics", icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M3 3v18h18"/><path d="M7 16l4-6 4 3 5-7"/></svg>, label: "Аналитика" },
              { href: "/admin/settings", icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 01-2.83 2.83l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z"/></svg>, label: "Настройки" },
            ].map((item) => (
              <Link key={item.href} href={item.href} className="cms-quick-link">
                <span style={{ display: "flex", alignItems: "center", justifyContent: "center" }}>{item.icon}</span>
                <span>{item.label}</span>
              </Link>
            ))}
          </div>
        </div>
      </main>

      <style jsx>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }
      `}</style>
    </div>
  );
}
