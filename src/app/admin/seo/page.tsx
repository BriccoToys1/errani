"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { AdminSidebar } from "../AdminSidebar";

interface SeoPage {
  path: string;
  title: string;
  description: string;
  indexed: boolean;
}

interface GlobalSeo {
  title: string;
  description: string;
  keywords: string;
  ogTitle: string;
  ogDescription: string;
  ogImage: string;
}

const DEFAULT_PAGES: SeoPage[] = [
  { path: "/", title: "errani — Колоды Таро", description: "Авторские колоды Таро от Екатерины Эррани. Оформляйте предзаказ.", indexed: true },
  { path: "/catalog", title: "Каталог — errani", description: "Коллекция колод Таро.", indexed: true },
  { path: "/tenderly-vibe", title: "Tenderly Vibe — errani", description: "Колода Tenderly Vibe — уникальная авторская колода.", indexed: true },
  { path: "/cart", title: "Корзина — errani", description: "Ваша корзина покупок.", indexed: false },
  { path: "/privacy", title: "Политика конфиденциальности — errani", description: "Политика конфиденциальности.", indexed: true },
  { path: "/oferta", title: "Публичная оферта — errani", description: "Условия использования.", indexed: true },
];

function RobotsEditor({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <div className="cms-table-wrap" style={{ padding: "16px 20px" }}>
      <div style={{ fontWeight: 700, fontSize: "14px", marginBottom: "10px" }}>robots.txt</div>
      <textarea
        className="cms-textarea"
        rows={8}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        style={{ width: "100%", fontFamily: "monospace", fontSize: "12px" }}
      />
      <div style={{ fontSize: "11px", color: "var(--cms-text-muted)", marginTop: "6px" }}>
        Управление индексацией страниц поисковыми системами. Применяется к /public/robots.txt
      </div>
    </div>
  );
}

const DEFAULT_GLOBAL: GlobalSeo = {
  title: "errani — Авторские Колоды Таро",
  description: "Авторские колоды Таро от Екатерины Эррани. Оформляйте предзаказ.",
  keywords: "таро, колода таро, авторская колода, errani",
  ogTitle: "errani — Авторские Колоды Таро",
  ogDescription: "Авторские колоды Таро от Екатерины Эррани. Оформляйте предзаказ.",
  ogImage: "https://errani.ru/og-image.jpg",
};

export default function AdminSeoPage() {
  const router = useRouter();
  const [pages, setPages] = useState<SeoPage[]>(DEFAULT_PAGES);
  const [robots, setRobots] = useState("User-agent: *\nAllow: /\nDisallow: /admin\nDisallow: /api\nDisallow: /cart\nDisallow: /account\n\nSitemap: https://errani.ru/sitemap.xml");
  const [globalSeo, setGlobalSeo] = useState<GlobalSeo>(DEFAULT_GLOBAL);
  const [notification, setNotification] = useState("");
  const [editPage, setEditPage] = useState<SeoPage | null>(null);
  const [saving, setSaving] = useState(false);
  const [sitemapUrls, setSitemapUrls] = useState<string[]>([]);

  const getToken = useCallback(() => localStorage.getItem("admin_token"), []);

  useEffect(() => {
    const token = getToken();
    if (!token) { router.push("/admin/login"); return; }

    // Load from DB
    fetch("/api/admin/settings?key=seo_pages", { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json())
      .then(data => {
        if (data.value) {
          try {
            const parsed = JSON.parse(data.value);
            setPages(parsed);
            setSitemapUrls(parsed.filter((p: SeoPage) => p.indexed).map((p: SeoPage) => `https://errani.ru${p.path}`));
          } catch {}
        } else {
          const saved = localStorage.getItem("cms_seo_pages");
          if (saved) { try { setPages(JSON.parse(saved)); } catch {} }
        }
      })
      .catch(() => {
        const saved = localStorage.getItem("cms_seo_pages");
        if (saved) { try { setPages(JSON.parse(saved)); } catch {} }
      });

    fetch("/api/admin/settings?key=seo_robots", { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json())
      .then(data => { if (data.value) setRobots(data.value); else { const s = localStorage.getItem("cms_seo_robots"); if (s) setRobots(s); } })
      .catch(() => { const s = localStorage.getItem("cms_seo_robots"); if (s) setRobots(s); });

    fetch("/api/admin/settings?key=seo_global", { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json())
      .then(data => {
        if (data.value) {
          try { setGlobalSeo({ ...DEFAULT_GLOBAL, ...JSON.parse(data.value) }); } catch {}
        }
      })
      .catch(() => {});
  }, [getToken, router]);

  const handleSavePage = () => {
    if (!editPage) return;
    setPages((prev) => prev.map((p) => p.path === editPage.path ? editPage : p));
    setEditPage(null);
    notify("SEO страницы обновлён");
  };

  const handleSaveAll = async () => {
    setSaving(true);
    const token = getToken();
    try {
      await Promise.all([
        fetch("/api/admin/settings", {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
          body: JSON.stringify({ key: "seo_pages", value: JSON.stringify(pages) }),
        }),
        fetch("/api/admin/settings", {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
          body: JSON.stringify({ key: "seo_robots", value: robots }),
        }),
        fetch("/api/admin/settings", {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
          body: JSON.stringify({ key: "seo_global", value: JSON.stringify(globalSeo) }),
        }),
      ]);
      localStorage.setItem("cms_seo_pages", JSON.stringify(pages));
      localStorage.setItem("cms_seo_robots", robots);
      setSitemapUrls(pages.filter((p) => p.indexed).map((p) => `https://errani.ru${p.path}`));
      notify("Настройки SEO сохранены в базе данных");
    } catch {
      notify("Ошибка сохранения");
    }
    setSaving(false);
  };

  const toggleIndex = (path: string) => {
    setPages((prev) => prev.map((p) => p.path === path ? { ...p, indexed: !p.indexed } : p));
  };

  const notify = (msg: string) => { setNotification(msg); setTimeout(() => setNotification(""), 3000); };

  return (
    <div className="cms-root">
      <AdminSidebar />
      <main className="cms-main">
        <div className="cms-header">
          <h1 className="cms-header-title">SEO и индексация</h1>
          <div className="cms-header-actions">
            <button className="cms-btn cms-btn-sm cms-btn-primary" onClick={handleSaveAll} disabled={saving}>
              {saving ? "Сохранение..." : "Сохранить всё"}
            </button>
          </div>
        </div>

        <div className="cms-content">
          {/* Global SEO */}
          <div className="cms-table-wrap" style={{ padding: "20px", marginBottom: "20px" }}>
            <div style={{ fontWeight: 700, fontSize: "14px", marginBottom: "16px", display: "flex", alignItems: "center", gap: "8px" }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
              Глобальные настройки сайта
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "14px" }}>
              <label className="cms-label" style={{ display: "block" }}>
                Заголовок сайта (title)
                <input className="cms-input" value={globalSeo.title} onChange={e => setGlobalSeo(g => ({ ...g, title: e.target.value }))} placeholder="errani — Авторские Колоды Таро" />
                <span style={{ fontSize: "11px", color: "var(--cms-text-muted)" }}>{globalSeo.title.length}/60</span>
              </label>
              <label className="cms-label" style={{ display: "block" }}>
                OG заголовок
                <input className="cms-input" value={globalSeo.ogTitle} onChange={e => setGlobalSeo(g => ({ ...g, ogTitle: e.target.value }))} placeholder="errani — Авторские Колоды Таро" />
                <span style={{ fontSize: "11px", color: "var(--cms-text-muted)" }}>{globalSeo.ogTitle.length}/60</span>
              </label>
              <label className="cms-label" style={{ display: "block" }}>
                Мета-описание
                <textarea className="cms-textarea" rows={2} value={globalSeo.description} onChange={e => setGlobalSeo(g => ({ ...g, description: e.target.value }))} style={{ width: "100%" }} />
                <span style={{ fontSize: "11px", color: "var(--cms-text-muted)" }}>{globalSeo.description.length}/160</span>
              </label>
              <label className="cms-label" style={{ display: "block" }}>
                OG описание
                <textarea className="cms-textarea" rows={2} value={globalSeo.ogDescription} onChange={e => setGlobalSeo(g => ({ ...g, ogDescription: e.target.value }))} style={{ width: "100%" }} />
                <span style={{ fontSize: "11px", color: "var(--cms-text-muted)" }}>{globalSeo.ogDescription.length}/160</span>
              </label>
              <label className="cms-label" style={{ display: "block" }}>
                Ключевые слова
                <input className="cms-input" value={globalSeo.keywords} onChange={e => setGlobalSeo(g => ({ ...g, keywords: e.target.value }))} placeholder="таро, колода, errani" />
              </label>
              <label className="cms-label" style={{ display: "block" }}>
                OG Image URL
                <input className="cms-input" value={globalSeo.ogImage} onChange={e => setGlobalSeo(g => ({ ...g, ogImage: e.target.value }))} placeholder="https://errani.ru/og-image.jpg" />
              </label>
            </div>
            {globalSeo.ogImage && (
              <div style={{ marginTop: "12px", display: "flex", alignItems: "center", gap: "10px" }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={globalSeo.ogImage} alt="OG preview" style={{ width: "120px", height: "63px", objectFit: "cover", borderRadius: "6px", border: "1px solid var(--cms-border)" }} onError={e => { (e.target as HTMLImageElement).style.display = "none"; }} />
                <span style={{ fontSize: "11px", color: "var(--cms-text-muted)" }}>Предпросмотр OG Image (1200×630)</span>
              </div>
            )}
          </div>

          {/* Pages SEO Table */}
          <div className="cms-table-wrap">
            <div style={{ padding: "14px 18px", borderBottom: "1px solid var(--cms-border)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ fontWeight: 700, fontSize: "14px" }}>Мета-теги страниц</span>
              <span style={{ fontSize: "12px", color: "var(--cms-text-muted)" }}>{pages.filter((p) => p.indexed).length} индексируется / {pages.length} всего</span>
            </div>
            <table className="cms-table">
              <thead>
                <tr>
                  <th>Путь</th>
                  <th>Заголовок</th>
                  <th>Описание</th>
                  <th style={{ width: 90 }}>Индексация</th>
                  <th style={{ width: 70 }}>Ред.</th>
                </tr>
              </thead>
              <tbody>
                {pages.map((page) => (
                  <tr key={page.path}>
                    <td className="cms-td-mono">{page.path}</td>
                    <td style={{ maxWidth: "200px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{page.title}</td>
                    <td style={{ maxWidth: "200px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", color: "var(--cms-text-muted)", fontSize: "12px" }}>{page.description}</td>
                    <td>
                      <button
                        onClick={() => toggleIndex(page.path)}
                        className={`cms-badge ${page.indexed ? "cms-badge-green" : "cms-badge-red"}`}
                        style={{ cursor: "pointer", border: "none" }}
                      >
                        {page.indexed ? "Да" : "Нет"}
                      </button>
                    </td>
                    <td>
                      <button className="cms-btn cms-btn-xs cms-btn-ghost" onClick={() => setEditPage({ ...page })}>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 013 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Robots.txt Editor */}
          <div style={{ marginTop: "20px" }}>
            <RobotsEditor value={robots} onChange={setRobots} />
          </div>

          {/* Sitemap Preview */}
          <div className="cms-table-wrap" style={{ padding: "16px 20px", marginTop: "20px" }}>
            <div style={{ fontWeight: 700, fontSize: "14px", marginBottom: "10px" }}>Предпросмотр Sitemap</div>
            <div style={{ fontSize: "12px", color: "var(--cms-text-muted)", marginBottom: "8px" }}>
              Эти URL будут включены в sitemap.xml ({sitemapUrls.length} URL)
            </div>
            <div style={{ fontFamily: "monospace", fontSize: "11px", background: "var(--cms-bg)", padding: "12px", borderRadius: "6px", maxHeight: "200px", overflow: "auto" }}>
              {sitemapUrls.map((url) => <div key={url} style={{ padding: "2px 0" }}>{url}</div>)}
              {sitemapUrls.length === 0 && <div style={{ color: "var(--cms-text-muted)" }}>Нет индексируемых страниц</div>}
            </div>
          </div>
        </div>
      </main>

      {/* Edit Page SEO Modal */}
      {editPage && (
        <div className="cms-modal-overlay" onClick={() => setEditPage(null)}>
          <div className="cms-modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 500 }}>
            <div className="cms-modal-header">
              <h3>Редактирование SEO: {editPage.path}</h3>
              <button className="cms-modal-close" onClick={() => setEditPage(null)}>&times;</button>
            </div>
            <div className="cms-modal-body">
              <label className="cms-label" style={{ marginBottom: "12px", display: "block" }}>
                Заголовок страницы
                <input className="cms-input" value={editPage.title} onChange={(e) => setEditPage({ ...editPage, title: e.target.value })} />
                <div style={{ fontSize: "11px", color: "var(--cms-text-muted)", marginTop: "4px" }}>{editPage.title.length}/60 символов</div>
              </label>
              <label className="cms-label" style={{ marginBottom: "12px", display: "block" }}>
                Мета-описание
                <textarea className="cms-textarea" rows={3} value={editPage.description} onChange={(e) => setEditPage({ ...editPage, description: e.target.value })} style={{ width: "100%" }} />
                <div style={{ fontSize: "11px", color: "var(--cms-text-muted)", marginTop: "4px" }}>{editPage.description.length}/160 символов</div>
              </label>
              <label className="cms-checkbox-label">
                <input type="checkbox" checked={editPage.indexed} onChange={(e) => setEditPage({ ...editPage, indexed: e.target.checked })} />
                Разрешить индексацию (добавить в sitemap)
              </label>

              {/* Preview */}
              <div style={{ marginTop: "16px", padding: "12px", background: "var(--cms-bg)", borderRadius: "8px" }}>
                <div style={{ fontSize: "11px", color: "var(--cms-text-muted)", marginBottom: "6px" }}>Предпросмотр Google:</div>
                <div style={{ fontSize: "16px", color: "#1a0dab" }}>{editPage.title || "Page Title"}</div>
                <div style={{ fontSize: "12px", color: "#006621" }}>errani.ru{editPage.path}</div>
                <div style={{ fontSize: "12px", color: "#545454", marginTop: "2px" }}>{editPage.description || "Page description..."}</div>
              </div>
            </div>
            <div className="cms-modal-actions">
              <button className="cms-btn cms-btn-primary" onClick={handleSavePage}>Сохранить</button>
              <button className="cms-btn" onClick={() => setEditPage(null)}>Отмена</button>
            </div>
          </div>
        </div>
      )}

      {notification && <div className="cms-toast">{notification}</div>}
    </div>
  );
}
