"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { AdminSidebar } from "./AdminSidebar";

interface Expense {
  id: string;
  amount: number;
  description: string;
  category: string;
  date: string;
}

interface DashboardData {
  orderCount: number;
  pendingCount: number;
  productCount: number;
  totalRevenue: number;
  totalExpenses: number;
  profit: number;
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
  languages: Array<{ lang: string; count: number }>;
  referrers: Array<{ referrer: string; count: number }>;
  devices: Array<{ device: string; count: number }>;
  totals: { views: number; orders: number; revenue: number; products: number; uniqueIPs: number };
}

interface ServerStats {
  cpu: { usage: number; cores: number };
  memory: { total: string; used: string; free: string; usage: number; process: { heapUsed: string; heapTotal: string; rss: string } };
  system: { platform: string; uptime: string; nodeVersion: string; hostname: string };
  loadAverage: { '1m': number; '5m': number; '15m': number };
  disk?: { total: string; used: string; free: string; usage: number };
  dbConnected?: boolean;
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
  UA: "Украина", BY: "Беларусь", UZ: "Узбекистан", AZ: "Азербайджан",
};

// ─── Stock-market style SVG line chart ────────────────────────────────────────
function StockChart({ data, valueKey, color }: {
  data: Array<{ date: string; views: number; visitors: number; orders: number; revenue: number }>;
  valueKey: "views" | "visitors" | "orders";
  color: string;
}) {
  if (!data || data.length < 2) {
    return <div style={{ height: 100, display: "flex", alignItems: "center", justifyContent: "center", color: "var(--cms-text-muted)", fontSize: 13 }}>Недостаточно данных</div>;
  }

  const W = 500, H = 110;
  const pad = { t: 10, r: 10, b: 22, l: 38 };
  const iW = W - pad.l - pad.r;
  const iH = H - pad.t - pad.b;

  const values = data.map((d) => d[valueKey]);
  const maxV = Math.max(...values, 1);
  const minV = Math.min(...values, 0);
  const range = maxV - minV || 1;

  const x = (i: number) => pad.l + (i / (data.length - 1)) * iW;
  const y = (v: number) => pad.t + (1 - (v - minV) / range) * iH;

  // Smooth bezier path
  let linePath = `M ${x(0)},${y(values[0])}`;
  for (let i = 1; i < values.length; i++) {
    const x0 = x(i - 1), y0 = y(values[i - 1]);
    const x1 = x(i), y1 = y(values[i]);
    const cpx = (x0 + x1) / 2;
    linePath += ` C ${cpx},${y0} ${cpx},${y1} ${x1},${y1}`;
  }
  const areaPath = `${linePath} L ${x(data.length - 1)},${pad.t + iH} L ${pad.l},${pad.t + iH} Z`;

  const isUp = values[values.length - 1] >= values[0];
  const lineColor = isUp ? "#22c55e" : "#ef4444";
  const gradId = `sg-${valueKey}`;

  // Y-axis ticks
  const yTicks = [0, 0.25, 0.5, 0.75, 1].map((pct) => ({
    v: Math.round(minV + pct * range),
    yPos: pad.t + (1 - pct) * iH,
  }));

  // X-axis labels: first, middle, last
  const xLabels = [0, Math.floor((data.length - 1) / 2), data.length - 1];

  // Trend indicator
  const trendPct = values[0] > 0 ? (((values[values.length - 1] - values[0]) / values[0]) * 100).toFixed(1) : "—";

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "6px" }}>
        <span style={{ fontSize: "11px", fontWeight: 600, color: lineColor, display: "flex", alignItems: "center", gap: "3px" }}>
          {isUp ? "▲" : "▼"} {trendPct !== "—" ? `${isUp ? "+" : ""}${trendPct}%` : "—"}
        </span>
        <span style={{ fontSize: "10px", color: "var(--cms-text-muted)" }}>за период</span>
      </div>
      <svg width="100%" viewBox={`0 0 ${W} ${H}`} style={{ overflow: "visible", display: "block" }}>
        <defs>
          <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={lineColor} stopOpacity="0.25" />
            <stop offset="100%" stopColor={lineColor} stopOpacity="0.02" />
          </linearGradient>
        </defs>
        {/* Grid lines */}
        {yTicks.map((t, i) => (
          <g key={i}>
            <line x1={pad.l} y1={t.yPos} x2={W - pad.r} y2={t.yPos} stroke="currentColor" strokeOpacity="0.07" strokeWidth="1" />
            <text x={pad.l - 4} y={t.yPos + 4} textAnchor="end" fontSize="9" fill="currentColor" fillOpacity="0.4">{t.v}</text>
          </g>
        ))}
        {/* Area fill */}
        <path d={areaPath} fill={`url(#${gradId})`} />
        {/* Line */}
        <path d={linePath} fill="none" stroke={lineColor} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        {/* Last-point dot */}
        <circle cx={x(data.length - 1)} cy={y(values[values.length - 1])} r="4" fill={lineColor} />
        {/* X-axis labels */}
        {xLabels.map((idx) => (
          <text key={idx} x={x(idx)} y={H - 4} textAnchor="middle" fontSize="9" fill="currentColor" fillOpacity="0.5">{data[idx]?.date?.slice(5)}</text>
        ))}
      </svg>
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

function GaugeBar({ value, max = 100, color }: { value: number; max?: number; color: string }) {
  const pct = Math.min((value / max) * 100, 100);
  return (
    <div style={{ height: 5, background: "var(--cms-border)", borderRadius: 3, overflow: "hidden" }}>
      <div style={{ height: "100%", width: `${pct}%`, background: color, borderRadius: 3, transition: "width 0.5s ease" }} />
    </div>
  );
}

export default function AdminDashboard() {
  const router = useRouter();
  const [data, setData] = useState<DashboardData | null>(null);
  const [analytics, setAnalytics] = useState<AnalyticsData | null>(null);
  const [serverStats, setServerStats] = useState<ServerStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [chartMode, setChartMode] = useState<"views" | "visitors" | "orders">("views");
  const [period, setPeriod] = useState<"7" | "14" | "30" | "90">("30");

  const getToken = useCallback(() => localStorage.getItem("admin_token"), []);

  const fetchData = useCallback(async (isRefresh = false) => {
    const token = getToken();
    if (!token) { router.push("/admin/login"); return; }
    if (isRefresh) setRefreshing(true);

    try {
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
    } finally {
      setLoading(false);
      if (isRefresh) setRefreshing(false);
    }
  }, [getToken, router, period]);

  const [showExport, setShowExport] = useState(false);
  const [exportFrom, setExportFrom] = useState(() => { const d = new Date(); d.setDate(d.getDate() - 30); return d.toISOString().slice(0, 10); });
  const [exportTo, setExportTo] = useState(() => new Date().toISOString().slice(0, 10));
  const [exportFormat, setExportFormat] = useState("csv");

  const [showExpenses, setShowExpenses] = useState(false);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [expenseForm, setExpenseForm] = useState({ amount: "", description: "", category: "other", date: new Date().toISOString().slice(0, 10) });
  const [savingExpense, setSavingExpense] = useState(false);
  const [deletingExpenseId, setDeletingExpenseId] = useState<string | null>(null);

  const fetchExpenses = useCallback(async () => {
    const token = getToken();
    const res = await fetch("/api/admin/expenses", { headers: { Authorization: `Bearer ${token}` } });
    if (res.ok) { const d = await res.json(); setExpenses(d.expenses || []); }
  }, [getToken]);

  const handleAddExpense = async () => {
    if (!expenseForm.amount || !expenseForm.description) return;
    setSavingExpense(true);
    const token = getToken();
    const res = await fetch("/api/admin/expenses", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify(expenseForm),
    });
    if (res.ok) {
      setExpenseForm({ amount: "", description: "", category: "other", date: new Date().toISOString().slice(0, 10) });
      fetchExpenses();
      fetchData(true);
    }
    setSavingExpense(false);
  };

  const handleDeleteExpense = async (id: string) => {
    setDeletingExpenseId(id);
    const token = getToken();
    await fetch(`/api/admin/expenses?id=${id}`, { method: "DELETE", headers: { Authorization: `Bearer ${token}` } });
    fetchExpenses();
    fetchData(true);
    setDeletingExpenseId(null);
  };

  useEffect(() => {
    fetchData();
    fetchExpenses();
    const interval = setInterval(() => fetchData(), 30000);
    return () => clearInterval(interval);
  }, [fetchData, fetchExpenses]);

  const formatPrice = (n: number) =>
    new Intl.NumberFormat("ru-RU", { style: "currency", currency: "RUB", minimumFractionDigits: 0 }).format(n);

  const formatDuration = (s: number) => s < 60 ? `${s}с` : `${Math.floor(s / 60)}м ${s % 60}с`;

  const handleExport = () => {
    if (!analytics) return;
    const fromDate = new Date(exportFrom);
    const toDate = new Date(exportTo);
    const chartFiltered = analytics.chart.filter((d) => {
      const dd = new Date(d.date);
      return dd >= fromDate && dd <= toDate;
    });
    if (exportFormat === "csv") {
      const header = "Date,Views,Visitors,Orders,Revenue";
      const rows = chartFiltered.map((d) => `${d.date},${d.views},${d.visitors},${d.orders},${d.revenue}`);
      const csv = [header, ...rows].join("\n");
      downloadExportFile(csv, "analytics-report.csv", "text/csv");
    } else {
      const report = { period: { from: exportFrom, to: exportTo }, summary: analytics.totals, today: analytics.today, dailyData: chartFiltered, topPages: analytics.topPages, countries: analytics.countries, languages: analytics.languages, referrers: analytics.referrers };
      downloadExportFile(JSON.stringify(report, null, 2), "analytics-report.json", "application/json");
    }
    setShowExport(false);
  };

  const downloadExportFile = (content: string, filename: string, type: string) => {
    const blob = new Blob([content], { type });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = filename; a.click();
    URL.revokeObjectURL(url);
  };

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
            <a href="https://errani.ru" target="_blank" rel="noopener noreferrer" className="cms-btn cms-btn-sm">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ marginRight: "6px" }}><path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6"/><path d="M15 3h6v6M10 14L21 3"/></svg>
              Открыть сайт
            </a>
            <button className="cms-btn cms-btn-sm" onClick={() => setShowExport(true)}>Экспорт отчёта</button>
            <button
              className="cms-btn cms-btn-sm cms-btn-ghost"
              onClick={() => fetchData(true)}
              disabled={refreshing}
              style={{ display: "flex", alignItems: "center", gap: "6px", minWidth: 90 }}
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
                style={{ animation: refreshing ? "spin 0.8s linear infinite" : "none" }}>
                <path d="M23 4v6h-6M1 20v-6h6"/><path d="M3.51 9a9 9 0 0114.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0020.49 15"/>
              </svg>
              {refreshing ? "..." : "Обновить"}
            </button>
          </div>
        </div>

        <div className="cms-content">
          {/* Main Stat Cards */}
          <div className="cms-stat-grid" style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "8px" }}>
            <StatCard
              icon={<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#e8722a" strokeWidth="2"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M8 7h8M8 11h8M8 15h4"/></svg>}
              label="Заказы (оплач.)"
              value={data?.orderCount ?? 0}
              sub={data?.pendingCount ? `${data.pendingCount} ждут оплаты` : `${analytics?.today.orders ?? 0} сегодня`}
              color="rgba(232, 114, 42, 0.15)"
            />
            <div onClick={() => { setShowExpenses(true); fetchExpenses(); }} style={{ cursor: "pointer" }} title="Нажмите для управления расходами">
              <StatCard
                icon={<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#22c55e" strokeWidth="2"><path d="M12 2v20M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6"/></svg>}
                label="Выручка ↗ (нажмите)"
                value={formatPrice(data?.totalRevenue ?? 0)}
                sub={data?.totalExpenses ? `расходы: ${formatPrice(data.totalExpenses)}` : "добавить расходы"}
                color="rgba(34, 197, 94, 0.15)"
              />
            </div>
            <StatCard
              icon={<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={(data?.profit ?? 0) >= 0 ? "#10b981" : "#ef4444"} strokeWidth="2"><path d="M22 12h-4l-3 9L9 3l-3 9H2"/></svg>}
              label="Прибыль"
              value={formatPrice(data?.profit ?? 0)}
              sub={(data?.profit ?? 0) >= 0 ? "в плюсе" : "в минусе"}
              color={(data?.profit ?? 0) >= 0 ? "rgba(16, 185, 129, 0.12)" : "rgba(239, 68, 68, 0.12)"}
            />
            <StatCard
              icon={<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#3b82f6" strokeWidth="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>}
              label="Просмотры"
              value={analytics?.totals.views ?? 0}
              sub={`${analytics?.today.views ?? 0} сегодня`}
              trend={analytics?.today.views && analytics.totals.views ? `+${((analytics.today.views / analytics.totals.views) * 100).toFixed(1)}%` : undefined}
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
            {/* Stock Chart */}
            <div className="cms-table-wrap" style={{ padding: "20px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px", flexWrap: "wrap", gap: "8px" }}>
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
              {analytics?.chart ? (
                <StockChart data={analytics.chart} valueKey={chartMode} color={chartColors[chartMode]} />
              ) : (
                <div style={{ height: 110, display: "flex", alignItems: "center", justifyContent: "center", color: "var(--cms-text-muted)", fontSize: 13 }}>Нет данных</div>
              )}
            </div>

            {/* Today Quick Stats */}
            <div className="cms-table-wrap" style={{ padding: "20px" }}>
              <div style={{ fontWeight: 700, fontSize: "15px", marginBottom: "16px" }}>Сегодня</div>
              <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                {[
                  { label: "Просмотры", value: analytics?.today.views ?? 0 },
                  { label: "Посетители", value: analytics?.today.visitors ?? 0 },
                  { label: "Заказы", value: analytics?.today.orders ?? 0 },
                  { label: "Ср. время на сайте", value: formatDuration(analytics?.today.avgDuration ?? 0) },
                ].map((row, i, arr) => (
                  <div key={row.label} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 0", borderBottom: i < arr.length - 1 ? "1px solid var(--cms-border)" : "none" }}>
                    <span style={{ color: "var(--cms-text-muted)", fontSize: 13 }}>{row.label}</span>
                    <span style={{ fontWeight: 600, fontSize: "16px" }}>{row.value}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Recent Orders + Analytics Details */}
          <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: "16px", marginTop: "16px" }}>
            {/* Recent Paid Orders */}
            <div className="cms-table-wrap">
              <div style={{ padding: "14px 18px", borderBottom: "1px solid var(--cms-border)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ fontWeight: 700, fontSize: "14px" }}>Последние оплаченные заказы</span>
                <Link href="/admin/orders" className="cms-btn cms-btn-sm cms-btn-ghost">Все заказы →</Link>
              </div>
              <table className="cms-table">
                <thead>
                  <tr><th>№</th><th>Клиент</th><th>Сумма</th><th>Статус</th><th>Дата</th></tr>
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

            {/* Right column: Server + Geography */}
            <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
              {/* Professional Server Status */}
              <div className="cms-table-wrap" style={{ padding: "16px" }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "12px" }}>
                  <span style={{ fontWeight: 700, fontSize: "14px" }}>Сервер</span>
                  {serverStats && (
                    <span style={{ display: "flex", alignItems: "center", gap: "5px", fontSize: "11px", color: serverStats.dbConnected !== false ? "#22c55e" : "#ef4444" }}>
                      <span style={{ width: 7, height: 7, borderRadius: "50%", background: serverStats.dbConnected !== false ? "#22c55e" : "#ef4444", animation: "pulse 2s infinite" }} />
                      {serverStats.dbConnected !== false ? "БД подключена" : "БД недоступна"}
                    </span>
                  )}
                </div>
                {serverStats ? (
                  <div style={{ display: "flex", flexDirection: "column", gap: "9px" }}>
                    {/* CPU */}
                    <div>
                      <div style={{ display: "flex", justifyContent: "space-between", fontSize: "12px", marginBottom: 3 }}>
                        <span style={{ display: "flex", alignItems: "center", gap: 5 }}>
                          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="4" y="4" width="16" height="16" rx="2"/><rect x="9" y="9" width="6" height="6"/><path d="M9 1v3M15 1v3M9 20v3M15 20v3M1 9h3M1 15h3M20 9h3M20 15h3"/></svg>
                          CPU
                        </span>
                        <span style={{ color: serverStats.cpu.usage > 80 ? "#ef4444" : "var(--cms-text-muted)", fontWeight: 600 }}>{serverStats.cpu.usage}% · {serverStats.cpu.cores}ядра</span>
                      </div>
                      <GaugeBar value={serverStats.cpu.usage} color={serverStats.cpu.usage > 80 ? "#ef4444" : serverStats.cpu.usage > 60 ? "#f59e0b" : "#22c55e"} />
                    </div>
                    {/* Memory */}
                    <div>
                      <div style={{ display: "flex", justifyContent: "space-between", fontSize: "12px", marginBottom: 3 }}>
                        <span style={{ display: "flex", alignItems: "center", gap: 5 }}>
                          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="2" y="7" width="20" height="10" rx="1"/><path d="M6 7V5M10 7V5M14 7V5M18 7V5M6 17v2M10 17v2M14 17v2M18 17v2"/></svg>
                          ОЗУ
                        </span>
                        <span style={{ color: serverStats.memory.usage > 80 ? "#ef4444" : "var(--cms-text-muted)", fontWeight: 600 }}>{serverStats.memory.usage}% · {serverStats.memory.used}/{serverStats.memory.total}</span>
                      </div>
                      <GaugeBar value={serverStats.memory.usage} color={serverStats.memory.usage > 80 ? "#ef4444" : serverStats.memory.usage > 60 ? "#f59e0b" : "#3b82f6"} />
                    </div>
                    {/* Disk (if available) */}
                    {serverStats.disk && (
                      <div>
                        <div style={{ display: "flex", justifyContent: "space-between", fontSize: "12px", marginBottom: 3 }}>
                          <span>Диск</span>
                          <span style={{ color: "var(--cms-text-muted)", fontWeight: 600 }}>{serverStats.disk.usage}% · {serverStats.disk.used}/{serverStats.disk.total}</span>
                        </div>
                        <GaugeBar value={serverStats.disk.usage} color={serverStats.disk.usage > 85 ? "#ef4444" : "#8b5cf6"} />
                      </div>
                    )}
                    {/* Load + Uptime */}
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: "11px", color: "var(--cms-text-muted)", paddingTop: 2, borderTop: "1px solid var(--cms-border)" }}>
                      <span>Load: {serverStats.loadAverage['1m']} / {serverStats.loadAverage['5m']} / {serverStats.loadAverage['15m']}</span>
                      <span>↑ {serverStats.system.uptime}</span>
                    </div>
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: "11px", color: "var(--cms-text-muted)" }}>
                      <span>{serverStats.system.nodeVersion}</span>
                      <span>{serverStats.system.platform}</span>
                    </div>
                  </div>
                ) : (
                  <div style={{ color: "var(--cms-text-muted)", fontSize: "13px" }}>Загрузка...</div>
                )}
              </div>

              {/* Geography */}
              <div className="cms-table-wrap" style={{ padding: "16px" }}>
                <div style={{ fontWeight: 700, fontSize: "14px", marginBottom: "10px" }}>География</div>
                {analytics?.countries && analytics.countries.length > 0 ? (
                  analytics.countries.slice(0, 5).map((c, i) => {
                    const maxCount = analytics.countries[0]?.count || 1;
                    return (
                      <div key={i} style={{ marginBottom: 7 }}>
                        <div style={{ display: "flex", justifyContent: "space-between", fontSize: "12px", marginBottom: 3 }}>
                          <span>{COUNTRY_NAMES[c.country] || c.country}</span>
                          <span style={{ color: "var(--cms-text-muted)" }}>{c.count}</span>
                        </div>
                        <GaugeBar value={c.count} max={maxCount} color="var(--cms-accent)" />
                      </div>
                    );
                  })
                ) : (
                  <div style={{ color: "var(--cms-text-muted)", fontSize: "13px" }}>Нет данных</div>
                )}
              </div>
            </div>
          </div>

          {/* Analytics Detail Row: Top Pages + Referrers + Devices */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "16px", marginTop: "16px" }}>
            {/* Top Pages */}
            <div className="cms-table-wrap" style={{ padding: "16px" }}>
              <div style={{ fontWeight: 700, fontSize: "14px", marginBottom: "10px" }}>Топ страниц (сегодня)</div>
              {analytics?.topPages && analytics.topPages.length > 0 ? (
                analytics.topPages.slice(0, 7).map((p, i) => {
                  const maxV = analytics.topPages[0]?.views || 1;
                  return (
                    <div key={i} style={{ marginBottom: 7 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", fontSize: "11px", marginBottom: 2 }}>
                        <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: "70%", color: "var(--cms-text-muted)" }}>{p.path}</span>
                        <span style={{ fontWeight: 600 }}>{p.views}</span>
                      </div>
                      <GaugeBar value={p.views} max={maxV} color="#3b82f6" />
                    </div>
                  );
                })
              ) : <div style={{ color: "var(--cms-text-muted)", fontSize: "13px" }}>Нет данных</div>}
            </div>

            {/* Referrers */}
            <div className="cms-table-wrap" style={{ padding: "16px" }}>
              <div style={{ fontWeight: 700, fontSize: "14px", marginBottom: "10px" }}>Источники трафика</div>
              {analytics?.referrers && analytics.referrers.length > 0 ? (
                analytics.referrers.slice(0, 7).map((r, i) => {
                  const maxV = analytics.referrers[0]?.count || 1;
                  const label = r.referrer.replace(/^https?:\/\//, "").replace(/\/$/, "").split("/")[0] || "Прямой";
                  return (
                    <div key={i} style={{ marginBottom: 7 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", fontSize: "11px", marginBottom: 2 }}>
                        <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: "70%", color: "var(--cms-text-muted)" }}>{label}</span>
                        <span style={{ fontWeight: 600 }}>{r.count}</span>
                      </div>
                      <GaugeBar value={r.count} max={maxV} color="#8b5cf6" />
                    </div>
                  );
                })
              ) : <div style={{ color: "var(--cms-text-muted)", fontSize: "13px" }}>Нет данных</div>}
            </div>

            {/* Devices + Languages */}
            <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
              <div className="cms-table-wrap" style={{ padding: "16px" }}>
                <div style={{ fontWeight: 700, fontSize: "14px", marginBottom: "10px" }}>Устройства</div>
                {analytics?.devices && analytics.devices.length > 0 ? (
                  analytics.devices.slice(0, 3).map((d, i) => (
                    <div key={i} style={{ display: "flex", justifyContent: "space-between", padding: "5px 0", fontSize: "12px" }}>
                      <span style={{ display: "flex", alignItems: "center", gap: "7px", color: "var(--cms-text-muted)" }}>
                        {d.device === "mobile" ? (
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="5" y="2" width="14" height="20" rx="2"/><path d="M12 18h.01"/></svg>
                        ) : (
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 21h8M12 17v4"/></svg>
                        )}
                        {d.device === "mobile" ? "Мобильные" : "Десктоп"}
                      </span>
                      <span style={{ fontWeight: 600 }}>{d.count}</span>
                    </div>
                  ))
                ) : <div style={{ color: "var(--cms-text-muted)", fontSize: "12px" }}>Нет данных</div>}
              </div>

              <div className="cms-table-wrap" style={{ padding: "16px" }}>
                <div style={{ fontWeight: 700, fontSize: "14px", marginBottom: "10px" }}>Языки</div>
                {analytics?.languages && analytics.languages.length > 0 ? (
                  analytics.languages.slice(0, 4).map((l, i) => (
                    <div key={i} style={{ display: "flex", justifyContent: "space-between", padding: "5px 0", fontSize: "12px", borderBottom: i < 3 ? "1px solid var(--cms-border)" : "none" }}>
                      <span style={{ color: "var(--cms-text-muted)" }}>{l.lang.toUpperCase()}</span>
                      <span style={{ fontWeight: 600 }}>{l.count}</span>
                    </div>
                  ))
                ) : <div style={{ color: "var(--cms-text-muted)", fontSize: "12px" }}>Нет данных</div>}
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

      {/* Expenses Modal */}
      {showExpenses && (
        <div className="cms-modal-overlay" onClick={() => setShowExpenses(false)}>
          <div className="cms-modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 560 }}>
            <div className="cms-modal-header">
              <h3>Расходы</h3>
              <button className="cms-modal-close" onClick={() => setShowExpenses(false)}>&times;</button>
            </div>
            <div className="cms-modal-body" style={{ maxHeight: "55vh", overflowY: "auto" }}>
              {/* Summary */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10, marginBottom: 16 }}>
                <div style={{ background: "rgba(34,197,94,0.08)", borderRadius: 8, padding: "10px 14px" }}>
                  <div style={{ fontSize: 11, color: "var(--cms-text-muted)" }}>Выручка</div>
                  <div style={{ fontWeight: 700, fontSize: 15 }}>{formatPrice(data?.totalRevenue ?? 0)}</div>
                </div>
                <div style={{ background: "rgba(239,68,68,0.08)", borderRadius: 8, padding: "10px 14px" }}>
                  <div style={{ fontSize: 11, color: "var(--cms-text-muted)" }}>Расходы</div>
                  <div style={{ fontWeight: 700, fontSize: 15 }}>{formatPrice(data?.totalExpenses ?? 0)}</div>
                </div>
                <div style={{ background: (data?.profit ?? 0) >= 0 ? "rgba(16,185,129,0.1)" : "rgba(239,68,68,0.1)", borderRadius: 8, padding: "10px 14px" }}>
                  <div style={{ fontSize: 11, color: "var(--cms-text-muted)" }}>Прибыль</div>
                  <div style={{ fontWeight: 700, fontSize: 15, color: (data?.profit ?? 0) >= 0 ? "#10b981" : "#ef4444" }}>{formatPrice(data?.profit ?? 0)}</div>
                </div>
              </div>

              {/* Add expense form */}
              <div style={{ background: "var(--cms-bg-hover)", borderRadius: 8, padding: 14, marginBottom: 16 }}>
                <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 10 }}>Добавить расход</div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 10 }}>
                  <label className="cms-label">
                    Описание
                    <input className="cms-input" value={expenseForm.description} onChange={(e) => setExpenseForm({ ...expenseForm, description: e.target.value })} placeholder="Упаковка, доставка..." style={{ marginTop: 4 }} />
                  </label>
                  <label className="cms-label">
                    Сумма (₽)
                    <input className="cms-input" type="number" value={expenseForm.amount} onChange={(e) => setExpenseForm({ ...expenseForm, amount: e.target.value })} placeholder="0" style={{ marginTop: 4 }} />
                  </label>
                  <label className="cms-label">
                    Категория
                    <select className="cms-select" value={expenseForm.category} onChange={(e) => setExpenseForm({ ...expenseForm, category: e.target.value })} style={{ marginTop: 4 }}>
                      <option value="shipping">Доставка</option>
                      <option value="packaging">Упаковка</option>
                      <option value="marketing">Маркетинг</option>
                      <option value="product">Закупка товара</option>
                      <option value="other">Прочее</option>
                    </select>
                  </label>
                  <label className="cms-label">
                    Дата
                    <input className="cms-input" type="date" value={expenseForm.date} onChange={(e) => setExpenseForm({ ...expenseForm, date: e.target.value })} style={{ marginTop: 4 }} />
                  </label>
                </div>
                <button className="cms-btn cms-btn-primary cms-btn-sm" onClick={handleAddExpense} disabled={savingExpense}>
                  {savingExpense ? "Сохранение..." : "+ Добавить расход"}
                </button>
              </div>

              {/* Expense list */}
              {expenses.length > 0 ? (
                <table className="cms-table">
                  <thead>
                    <tr><th>Дата</th><th>Описание</th><th>Категория</th><th style={{ textAlign: "right" }}>Сумма</th><th style={{ width: 40 }}></th></tr>
                  </thead>
                  <tbody>
                    {expenses.map((exp) => (
                      <tr key={exp.id}>
                        <td style={{ fontSize: 12, color: "var(--cms-text-muted)" }}>{exp.date}</td>
                        <td style={{ fontSize: 13 }}>{exp.description}</td>
                        <td><span style={{ fontSize: 11, background: "var(--cms-border)", borderRadius: 4, padding: "2px 6px" }}>{exp.category}</span></td>
                        <td style={{ textAlign: "right", fontWeight: 600, color: "#ef4444" }}>−{formatPrice(exp.amount)}</td>
                        <td>
                          <button className="cms-btn cms-btn-xs cms-btn-danger" onClick={() => handleDeleteExpense(exp.id)} disabled={deletingExpenseId === exp.id} title="Удалить">×</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <div style={{ textAlign: "center", padding: "20px", color: "var(--cms-text-muted)", fontSize: 13 }}>Расходов пока нет</div>
              )}
            </div>
            <div className="cms-modal-actions">
              <button className="cms-btn" onClick={() => setShowExpenses(false)}>Закрыть</button>
            </div>
          </div>
        </div>
      )}

      {/* Export Modal */}
      {showExport && (
        <div className="cms-modal-overlay" onClick={() => setShowExport(false)}>
          <div className="cms-modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 440 }}>
            <div className="cms-modal-header">
              <h3>Экспорт отчёта</h3>
              <button className="cms-modal-close" onClick={() => setShowExport(false)}>&times;</button>
            </div>
            <div className="cms-modal-body">
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px", marginBottom: "16px" }}>
                <label className="cms-label">
                  С
                  <input className="cms-input" type="date" value={exportFrom} onChange={(e) => setExportFrom(e.target.value)} />
                </label>
                <label className="cms-label">
                  По
                  <input className="cms-input" type="date" value={exportTo} onChange={(e) => setExportTo(e.target.value)} />
                </label>
              </div>
              <label className="cms-label">
                Формат
                <div style={{ display: "flex", gap: "10px", marginTop: "8px" }}>
                  {[{ v: "csv", l: "CSV" }, { v: "json", l: "JSON" }].map((f) => (
                    <label key={f.v} className="cms-checkbox-label" style={{ padding: "8px 16px", borderRadius: "8px", border: `1px solid ${exportFormat === f.v ? "var(--cms-accent)" : "var(--cms-border)"}`, background: exportFormat === f.v ? "rgba(232,114,42,0.1)" : "transparent", cursor: "pointer" }}>
                      <input type="radio" name="fmt" value={f.v} checked={exportFormat === f.v} onChange={() => setExportFormat(f.v)} style={{ display: "none" }} />
                      {f.l}
                    </label>
                  ))}
                </div>
              </label>
            </div>
            <div className="cms-modal-actions">
              <button className="cms-btn cms-btn-primary" onClick={handleExport}>Скачать</button>
              <button className="cms-btn" onClick={() => setShowExport(false)}>Отмена</button>
            </div>
          </div>
        </div>
      )}

      <style jsx>{`
        @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.5; } }
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}
