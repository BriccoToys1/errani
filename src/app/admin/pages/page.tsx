"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { AdminSidebar } from "../AdminSidebar";

interface CustomPage {
  id: string;
  title: string;
  titleRu: string;
  slug: string;
  content: string;
  contentRu: string;
  isPublished: boolean;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

const emptyPage = {
  title: "",
  titleRu: "",
  slug: "",
  content: "",
  contentRu: "",
  isPublished: false,
  sortOrder: 0,
};

export default function AdminPagesPage() {
  const router = useRouter();
  const [pages, setPages] = useState<CustomPage[]>([]);
  const [loading, setLoading] = useState(true);
  const [isNew, setIsNew] = useState(false);
  const [selected, setSelected] = useState<CustomPage | null>(null);
  const [form, setForm] = useState(emptyPage);
  const [saving, setSaving] = useState(false);
  const [notification, setNotification] = useState("");

  const getToken = useCallback(() => localStorage.getItem("admin_token"), []);

  const fetchPages = useCallback(async () => {
    const token = getToken();
    if (!token) { router.push("/admin/login"); return; }
    const res = await fetch("/api/pages", { headers: { Authorization: `Bearer ${token}` } });
    if (res.status === 401) { localStorage.removeItem("admin_token"); router.push("/admin/login"); return; }
    const data = await res.json();
    setPages(Array.isArray(data) ? data : []);
    setLoading(false);
  }, [getToken, router]);

  useEffect(() => { fetchPages(); }, [fetchPages]);

  const notify = (msg: string) => {
    setNotification(msg);
    setTimeout(() => setNotification(""), 3000);
  };

  const openNew = () => {
    setIsNew(true);
    setSelected(null);
    setForm(emptyPage);
  };

  const openEdit = (page: CustomPage) => {
    setIsNew(false);
    setSelected(page);
    setForm({
      title: page.title,
      titleRu: page.titleRu,
      slug: page.slug,
      content: page.content,
      contentRu: page.contentRu,
      isPublished: page.isPublished,
      sortOrder: page.sortOrder,
    });
  };

  const handleSave = async () => {
    if (!form.title || !form.slug) { notify("Заполните название и slug"); return; }
    setSaving(true);
    const token = getToken();
    const url = isNew ? "/api/pages" : `/api/pages/${selected!.id}`;
    const method = isNew ? "POST" : "PUT";
    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify(form),
    });
    if (res.ok) {
      notify(isNew ? "Страница создана" : "Страница обновлена");
      setSelected(null);
      setIsNew(false);
      fetchPages();
    } else {
      notify("Ошибка сохранения");
    }
    setSaving(false);
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Удалить страницу?")) return;
    const token = getToken();
    const res = await fetch(`/api/pages/${id}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` },
    });
    if (res.ok) {
      notify("Страница удалена");
      fetchPages();
    }
  };

  const generateSlug = (title: string) => {
    return title
      .toLowerCase()
      .replace(/[а-яё]/g, (c) => {
        const map: Record<string, string> = { а:'a',б:'b',в:'v',г:'g',д:'d',е:'e',ё:'yo',ж:'zh',з:'z',и:'i',й:'y',к:'k',л:'l',м:'m',н:'n',о:'o',п:'p',р:'r',с:'s',т:'t',у:'u',ф:'f',х:'h',ц:'ts',ч:'ch',ш:'sh',щ:'sch',ъ:'',ы:'y',ь:'',э:'e',ю:'yu',я:'ya' };
        return map[c] || c;
      })
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');
  };

  if (loading) return <div className="cms-loading"><div className="cms-spinner" /> Загрузка...</div>;

  const isEditing = isNew || selected;

  return (
    <div className="cms-root">
      <AdminSidebar />
      <main className="cms-main">
        <div className="cms-header">
          <h1 className="cms-header-title">Страницы</h1>
          <div className="cms-header-actions">
            <span style={{ fontSize: "13px", color: "var(--cms-text-muted)" }}>{pages.length} всего</span>
            <button className="cms-btn cms-btn-sm cms-btn-primary" onClick={openNew}>+ Новая страница</button>
          </div>
        </div>

        <div className="cms-content">
          <div className="cms-table-wrap">
            <table className="cms-table">
              <thead>
                <tr>
                  <th>Название</th>
                  <th>Slug</th>
                  <th>Статус</th>
                  <th>Обновлено</th>
                  <th style={{ width: 120 }}>Действия</th>
                </tr>
              </thead>
              <tbody>
                {pages.map((page) => (
                  <tr key={page.id}>
                    <td className="cms-td-bold">{page.titleRu || page.title}</td>
                    <td className="cms-td-mono">/p/{page.slug}</td>
                    <td>
                      <span className={`cms-badge ${page.isPublished ? "cms-badge-green" : "cms-badge-yellow"}`}>
                        {page.isPublished ? "Опубликована" : "Черновик"}
                      </span>
                    </td>
                    <td>{new Date(page.updatedAt).toLocaleDateString("ru-RU")}</td>
                    <td>
                      <button className="cms-btn cms-btn-xs cms-btn-ghost" onClick={() => openEdit(page)} title="Редактировать">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 013 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>
                      </button>
                      {page.isPublished && (
                        <a href={`/p/${page.slug}`} target="_blank" className="cms-btn cms-btn-xs cms-btn-ghost" title="Открыть">
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
                        </a>
                      )}
                      <button className="cms-btn cms-btn-xs cms-btn-ghost cms-btn-danger" onClick={() => handleDelete(page.id)} title="Удалить">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/></svg>
                      </button>
                    </td>
                  </tr>
                ))}
                {pages.length === 0 && (
                  <tr><td colSpan={5} style={{ textAlign: "center", padding: "32px", color: "var(--cms-text-muted)" }}>Нет страниц. Создайте первую!</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </main>

      {/* Edit Modal */}
      {isEditing && (
        <div className="cms-modal-overlay" onClick={() => { setSelected(null); setIsNew(false); }}>
          <div className="cms-modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 800 }}>
            <div className="cms-modal-header">
              <h3>{isNew ? "Новая страница" : "Редактировать страницу"}</h3>
              <button className="cms-modal-close" onClick={() => { setSelected(null); setIsNew(false); }}>&times;</button>
            </div>
            <div className="cms-modal-body" style={{ maxHeight: "70vh", overflowY: "auto" }}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px", marginBottom: "16px" }}>
                <label className="cms-label">
                  Title (EN)
                  <input className="cms-input" value={form.title} onChange={(e) => {
                    const title = e.target.value;
                    setForm(f => ({ ...f, title, slug: isNew && !form.slug ? generateSlug(title) : f.slug }));
                  }} />
                </label>
                <label className="cms-label">
                  Название (RU)
                  <input className="cms-input" value={form.titleRu} onChange={(e) => {
                    const titleRu = e.target.value;
                    setForm(f => ({ ...f, titleRu, slug: isNew && !form.slug && !form.title ? generateSlug(titleRu) : f.slug }));
                  }} />
                </label>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "12px", marginBottom: "16px" }}>
                <label className="cms-label">
                  Slug
                  <input className="cms-input" value={form.slug} onChange={(e) => setForm(f => ({ ...f, slug: e.target.value }))} placeholder="my-page" />
                </label>
                <label className="cms-label">
                  Порядок
                  <input className="cms-input" type="number" value={form.sortOrder} onChange={(e) => setForm(f => ({ ...f, sortOrder: parseInt(e.target.value) || 0 }))} />
                </label>
                <label className="cms-label" style={{ display: "flex", alignItems: "center", gap: "8px", paddingTop: "22px" }}>
                  <input type="checkbox" checked={form.isPublished} onChange={(e) => setForm(f => ({ ...f, isPublished: e.target.checked }))} />
                  Опубликовать
                </label>
              </div>

              <label className="cms-label" style={{ marginBottom: "12px" }}>
                Content (EN) — HTML
                <textarea className="cms-textarea" value={form.content} onChange={(e) => setForm(f => ({ ...f, content: e.target.value }))} rows={8} style={{ fontFamily: "monospace", fontSize: "13px" }} />
              </label>

              <label className="cms-label">
                Контент (RU) — HTML
                <textarea className="cms-textarea" value={form.contentRu} onChange={(e) => setForm(f => ({ ...f, contentRu: e.target.value }))} rows={8} style={{ fontFamily: "monospace", fontSize: "13px" }} />
              </label>

              {form.slug && (
                <p style={{ fontSize: "12px", color: "var(--cms-text-muted)", marginTop: "8px" }}>
                  URL: /p/{form.slug}
                </p>
              )}
            </div>
            <div className="cms-modal-actions">
              <button className="cms-btn cms-btn-primary" onClick={handleSave} disabled={saving}>{saving ? "Сохранение..." : "Сохранить"}</button>
              <button className="cms-btn" onClick={() => { setSelected(null); setIsNew(false); }}>Отмена</button>
            </div>
          </div>
        </div>
      )}

      {notification && <div className="cms-toast">{notification}</div>}
    </div>
  );
}
