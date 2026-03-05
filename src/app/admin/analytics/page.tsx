"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { AdminSidebar } from "../AdminSidebar";

interface ChartDay { date: string; views: number; visitors: number; orders: number; revenue: number; }

interface AnalyticsData {
  realtime: { onlineNow: number };
  today: { views: number; visitors: number; orders: number; avgDuration: number };
  chart: ChartDay[];
  topPages: Array<{ path: string; views: number }>;
  countries: Array<{ country: string; count: number }>;
  languages: Array<{ lang: string; count: number }>;
  referrers: Array<{ referrer: string; count: number }>;
  totals: { views: number; orders: number; revenue: number; products: number };
}

const COUNTRY_NAMES: Record<string, string> = {
  RU: "Россия", US: "США", DE: "Германия", FR: "Франция", IT: "Италия",
  ES: "Испания", TR: "Турция", CN: "Китай", GB: "Великобритания", KZ: "Казахстан",
  BY: "Беларусь", UA: "Украина", AE: "ОАЭ", SA: "Саудовская Аравия",
};

const LANG_NAMES: Record<string, string> = {
  ru: "Русский", en: "Английский", it: "Итальянский", es: "Испанский",
  fr: "Французский", de: "Немецкий", tr: "Турецкий", ar: "Арабский", zh: "Китайский",
};

function BarChart({ data, valueKey, color = "var(--cms-accent)" }: {
  data: Record<string, string | number>[]; valueKey: string; color?: string;
}) {
  const max = Math.max(...data.map((d) => Number(d[valueKey]) || 0), 1);
  return (
    <div style={{ display: "flex", alignItems: "flex-end", gap: "2px", height: "140px", padding: "8px 0" }}>
      {data.map((d, i) => {
        const val = Number(d[valueKey]) || 0;
        const pct = (val / max) * 100;
        return (
          <div key={i} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", height: "100%", justifyContent: "flex-end" }}
            title={`${d.date}: ${val}`}>
            <div style={{ width: "100%", minWidth: "3px", height: `${Math.max(pct, 2)}%`, background: color, borderRadius: "3px 3px 0 0", transition: "height 0.3s" }} />
          </div>
        );
      })}
    </div>
  );
}

function StatCard({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
  return (
    <div className="cms-stat-card">
      <div className="cms-stat-label">{label}</div>
      <div className="cms-stat-value">{value}</div>
      {sub && <div style={{ fontSize: "11px", color: "var(--cms-text-muted)", marginTop: "2px" }}>{sub}</div>}
    </div>
  );
}

export default function AdminAnalytics() {
  const router = useRouter();
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [chartMode, setChartMode] = useState<"views" | "visitors" | "orders">("views");
  const [showExport, setShowExport] = useState(false);
  const [exportFrom, setExportFrom] = useState(() => { const d = new Date(); d.setDate(d.getDate() - 30); return d.toISOString().slice(0, 10); });
  const [exportTo, setExportTo] = useState(() => new Date().toISOString().slice(0, 10));
  const [exportFormat, setExportFormat] = useState("csv");

  const getToken = useCallback(() => localStorage.getItem("admin_token"), []);

  const fetchData = useCallback(() => {
    const token = getToken();
    if (!token) { router.push("/admin/login"); return; }
    fetch("/api/admin/analytics", { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => { if (r.status === 401) { localStorage.removeItem("admin_token"); router.push("/admin/login"); return null; } return r.json(); })
      .then((d) => { if (d && !d.error) setData(d); else setError(d?.error || "Error"); setLoading(false); })
      .catch((e) => { setError(e.message); setLoading(false); });
  }, [getToken, router]);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 30000);
    return () => clearInterval(interval);
  }, [fetchData]);

  const formatPrice = (n: number) =>
    new Intl.NumberFormat("ru-RU", { style: "currency", currency: "RUB", minimumFractionDigits: 0 }).format(n);

  const formatDuration = (s: number) => s < 60 ? `${s}s` : `${Math.floor(s / 60)}m ${s % 60}s`;

  const handleExport = () => {
    if (!data) return;
    const fromDate = new Date(exportFrom);
    const toDate = new Date(exportTo);
    const chartFiltered = data.chart.filter((d) => {
      const dd = new Date(d.date);
      return dd >= fromDate && dd <= toDate;
    });

    if (exportFormat === "csv") {
      const header = "Date,Views,Visitors,Orders,Revenue";
      const rows = chartFiltered.map((d) => `${d.date},${d.views},${d.visitors},${d.orders},${d.revenue}`);
      const csv = [header, ...rows].join("\n");
      downloadFile(csv, "analytics-report.csv", "text/csv");
    } else {
      const report = {
        period: { from: exportFrom, to: exportTo },
        summary: data.totals,
        today: data.today,
        dailyData: chartFiltered,
        topPages: data.topPages,
        countries: data.countries,
        languages: data.languages,
        referrers: data.referrers,
      };
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

  if (loading) return <div className="cms-loading"><div className="cms-spinner" /> Загрузка аналитики...</div>;

  const chartColors: Record<string, string> = { views: "var(--cms-accent)", visitors: "#22c55e", orders: "#3b82f6" };

  return (
    <div className="cms-root">
      <AdminSidebar />
      <main className="cms-main">
        <div className="cms-header">
          <h1 className="cms-header-title">
            Аналитика
            {data?.realtime.onlineNow ? (
              <span style={{ marginLeft: 12, fontSize: "13px", color: "#22c55e", fontWeight: 400 }}>
                \u25cf {data.realtime.onlineNow} сейчас на сайте
              </span>
            ) : null}
          </h1>
          <div className="cms-header-actions">
            <button className="cms-btn cms-btn-sm" onClick={() => setShowExport(true)}>Экспорт отчёта</button>
            <button className="cms-btn cms-btn-sm cms-btn-ghost" onClick={fetchData}>Обновить</button>
          </div>
        </div>

        <div className="cms-content">
          {error && <div style={{ background: "rgba(239,68,68,0.1)", border: "1px solid var(--cms-danger)", padding: "10px 14px", borderRadius: "8px", fontSize: "13px", color: "var(--cms-danger)", marginBottom: "16px" }}>{error}</div>}

          {data && (
            <>
              {/* Stat Cards */}
              <div className="cms-stat-grid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))" }}>
                <StatCard label="Онлайн" value={data.realtime.onlineNow} sub="за 5 мин" />
                <StatCard label="Просмотры сегодня" value={data.today.views} />
                <StatCard label="Посетители сегодня" value={data.today.visitors} />
                <StatCard label="Заказы сегодня" value={data.today.orders} />
                <StatCard label="Ср. длительность" value={formatDuration(data.today.avgDuration)} />
                <StatCard label="Общий доход" value={formatPrice(data.totals.revenue)} sub={`${data.totals.orders} заказов`} />
              </div>

              {/* Chart */}
              <div className="cms-table-wrap" style={{ padding: "16px 20px", marginTop: "20px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "10px" }}>
                  <span style={{ fontWeight: 700, fontSize: "14px" }}>Тренд за 30 дней</span>
                  <div className="cms-tabs">
                    {(["views", "visitors", "orders"] as const).map((m) => (
                      <button key={m} className={`cms-tab ${chartMode === m ? "active" : ""}`} onClick={() => setChartMode(m)}>
                        {m === "views" ? "Просмотры" : m === "visitors" ? "Посетители" : "Заказы"}
                      </button>
                    ))}
                  </div>
                </div>
                <BarChart data={data.chart as unknown as Record<string, string | number>[]} valueKey={chartMode} color={chartColors[chartMode]} />
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: "11px", color: "var(--cms-text-muted)", marginTop: "4px" }}>
                  <span>{data.chart[0]?.date?.slice(5)}</span>
                  <span>{data.chart[data.chart.length - 1]?.date?.slice(5)}</span>
                </div>
              </div>

              {/* Two-column: Top Pages + Countries */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px", marginTop: "20px" }}>
                <div className="cms-table-wrap">
                  <div style={{ padding: "12px 16px", borderBottom: "1px solid var(--cms-border)", fontWeight: 700, fontSize: "14px" }}>Популярные страницы</div>
                  <table className="cms-table"><thead><tr><th>Страница</th><th>Просмотры</th></tr></thead><tbody>
                    {data.topPages.map((p, i) => <tr key={i}><td>{p.path}</td><td>{p.views}</td></tr>)}
                    {!data.topPages.length && <tr><td colSpan={2} style={{ textAlign: "center", padding: "20px", color: "var(--cms-text-muted)" }}>Нет данных</td></tr>}
                  </tbody></table>
                </div>
                <div className="cms-table-wrap">
                  <div style={{ padding: "12px 16px", borderBottom: "1px solid var(--cms-border)", fontWeight: 700, fontSize: "14px" }}>Страны</div>
                  <table className="cms-table"><thead><tr><th>Страна</th><th>Визиты</th></tr></thead><tbody>
                    {data.countries.map((c, i) => <tr key={i}><td>{COUNTRY_NAMES[c.country] || c.country}</td><td>{c.count}</td></tr>)}
                    {!data.countries.length && <tr><td colSpan={2} style={{ textAlign: "center", padding: "20px", color: "var(--cms-text-muted)" }}>Нет данных</td></tr>}
                  </tbody></table>
                </div>
              </div>

              {/* Two-column: Languages + Referrers */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px", marginTop: "16px" }}>
                <div className="cms-table-wrap">
                  <div style={{ padding: "12px 16px", borderBottom: "1px solid var(--cms-border)", fontWeight: 700, fontSize: "14px" }}>Языки</div>
                  <table className="cms-table"><thead><tr><th>Язык</th><th>Визиты</th></tr></thead><tbody>
                    {data.languages.map((l, i) => <tr key={i}><td>{LANG_NAMES[l.lang] || l.lang}</td><td>{l.count}</td></tr>)}
                    {!data.languages.length && <tr><td colSpan={2} style={{ textAlign: "center", padding: "20px", color: "var(--cms-text-muted)" }}>Нет данных</td></tr>}
                  </tbody></table>
                </div>
                <div className="cms-table-wrap">
                  <div style={{ padding: "12px 16px", borderBottom: "1px solid var(--cms-border)", fontWeight: 700, fontSize: "14px" }}>Источники трафика</div>
                  <table className="cms-table"><thead><tr><th>Источник</th><th>Визиты</th></tr></thead><tbody>
                    {data.referrers.map((r, i) => {
                      let host = r.referrer;
                      try { host = new URL(r.referrer).hostname; } catch {}
                      return <tr key={i}><td>{host}</td><td>{r.count}</td></tr>;
                    })}
                    {!data.referrers.length && <tr><td colSpan={2} style={{ textAlign: "center", padding: "20px", color: "var(--cms-text-muted)" }}>Нет данных</td></tr>}
                  </tbody></table>
                </div>
              </div>

              {/* System Status */}
              <div className="cms-table-wrap" style={{ padding: "16px 20px", marginTop: "16px" }}>
                <div style={{ fontWeight: 700, fontSize: "14px", marginBottom: "10px" }}>Статус системы</div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "8px", fontSize: "13px" }}>
                  <div><strong>Статус:</strong> <span style={{ color: "#22c55e" }}>\u25cf Онлайн</span></div>
                  <div><strong>Товары:</strong> {data.totals.products}</div>
                  <div><strong>Всего просмотров:</strong> {data.totals.views}</div>
                  <div><strong>Всего заказов:</strong> {data.totals.orders}</div>
                  <div><strong>Авто-обновление:</strong> 30с</div>
                  <div><strong>Платформа:</strong> Next.js + Prisma</div>
                </div>
              </div>
            </>
          )}
        </div>
      </main>

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
    </div>
  );
}
