"use client";

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { Area, AreaChart, CartesianGrid, XAxis, YAxis } from "recharts";
import { AdminPage } from "./AdminPage";
import {
  HeaderActions,
  Icon,
  IconButton,
  SegmentedControl,
  Toolbar,
  Tooltip,
  Button,
  Modal,
  PageLoading,
} from "@/components/admin";
import {
  ChartContainer,
  ChartTooltip,
  type ChartConfig,
} from "@/components/ui/chart";
import { adminFetch, clearAdminAuthToken, getAdminAuthToken } from "@/lib/admin-client";

interface Expense {
  id: string;
  amount: number;
  description: string;
  category: string;
  date: string;
}

interface CommerceMetrics {
  revenue: number;
  profit: number | null;
  margin: number | null;
  orders: number;
  aov: number;
  conversionRate: number;
  visitors: number;
  roas: number | null;
  cac: number | null;
  ltv: number | null;
  hasCogs: boolean;
  marketingSpend: number | null;
  expenses: number;
}

interface AnalyticsData {
  status: { enabled: boolean; firstEventAt: string | null; lastEventAt: string | null; hasFreshData: boolean };
  period: { value: string; from: string; to: string };
  commerce: CommerceMetrics;
  seo: { score: number; checks: number; passed: number };
  chart: Array<{ date: string; views: number; visitors: number; orders: number; revenue: number }>;
  pages: Array<{ path: string; title: string; views: number; visitors: number; avgDuration: number }>;
  sources: Array<{ label: string; count: number; percentage: number }>;
  realtime: { onlineNow: number };
}

interface ServerStats {
  cpu: { usage: number; cores: number };
  memory: { total: string; used: string; free: string; usage: number };
  system: { platform: string; uptime: string; nodeVersion: string; hostname: string };
  disk?: { total: string; used: string; free: string; usage: number };
  dbConnected?: boolean;
}

type PeriodKey = "1" | "3" | "7" | "30" | "365" | "custom";

const PERIOD_STORAGE_KEY = "admin_analytics_period_v1";
const PERIOD_OPTIONS: Array<{ value: PeriodKey; label: string; title: string }> = [
  { value: "1", label: "1 день", title: "1 день" },
  { value: "3", label: "3 дня", title: "3 дня" },
  { value: "7", label: "Неделя", title: "Неделя" },
  { value: "30", label: "Месяц", title: "Месяц" },
  { value: "365", label: "Год", title: "Год" },
  { value: "custom", label: "Указать", title: "Указать период" },
];

type ChartMetric = "revenue" | "orders" | "visitors";
const CHART_METRIC_OPTIONS: Array<{ value: ChartMetric; label: string; title: string }> = [
  { value: "revenue", label: "Выручка", title: "Выручка" },
  { value: "orders", label: "Заказы", title: "Заказы" },
  { value: "visitors", label: "Посетители", title: "Посетители" },
];

const CHART_CONFIG: ChartConfig = {
  revenue: { label: "Выручка", color: "var(--cms-accent)" },
  orders: { label: "Заказы", color: "var(--cms-accent)" },
  visitors: { label: "Посетители", color: "var(--cms-accent)" },
};

/** Spec colour stops — interpolated for smooth transitions. */
const LOAD_STOPS: Array<[number, [number, number, number]]> = [
  [0, [0x3c, 0xf7, 0x39]],
  [10, [0x3c, 0xf7, 0x39]],
  [30, [0x29, 0xcc, 0x25]],
  [60, [0xf7, 0xf5, 0x39]],
  [70, [0xff, 0xd6, 0x33]],
  [90, [0xff, 0x24, 0x24]],
  [100, [0xd1, 0x00, 0x00]],
];

function fmt(n: number) {
  return new Intl.NumberFormat("ru-RU", { style: "currency", currency: "RUB", maximumFractionDigits: 0 }).format(n);
}

function fmtNum(n: number) {
  return new Intl.NumberFormat("ru-RU").format(n);
}

function loadBarColor(pct: number): string {
  const p = Math.min(100, Math.max(0, pct));
  for (let i = 1; i < LOAD_STOPS.length; i++) {
    const [p1, c1] = LOAD_STOPS[i];
    const [p0, c0] = LOAD_STOPS[i - 1];
    if (p <= p1) {
      const t = p1 === p0 ? 1 : (p - p0) / (p1 - p0);
      const c = c0.map((v, k) => Math.round(v + (c1[k] - v) * t));
      return `rgb(${c[0]}, ${c[1]}, ${c[2]})`;
    }
  }
  return "rgb(209, 0, 0)";
}

function statusTitle(pct: number): string {
  if (pct < 10) return "Все отлично";
  if (pct < 30) return "Все хорошо";
  if (pct < 60) return "Стабильно";
  if (pct < 70) return "Пока держимся";
  if (pct < 90) return "Загружен";
  return "Перегружен";
}

function LoadBar({ label, pct, detail }: { label: string; pct: number; detail?: string }) {
  const color = loadBarColor(pct);
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 8, fontSize: 12 }}>
        <span style={{ color: "var(--cms-text-muted)", fontWeight: 600 }}>{label}</span>
        <span style={{ color, fontWeight: 700, transition: "color 700ms ease" }}>
          {Math.round(pct)}%{detail ? ` · ${detail}` : ""}
        </span>
      </div>
      <div style={{ height: 6, borderRadius: 999, background: "var(--cms-border)", overflow: "hidden" }}>
        <div
          style={{
            width: `${Math.min(100, Math.max(0, pct))}%`,
            height: "100%",
            background: color,
            borderRadius: 999,
            transition: "width 700ms ease, background-color 700ms ease",
          }}
        />
      </div>
    </div>
  );
}

function StatusPulseIcon({ color }: { color: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="22"
      height="22"
      viewBox="0 0 24 24"
      aria-hidden="true"
      style={{ color, display: "block", transition: "color 700ms ease" }}
    >
      <g fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path
          className="cms-status-pulse-path"
          d="M3.00012 12H7.34073C7.74075 12 8.10229 12.2384 8.25987 12.6061L10.8436 18.6348C10.9386 18.8563 11.1564 19 11.3975 19C11.7303 19 12.0001 18.7302 12.0001 18.3974V5.60262C12.0001 5.2698 12.2699 5 12.6027 5C12.8438 5 13.0617 5.14367 13.1566 5.36526L15.74 11.3939C15.8976 11.7616 16.2591 12 16.6592 12H20.9998"
        />
      </g>
    </svg>
  );
}

function MetricCard({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="cms-stat-card cms-analytics-metric">
      <div className="cms-analytics-metric-label">{label}</div>
      <div className="cms-analytics-metric-value">{value}</div>
      {sub && <div className="cms-analytics-metric-sub">{sub}</div>}
    </div>
  );
}

function formatChartDate(iso: string): string {
  if (iso.length >= 10) {
    return `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}`;
  }
  return iso;
}

function formatAxisDate(iso: string): string {
  if (iso.length >= 10) return `${iso.slice(8, 10)}.${iso.slice(5, 7)}`;
  return iso;
}

function DynamicsTooltip({
  active,
  payload,
  metric,
  coordinate,
  viewBox,
}: {
  active?: boolean;
  payload?: Array<{ value?: number | string; payload?: { date?: string } }>;
  metric: ChartMetric;
  coordinate?: { x?: number; y?: number };
  viewBox?: { x?: number; y?: number; width?: number; height?: number };
}) {
  if (!active || !payload?.length || typeof document === "undefined") return null;
  const raw = Number(payload[0]?.value ?? 0);
  const value = metric === "revenue" ? fmt(raw) : fmtNum(raw);
  const date = formatChartDate(String(payload[0]?.payload?.date || ""));

  // Recharts gives chart-local coordinates; lift into a body portal so the tip is a free popup.
  const chartEl = document.querySelector(".cms-analytics-chart") as HTMLElement | null;
  const rect = chartEl?.getBoundingClientRect();
  const left = (rect?.left ?? 0) + (coordinate?.x ?? viewBox?.x ?? 0) + 12;
  const top = (rect?.top ?? 0) + (coordinate?.y ?? viewBox?.y ?? 0) - 12;

  return createPortal(
    <div
      className="cms-analytics-chart-tooltip cms-analytics-chart-tooltip-portal"
      style={{ left: Math.max(8, left), top: Math.max(8, top - 8) }}
    >
      <div className="cms-analytics-chart-tooltip-date">{date}</div>
      <div className="cms-analytics-chart-tooltip-value">{value}</div>
    </div>,
    document.body,
  );
}

function DynamicsChart({
  data,
  metric,
}: {
  data: AnalyticsData["chart"];
  metric: ChartMetric;
}) {
  const rows = useMemo(() => {
    const source = data?.length
      ? data
      : [
          { date: new Date().toISOString().slice(0, 10), views: 0, visitors: 0, orders: 0, revenue: 0 },
          {
            date: new Date(Date.now() - 86400000).toISOString().slice(0, 10),
            views: 0,
            visitors: 0,
            orders: 0,
            revenue: 0,
          },
        ].reverse();
    return source.map((d) => ({
      ...d,
      label: formatAxisDate(d.date),
    }));
  }, [data]);

  return (
    <ChartContainer config={CHART_CONFIG} variant="default" className="cms-analytics-chart h-[132px] w-full aspect-auto">
      <AreaChart data={rows} margin={{ left: 0, right: 4, top: 6, bottom: 0 }}>
        <defs>
          <linearGradient id="analytics-area" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={`var(--color-${metric})`} stopOpacity={0.38} />
            <stop offset="100%" stopColor={`var(--color-${metric})`} stopOpacity={0.02} />
          </linearGradient>
        </defs>
        <CartesianGrid vertical={false} strokeOpacity={0.08} />
        <XAxis dataKey="label" tickLine={false} axisLine={false} tickMargin={6} minTickGap={28} />
        <YAxis tickLine={false} axisLine={false} width={40} allowDecimals={false} />
        <ChartTooltip
          cursor={{ stroke: "var(--cms-accent)", strokeOpacity: 0.35 }}
          content={<DynamicsTooltip metric={metric} />}
          allowEscapeViewBox={{ x: true, y: true }}
          wrapperStyle={{ outline: "none", zIndex: 1200, pointerEvents: "none", overflow: "visible" }}
          offset={14}
        />
        <Area
          dataKey={metric}
          type="monotone"
          stroke={`var(--color-${metric})`}
          strokeWidth={2.2}
          fill="url(#analytics-area)"
          isAnimationActive
          animationDuration={650}
        />
      </AreaChart>
    </ChartContainer>
  );
}

export default function AdminAnalyticsPage() {
  const router = useRouter();
  const [analytics, setAnalytics] = useState<AnalyticsData | null>(null);
  const [serverStats, setServerStats] = useState<ServerStats | null>(null);
  const [siteOnline, setSiteOnline] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [period, setPeriod] = useState<PeriodKey>("30");
  const [chartMetric, setChartMetric] = useState<ChartMetric>("revenue");
  const [customFrom, setCustomFrom] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 30);
    return d.toISOString().slice(0, 10);
  });
  const [customTo, setCustomTo] = useState(() => new Date().toISOString().slice(0, 10));
  const [showExpenses, setShowExpenses] = useState(false);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [expenseForm, setExpenseForm] = useState({
    amount: "",
    description: "",
    category: "other",
    date: new Date().toISOString().slice(0, 10),
  });
  const [savingExpense, setSavingExpense] = useState(false);
  const mountedRef = useRef(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(PERIOD_STORAGE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw) as { period?: PeriodKey; from?: string; to?: string };
      if (parsed.period && PERIOD_OPTIONS.some((o) => o.value === parsed.period)) {
        setPeriod(parsed.period);
      }
      if (parsed.from) setCustomFrom(parsed.from);
      if (parsed.to) setCustomTo(parsed.to);
    } catch { /* ignore */ }
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(PERIOD_STORAGE_KEY, JSON.stringify({ period, from: customFrom, to: customTo }));
    } catch { /* ignore */ }
  }, [period, customFrom, customTo]);

  const fetchAll = useCallback(async (isRefresh = false) => {
    const token = getAdminAuthToken();
    if (!token) {
      clearAdminAuthToken();
      router.push("/admin/login");
      return;
    }
    if (isRefresh) setRefreshing(true);
    try {
      const qs =
        period === "custom"
          ? `period=custom&from=${encodeURIComponent(customFrom)}&to=${encodeURIComponent(customTo)}`
          : `period=${period}`;
      const [aRes, sRes, statusRes] = await Promise.all([
        adminFetch(`/api/admin/analytics?${qs}`),
        adminFetch("/api/admin/server-stats"),
        fetch("/api/admin/public-status", { cache: "no-store" }).catch(() => null),
      ]);
      if (aRes.status === 401) {
        clearAdminAuthToken();
        router.push("/admin/login");
        return;
      }
      if (aRes.ok) {
        const json = await aRes.json();
        if (json && !json.error) setAnalytics(json);
      }
      if (sRes.ok) {
        const json = await sRes.json();
        if (json && !json.error) setServerStats(json);
      }
      if (statusRes) setSiteOnline(statusRes.ok);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [router, period, customFrom, customTo]);

  useEffect(() => {
    if (!mountedRef.current) {
      mountedRef.current = true;
      fetchAll();
      return;
    }
    fetchAll();
  }, [fetchAll]);

  const fetchExpenses = useCallback(async () => {
    const res = await adminFetch("/api/admin/expenses");
    if (res.ok) {
      const d = await res.json();
      setExpenses(d.expenses || []);
    }
  }, []);

  const handleAddExpense = async () => {
    if (!expenseForm.amount || !expenseForm.description) return;
    setSavingExpense(true);
    await adminFetch("/api/admin/expenses", {
      method: "POST",
      body: JSON.stringify({
        amount: Number(expenseForm.amount),
        description: expenseForm.description,
        category: expenseForm.category,
        date: expenseForm.date,
      }),
    });
    setExpenseForm({ amount: "", description: "", category: "other", date: new Date().toISOString().slice(0, 10) });
    setSavingExpense(false);
    await fetchExpenses();
    await fetchAll(true);
  };

  const handleDeleteExpense = async (id: string) => {
    await adminFetch(`/api/admin/expenses?id=${id}`, { method: "DELETE" });
    await fetchExpenses();
    await fetchAll(true);
  };

  const exportXls = () => {
    const qs =
      period === "custom"
        ? `type=orders&format=xls&from=${encodeURIComponent(customFrom)}&to=${encodeURIComponent(customTo)}`
        : `type=orders&format=xls&period=${period}`;
    window.location.href = `/api/admin/export?${qs}`;
  };

  const commerce = analytics?.commerce;
  const cpu = serverStats?.cpu.usage ?? 0;
  const mem = serverStats?.memory.usage ?? 0;
  const disk = serverStats?.disk?.usage ?? 0;
  // Оценка по текущему состоянию сервера (без SEO).
  const currentLoad = siteOnline === false ? 100 : Math.max(cpu, mem, disk);
  const statusColor = loadBarColor(currentLoad);
  const statusTip = siteOnline === false ? "Перегружен" : statusTitle(currentLoad);

  if (loading && !analytics) {
    return <PageLoading />;
  }

  return (
    <AdminPage
      title="Аналитика"
      actions={
        <HeaderActions>
          <IconButton icon="export" label="Экспорт" shape="plain" onClick={exportXls} />
          <IconButton icon="refresh" label="Обновить" shape="plain" onClick={() => fetchAll(true)} disabled={refreshing} />
          <IconButton icon="go" label="Перейти на сайт" shape="plain" onClick={() => window.open("https://errani.ru", "_blank")} />
        </HeaderActions>
      }
    >
      <Toolbar>
        <SegmentedControl
          size="sm"
          options={PERIOD_OPTIONS}
          value={period}
          onChange={(v) => setPeriod(v as PeriodKey)}
          ariaLabel="Период"
        />
        {period === "custom" && (
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <input type="date" className="cms-input" value={customFrom} onChange={(e) => setCustomFrom(e.target.value)} style={{ width: 150 }} />
            <span style={{ color: "var(--cms-text-muted)", fontSize: 12 }}>—</span>
            <input type="date" className="cms-input" value={customTo} onChange={(e) => setCustomTo(e.target.value)} style={{ width: 150 }} />
          </div>
        )}
      </Toolbar>

      <div className="cms-section-stack" style={{ gap: 14 }}>
        <div className="cms-stats-grid cms-dashboard-metrics">
          <div className="cms-stat-card cms-analytics-metric cms-analytics-finance">
            <div className="cms-analytics-finance-top">
              <div className="cms-analytics-metric-label">Выручка</div>
              <Button
                variant="ghost"
                size="sm"
                icon="add"
                onClick={() => { setShowExpenses(true); fetchExpenses(); }}
              >
                Расходы
              </Button>
            </div>
            <div className="cms-analytics-metric-value">{fmt(commerce?.revenue ?? 0)}</div>
            <div className="cms-analytics-finance-profit">
              <span className="cms-analytics-metric-label">Прибыль</span>
              <span className="cms-analytics-finance-profit-value">
                {commerce?.profit != null ? fmt(commerce.profit) : "—"}
                {commerce?.margin != null ? ` · ${commerce.margin}%` : ""}
              </span>
            </div>
          </div>
          <MetricCard label="Заказы" value={fmtNum(commerce?.orders ?? 0)} />
          <MetricCard label="Средний чек" value={fmt(commerce?.aov ?? 0)} />
          <MetricCard label="Конверсия" value={`${commerce?.conversionRate ?? 0}%`} />
          <MetricCard label="Посетители" value={fmtNum(commerce?.visitors ?? 0)} />
          {commerce?.roas != null && <MetricCard label="ROAS" value={`${commerce.roas}x`} />}
          {commerce?.cac != null && <MetricCard label="CAC" value={fmt(commerce.cac)} />}
          {commerce?.ltv != null && <MetricCard label="LTV" value={fmt(commerce.ltv)} />}
        </div>

        <div className="cms-analytics-split">
          <div className="cms-card cms-analytics-panel cms-analytics-dynamics">
            <div className="cms-analytics-panel-head">
              <div className="cms-analytics-panel-title">
                <Icon name="chatArrowGrow" size={15} />
                <span>Динамика за период</span>
              </div>
              <SegmentedControl
                size="sm"
                options={CHART_METRIC_OPTIONS}
                value={chartMetric}
                onChange={(v) => setChartMetric(v as ChartMetric)}
                ariaLabel="Метрика графика"
              />
            </div>
            <DynamicsChart data={analytics?.chart || []} metric={chartMetric} />
          </div>

          <div className="cms-card cms-analytics-panel cms-analytics-status">
            <div className="cms-analytics-panel-head">
              <div className="cms-analytics-panel-title">
                <Tooltip content={statusTip}>
                  <span
                    className="cms-status-pulse"
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      justifyContent: "center",
                      cursor: "default",
                      filter: `drop-shadow(0 0 6px ${statusColor}55)`,
                      transition: "filter 700ms ease",
                    }}
                  >
                    <StatusPulseIcon color={statusColor} />
                  </span>
                </Tooltip>
                <span>Статус</span>
              </div>
            </div>
            <div style={{ display: "grid", gap: 12 }}>
              <LoadBar label="ЦП" pct={cpu} detail={serverStats ? `${serverStats.cpu.cores} ядер` : undefined} />
              <LoadBar label="ОЗУ" pct={mem} detail={serverStats?.memory.used} />
              <LoadBar label="Диск" pct={disk} detail={serverStats?.disk?.used} />
            </div>
          </div>
        </div>

        <div className="cms-analytics-split cms-analytics-split-equal">
          <div className="cms-card cms-analytics-panel" style={{ padding: 16 }}>
            <div className="cms-analytics-panel-title" style={{ marginBottom: 10 }}>
              <Icon name="browser" size={15} />
              <span>Топ страниц</span>
            </div>
            {(analytics?.pages || []).slice(0, 8).map((p) => (
              <div key={p.path} className="cms-analytics-row">
                <span className="cms-analytics-row-label">{p.title || p.path}</span>
                <span className="cms-analytics-row-value">{p.views}</span>
              </div>
            ))}
            {!analytics?.pages?.length && <div style={{ color: "var(--cms-text-muted)", fontSize: 12 }}>Нет данных</div>}
          </div>
          <div className="cms-card cms-analytics-panel" style={{ padding: 16 }}>
            <div className="cms-analytics-panel-title" style={{ marginBottom: 10 }}>
              <Icon name="list" size={15} />
              <span>Источники</span>
            </div>
            {(analytics?.sources || []).slice(0, 8).map((s) => (
              <div key={s.label} className="cms-analytics-row">
                <span className="cms-analytics-row-label">{s.label}</span>
                <span className="cms-analytics-row-value">{s.percentage}%</span>
              </div>
            ))}
            {!analytics?.sources?.length && <div style={{ color: "var(--cms-text-muted)", fontSize: 12 }}>Нет данных</div>}
          </div>
        </div>
      </div>

      <Modal open={showExpenses} onClose={() => setShowExpenses(false)} title="Расходы" width={560}>
        <div className="cms-section-stack" style={{ gap: 12 }}>
          <div className="cms-analytics-expense-form">
            <input className="cms-input" type="number" placeholder="Сумма" value={expenseForm.amount} onChange={(e) => setExpenseForm((f) => ({ ...f, amount: e.target.value }))} />
            <input className="cms-input" type="date" value={expenseForm.date} onChange={(e) => setExpenseForm((f) => ({ ...f, date: e.target.value }))} />
            <input className="cms-input cms-analytics-expense-desc" placeholder="Описание" value={expenseForm.description} onChange={(e) => setExpenseForm((f) => ({ ...f, description: e.target.value }))} />
            <select className="cms-select" value={expenseForm.category} onChange={(e) => setExpenseForm((f) => ({ ...f, category: e.target.value }))}>
              <option value="other">Другое</option>
              <option value="shipping">Доставка</option>
              <option value="packaging">Упаковка</option>
              <option value="marketing">Маркетинг</option>
            </select>
            <Button variant="primary" icon="add" onClick={handleAddExpense} disabled={savingExpense}>
              Добавить
            </Button>
          </div>
          <div style={{ maxHeight: 280, overflowY: "auto" }}>
            {expenses.map((exp) => (
              <div key={exp.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, padding: "8px 0", borderBottom: "1px solid var(--cms-border)", fontSize: 12 }}>
                <div>
                  <div style={{ fontWeight: 600 }}>{exp.description}</div>
                  <div style={{ color: "var(--cms-text-muted)" }}>{exp.date} · {exp.category}</div>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ fontWeight: 700 }}>{fmt(exp.amount)}</span>
                  <IconButton icon="delete" label="Удалить" shape="square" tone="danger" onClick={() => handleDeleteExpense(exp.id)} />
                </div>
              </div>
            ))}
            {!expenses.length && <div style={{ color: "var(--cms-text-muted)", fontSize: 12 }}>Расходов пока нет</div>}
          </div>
        </div>
      </Modal>
    </AdminPage>
  );
}
