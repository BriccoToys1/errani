"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { AdminSidebar } from "../AdminSidebar";

type Tab = "content" | "pages" | "files" | "database" | "server" | "seo";

interface ServerStats {
  cpu: { usage: number; cores: number };
  memory: { total: string; used: string; free: string; usage: number; process: { heapUsed: string; heapTotal: string; rss: string } };
  system: { platform: string; uptime: string; nodeVersion: string; hostname: string };
  loadAverage: { '1m': number; '5m': number; '15m': number };
  disk?: { total: string; used: string; free: string; usage: number };
  dbConnected?: boolean;
}

interface ContentSection { key: string; label: string; }
interface FileItem { name: string; isDirectory: boolean; size?: number; modified?: string; }

const CONTENT_SECTIONS: ContentSection[] = [
  { key: "hero", label: "Главная (Hero)" },
  { key: "about", label: "О бренде" },
  { key: "privacy_policy", label: "Политика конфиденциальности" },
  { key: "public_offer", label: "Публичная оферта" },
  { key: "shipping", label: "Доставка" },
  { key: "payment", label: "Оплата" },
];

const TABS: { key: Tab; label: string }[] = [
  { key: "content", label: "Контент" },
  { key: "pages", label: "Страницы" },
  { key: "files", label: "Файлы" },
  { key: "database", label: "База данных" },
  { key: "server", label: "Сервер" },
  { key: "seo", label: "SEO" },
];

export default function TechnicalPage() {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>("content");
  const [refreshing, setRefreshing] = useState(false);

  const getToken = useCallback(() => {
    const t = localStorage.getItem("admin_token");
    if (!t) router.push("/admin/login");
    return t;
  }, [router]);

  const handleRefresh = () => {
    setRefreshing(true);
    setTimeout(() => setRefreshing(false), 600);
  };

  return (
    <div className="cms-root">
      <AdminSidebar />
      <main className="cms-main">
        <div className="cms-header">
          <div>
            <h1 className="cms-header-title" style={{ display: "flex", alignItems: "center", gap: "10px" }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/><line x1="14" y1="4" x2="10" y2="20"/></svg>
              Техническое
            </h1>
          </div>
          <div className="cms-header-actions">
            <button className={`cms-refresh-btn ${refreshing ? 'spinning' : ''}`} onClick={handleRefresh} title="Обновить">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M23 4v6h-6M1 20v-6h6"/><path d="M3.51 9a9 9 0 0114.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0020.49 15"/>
              </svg>
            </button>
          </div>
        </div>

        <div className="cms-content cms-fade-in">
          {/* Tabs */}
          <div className="cms-tabs" style={{ marginBottom: "16px" }}>
            {TABS.map((t) => (
              <button key={t.key} className={`cms-tab ${tab === t.key ? "active" : ""}`} onClick={() => setTab(t.key)}>
                {t.label}
              </button>
            ))}
          </div>

          {/* Tab Content */}
          {tab === "content" && <ContentTab getToken={getToken} key={refreshing ? "r" : "n"} />}
          {tab === "pages" && <PagesTab getToken={getToken} key={refreshing ? "r" : "n"} />}
          {tab === "files" && <FilesTab getToken={getToken} key={refreshing ? "r" : "n"} />}
          {tab === "database" && <DatabaseTab getToken={getToken} key={refreshing ? "r" : "n"} />}
          {tab === "server" && <ServerTab getToken={getToken} key={refreshing ? "r" : "n"} />}
          {tab === "seo" && <SeoTab getToken={getToken} key={refreshing ? "r" : "n"} />}

          {/* Terminal Section (always visible) */}
          <div style={{ marginTop: "24px" }}>
            <TerminalSection getToken={getToken} />
          </div>
        </div>
      </main>
    </div>
  );
}

// ─── Content Tab ──────────────────────────────────────────────
function ContentTab({ getToken }: { getToken: () => string | null }) {
  const [contents, setContents] = useState<Record<string, unknown>>({});
  const [editing, setEditing] = useState<string | null>(null);
  const [editData, setEditData] = useState<Record<string, string>>({});
  const [lang, setLang] = useState("ru");
  const [toast, setToast] = useState("");

  useEffect(() => {
    const token = getToken();
    if (!token) return;
    CONTENT_SECTIONS.forEach(async (s) => {
      try {
        const res = await fetch(`/api/content/${s.key}`);
        if (res.ok) {
          const data = await res.json();
          setContents(prev => ({ ...prev, [s.key]: data }));
        }
      } catch { /* ignore */ }
    });
  }, [getToken]);

  const flattenObj = (obj: Record<string, unknown>, prefix = ""): Record<string, string> => {
    const result: Record<string, string> = {};
    for (const [k, v] of Object.entries(obj)) {
      const key = prefix ? `${prefix}.${k}` : k;
      if (v && typeof v === "object" && !Array.isArray(v)) {
        Object.assign(result, flattenObj(v as Record<string, unknown>, key));
      } else {
        result[key] = String(v ?? "");
      }
    }
    return result;
  };

  const openEdit = (key: string) => {
    const raw = contents[key];
    if (!raw) return;
    const data = (raw as Record<string, unknown>)?.[lang] ?? raw;
    setEditData(typeof data === "object" ? flattenObj(data as Record<string, unknown>) : { value: String(data) });
    setEditing(key);
  };

  const handleSave = async () => {
    if (!editing) return;
    const token = getToken();
    if (!token) return;
    const raw = contents[editing] || {};
    const updatedContent = { ...(raw as Record<string, unknown>), [lang]: editData };
    const res = await fetch(`/api/content/${editing}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ value: updatedContent }),
    });
    if (res.ok) {
      setContents(prev => ({ ...prev, [editing!]: updatedContent }));
      setEditing(null);
      setToast("Сохранено");
      setTimeout(() => setToast(""), 2000);
    }
  };

  return (
    <>
      <div className="cms-table-wrap">
        <table className="cms-table">
          <thead><tr><th>Раздел</th><th>Ключ</th><th>Действие</th></tr></thead>
          <tbody>
            {CONTENT_SECTIONS.map((s) => (
              <tr key={s.key}>
                <td className="cms-td-bold">{s.label}</td>
                <td className="cms-td-mono">{s.key}</td>
                <td><button className="cms-btn cms-btn-xs" onClick={() => openEdit(s.key)}>Редактировать</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {editing && (
        <div className="cms-modal-overlay" onClick={() => setEditing(null)}>
          <div className="cms-modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 640 }}>
            <div className="cms-modal-header">
              <h3>{CONTENT_SECTIONS.find(s => s.key === editing)?.label}</h3>
              <button className="cms-modal-close" onClick={() => setEditing(null)}>&times;</button>
            </div>
            <div className="cms-modal-body" style={{ maxHeight: 400, overflowY: "auto" }}>
              <div className="cms-tabs" style={{ marginBottom: "12px" }}>
                {["ru", "en"].map(l => (
                  <button key={l} className={`cms-tab ${lang === l ? "active" : ""}`} onClick={() => { setLang(l); openEdit(editing); }}>{l.toUpperCase()}</button>
                ))}
              </div>
              {Object.entries(editData).map(([key, val]) => (
                <label key={key} className="cms-label" style={{ marginBottom: "10px" }}>
                  {key}
                  <textarea className="cms-textarea" value={val} onChange={e => setEditData(prev => ({ ...prev, [key]: e.target.value }))} rows={val.length > 100 ? 4 : 2} />
                </label>
              ))}
            </div>
            <div className="cms-modal-actions">
              <button className="cms-btn cms-btn-primary" onClick={handleSave}>Сохранить</button>
              <button className="cms-btn" onClick={() => setEditing(null)}>Отмена</button>
            </div>
          </div>
        </div>
      )}
      {toast && <div className="cms-toast">{toast}</div>}
    </>
  );
}

// ─── Pages Tab ──────────────────────────────────────────────
function PagesTab({ getToken }: { getToken: () => string | null }) {
  interface CustomPage { id: string; title: string; titleRu: string; slug: string; content: string; contentRu: string; isPublished: boolean; sortOrder: number; }
  const [pages, setPages] = useState<CustomPage[]>([]);
  const [editing, setEditing] = useState<CustomPage | null>(null);
  const [toast, setToast] = useState("");

  useEffect(() => {
    const token = getToken();
    fetch("/api/pages", {
      headers: token ? { Authorization: `Bearer ${token}` } : undefined,
    }).then(r => r.json()).then(d => setPages(d)).catch(() => {});
  }, [getToken]);

  const handleSave = async () => {
    if (!editing) return;
    const token = getToken();
    const method = editing.id ? "PUT" : "POST";
    const url = editing.id ? `/api/pages/${editing.id}` : "/api/pages";
    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify(editing),
    });
    if (res.ok) {
      const saved = await res.json();
      setPages(prev => editing.id ? prev.map(p => p.id === saved.id ? saved : p) : [...prev, saved]);
      setEditing(null);
      setToast("Сохранено");
      setTimeout(() => setToast(""), 2000);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Удалить страницу?")) return;
    const token = getToken();
    await fetch(`/api/pages/${id}`, { method: "DELETE", headers: { Authorization: `Bearer ${token}` } });
    setPages(prev => prev.filter(p => p.id !== id));
  };

  const transliterate = (text: string) => {
    const map: Record<string, string> = { а: 'a', б: 'b', в: 'v', г: 'g', д: 'd', е: 'e', ё: 'yo', ж: 'zh', з: 'z', и: 'i', й: 'y', к: 'k', л: 'l', м: 'm', н: 'n', о: 'o', п: 'p', р: 'r', с: 's', т: 't', у: 'u', ф: 'f', х: 'h', ц: 'ts', ч: 'ch', ш: 'sh', щ: 'sch', ы: 'y', э: 'e', ю: 'yu', я: 'ya' };
    return text.toLowerCase().split('').map(c => map[c] || c).join('').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  };

  return (
    <>
      <div style={{ marginBottom: "12px" }}>
        <button className="cms-btn cms-btn-primary cms-btn-sm" onClick={() => setEditing({ id: '', title: '', titleRu: '', slug: '', content: '', contentRu: '', isPublished: false, sortOrder: 0 })}>+ Новая страница</button>
      </div>
      <div className="cms-table-wrap">
        <table className="cms-table">
          <thead><tr><th>Название</th><th>Slug</th><th>Статус</th><th>Действия</th></tr></thead>
          <tbody>
            {pages.map(p => (
              <tr key={p.id}>
                <td className="cms-td-bold">{p.titleRu || p.title}</td>
                <td className="cms-td-mono">/p/{p.slug}</td>
                <td><span className={`cms-badge ${p.isPublished ? 'cms-badge-green' : 'cms-badge-yellow'}`}>{p.isPublished ? 'Опубликована' : 'Черновик'}</span></td>
                <td style={{ display: "flex", gap: "6px" }}>
                  <button className="cms-btn cms-btn-xs" onClick={() => setEditing(p)}>Ред.</button>
                  <button className="cms-btn cms-btn-xs cms-btn-danger" onClick={() => handleDelete(p.id)}>Удалить</button>
                </td>
              </tr>
            ))}
            {pages.length === 0 && <tr><td colSpan={4} style={{ textAlign: "center", padding: "20px", color: "var(--cms-text-muted)" }}>Нет страниц</td></tr>}
          </tbody>
        </table>
      </div>

      {editing && (
        <div className="cms-modal-overlay" onClick={() => setEditing(null)}>
          <div className="cms-modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 640 }}>
            <div className="cms-modal-header">
              <h3>{editing.id ? "Редактирование" : "Новая страница"}</h3>
              <button className="cms-modal-close" onClick={() => setEditing(null)}>&times;</button>
            </div>
            <div className="cms-modal-body" style={{ maxHeight: 400, overflowY: "auto" }}>
              <label className="cms-label" style={{ marginBottom: "10px" }}>
                Название (RU)
                <input className="cms-input" value={editing.titleRu} onChange={e => { const titleRu = e.target.value; setEditing(prev => prev ? { ...prev, titleRu, slug: prev.slug || transliterate(titleRu) } : null); }} />
              </label>
              <label className="cms-label" style={{ marginBottom: "10px" }}>
                Название (EN)
                <input className="cms-input" value={editing.title} onChange={e => setEditing(prev => prev ? { ...prev, title: e.target.value } : null)} />
              </label>
              <label className="cms-label" style={{ marginBottom: "10px" }}>
                Slug
                <input className="cms-input" value={editing.slug} onChange={e => setEditing(prev => prev ? { ...prev, slug: e.target.value } : null)} />
              </label>
              <label className="cms-label" style={{ marginBottom: "10px" }}>
                Контент (RU HTML)
                <textarea className="cms-textarea" rows={6} value={editing.contentRu} onChange={e => setEditing(prev => prev ? { ...prev, contentRu: e.target.value } : null)} />
              </label>
              <label className="cms-label" style={{ marginBottom: "10px" }}>
                Контент (EN HTML)
                <textarea className="cms-textarea" rows={4} value={editing.content} onChange={e => setEditing(prev => prev ? { ...prev, content: e.target.value } : null)} />
              </label>
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <input type="checkbox" checked={editing.isPublished} onChange={e => setEditing(prev => prev ? { ...prev, isPublished: e.target.checked } : null)} />
                <span style={{ fontSize: "13px" }}>Опубликована</span>
              </div>
            </div>
            <div className="cms-modal-actions">
              <button className="cms-btn cms-btn-primary" onClick={handleSave}>Сохранить</button>
              <button className="cms-btn" onClick={() => setEditing(null)}>Отмена</button>
            </div>
          </div>
        </div>
      )}
      {toast && <div className="cms-toast">{toast}</div>}
    </>
  );
}

// ─── Files Tab ──────────────────────────────────────────────
function FilesTab({ getToken }: { getToken: () => string | null }) {
  const [path, setPath] = useState("/");
  const [items, setItems] = useState<FileItem[]>([]);
  const [fileContent, setFileContent] = useState<string | null>(null);
  const [editingFile, setEditingFile] = useState<string | null>(null);
  const [toast, setToast] = useState("");

  const fetchDir = useCallback(async (dir: string) => {
    const token = getToken();
    if (!token) return;
    const res = await fetch(`/api/admin/files?path=${encodeURIComponent(dir)}`, { headers: { Authorization: `Bearer ${token}` } });
    if (res.ok) {
      const data = await res.json();
      setItems(data.items || []);
      setPath(dir);
      setFileContent(null);
      setEditingFile(null);
    }
  }, [getToken]);

  useEffect(() => { fetchDir("/"); }, [fetchDir]);

  const openFile = async (item: FileItem) => {
    if (item.isDirectory) { fetchDir(path === "/" ? `/${item.name}` : `${path}/${item.name}`); return; }
    const token = getToken();
    const filePath = path === "/" ? `/${item.name}` : `${path}/${item.name}`;
    const res = await fetch(`/api/admin/files?path=${encodeURIComponent(filePath)}&action=read`, { headers: { Authorization: `Bearer ${token}` } });
    if (res.ok) {
      const data = await res.json();
      setFileContent(data.content ?? "");
      setEditingFile(filePath);
    }
  };

  const saveFile = async () => {
    if (!editingFile || fileContent === null) return;
    const token = getToken();
    const res = await fetch("/api/admin/files", {
      method: "PUT",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ path: editingFile, content: fileContent }),
    });
    if (res.ok) { setToast("Файл сохранён"); setTimeout(() => setToast(""), 2000); }
  };

  const goUp = () => {
    const parts = path.split("/").filter(Boolean);
    parts.pop();
    fetchDir(parts.length ? `/${parts.join("/")}` : "/");
  };

  return (
    <>
      <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "12px", fontSize: "12px" }}>
        <button className="cms-btn cms-btn-xs" onClick={goUp} disabled={path === "/"}>← Назад</button>
        <span className="cms-td-mono" style={{ color: "var(--cms-text-muted)" }}>public{path}</span>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: editingFile ? "1fr 1fr" : "1fr", gap: "12px" }}>
        <div className="cms-table-wrap">
          <table className="cms-table">
            <thead><tr><th>Имя</th><th>Размер</th></tr></thead>
            <tbody>
              {items.map((item, i) => (
                <tr key={i} style={{ cursor: "pointer" }} onClick={() => openFile(item)}>
                  <td style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                    {item.isDirectory ? "📁" : "📄"} {item.name}
                  </td>
                  <td style={{ color: "var(--cms-text-muted)", fontSize: "12px" }}>{item.size ? `${(item.size / 1024).toFixed(1)} KB` : "—"}</td>
                </tr>
              ))}
              {items.length === 0 && <tr><td colSpan={2} style={{ textAlign: "center", padding: "20px", color: "var(--cms-text-muted)" }}>Пусто</td></tr>}
            </tbody>
          </table>
        </div>
        {editingFile && fileContent !== null && (
          <div className="cms-table-wrap" style={{ padding: "12px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
              <span className="cms-td-mono" style={{ fontSize: "11px", color: "var(--cms-text-muted)" }}>{editingFile}</span>
              <button className="cms-btn cms-btn-xs cms-btn-primary" onClick={saveFile}>Сохранить</button>
            </div>
            <textarea value={fileContent} onChange={e => setFileContent(e.target.value)}
              style={{ width: "100%", minHeight: 300, background: "var(--cms-bg)", border: "1px solid var(--cms-border)", borderRadius: "6px", color: "var(--cms-text)", fontFamily: "monospace", fontSize: "12px", padding: "10px", resize: "vertical", outline: "none" }} />
          </div>
        )}
      </div>
      {toast && <div className="cms-toast">{toast}</div>}
    </>
  );
}

// ─── Database Tab ──────────────────────────────────────────────
function DatabaseTab({ getToken }: { getToken: () => string | null }) {
  const [dbData, setDbData] = useState<{ tables: Array<{ name: string; count: number }>; orders: unknown[]; products: unknown[] } | null>(null);
  const [dbTab, setDbTab] = useState<"overview" | "orders" | "products">("overview");

  useEffect(() => {
    const load = async () => {
      const token = getToken();
      if (!token) return;
      const [dashRes, prodRes, ordRes] = await Promise.all([
        fetch("/api/admin/dashboard", { headers: { Authorization: `Bearer ${token}` } }),
        fetch("/api/products"),
        fetch("/api/orders", { headers: { Authorization: `Bearer ${token}` } }),
      ]);
      const dash = dashRes.ok ? await dashRes.json() : {};
      const prods = prodRes.ok ? await prodRes.json() : [];
      const ords = ordRes.ok ? await ordRes.json() : [];
      setDbData({
        tables: [
          { name: "Products", count: dash.productCount || 0 },
          { name: "Orders", count: dash.orderCount || 0 },
          { name: "Inquiries", count: dash.inquiryCount || 0 },
        ],
        orders: ords,
        products: prods,
      });
    };
    load();
  }, [getToken]);

  const formatPrice = (n: number) => new Intl.NumberFormat("ru-RU", { style: "currency", currency: "RUB", minimumFractionDigits: 0 }).format(n);

  if (!dbData) return <div style={{ color: "var(--cms-text-muted)", padding: "20px" }}>Загрузка...</div>;

  return (
    <>
      <div className="cms-tabs" style={{ marginBottom: "12px" }}>
        {(["overview", "orders", "products"] as const).map(t => (
          <button key={t} className={`cms-tab ${dbTab === t ? "active" : ""}`} onClick={() => setDbTab(t)}>
            {t === "overview" ? "Обзор" : t === "orders" ? "Заказы" : "Товары"}
          </button>
        ))}
      </div>

      {dbTab === "overview" && (
        <div className="cms-table-wrap">
          <table className="cms-table">
            <thead><tr><th>Таблица</th><th>Записей</th></tr></thead>
            <tbody>
              {dbData.tables.map(t => (
                <tr key={t.name}><td className="cms-td-bold">{t.name}</td><td>{t.count}</td></tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {dbTab === "orders" && (
        <div className="cms-table-wrap" style={{ overflowX: "auto" }}>
          <table className="cms-table">
            <thead><tr><th>№</th><th>Клиент</th><th>Сумма</th><th>Статус</th><th>Дата</th></tr></thead>
            <tbody>
              {(dbData.orders as Array<{ id: string; orderNumber: string; customerName: string; totalAmount: number; status: string; createdAt: string }>).slice(0, 20).map(o => (
                <tr key={o.id}>
                  <td className="cms-td-mono">{o.orderNumber}</td>
                  <td>{o.customerName}</td>
                  <td>{formatPrice(o.totalAmount)}</td>
                  <td><span className={`cms-badge ${o.status === 'delivered' ? 'cms-badge-green' : 'cms-badge-yellow'}`}>{o.status}</span></td>
                  <td>{new Date(o.createdAt).toLocaleDateString("ru-RU")}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {dbTab === "products" && (
        <div className="cms-table-wrap" style={{ overflowX: "auto" }}>
          <table className="cms-table">
            <thead><tr><th>Название</th><th>Slug</th><th>Цена</th><th>В наличии</th></tr></thead>
            <tbody>
              {(dbData.products as Array<{ id: string; name: string; slug: string; price: number; inStock: boolean }>).map(p => (
                <tr key={p.id}>
                  <td className="cms-td-bold">{p.name}</td>
                  <td className="cms-td-mono">{p.slug}</td>
                  <td>{formatPrice(p.price)}</td>
                  <td><span className={`cms-badge ${p.inStock ? 'cms-badge-green' : 'cms-badge-red'}`}>{p.inStock ? 'Да' : 'Нет'}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}

// ─── Server Tab ──────────────────────────────────────────────
function ServerTab({ getToken }: { getToken: () => string | null }) {
  const [stats, setStats] = useState<ServerStats | null>(null);
  const [history, setHistory] = useState<Array<{ cpu: number; mem: number; time: string }>>([]);

  useEffect(() => {
    const fetchStats = async () => {
      const token = getToken();
      if (!token) return;
      const res = await fetch("/api/admin/server-stats", { headers: { Authorization: `Bearer ${token}` } });
      if (res.ok) {
        const data = await res.json();
        setStats(data);
        setHistory(prev => [...prev.slice(-29), { cpu: data.cpu?.usage ?? 0, mem: data.memory?.usage ?? 0, time: new Date().toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit", second: "2-digit" }) }]);
      }
    };
    fetchStats();
    const interval = setInterval(fetchStats, 5000);
    return () => clearInterval(interval);
  }, [getToken]);

  if (!stats) return <div style={{ color: "var(--cms-text-muted)", padding: "20px" }}>Загрузка...</div>;

  const W = 600, H = 120, pad = 40;
  const drawLine = (values: number[], color: string) => {
    if (values.length < 2) return null;
    const max = 100;
    const iW = W - pad - 10;
    const iH = H - 20;
    let d = `M ${pad},${10 + (1 - values[0] / max) * iH}`;
    for (let i = 1; i < values.length; i++) {
      const cx = pad + (i / (values.length - 1)) * iW;
      const cy = 10 + (1 - values[i] / max) * iH;
      d += ` L ${cx},${cy}`;
    }
    return <path d={d} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" />;
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
      {/* Live Chart */}
      <div className="cms-table-wrap" style={{ padding: "16px" }}>
        <div style={{ fontWeight: 700, fontSize: "14px", marginBottom: "12px" }}>Мониторинг в реальном времени</div>
        <svg width="100%" viewBox={`0 0 ${W} ${H}`} style={{ display: "block" }}>
          {[0, 25, 50, 75, 100].map(v => (
            <g key={v}>
              <line x1={pad} y1={10 + (1 - v / 100) * (H - 20)} x2={W - 10} y2={10 + (1 - v / 100) * (H - 20)} stroke="var(--cms-border)" strokeWidth="1" />
              <text x={pad - 4} y={10 + (1 - v / 100) * (H - 20) + 4} textAnchor="end" fontSize="9" fill="var(--cms-text-muted)">{v}%</text>
            </g>
          ))}
          {drawLine(history.map(h => h.cpu), "#7c5cfc")}
          {drawLine(history.map(h => h.mem), "#38bdf8")}
        </svg>
        <div style={{ display: "flex", gap: "16px", justifyContent: "center", marginTop: "8px", fontSize: "11px" }}>
          <span style={{ display: "flex", alignItems: "center", gap: "4px" }}><span style={{ width: 10, height: 3, background: "#7c5cfc", borderRadius: 2 }} /> CPU {stats.cpu.usage}%</span>
          <span style={{ display: "flex", alignItems: "center", gap: "4px" }}><span style={{ width: 10, height: 3, background: "#38bdf8", borderRadius: 2 }} /> RAM {stats.memory.usage}%</span>
        </div>
      </div>

      {/* Details */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "12px" }}>
        <div className="cms-table-wrap" style={{ padding: "16px" }}>
          <div style={{ fontWeight: 700, fontSize: "13px", marginBottom: "10px" }}>CPU</div>
          <div style={{ fontSize: "28px", fontWeight: 700, color: stats.cpu.usage > 80 ? "var(--cms-danger)" : "var(--cms-text-heading)" }}>{stats.cpu.usage}%</div>
          <div style={{ fontSize: "11px", color: "var(--cms-text-muted)" }}>{stats.cpu.cores} ядер · Load: {stats.loadAverage['1m']}</div>
        </div>
        <div className="cms-table-wrap" style={{ padding: "16px" }}>
          <div style={{ fontWeight: 700, fontSize: "13px", marginBottom: "10px" }}>ОЗУ</div>
          <div style={{ fontSize: "28px", fontWeight: 700, color: stats.memory.usage > 80 ? "var(--cms-danger)" : "var(--cms-text-heading)" }}>{stats.memory.usage}%</div>
          <div style={{ fontSize: "11px", color: "var(--cms-text-muted)" }}>{stats.memory.used} / {stats.memory.total}</div>
        </div>
        <div className="cms-table-wrap" style={{ padding: "16px" }}>
          <div style={{ fontWeight: 700, fontSize: "13px", marginBottom: "10px" }}>Диск</div>
          <div style={{ fontSize: "28px", fontWeight: 700, color: (stats.disk?.usage ?? 0) > 90 ? "var(--cms-danger)" : "var(--cms-text-heading)" }}>{stats.disk?.usage ?? 0}%</div>
          <div style={{ fontSize: "11px", color: "var(--cms-text-muted)" }}>{stats.disk?.used ?? "-"} / {stats.disk?.total ?? "-"}</div>
        </div>
      </div>

      {/* System Info */}
      <div className="cms-table-wrap" style={{ padding: "16px" }}>
        <div style={{ fontWeight: 700, fontSize: "13px", marginBottom: "10px" }}>Система</div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "6px", fontSize: "12px" }}>
          {[
            ["Платформа", stats.system.platform],
            ["Node.js", stats.system.nodeVersion],
            ["Hostname", stats.system.hostname],
            ["Uptime", stats.system.uptime],
            ["Load Avg", `${stats.loadAverage['1m']} / ${stats.loadAverage['5m']} / ${stats.loadAverage['15m']}`],
            ["БД", `PostgreSQL ${stats.dbConnected !== false ? '✓ подключена' : '✗ недоступна'}`],
            ["Process Heap", stats.memory.process?.heapUsed ?? "-"],
            ["RSS", stats.memory.process?.rss ?? "-"],
          ].map(([label, val]) => (
            <div key={String(label)} style={{ display: "flex", justifyContent: "space-between", padding: "4px 0", borderBottom: "1px solid var(--cms-border)" }}>
              <span style={{ color: "var(--cms-text-muted)" }}>{label}</span>
              <span style={{ fontWeight: 600 }}>{val}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── SEO Tab ──────────────────────────────────────────────
function SeoTab({ getToken }: { getToken: () => string | null }) {
  interface SeoPage { path: string; title: string; description: string; indexed: boolean; }
  const DEFAULT_PAGES: SeoPage[] = [
    { path: "/", title: "errani — дизайнерские украшения", description: "Ювелирные украшения ручной работы", indexed: true },
    { path: "/catalog", title: "Каталог — errani", description: "Каталог украшений errani", indexed: true },
    { path: "/cart", title: "Корзина — errani", description: "Корзина покупок", indexed: false },
    { path: "/privacy", title: "Политика конфиденциальности — errani", description: "Политика конфиденциальности", indexed: true },
    { path: "/oferta", title: "Публичная оферта — errani", description: "Договор публичной оферты", indexed: true },
  ];
  const [pages, setPages] = useState<SeoPage[]>(DEFAULT_PAGES);
  const [robotsTxt, setRobotsTxt] = useState("User-agent: *\nAllow: /\nDisallow: /admin\nDisallow: /api\nDisallow: /cart\n\nSitemap: https://errani.ru/sitemap.xml");
  const [editing, setEditing] = useState<SeoPage | null>(null);
  const [toast, setToast] = useState("");

  useEffect(() => {
    const load = async () => {
      const token = getToken();
      if (!token) return;
      try {
        const res = await fetch("/api/admin/settings?key=seo_pages", { headers: { Authorization: `Bearer ${token}` } });
        if (res.ok) {
          const data = await res.json();
          if (data.value) setPages(JSON.parse(data.value));
        }
        const res2 = await fetch("/api/admin/settings?key=seo_robots", { headers: { Authorization: `Bearer ${token}` } });
        if (res2.ok) {
          const data2 = await res2.json();
          if (data2.value) setRobotsTxt(data2.value);
        }
      } catch { /* use defaults */ }
    };
    load();
  }, [getToken]);

  const handleSaveAll = async () => {
    const token = getToken();
    if (!token) return;
    await Promise.all([
      fetch("/api/admin/settings", { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` }, body: JSON.stringify({ key: "seo_pages", value: JSON.stringify(pages) }) }),
      fetch("/api/admin/settings", { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` }, body: JSON.stringify({ key: "seo_robots", value: robotsTxt }) }),
    ]);
    setToast("SEO сохранено");
    setTimeout(() => setToast(""), 2000);
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
      {/* Meta Pages */}
      <div className="cms-table-wrap">
        <div style={{ padding: "14px 18px", borderBottom: "1px solid var(--cms-border)", display: "flex", justifyContent: "space-between" }}>
          <span style={{ fontWeight: 700, fontSize: "14px" }}>Мета-теги страниц</span>
          <button className="cms-btn cms-btn-sm cms-btn-primary" onClick={handleSaveAll}>Сохранить всё</button>
        </div>
        <table className="cms-table">
          <thead><tr><th>Страница</th><th>Title</th><th>Индексация</th><th></th></tr></thead>
          <tbody>
            {pages.map((p, i) => (
              <tr key={i}>
                <td className="cms-td-mono">{p.path}</td>
                <td style={{ maxWidth: 200, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.title}</td>
                <td>
                  <label className="cms-toggle" style={{ transform: "scale(0.8)" }}>
                    <input type="checkbox" checked={p.indexed} onChange={() => setPages(prev => prev.map((pg, j) => j === i ? { ...pg, indexed: !pg.indexed } : pg))} />
                    <span className="cms-toggle-slider" />
                  </label>
                </td>
                <td><button className="cms-btn cms-btn-xs" onClick={() => setEditing(p)}>Ред.</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* robots.txt */}
      <div className="cms-table-wrap" style={{ padding: "16px" }}>
        <div style={{ fontWeight: 700, fontSize: "14px", marginBottom: "10px" }}>robots.txt</div>
        <textarea className="cms-textarea" value={robotsTxt} onChange={e => setRobotsTxt(e.target.value)} rows={6} style={{ fontFamily: "monospace", fontSize: "12px" }} />
      </div>

      {/* Sitemap Preview */}
      <div className="cms-table-wrap" style={{ padding: "16px" }}>
        <div style={{ fontWeight: 700, fontSize: "14px", marginBottom: "10px" }}>Sitemap Preview</div>
        <div style={{ fontFamily: "monospace", fontSize: "11px", color: "var(--cms-text-muted)", background: "var(--cms-bg)", padding: "10px", borderRadius: "6px", maxHeight: 150, overflowY: "auto" }}>
          {pages.filter(p => p.indexed).map((p, i) => (
            <div key={i}>https://errani.ru{p.path}</div>
          ))}
        </div>
      </div>

      {/* Edit Modal */}
      {editing && (
        <div className="cms-modal-overlay" onClick={() => setEditing(null)}>
          <div className="cms-modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 500 }}>
            <div className="cms-modal-header">
              <h3>Мета-теги: {editing.path}</h3>
              <button className="cms-modal-close" onClick={() => setEditing(null)}>&times;</button>
            </div>
            <div className="cms-modal-body">
              <label className="cms-label" style={{ marginBottom: "10px" }}>Title<input className="cms-input" value={editing.title} onChange={e => setEditing(prev => prev ? { ...prev, title: e.target.value } : null)} /></label>
              <label className="cms-label" style={{ marginBottom: "10px" }}>Description<textarea className="cms-textarea" value={editing.description} onChange={e => setEditing(prev => prev ? { ...prev, description: e.target.value } : null)} rows={3} /></label>
              <div style={{ marginTop: "12px", padding: "12px", background: "var(--cms-bg)", borderRadius: "8px" }}>
                <div style={{ fontSize: "10px", color: "var(--cms-text-muted)", marginBottom: "4px" }}>Google Preview</div>
                <div style={{ color: "#8ab4f8", fontSize: "16px", marginBottom: "2px" }}>{editing.title}</div>
                <div style={{ color: "#bdc1c6", fontSize: "12px", marginBottom: "2px" }}>https://errani.ru{editing.path}</div>
                <div style={{ color: "#969ba1", fontSize: "12px" }}>{editing.description}</div>
              </div>
            </div>
            <div className="cms-modal-actions">
              <button className="cms-btn cms-btn-primary" onClick={() => { setPages(prev => prev.map(p => p.path === editing.path ? editing : p)); setEditing(null); }}>Применить</button>
              <button className="cms-btn" onClick={() => setEditing(null)}>Отмена</button>
            </div>
          </div>
        </div>
      )}
      {toast && <div className="cms-toast">{toast}</div>}
    </div>
  );
}

// ─── Terminal Section ──────────────────────────────────────────────
function TerminalSection({ getToken }: { getToken: () => string | null }) {
  const [logs, setLogs] = useState<string>("");
  const [cmd, setCmd] = useState("");
  const [output, setOutput] = useState<string[]>([]);
  const logsRef = useRef<HTMLDivElement>(null);
  const outputRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const fetchLogs = async () => {
      const token = getToken();
      if (!token) return;
      const res = await fetch("/api/admin/terminal", { headers: { Authorization: `Bearer ${token}` } });
      if (res.ok) {
        const data = await res.json();
        setLogs(data.logs || "No logs");
      }
    };
    fetchLogs();
    const interval = setInterval(fetchLogs, 10000);
    return () => clearInterval(interval);
  }, [getToken]);

  useEffect(() => {
    if (logsRef.current) logsRef.current.scrollTop = logsRef.current.scrollHeight;
  }, [logs]);

  useEffect(() => {
    if (outputRef.current) outputRef.current.scrollTop = outputRef.current.scrollHeight;
  }, [output]);

  const runCommand = async () => {
    if (!cmd.trim()) return;
    const command = cmd.trim();
    setCmd("");

    if (command === "clear") { setOutput([]); return; }

    setOutput(prev => [...prev, `$ ${command}`, "..."]);
    const token = getToken();
    const res = await fetch("/api/admin/terminal", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ command }),
    });
    if (res.ok) {
      const data = await res.json();
      setOutput(prev => [...prev.slice(0, -1), data.output || "No output"]);
    } else {
      setOutput(prev => [...prev.slice(0, -1), "Error: request failed"]);
    }
  };

  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
      {/* Read-only logs */}
      <div className="cms-terminal">
        <div className="cms-terminal-header">
          <span className="cms-terminal-dot" style={{ background: "#ef4444" }} />
          <span className="cms-terminal-dot" style={{ background: "#f59e0b" }} />
          <span className="cms-terminal-dot" style={{ background: "#22c55e" }} />
          <span style={{ fontSize: "11px", color: "var(--cms-text-muted)", marginLeft: "8px" }}>Логи сервера (read-only)</span>
        </div>
        <div className="cms-terminal-body" ref={logsRef} style={{ minHeight: 200 }}>
          <pre style={{ margin: 0, whiteSpace: "pre-wrap", wordBreak: "break-all" }}>{logs}</pre>
        </div>
      </div>

      {/* Interactive terminal */}
      <div className="cms-terminal">
        <div className="cms-terminal-header">
          <span className="cms-terminal-dot" style={{ background: "#ef4444" }} />
          <span className="cms-terminal-dot" style={{ background: "#f59e0b" }} />
          <span className="cms-terminal-dot" style={{ background: "#22c55e" }} />
          <span style={{ fontSize: "11px", color: "var(--cms-text-muted)", marginLeft: "8px" }}>Консоль (type &quot;help&quot;)</span>
        </div>
        <div className="cms-terminal-body" ref={outputRef} style={{ minHeight: 160 }}>
          {output.length === 0 && <span style={{ color: "var(--cms-text-muted)" }}>Введите команду. &quot;help&quot; — список команд.</span>}
          {output.map((line, i) => (
            <div key={i} style={{ color: line.startsWith("$") ? "var(--cms-success)" : line.startsWith("Error") ? "var(--cms-danger)" : "#a1a1aa" }}>
              <pre style={{ margin: 0, whiteSpace: "pre-wrap" }}>{line}</pre>
            </div>
          ))}
        </div>
        <div className="cms-terminal-input">
          <span style={{ color: "var(--cms-success)" }}>$</span>
          <input
            value={cmd}
            onChange={e => setCmd(e.target.value)}
            onKeyDown={e => e.key === "Enter" && runCommand()}
            placeholder="Команда..."
            autoComplete="off"
          />
        </div>
      </div>
    </div>
  );
}
