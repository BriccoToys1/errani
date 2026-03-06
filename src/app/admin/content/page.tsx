"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { AdminSidebar } from "../AdminSidebar";

interface ContentItem {
  id: string;
  key: string;
  value: string;
  updatedAt: string;
}

const LANGUAGES = [
  { code: "ru", name: "Русский" },
  { code: "en", name: "English" },
  { code: "it", name: "Italiano" },
  { code: "es", name: "Español" },
  { code: "fr", name: "Français" },
  { code: "de", name: "Deutsch" },
  { code: "tr", name: "Türkçe" },
  { code: "ar", name: "العربية" },
  { code: "zh", name: "中文" },
];

const CONTENT_SECTIONS = [
  { key: "hero", label: "Главный баннер", desc: "Герой-секция на главной странице" },
  { key: "about", label: "Об авторе", desc: "Биография и информация" },
  { key: "privacy_policy", label: "Политика конфиденциальности", desc: "Страница приватности" },
  { key: "public_offer", label: "Публичная оферта", desc: "Условия использования" },
  { key: "shipping", label: "Доставка", desc: "Информация о доставке" },
  { key: "payment", label: "Оплата", desc: "Способы оплаты" },
];

export default function AdminContentPage() {
  const router = useRouter();
  const [contents, setContents] = useState<ContentItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [editKey, setEditKey] = useState<string | null>(null);
  const [editLang, setEditLang] = useState("ru");
  const [editValue, setEditValue] = useState("");
  const [parsedFields, setParsedFields] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [notification, setNotification] = useState("");
  const [newFieldKey, setNewFieldKey] = useState("");
  const [showAddField, setShowAddField] = useState(false);

  const getToken = useCallback(() => localStorage.getItem("admin_token"), []);

  const fetchContent = useCallback(async () => {
    const token = getToken();
    if (!token) { router.push("/admin/login"); return; }
    try {
      const results: ContentItem[] = [];
      for (const section of CONTENT_SECTIONS) {
        const res = await fetch(`/api/content/${section.key}`);
        if (res.ok) {
          const data = await res.json();
          results.push(data);
        }
      }
      setContents(results);
    } catch (e) {
      console.error(e);
    }
    setLoading(false);
  }, [getToken, router]);

  useEffect(() => { fetchContent(); }, [fetchContent]);

  // Load language-specific content when language changes
  const loadLangContent = useCallback((key: string, lang: string) => {
    const item = contents.find((c) => c.key === key);
    if (item) {
      try {
        const parsed = JSON.parse(item.value);
        // Check if content has language structure
        if (parsed[lang] && typeof parsed[lang] === "object") {
          setParsedFields(flattenObj(parsed[lang]));
        } else if (parsed.ru || parsed.en) {
          // Has language structure but missing current lang - use ru/en as fallback
          const fallback = parsed[lang] || parsed.ru || parsed.en || {};
          setParsedFields(flattenObj(fallback));
        } else {
          // Old format - no language keys, use as-is for migration
          setParsedFields(flattenObj(parsed));
        }
        setEditValue(item.value);
      } catch {
        setParsedFields({ content: item.value });
        setEditValue(item.value);
      }
    } else {
      setParsedFields({});
      setEditValue("{}");
    }
  }, [contents]);

  const openEdit = (key: string) => {
    setEditKey(key);
    setEditLang("ru");
    loadLangContent(key, "ru");
  };

  // When language tab changes, reload content for that language
  useEffect(() => {
    if (editKey) {
      loadLangContent(editKey, editLang);
    }
  }, [editLang, editKey, loadLangContent]);

  const flattenObj = (obj: Record<string, unknown>, prefix = ""): Record<string, string> => {
    const result: Record<string, string> = {};
    for (const [k, v] of Object.entries(obj)) {
      const key = prefix ? `${prefix}.${k}` : k;
      if (typeof v === "object" && v !== null && !Array.isArray(v)) {
        Object.assign(result, flattenObj(v as Record<string, unknown>, key));
      } else {
        result[key] = String(v ?? "");
      }
    }
    return result;
  };

  const updateField = (fieldKey: string, value: string) => {
    setParsedFields((prev) => ({ ...prev, [fieldKey]: value }));
  };

  const handleSave = async () => {
    if (!editKey) return;
    setSaving(true);
    const token = getToken();

    // Reconstruct JSON with language structure
    const item = contents.find((c) => c.key === editKey);
    let newValue: string;
    try {
      const original = item ? JSON.parse(item.value) : {};
      
      // Ensure language structure exists
      if (!original[editLang]) {
        original[editLang] = {};
      }
      
      // Check if original has language structure or needs migration
      const hasLangStructure = original.ru || original.en || original[editLang];
      
      if (hasLangStructure) {
        // Apply field updates to current language
        for (const [path, val] of Object.entries(parsedFields)) {
          const parts = path.split(".");
          let obj = original[editLang];
          for (let i = 0; i < parts.length - 1; i++) {
            if (!obj[parts[i]]) obj[parts[i]] = {};
            obj = obj[parts[i]];
          }
          obj[parts[parts.length - 1]] = val;
        }
      } else {
        // Migrate old format: wrap existing content as 'ru' and add current edits
        const oldContent = { ...original };
        // Clear original and restructure with languages
        Object.keys(original).forEach(k => delete original[k]);
        original.ru = oldContent;
        original[editLang] = {};
        
        for (const [path, val] of Object.entries(parsedFields)) {
          const parts = path.split(".");
          let obj = original[editLang];
          for (let i = 0; i < parts.length - 1; i++) {
            if (!obj[parts[i]]) obj[parts[i]] = {};
            obj = obj[parts[i]];
          }
          obj[parts[parts.length - 1]] = val;
        }
      }
      
      newValue = JSON.stringify(original);
    } catch {
      newValue = editValue;
    }

    const res = await fetch(`/api/content/${editKey}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ value: newValue }),
    });

    if (res.ok) {
      notify("Контент сохранён");
      setEditKey(null);
      fetchContent();
    } else {
      notify("Ошибка сохранения");
    }
    setSaving(false);
  };

  const notify = (msg: string) => { setNotification(msg); setTimeout(() => setNotification(""), 3000); };

  const isLongContent = (key: string) => key === "content" || key.endsWith(".content") || key.endsWith(".text") || key.endsWith(".description");

  if (loading) return <div className="cms-loading"><div className="cms-spinner" /> Загрузка...</div>;

  return (
    <div className="cms-root">
      <AdminSidebar />
      <main className="cms-main">
        <div className="cms-header">
          <h1 className="cms-header-title">Управление контентом</h1>
          <div className="cms-header-actions">
            <span style={{ fontSize: "13px", color: "var(--cms-text-muted)" }}>{contents.length} секций</span>
          </div>
        </div>

        <div className="cms-content">
          {/* Content Sections */}
          <div style={{ display: "grid", gap: "12px" }}>
            {CONTENT_SECTIONS.map((section) => {
              const item = contents.find((c) => c.key === section.key);
              return (
                <div key={section.key} className="cms-table-wrap" style={{ padding: "16px 20px" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <div>
                      <div style={{ fontWeight: 700, fontSize: "14px" }}>{section.label}</div>
                      <div style={{ fontSize: "12px", color: "var(--cms-text-muted)", marginTop: "2px" }}>{section.desc}</div>
                    </div>
                    <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
                      {item && (
                        <span style={{ fontSize: "11px", color: "var(--cms-text-muted)" }}>
                          Обновлено: {new Date(item.updatedAt).toLocaleDateString("ru-RU")}
                        </span>
                      )}
                      <button className="cms-btn cms-btn-sm" onClick={() => openEdit(section.key)}>
                        Редактировать
                      </button>
                    </div>
                  </div>
                  {item && (
                    <div style={{ marginTop: "10px", fontSize: "12px", color: "var(--cms-text-muted)", maxHeight: "60px", overflow: "hidden" }}>
                      {(() => {
                        try {
                          const parsed = JSON.parse(item.value);
                          return Object.entries(parsed).slice(0, 3).map(([k, v]) => (
                            <div key={k}><strong>{k}:</strong> {String(v).substring(0, 80)}...</div>
                          ));
                        } catch { return item.value.substring(0, 200); }
                      })()}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </main>

      {/* Edit Modal */}
      {editKey && (
        <div className="cms-modal-overlay" onClick={() => setEditKey(null)}>
          <div className="cms-modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 700, maxHeight: "85vh" }}>
            <div className="cms-modal-header">
              <h3>Редактирование: {CONTENT_SECTIONS.find((s) => s.key === editKey)?.label}</h3>
              <button className="cms-modal-close" onClick={() => setEditKey(null)}>&times;</button>
            </div>
            <div className="cms-modal-body" style={{ maxHeight: "60vh", overflow: "auto" }}>
              {/* Language Tabs inside modal */}
              <div style={{ display: "flex", flexWrap: "wrap", gap: "6px", marginBottom: "16px", paddingBottom: "12px", borderBottom: "1px solid var(--cms-border)" }}>
                {LANGUAGES.map((lang) => (
                  <button
                    key={lang.code}
                    onClick={() => setEditLang(lang.code)}
                    style={{
                      padding: "6px 12px",
                      fontSize: "12px",
                      fontWeight: editLang === lang.code ? 700 : 400,
                      background: editLang === lang.code ? "var(--cms-accent)" : "var(--cms-surface)",
                      color: editLang === lang.code ? "#fff" : "var(--cms-text)",
                      border: "none",
                      borderRadius: "6px",
                      cursor: "pointer",
                    }}
                  >
                    {lang.name}
                  </button>
                ))}
              </div>

              <div style={{ marginBottom: "12px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ fontSize: "12px", color: "var(--cms-text-muted)" }}>
                  Редактируйте текст для: <strong>{LANGUAGES.find((l) => l.code === editLang)?.name}</strong>
                </span>
                <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
                  <span style={{ fontSize: "11px", color: "var(--cms-text-muted)" }}>Скопировать из:</span>
                  <select
                    className="cms-select"
                    style={{ width: "auto", fontSize: "11px", padding: "4px 8px" }}
                    value=""
                    onChange={(e) => {
                      if (e.target.value) {
                        loadLangContent(editKey!, e.target.value);
                      }
                    }}
                  >
                    <option value="">-- выбрать язык --</option>
                    {LANGUAGES.filter((l) => l.code !== editLang).map((lang) => (
                      <option key={lang.code} value={lang.code}>{lang.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div style={{ display: "grid", gap: "12px" }}>
                {Object.keys(parsedFields).length === 0 && (
                  <div style={{ padding: "20px", textAlign: "center", color: "var(--cms-text-muted)", background: "var(--cms-surface)", borderRadius: "8px" }}>
                    <div style={{ marginBottom: "8px" }}><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--cms-text-muted)" strokeWidth="1.5"><path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 013 3L7 19l-4 1 1-4L16.5 3.5z"/></svg></div>
                    <div>Нет контента для этого языка</div>
                    <div style={{ fontSize: "12px", marginTop: "4px" }}>Скопируйте из другого языка или добавьте новое поле</div>
                  </div>
                )}
                {Object.entries(parsedFields).map(([key, value]) => (
                  <div key={key} style={{ display: "flex", gap: "8px", alignItems: "flex-start" }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "4px" }}>
                        <span className="cms-label" style={{ textTransform: "capitalize", marginBottom: 0 }}>{key.replace(/\./g, " > ")}</span>
                        <button
                          type="button"
                          onClick={() => {
                            const newFields = { ...parsedFields };
                            delete newFields[key];
                            setParsedFields(newFields);
                          }}
                          style={{ background: "none", border: "none", color: "var(--cms-danger)", cursor: "pointer", fontSize: "12px", opacity: 0.6 }}
                          title="Удалить поле"
                        >
                          ✕
                        </button>
                      </div>
                      {isLongContent(key) ? (
                        <textarea
                          className="cms-textarea"
                          rows={6}
                          value={value}
                          onChange={(e) => updateField(key, e.target.value)}
                          style={{ width: "100%", fontFamily: "monospace", fontSize: "12px" }}
                        />
                      ) : (
                        <input
                          className="cms-input"
                          value={value}
                          onChange={(e) => updateField(key, e.target.value)}
                        />
                      )}
                    </div>
                  </div>
                ))}
              </div>

              {/* Add new field */}
              {showAddField ? (
                <div style={{ marginTop: "12px", display: "flex", gap: "8px", alignItems: "center" }}>
                  <input
                    className="cms-input"
                    placeholder="Название поля (напр. title, subtitle)"
                    value={newFieldKey}
                    onChange={(e) => setNewFieldKey(e.target.value)}
                    style={{ flex: 1 }}
                    autoFocus
                  />
                  <button
                    className="cms-btn cms-btn-sm cms-btn-primary"
                    onClick={() => {
                      if (newFieldKey.trim()) {
                        setParsedFields((prev) => ({ ...prev, [newFieldKey.trim()]: "" }));
                        setNewFieldKey("");
                        setShowAddField(false);
                      }
                    }}
                  >
                    Добавить
                  </button>
                  <button className="cms-btn cms-btn-sm" onClick={() => { setShowAddField(false); setNewFieldKey(""); }}>
                    Отмена
                  </button>
                </div>
              ) : (
                <button
                  className="cms-btn cms-btn-sm"
                  style={{ marginTop: "12px" }}
                  onClick={() => setShowAddField(true)}
                >
                  + Добавить поле
                </button>
              )}

              {/* Raw JSON toggle */}
              <details style={{ marginTop: "16px" }}>
                <summary style={{ fontSize: "12px", color: "var(--cms-text-muted)", cursor: "pointer" }}>Raw JSON</summary>
                <textarea
                  className="cms-textarea"
                  rows={8}
                  value={(() => {
                    try {
                      const item = contents.find((c) => c.key === editKey);
                      if (!item) return "{}";
                      const original = JSON.parse(item.value);
                      for (const [path, val] of Object.entries(parsedFields)) {
                        const parts = path.split(".");
                        let obj = original;
                        for (let i = 0; i < parts.length - 1; i++) {
                          if (!obj[parts[i]]) obj[parts[i]] = {};
                          obj = obj[parts[i]];
                        }
                        obj[parts[parts.length - 1]] = val;
                      }
                      return JSON.stringify(original, null, 2);
                    } catch { return editValue; }
                  })()}
                  onChange={(e) => setEditValue(e.target.value)}
                  style={{ width: "100%", fontFamily: "monospace", fontSize: "11px", marginTop: "8px" }}
                />
              </details>
            </div>
            <div className="cms-modal-actions">
              <button className="cms-btn cms-btn-primary" onClick={handleSave} disabled={saving}>{saving ? "Сохранение..." : "Сохранить"}</button>
              <button className="cms-btn" onClick={() => setEditKey(null)}>Отмена</button>
            </div>
          </div>
        </div>
      )}

      {notification && <div className="cms-toast">{notification}</div>}
    </div>
  );
}
