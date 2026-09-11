"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { AdminSidebar } from "../AdminSidebar";

interface PageSeo {
  title: string;
  description: string;
  keywords: string;
  ogTitle: string;
  ogDescription: string;
  ogImage: string;
}

const PAGE_CONFIGS = [
  { key: "seo_global", label: "Главная страница", url: "/" },
  { key: "seo_catalog", label: "Каталог", url: "/catalog" },
  { key: "seo_oferta", label: "Публичная оферта", url: "/oferta" },
  { key: "seo_privacy", label: "Политика конфиденциальности", url: "/privacy" },
];

const EMPTY_SEO: PageSeo = {
  title: "",
  description: "",
  keywords: "",
  ogTitle: "",
  ogDescription: "",
  ogImage: "",
};

export default function AdminSeoPage() {
  const router = useRouter();
  const [settings, setSettings] = useState<Record<string, PageSeo>>({});
  const [saving, setSaving] = useState<Record<string, boolean>>({});
  const [saved, setSaved] = useState<Record<string, boolean>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [authChecked, setAuthChecked] = useState(false);

  useEffect(() => {
    const token = typeof window !== "undefined" ? localStorage.getItem("admin_token") : null;
    if (!token) { router.replace("/admin/login"); return; }
    setAuthChecked(true);

    const loadSettings = async () => {
      const loaded: Record<string, PageSeo> = {};
      await Promise.all(
        PAGE_CONFIGS.map(async ({ key }) => {
          try {
            const res = await fetch(`/api/admin/settings?key=${encodeURIComponent(key)}`, {
              headers: { Authorization: `Bearer ${token}` },
            });
            if (res.ok) {
              const data = await res.json();
              if (data.value) {
                const seo = JSON.parse(data.value) as Partial<{ title: string; description: string; keywords: string[]; ogTitle: string; ogDescription: string; ogImage: string }>;
                loaded[key] = {
                  title: seo.title || "",
                  description: seo.description || "",
                  keywords: Array.isArray(seo.keywords) ? seo.keywords.join(", ") : "",
                  ogTitle: seo.ogTitle || "",
                  ogDescription: seo.ogDescription || "",
                  ogImage: seo.ogImage || "",
                };
              } else {
                loaded[key] = { ...EMPTY_SEO };
              }
            }
          } catch {
            loaded[key] = { ...EMPTY_SEO };
          }
        })
      );
      setSettings(loaded);
    };

    loadSettings();
  }, [router]);

  const updateField = (key: string, field: keyof PageSeo, value: string) => {
    setSettings(prev => ({
      ...prev,
      [key]: { ...(prev[key] ?? EMPTY_SEO), [field]: value },
    }));
  };

  const handleSave = async (key: string) => {
    const token = typeof window !== "undefined" ? localStorage.getItem("admin_token") : null;
    if (!token) return;

    setSaving(prev => ({ ...prev, [key]: true }));
    setErrors(prev => ({ ...prev, [key]: "" }));
    const seo = settings[key] ?? EMPTY_SEO;

    try {
      const res = await fetch("/api/admin/settings", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          key,
          value: JSON.stringify({
            title: seo.title.trim(),
            description: seo.description.trim(),
            keywords: seo.keywords.split(",").map(k => k.trim()).filter(Boolean),
            ogTitle: seo.ogTitle.trim(),
            ogDescription: seo.ogDescription.trim(),
            ogImage: seo.ogImage.trim(),
          }),
        }),
      });

      if (res.ok) {
        setSaved(prev => ({ ...prev, [key]: true }));
        setTimeout(() => setSaved(prev => ({ ...prev, [key]: false })), 3000);
      } else {
        const data = await res.json().catch(() => ({})) as { error?: string };
        setErrors(prev => ({ ...prev, [key]: data.error || "Ошибка при сохранении" }));
      }
    } catch {
      setErrors(prev => ({ ...prev, [key]: "Ошибка сети" }));
    } finally {
      setSaving(prev => ({ ...prev, [key]: false }));
    }
  };

  if (!authChecked) return null;

  return (
    <div className="cms-root">
      <AdminSidebar />
      <main className="cms-main">
        <div className="cms-topbar">
          <div>
            <div className="cms-page-title">SEO</div>
            <div className="cms-page-sub">Управление мета-тегами страниц сайта</div>
          </div>
        </div>

        <div className="cms-content" style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
          {PAGE_CONFIGS.map(({ key, label, url }) => {
            const seo = settings[key] ?? EMPTY_SEO;
            const charTitle = seo.title.length;
            const charDesc = seo.description.length;

            return (
              <div key={key} className="cms-table-wrap" style={{ padding: "20px" }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "18px", paddingBottom: "14px", borderBottom: "1px solid var(--cms-border)" }}>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: "15px", color: "var(--cms-text-heading)" }}>{label}</div>
                    <a href={url} target="_blank" rel="noopener noreferrer" style={{ fontSize: "12px", color: "var(--cms-text-muted)", marginTop: "2px", display: "inline-block", textDecoration: "none" }}>
                      errani.ru{url} ↗
                    </a>
                  </div>
                  <button
                    onClick={() => handleSave(key)}
                    disabled={saving[key]}
                    className="cms-btn cms-btn-primary"
                    style={{ minWidth: "100px" }}
                  >
                    {saving[key] ? "Сохраняем…" : saved[key] ? "✓ Сохранено" : "Сохранить"}
                  </button>
                </div>

                {errors[key] && (
                  <div style={{ marginBottom: "14px", padding: "10px 14px", background: "rgba(244,63,94,0.1)", border: "1px solid rgba(244,63,94,0.3)", borderRadius: "7px", color: "var(--cms-danger)", fontSize: "12px" }}>
                    {errors[key]}
                  </div>
                )}

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "14px" }}>
                  {/* Title */}
                  <div style={{ gridColumn: "1 / -1" }}>
                    <label className="cms-label" style={{ display: "block" }}>
                      Title — заголовок страницы
                      <input
                        className="cms-input"
                        value={seo.title}
                        onChange={e => updateField(key, "title", e.target.value)}
                        placeholder="Заголовок в браузере и поисковике"
                        style={{ marginTop: "5px" }}
                      />
                    </label>
                    <div style={{ fontSize: "11px", color: charTitle > 60 ? "var(--cms-danger)" : "var(--cms-text-muted)", marginTop: "4px" }}>
                      {charTitle}/60 символов · рекомендуется 50–60
                    </div>
                  </div>

                  {/* Description */}
                  <div style={{ gridColumn: "1 / -1" }}>
                    <label className="cms-label" style={{ display: "block" }}>
                      Description — описание
                      <textarea
                        className="cms-input"
                        value={seo.description}
                        onChange={e => updateField(key, "description", e.target.value)}
                        placeholder="Описание страницы для поисковика"
                        rows={2}
                        style={{ marginTop: "5px", resize: "vertical" }}
                      />
                    </label>
                    <div style={{ fontSize: "11px", color: charDesc > 160 ? "var(--cms-danger)" : "var(--cms-text-muted)", marginTop: "4px" }}>
                      {charDesc}/160 символов · рекомендуется 120–160
                    </div>
                  </div>

                  {/* Keywords */}
                  <div style={{ gridColumn: "1 / -1" }}>
                    <label className="cms-label" style={{ display: "block" }}>
                      Keywords — ключевые слова
                      <input
                        className="cms-input"
                        value={seo.keywords}
                        onChange={e => updateField(key, "keywords", e.target.value)}
                        placeholder="таро, колода, errani"
                        style={{ marginTop: "5px" }}
                      />
                    </label>
                    <div style={{ fontSize: "11px", color: "var(--cms-text-muted)", marginTop: "4px" }}>Через запятую</div>
                  </div>

                  {/* OG Title */}
                  <div>
                    <label className="cms-label" style={{ display: "block" }}>
                      OG Title — заголовок для соцсетей
                      <input
                        className="cms-input"
                        value={seo.ogTitle}
                        onChange={e => updateField(key, "ogTitle", e.target.value)}
                        placeholder="Как в обычном Title"
                        style={{ marginTop: "5px" }}
                      />
                    </label>
                  </div>

                  {/* OG Image */}
                  <div>
                    <label className="cms-label" style={{ display: "block" }}>
                      OG Image — картинка для превью
                      <input
                        className="cms-input"
                        value={seo.ogImage}
                        onChange={e => updateField(key, "ogImage", e.target.value)}
                        placeholder="/media/og-cover.jpg"
                        style={{ marginTop: "5px" }}
                      />
                    </label>
                    <div style={{ fontSize: "11px", color: "var(--cms-text-muted)", marginTop: "4px" }}>Рекомендуется: 1200×630 px</div>
                  </div>

                  {/* OG Description */}
                  <div style={{ gridColumn: "1 / -1" }}>
                    <label className="cms-label" style={{ display: "block" }}>
                      OG Description — описание для соцсетей
                      <textarea
                        className="cms-input"
                        value={seo.ogDescription}
                        onChange={e => updateField(key, "ogDescription", e.target.value)}
                        placeholder="Текст под заголовком в превью"
                        rows={2}
                        style={{ marginTop: "5px", resize: "vertical" }}
                      />
                    </label>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </main>
    </div>
  );
}
