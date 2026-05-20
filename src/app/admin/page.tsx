"use client";

import { useState, useEffect, useCallback, useRef } from "react";
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
  countries: Array<{ country: string; count: number }>;
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
  paid: { label: "Оплачен", cls: "cms-badge-green" },
};

const COUNTRY_NAMES: Record<string, string> = {
  RU: "Россия", US: "США", DE: "Германия", FR: "Франция", IT: "Италия",
  ES: "Испания", TR: "Турция", CN: "Китай", GB: "Великобритания", KZ: "Казахстан",
  UA: "Украина", BY: "Беларусь", UZ: "Узбекистан", AZ: "Азербайджан",
};

// ─── Mini line chart ──────────────────────────────────────────────────────────
function SparkChart({ data, valueKey }: {
  data: Array<{ date: string; views: number; visitors: number; orders: number; revenue: number }>;
  valueKey: "views" | "visitors" | "orders";
}) {
  if (!data || data.length < 2) return (
    <div style={{ height: 80, display: "flex", alignItems: "center", justifyContent: "center", color: "var(--cms-text-muted)", fontSize: 12 }}>
      Нет данных
    </div>
  );

  const W = 500, H = 90;
  const pad = { t: 8, r: 8, b: 20, l: 34 };
  const iW = W - pad.l - pad.r;
  const iH = H - pad.t - pad.b;

  const values = data.map((d) => d[valueKey]);
  const maxV = Math.max(...values, 1);
  const minV = Math.min(...values, 0);
  const range = maxV - minV || 1;

  const x = (i: number) => pad.l + (i / (data.length - 1)) * iW;
  const y = (v: number) => pad.t + (1 - (v - minV) / range) * iH;

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

  const yTicks = [0, 0.5, 1].map((pct) => ({
    v: Math.round(minV + pct * range),
    yPos: pad.t + (1 - pct) * iH,
  }));

  const xLabels = [0, Math.floor((data.length - 1) / 2), data.length - 1];
  const trendPct = values[0] > 0
    ? (((values[values.length - 1] - values[0]) / values[0]) * 100).toFixed(1)
    : null;

  return (
    <div>
      {trendPct !== null && (
        <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
          <span style={{ fontSize: 11, fontWeight: 600, color: lineColor }}>
            {isUp ? "▲" : "▼"} {isUp ? "+" : ""}{trendPct}%
          </span>
          <span style={{ fontSize: 10, color: "var(--cms-text-muted)" }}>за период</span>
        </div>
      )}
      <svg width="100%" viewBox={`0 0 ${W} ${H}`} style={{ overflow: "visible", display: "block" }}>
        <defs>
          <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={lineColor} stopOpacity="0.22" />
            <stop offset="100%" stopColor={lineColor} stopOpacity="0.01" />
          </linearGradient>
        </defs>
        {yTicks.map((t, i) => (
          <g key={i}>
            <line x1={pad.l} y1={t.yPos} x2={W - pad.r} y2={t.yPos} stroke="currentColor" strokeOpacity="0.07" strokeWidth="1" />
            <text x={pad.l - 4} y={t.yPos + 4} textAnchor="end" fontSize="9" fill="currentColor" fillOpacity="0.4">{t.v}</text>
          </g>
        ))}
        <path d={areaPath} fill={`url(#${gradId})`} />
        <path d={linePath} fill="none" stroke={lineColor} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        <circle cx={x(data.length - 1)} cy={y(values[values.length - 1])} r="3.5" fill={lineColor} />
        {xLabels.map((idx) => (
          <text key={idx} x={x(idx)} y={H - 3} textAnchor="middle" fontSize="9" fill="currentColor" fillOpacity="0.45">
            {data[idx]?.date?.slice(5)}
          </text>
        ))}
      </svg>
    </div>
  );
}

function GaugeBar({ value, max = 100, color }: { value: number; max?: number; color: string }) {
  const pct = Math.min((value / max) * 100, 100);
  return (
    <div style={{ height: 4, background: "var(--cms-border)", borderRadius: 3, overflow: "hidden" }}>
      <div style={{ height: "100%", width: `${pct}%`, background: color, borderRadius: 3, transition: "width 0.5s ease" }} />
    </div>
  );
}

// ─── Metric Card ──────────────────────────────────────────────────────────────
function MetricCard({ label, value, sub, accent, icon }: {
  label: string;
  value: string | number;
  sub?: string;
  accent: string;
  icon: React.ReactNode;
}) {
  return (
    <div className="cms-stat-card" style={{ padding: "16px 18px" }}>
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 8 }}>
        <div>
          <div style={{ fontSize: 12, color: "var(--cms-text-muted)", marginBottom: 6, fontWeight: 500 }}>{label}</div>
          <div style={{ fontSize: 22, fontWeight: 700, lineHeight: 1.2, letterSpacing: "-0.5px" }}>{value}</div>
          {sub && <div style={{ fontSize: 11, color: "var(--cms-text-muted)", marginTop: 4 }}>{sub}</div>}
        </div>
        <div style={{ width: 36, height: 36, borderRadius: 10, background: accent, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
          {icon}
        </div>
      </div>
    </div>
  );
}

// ─── Site Status ──────────────────────────────────────────────────────────────
function SiteStatusDot({ ok }: { ok: boolean | null }) {
  const color = ok === null ? "#6b7280" : ok ? "#22c55e" : "#ef4444";
  return (
    <span style={{
      display: "inline-block", width: 8, height: 8, borderRadius: "50%",
      background: color, animation: ok ? "pulse 2s infinite" : "none", flexShrink: 0,
    }} />
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
  const [siteOnline, setSiteOnline] = useState<boolean | null>(null);
  const [lastRefreshed, setLastRefreshed] = useState<Date | null>(null);
  const serverRefreshRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const mountedRef = useRef(false);

  const getToken = useCallback(() => localStorage.getItem("admin_token"), []);

  const fetchWithTimeout = useCallback(async (url: string, token: string, timeoutMs = 20000) => {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    try {
      return await fetch(url, {
        headers: { Authorization: `Bearer ${token}` },
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timeout);
    }
  }, []);

  const checkSiteStatus = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/public-status", { cache: "no-store" });
      setSiteOnline(res.ok);
    } catch {
      setSiteOnline(false);
    }
  }, []);

  const fetchServerStats = useCallback(async () => {
    const token = getToken();
    if (!token) return;
    try {
      const res = await fetchWithTimeout("/api/admin/server-stats", token);
      if (res.ok) {
        const d = await res.json();
        if (d && !d.error) setServerStats(d);
      }
    } catch {}
  }, [fetchWithTimeout, getToken]);

  const fetchData = useCallback(async (isRefresh = false) => {
    const token = getToken();
    if (!token) { router.push("/admin/login"); return; }

    if (isRefresh) {
      setRefreshing(true);
    } else {
      // Load cached data immediately for instant display
      try {
        const cached = localStorage.getItem("admin_dashboard_cache");
        if (cached) {
          const { d, a, s } = JSON.parse(cached);
          if (d) { setData(d); setLoading(false); }
          if (a) setAnalytics(a);
          if (s) setServerStats(s);
        }
      } catch {}
    }

    try {
      const dashResponse = await fetchWithTimeout("/api/admin/dashboard", token, 8000).catch(() => null);
      if (dashResponse?.status === 401) {
        localStorage.removeItem("admin_token");
        router.push("/admin/login");
        return;
      }

      let freshD: DashboardData | null = null;
      let freshA: AnalyticsData | null = null;
      let freshS: ServerStats | null = null;

      if (dashResponse?.ok) {
        freshD = await dashResponse.json();
        if (freshD) setData(freshD);
      }

      // Do not block first render on heavy analytics endpoints.
      setLoading(false);

      const [analyticsResult, serverResult] = await Promise.allSettled([
        fetchWithTimeout(`/api/admin/analytics?period=${period}`, token, 7000),
        fetchWithTimeout("/api/admin/server-stats", token, 4000),
      ]);

      if (analyticsResult.status === "fulfilled" && analyticsResult.value.ok) {
        const json = await analyticsResult.value.json();
        if (json && !json.error) { freshA = json; setAnalytics(freshA); }
      }
      if (serverResult.status === "fulfilled" && serverResult.value.ok) {
        const json = await serverResult.value.json();
        if (json && !json.error) { freshS = json; setServerStats(freshS); }
      }

      // Cache successful fetch
      if (freshD || freshA || freshS) {
        try {
          localStorage.setItem("admin_dashboard_cache", JSON.stringify({ d: freshD, a: freshA, s: freshS }));
        } catch {}
      }

      setLastRefreshed(new Date());
    } finally {
      setLoading(false);
      if (isRefresh) setRefreshing(false);
    }
  }, [fetchWithTimeout, getToken, router, period]);

  // Expenses
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
    checkSiteStatus();

    const dashInterval = setInterval(() => fetchData(), 60000);
    // Server stats + site status every 5 minutes
    serverRefreshRef.current = setInterval(() => {
      fetchServerStats();
      checkSiteStatus();
    }, 5 * 60 * 1000);

    return () => {
      clearInterval(dashInterval);
      if (serverRefreshRef.current) clearInterval(serverRefreshRef.current);
    };
  }, [fetchData, fetchExpenses, checkSiteStatus, fetchServerStats]);

  // Refetch when period changes (skip on initial mount)
  useEffect(() => {
    if (!mountedRef.current) { mountedRef.current = true; return; }
    fetchData(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [period]);

  const fmt = (n: number) =>
    new Intl.NumberFormat("ru-RU", { style: "currency", currency: "RUB", minimumFractionDigits: 0 }).format(n);

  const fmtDur = (s: number) => s < 60 ? `${s}с` : `${Math.floor(s / 60)}м ${s % 60}с`;

  const handleExport = () => {
    const fromDate = new Date(exportFrom);
    const toDate = new Date(exportTo);
    const chartFiltered = (analytics?.chart ?? []).filter((d) => {
      const dd = new Date(d.date);
      return dd >= fromDate && dd <= toDate;
    });
    if (exportFormat === "csv") {
      const csv = ["Date,Views,Visitors,Orders,Revenue",
        ...chartFiltered.map((d) => `${d.date},${d.views},${d.visitors},${d.orders},${d.revenue}`)].join("\n");
      downloadFile(csv, "analytics-report.csv", "text/csv");
    } else {
      const report = { period: { from: exportFrom, to: exportTo }, summary: analytics?.totals, today: analytics?.today, dailyData: chartFiltered };
      downloadFile(JSON.stringify(report, null, 2), "analytics-report.json", "application/json");
    }
    setShowExport(false);
  };

  const downloadFile = (content: string, filename: string, type: string) => {
    const blob = new Blob([content], { type });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = filename; a.click();
    URL.revokeObjectURL(url);
  };

  if (loading) {
    return <div className="cms-loading"><div className="cms-spinner" /> Загрузка...</div>;
  }

  const cpuColor = (serverStats?.cpu.usage ?? 0) > 80 ? "#ef4444" : (serverStats?.cpu.usage ?? 0) > 60 ? "#f59e0b" : "#22c55e";
  const ramColor = (serverStats?.memory.usage ?? 0) > 80 ? "#ef4444" : (serverStats?.memory.usage ?? 0) > 60 ? "#f59e0b" : "#3b82f6";
  const statusDots = [
    {
      color: siteOnline === null ? "#f59e0b" : siteOnline ? "#22c55e" : "#ef4444",
      title: siteOnline === null ? "Проверяем сайт" : siteOnline ? "Все отлично: сайт доступен" : "Ошибка: сайт недоступен",
    },
    {
      color: serverStats?.dbConnected === false ? "#ef4444" : "#22c55e",
      title: serverStats?.dbConnected === false ? "Ошибка: база данных недоступна" : "Все отлично: база данных подключена",
    },
    {
      color: (serverStats?.cpu.usage ?? 0) > 80 ? "#ef4444" : (serverStats?.cpu.usage ?? 0) > 60 ? "#f59e0b" : "#22c55e",
      title: (serverStats?.cpu.usage ?? 0) > 80
        ? `Ошибка: высокая нагрузка CPU ${serverStats?.cpu.usage ?? 0}%`
        : (serverStats?.cpu.usage ?? 0) > 60
          ? `Предупреждение: CPU ${serverStats?.cpu.usage ?? 0}%`
          : "Все отлично: нагрузка CPU в норме",
    },
  ];

  return (
    <div className="cms-root">
      <AdminSidebar />
      <main className="cms-main">

        {/* ── Header ── */}
        <div className="cms-header">
          <div>
            <h1 className="cms-header-title" style={{ display: "flex", alignItems: "center", gap: 10 }}>
              Дашборд
              {(analytics?.realtime.onlineNow ?? 0) > 0 && (
                <span style={{ fontSize: 12, color: "#22c55e", fontWeight: 500, display: "flex", alignItems: "center", gap: 5 }}>
                  <span style={{ width: 7, height: 7, borderRadius: "50%", background: "#22c55e", animation: "pulse 2s infinite" }} />
                  {analytics!.realtime.onlineNow} онлайн
                </span>
              )}
            </h1>
            {lastRefreshed && (
              <p style={{ fontSize: 12, color: "var(--cms-text-muted)", marginTop: 2 }}>
                Обновлено в {lastRefreshed.toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" })}
              </p>
            )}
          </div>
          <div className="cms-header-actions">
            <span style={{ fontSize: 12, color: "var(--cms-text-muted)" }}>Статус</span>
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              {statusDots.map((dot, idx) => (
                <span key={idx} title={dot.title} style={{ width: 10, height: 10, borderRadius: "999px", background: dot.color, display: "inline-block" }} />
              ))}
            </div>
            <a href="https://errani.ru" target="_blank" rel="noopener noreferrer" className="cms-btn cms-btn-sm" title="Открыть сайт">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6"/><path d="M15 3h6v6M10 14L21 3"/></svg>
            </a>
            <button
              className="cms-btn cms-btn-sm cms-btn-ghost"
              onClick={() => fetchData(true)}
              disabled={refreshing}
              style={{ display: "flex", alignItems: "center", gap: 5 }}
              title="Обновить"
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
                style={{ animation: refreshing ? "spin 0.8s linear infinite" : "none" }}>
                <path d="M23 4v6h-6M1 20v-6h6"/><path d="M3.51 9a9 9 0 0114.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0020.49 15"/>
              </svg>
              {refreshing ? "..." : ""}
            </button>
          </div>
        </div>

        <div className="cms-content">

          {/* ── Row 1: Business Metrics ── */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 10, marginBottom: 16 }}>
            <MetricCard
              label="Заказов оплачено"
              value={data?.orderCount ?? 0}
              sub={data?.pendingCount ? `${data.pendingCount} ожидают` : "все проведены"}
              accent="rgba(232,114,42,0.15)"
              icon={<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#e8722a" strokeWidth="2"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M8 7h8M8 11h8M8 15h4"/></svg>}
            />
            <div onClick={() => { setShowExpenses(true); fetchExpenses(); }} style={{ cursor: "pointer" }} title="Управление расходами">
              <MetricCard
                label="Выручка (нажмите)"
                value={fmt(data?.totalRevenue ?? 0)}
                sub={data?.totalExpenses ? `расходы: ${fmt(data.totalExpenses)}` : "добавить расходы"}
                accent="rgba(34,197,94,0.15)"
                icon={<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#22c55e" strokeWidth="2"><path d="M12 2v20M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6"/></svg>}
              />
            </div>
            <MetricCard
              label="Прибыль"
              value={fmt(data?.profit ?? 0)}
              sub={(data?.profit ?? 0) >= 0 ? "в плюсе" : "в минусе"}
              accent={(data?.profit ?? 0) >= 0 ? "rgba(16,185,129,0.12)" : "rgba(239,68,68,0.12)"}
              icon={<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={(data?.profit ?? 0) >= 0 ? "#10b981" : "#ef4444"} strokeWidth="2"><path d="M22 12h-4l-3 9L9 3l-3 9H2"/></svg>}
            />
            <MetricCard
              label="Обращения"
              value={data?.inquiryCount ?? 0}
              sub={data?.newInquiryCount ? `${data.newInquiryCount} новых` : "все прочитаны"}
              accent="rgba(245,158,11,0.15)"
              icon={<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" strokeWidth="2"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><path d="M22 6l-10 7L2 6"/></svg>}
            />
          </div>

          {/* ── Row 2: Analytics Today ── */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 10, marginBottom: 16 }}>
            <MetricCard
              label="Просмотры сегодня"
              value={analytics?.today.views ?? 0}
              sub={`всего: ${analytics?.totals.views ?? 0}`}
              accent="rgba(59,130,246,0.15)"
              icon={<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#3b82f6" strokeWidth="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>}
            />
            <MetricCard
              label="Посетители сегодня"
              value={analytics?.today.visitors ?? 0}
              sub={`уник. IP: ${analytics?.totals.uniqueIPs ?? 0}`}
              accent="rgba(139,92,246,0.15)"
              icon={<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#8b5cf6" strokeWidth="2"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75"/></svg>}
            />
            <MetricCard
              label="Заказов сегодня"
              value={analytics?.today.orders ?? 0}
              sub={`товаров: ${data?.productCount ?? 0}`}
              accent="rgba(6,182,212,0.15)"
              icon={<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#06b6d4" strokeWidth="2"><path d="M20.59 13.41l-7.17 7.17a2 2 0 01-2.83 0L2 12V2h10l8.59 8.59a2 2 0 010 2.82z"/><circle cx="7" cy="7" r="1.5" fill="currentColor"/></svg>}
            />
            <MetricCard
              label="Ср. время на сайте"
              value={fmtDur(analytics?.today.avgDuration ?? 0)}
              sub="за сегодня"
              accent="rgba(236,72,153,0.12)"
              icon={<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#ec4899" strokeWidth="2"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg>}
            />
          </div>

          {/* ── Row 3: Chart + Server ── */}
          <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 14, marginBottom: 14 }}>

            {/* Chart */}
            <div className="cms-table-wrap" style={{ padding: "18px 20px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12, flexWrap: "wrap", gap: 8 }}>
                <span style={{ fontWeight: 700, fontSize: 14 }}>Тренд за {period} дней</span>
                <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                  <select className="cms-select" value={period} onChange={(e) => setPeriod(e.target.value as typeof period)} style={{ padding: "3px 8px", fontSize: 12 }}>
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
                <SparkChart data={analytics.chart} valueKey={chartMode} />
              ) : (
                <div style={{ height: 90, display: "flex", alignItems: "center", justifyContent: "center", color: "var(--cms-text-muted)", fontSize: 13 }}>Нет данных</div>
              )}
            </div>

            {/* Site Status + Server */}
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>

              {/* Site Status */}
              <div className="cms-table-wrap" style={{ padding: "14px 16px" }}>
                <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 10 }}>Статус сайта</div>
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 12 }}>
                    <span style={{ color: "var(--cms-text-muted)" }}>Сайт</span>
                    <span style={{ display: "flex", alignItems: "center", gap: 5, fontWeight: 600, color: siteOnline ? "#22c55e" : "#ef4444" }}>
                      <SiteStatusDot ok={siteOnline} />
                      {siteOnline === null ? "..." : siteOnline ? "Онлайн" : "Офлайн"}
                    </span>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 12 }}>
                    <span style={{ color: "var(--cms-text-muted)" }}>База данных</span>
                    <span style={{ display: "flex", alignItems: "center", gap: 5, fontWeight: 600, color: serverStats?.dbConnected !== false ? "#22c55e" : "#ef4444" }}>
                      <SiteStatusDot ok={serverStats ? serverStats.dbConnected !== false : null} />
                      {serverStats === null ? "..." : serverStats?.dbConnected !== false ? "Подключена" : "Недоступна"}
                    </span>
                  </div>
                  {serverStats && (
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: "var(--cms-text-muted)", paddingTop: 4, borderTop: "1px solid var(--cms-border)" }}>
                      <span>↑ {serverStats.system.uptime}</span>
                      <span>{serverStats.system.nodeVersion}</span>
                    </div>
                  )}
                  <div style={{ fontSize: 10, color: "var(--cms-text-muted)", marginTop: 2 }}>
                    Обновляется каждые 5 мин
                  </div>
                </div>
              </div>

              {/* Server Resources */}
              <div className="cms-table-wrap" style={{ padding: "14px 16px" }}>
                <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 10 }}>Ресурсы сервера</div>
                {serverStats ? (
                  <div style={{ display: "flex", flexDirection: "column", gap: 9 }}>
                    <div>
                      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginBottom: 4 }}>
                        <span style={{ color: "var(--cms-text-muted)" }}>CPU</span>
                        <span style={{ fontWeight: 600, color: cpuColor }}>{serverStats.cpu.usage}% · {serverStats.cpu.cores} ядра</span>
                      </div>
                      <GaugeBar value={serverStats.cpu.usage} color={cpuColor} />
                    </div>
                    <div>
                      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginBottom: 4 }}>
                        <span style={{ color: "var(--cms-text-muted)" }}>ОЗУ</span>
                        <span style={{ fontWeight: 600, color: ramColor }}>{serverStats.memory.usage}% · {serverStats.memory.used}/{serverStats.memory.total}</span>
                      </div>
                      <GaugeBar value={serverStats.memory.usage} color={ramColor} />
                    </div>
                    {serverStats.disk && (
                      <div>
                        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginBottom: 4 }}>
                          <span style={{ color: "var(--cms-text-muted)" }}>Диск</span>
                          <span style={{ fontWeight: 600, color: "var(--cms-text-muted)" }}>{serverStats.disk.usage}% · {serverStats.disk.used}/{serverStats.disk.total}</span>
                        </div>
                        <GaugeBar value={serverStats.disk.usage} color="#8b5cf6" />
                      </div>
                    )}
                    <div style={{ fontSize: 11, color: "var(--cms-text-muted)", paddingTop: 4, borderTop: "1px solid var(--cms-border)" }}>
                      Load: {serverStats.loadAverage['1m']} / {serverStats.loadAverage['5m']} / {serverStats.loadAverage['15m']}
                    </div>
                  </div>
                ) : (
                  <div style={{ color: "var(--cms-text-muted)", fontSize: 13 }}>Нет данных</div>
                )}
              </div>
            </div>
          </div>

          {/* ── Row 4: Orders + Geography ── */}
          <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 14, marginBottom: 20 }}>

            {/* Recent Orders */}
            <div className="cms-table-wrap">
              <div style={{ padding: "12px 16px", borderBottom: "1px solid var(--cms-border)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ fontWeight: 700, fontSize: 13 }}>Последние оплаченные заказы</span>
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
                        <td>{fmt(order.totalAmount)}</td>
                        <td>
                          <span className={`cms-badge ${STATUS_MAP[order.status]?.cls ?? "cms-badge-yellow"}`}>
                            {STATUS_MAP[order.status]?.label ?? order.status}
                          </span>
                        </td>
                        <td>{new Date(order.createdAt).toLocaleDateString("ru-RU")}</td>
                      </tr>
                    ))
                  ) : (
                    <tr><td colSpan={5} style={{ textAlign: "center", padding: 32, color: "var(--cms-text-muted)" }}>Заказов пока нет</td></tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Geography */}
            <div className="cms-table-wrap" style={{ padding: "14px 16px" }}>
              <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 12 }}>География (сегодня)</div>
              {analytics?.countries && analytics.countries.length > 0 ? (
                <div style={{ display: "flex", flexDirection: "column", gap: 9 }}>
                  {analytics.countries.slice(0, 6).map((c, i) => {
                    const maxC = analytics.countries[0]?.count || 1;
                    return (
                      <div key={i}>
                        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginBottom: 4 }}>
                          <span style={{ color: "var(--cms-text-muted)" }}>{COUNTRY_NAMES[c.country] || c.country}</span>
                          <span style={{ fontWeight: 600 }}>{c.count}</span>
                        </div>
                        <GaugeBar value={c.count} max={maxC} color="var(--cms-accent)" />
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div style={{ color: "var(--cms-text-muted)", fontSize: 13 }}>Нет данных</div>
              )}
            </div>
          </div>

          {/* ── Quick Links ── */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))", gap: 10 }}>
            {[
              { href: "/admin/orders", label: "Заказы", icon: <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M8 7h8M8 11h8M8 15h4"/></svg> },
              { href: "/admin/products", label: "Товары", icon: <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M20.59 13.41l-7.17 7.17a2 2 0 01-2.83 0L2 12V2h10l8.59 8.59a2 2 0 010 2.82z"/><circle cx="7" cy="7" r="1.5" fill="currentColor"/></svg> },
              { href: "/admin/inquiries", label: "Обращения", icon: <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><path d="M22 6l-10 7L2 6"/></svg> },
              { href: "/admin/media", label: "Медиа", icon: <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="M21 15l-5-5L5 21"/></svg> },
              { href: "/admin/reviews", label: "Отзывы", icon: <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M12 3l2.9 5.88 6.5.95-4.7 4.58 1.1 6.47L12 17.85 6.2 20.88l1.1-6.47-4.7-4.58 6.5-.95L12 3z"/></svg> },
              { href: "/admin/settings", label: "Настройки", icon: <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 01-2.83 2.83l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z"/></svg> },
            ].map((item) => (
              <Link key={item.href} href={item.href} className="cms-quick-link">
                <span>{item.icon}</span>
                <span>{item.label}</span>
              </Link>
            ))}
          </div>
        </div>
      </main>

      {/* ── Expenses Modal ── */}
      {showExpenses && (
        <div className="cms-modal-overlay" onClick={() => setShowExpenses(false)}>
          <div className="cms-modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 560 }}>
            <div className="cms-modal-header">
              <h3>Расходы</h3>
              <button className="cms-modal-close" onClick={() => setShowExpenses(false)}>&times;</button>
            </div>
            <div className="cms-modal-body" style={{ maxHeight: "55vh", overflowY: "auto" }}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10, marginBottom: 16 }}>
                <div style={{ background: "rgba(34,197,94,0.08)", borderRadius: 8, padding: "10px 14px" }}>
                  <div style={{ fontSize: 11, color: "var(--cms-text-muted)" }}>Выручка</div>
                  <div style={{ fontWeight: 700, fontSize: 15 }}>{fmt(data?.totalRevenue ?? 0)}</div>
                </div>
                <div style={{ background: "rgba(239,68,68,0.08)", borderRadius: 8, padding: "10px 14px" }}>
                  <div style={{ fontSize: 11, color: "var(--cms-text-muted)" }}>Расходы</div>
                  <div style={{ fontWeight: 700, fontSize: 15 }}>{fmt(data?.totalExpenses ?? 0)}</div>
                </div>
                <div style={{ background: (data?.profit ?? 0) >= 0 ? "rgba(16,185,129,0.1)" : "rgba(239,68,68,0.1)", borderRadius: 8, padding: "10px 14px" }}>
                  <div style={{ fontSize: 11, color: "var(--cms-text-muted)" }}>Прибыль</div>
                  <div style={{ fontWeight: 700, fontSize: 15, color: (data?.profit ?? 0) >= 0 ? "#10b981" : "#ef4444" }}>{fmt(data?.profit ?? 0)}</div>
                </div>
              </div>
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
                        <td style={{ textAlign: "right", fontWeight: 600, color: "#ef4444" }}>−{fmt(exp.amount)}</td>
                        <td>
                          <button className="cms-btn cms-btn-xs cms-btn-danger" onClick={() => handleDeleteExpense(exp.id)} disabled={deletingExpenseId === exp.id}>×</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <div style={{ textAlign: "center", padding: 20, color: "var(--cms-text-muted)", fontSize: 13 }}>Расходов пока нет</div>
              )}
            </div>
            <div className="cms-modal-actions">
              <button className="cms-btn" onClick={() => setShowExpenses(false)}>Закрыть</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Export Modal ── */}
      {showExport && (
        <div className="cms-modal-overlay" onClick={() => setShowExport(false)}>
          <div className="cms-modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 420 }}>
            <div className="cms-modal-header">
              <h3>Экспорт отчёта</h3>
              <button className="cms-modal-close" onClick={() => setShowExport(false)}>&times;</button>
            </div>
            <div className="cms-modal-body">
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 16 }}>
                <label className="cms-label">С<input className="cms-input" type="date" value={exportFrom} onChange={(e) => setExportFrom(e.target.value)} /></label>
                <label className="cms-label">По<input className="cms-input" type="date" value={exportTo} onChange={(e) => setExportTo(e.target.value)} /></label>
              </div>
              <label className="cms-label">
                Формат
                <div style={{ display: "flex", gap: 10, marginTop: 8 }}>
                  {[{ v: "csv", l: "CSV" }, { v: "json", l: "JSON" }].map((f) => (
                    <label key={f.v} style={{ padding: "8px 16px", borderRadius: 8, border: `1px solid ${exportFormat === f.v ? "var(--cms-accent)" : "var(--cms-border)"}`, background: exportFormat === f.v ? "rgba(232,114,42,0.1)" : "transparent", cursor: "pointer", fontSize: 13 }}>
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
