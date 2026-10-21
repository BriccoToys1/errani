"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { AdminPage } from "../AdminPage";
import { HeaderActions, Button, Icon, SearchField, SegmentedControl, Slider, Toggle as AdminToggle } from "@/components/admin";
import {
  applyAppearance,
  cacheAppearance,
  parseAppearance,
  DEFAULT_APPEARANCE,
  APPEARANCE_SETTING_KEY,
  type AdminAppearance,
  type AdminTheme,
} from "@/components/admin/appearance";
import { adminFetch, adminToastClass } from "@/lib/admin-client";
import { isPhotoMedia } from "@/lib/media-kind";
import {
  DEFAULT_MOBILE_NAV_SLOTS,
  MOBILE_NAV_CATALOG,
  MOBILE_NAV_SETTING_KEY,
  parseMobileNavSlots,
  type MobileNavSlotId,
} from "@/lib/mobile-nav";

interface Settings {
  siteEnabled: boolean;
  maintenanceMode: boolean;
  maintenanceMessage: string;
  siteName: string;
  siteUrl: string;
  contactEmail: string;
  currency: string;
  defaultLang: string;
  enablePreorders: boolean;
  enableFavorites: boolean;
  enableReviews: boolean;
  shippingMethods: string[];
  paymentMethods: string[];
  socialLinks: { instagram: string; telegram: string; vk: string; tiktok: string };
  emailNotifications: boolean;
  orderNotifyEmail: string;
  analyticsEnabled: boolean;
  cookieConsent: boolean;
  maxCartItems: number;
  freeShippingThreshold: number;
}

interface AdminSessionEntry {
  at: string;
  email: string;
  name: string;
  ip: string;
  country?: string;
  city?: string;
  userAgent?: string;
}

interface SeoSettings {
  title: string;
  description: string;
  keywords: string;
  titleEn: string;
  descriptionEn: string;
  keywordsEn: string;
}

const DEFAULT_SEO_SETTINGS: SeoSettings = {
  title: "errani — Авторские Колоды Таро",
  description: "Авторские колоды Таро от Екатерины Эррани.",
  keywords: "таро, колода таро, errani",
  titleEn: "errani — Author Tarot Decks",
  descriptionEn: "Author tarot decks by Ekaterina Errani.",
  keywordsEn: "tarot, tarot deck, errani",
};

const DEFAULT_SETTINGS: Settings = {
  siteEnabled: true,
  maintenanceMode: false,
  maintenanceMessage: "We are currently updating our site. Please check back soon!",
  siteName: "errani",
  siteUrl: "https://errani.ru",
  contactEmail: "info@errani.ru",
  currency: "RUB",
  defaultLang: "ru",
  enablePreorders: true,
  enableFavorites: true,
  enableReviews: false,
  shippingMethods: ["manual_delivery"],
  paymentMethods: ["tochka"],
  socialLinks: { instagram: "", telegram: "", vk: "", tiktok: "" },
  emailNotifications: true,
  orderNotifyEmail: "info@errani.ru",
  analyticsEnabled: true,
  cookieConsent: true,
  maxCartItems: 10,
  freeShippingThreshold: 10000,
};

const CURRENCIES = ["RUB", "USD", "EUR", "GBP", "KZT", "BYN"];
const LANGS = [
  { code: "ru", name: "Русский" }, { code: "en", name: "Английский" },
  { code: "it", name: "Итальянский" }, { code: "es", name: "Испанский" },
  { code: "fr", name: "Французский" }, { code: "de", name: "Немецкий" },
  { code: "tr", name: "Турецкий" }, { code: "ar", name: "Арабский" },
  { code: "zh", name: "Китайский" },
];

const PAYMENT = [
  { id: "tochka", label: "СБП" },
];

function SettingSection({
  title,
  hint,
  divider = true,
  children,
}: {
  title: string;
  hint?: string;
  divider?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="cms-table-wrap cms-settings-section">
      <div className={`cms-settings-section-head${divider ? " has-divider" : ""}`}>
        <span className="cms-settings-section-title">{title}</span>
        {hint && <span className="cms-settings-section-hint">{hint}</span>}
      </div>
      {children}
    </div>
  );
}

function WallpaperPicker({
  currentUrl,
  onPick,
  onClear,
  getToken,
}: {
  currentUrl: string;
  onPick: (url: string) => void;
  onClear: () => void;
  getToken: () => string | null;
}) {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<{ url: string; filename: string }[]>([]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [error, setError] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const loadGallery = useCallback(async () => {
    const token = getToken();
    if (!token) return;
    setLoading(true);
    setError("");
    try {
      const r = await fetch("/api/admin/upload/images", { headers: { Authorization: `Bearer ${token}` } });
      const d = await r.json().catch(() => ({}));
      const list = Array.isArray(d?.items) ? d.items : [];
      setItems(
        list
          .map((item: Record<string, unknown>) => ({
            url: String(item.url || ""),
            filename: String(item.filename || ""),
            mimeType: String(item.mimeType || ""),
          }))
          .filter((i: { url: string; filename: string; mimeType: string }) => i.url && isPhotoMedia(i))
          .map((i: { url: string; filename: string }) => ({ url: i.url, filename: i.filename }))
      );
    } catch {
      setItems([]);
      setError("Не удалось загрузить галерею");
    } finally {
      setLoading(false);
    }
  }, [getToken]);

  useEffect(() => {
    if (!open) return;
    void loadGallery();
  }, [open, loadGallery]);

  const uploadFiles = async (files: FileList | File[]) => {
    const token = getToken();
    if (!token) return;
    const list = Array.from(files).filter((f) => isPhotoMedia({ mimeType: f.type, filename: f.name }));
    if (list.length === 0) {
      setError("Можно загружать только фото (JPG, PNG, WEBP)");
      return;
    }
    setUploading(true);
    setError("");
    let lastUrl = "";
    try {
      for (const file of list.slice(0, 10)) {
        const form = new FormData();
        form.append("file", file);
        const res = await fetch("/api/admin/media/upload", {
          method: "POST",
          headers: { Authorization: `Bearer ${token}` },
          body: form,
        });
        const data = await res.json().catch(() => ({}));
        if (res.ok && data?.url) lastUrl = String(data.url);
      }
      await loadGallery();
      if (lastUrl) {
        onPick(lastUrl);
        setOpen(false);
      }
    } catch {
      setError("Ошибка загрузки");
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="cms-wallpaper-dd">
      <div className="cms-wallpaper-dd-row">
        <div className={`cms-wallpaper-dd-preview${currentUrl ? " has-image" : ""}`} aria-hidden>
          {currentUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={currentUrl} alt="" />
          ) : null}
        </div>
        <Button icon="wallpaper" onClick={() => setOpen(true)}>
          Выбрать
        </Button>
        {currentUrl ? (
          <Button variant="ghost" icon="hide" onClick={onClear}>
            Убрать
          </Button>
        ) : null}
      </div>

      {open && (
        <div className="cms-modal-overlay" onClick={() => setOpen(false)}>
          <div
            className="cms-modal cms-wallpaper-gallery-modal"
            onClick={(e) => e.stopPropagation()}
            style={{ maxWidth: 720, width: "94vw" }}
          >
            <div className="cms-modal-header">
              <h3>Галерея</h3>
              <button type="button" className="cms-modal-close" onClick={() => setOpen(false)} aria-label="Закрыть">
                &times;
              </button>
            </div>
            <div className="cms-modal-body" style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <div
                className={`cms-uploader-zone${dragging ? " dragging" : ""}`}
                onDrop={(e) => {
                  e.preventDefault();
                  setDragging(false);
                  void uploadFiles(e.dataTransfer.files);
                }}
                onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
                onDragLeave={() => setDragging(false)}
                onClick={() => !uploading && fileInputRef.current?.click()}
              >
                <div className="cms-uploader-zone-label">
                  <Icon name="attach" size={16} />
                  <span>{uploading ? "Загрузка…" : "Перетащите фото сюда или нажмите для выбора"}</span>
                </div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp"
                  multiple
                  style={{ display: "none" }}
                  onChange={(e) => {
                    const files = e.target.files;
                    e.target.value = "";
                    if (files?.length) void uploadFiles(files);
                  }}
                />
              </div>

              {error ? <div style={{ fontSize: 12, color: "var(--cms-danger)" }}>{error}</div> : null}

              {loading ? (
                <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 10, padding: 40, color: "var(--cms-text-muted)", fontSize: 13 }}>
                  <span className="cms-spinner" /> Загрузка…
                </div>
              ) : (
                <div className="cms-wallpaper-picker-grid">
                  {items.map((item) => (
                    <button
                      key={item.url}
                      type="button"
                      className={`cms-wallpaper-picker-tile${item.url === currentUrl ? " active" : ""}`}
                      title={item.filename}
                      onClick={() => {
                        onPick(item.url);
                        setOpen(false);
                      }}
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={item.url} alt={item.filename} />
                    </button>
                  ))}
                  {items.length === 0 && (
                    <div style={{ gridColumn: "1 / -1", textAlign: "center", color: "var(--cms-text-muted)", padding: 28, fontSize: 13 }}>
                      Нет фото в галерее — загрузите выше
                    </div>
                  )}
                </div>
              )}
            </div>
            <div className="cms-modal-actions">
              <Button variant="ghost" onClick={() => setOpen(false)}>Закрыть</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Toggle({ checked, onChange, label, description }: { checked: boolean; onChange: (v: boolean) => void; label: string; description?: string }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 0" }}>
      <div>
        <div style={{ fontSize: "13px", fontWeight: 600 }}>{label}</div>
        {description && <div style={{ fontSize: "12px", color: "var(--cms-text-muted)", marginTop: "2px" }}>{description}</div>}
      </div>
      <label className="cms-toggle">
        <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
        <span className="cms-toggle-slider" />
      </label>
    </div>
  );
}

function MemoryManagement({ getToken, notify }: { getToken: () => string | null; notify: (msg: string) => void }) {
  const [stats, setStats] = useState({ pageViews: 0, inquiries: 0, dailyStats: 0, dbSize: '0 KB' });
  const [cleaning, setCleaning] = useState<string | null>(null);
  const [confirmClean, setConfirmClean] = useState<string | null>(null);

  useEffect(() => {
    const token = getToken();
    if (token) {
      fetch('/api/admin/memory', { headers: { Authorization: `Bearer ${token}` } })
        .then(r => r.json())
        .then(data => {
          if (!data.error) setStats(data);
        })
        .catch(() => {});
    }
  }, [getToken]);

  const cleanData = async (type: string) => {
    setCleaning(type);
    const token = getToken();
    const res = await fetch('/api/admin/memory', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ action: 'clean', type }),
    });
    const data = await res.json();
    if (data.success) {
      notify(data.message);
      // Refresh stats
      const statsRes = await fetch('/api/admin/memory', { headers: { Authorization: `Bearer ${token}` } });
      const newStats = await statsRes.json();
      if (!newStats.error) setStats(newStats);
    } else {
      notify(data.error || 'Ошибка очистки');
    }
    setCleaning(null);
    setConfirmClean(null);
  };

  return (
    <SettingSection title="Управление памятью">
      <div style={{ marginBottom: "16px" }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "10px" }}>
          <div className="cms-stat-card">
            <div className="cms-stat-label">Просмотры</div>
            <div className="cms-stat-value">{stats.pageViews.toLocaleString()}</div>
          </div>
          <div className="cms-stat-card">
            <div className="cms-stat-label">Заявки</div>
            <div className="cms-stat-value">{stats.inquiries}</div>
          </div>
          <div className="cms-stat-card">
            <div className="cms-stat-label">Статистика (дней)</div>
            <div className="cms-stat-value">{stats.dailyStats}</div>
          </div>
          <div className="cms-stat-card">
            <div className="cms-stat-label">Размер БД</div>
            <div className="cms-stat-value" style={{ fontSize: "16px" }}>{stats.dbSize}</div>
          </div>
        </div>
      </div>

      <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
        <button 
          className="cms-btn cms-btn-sm cms-btn-primary" 
          onClick={() => setConfirmClean('recalculate_stats')}
          disabled={cleaning !== null}
        >
          Пересчитать статистику
        </button>
        <button 
          className="cms-btn cms-btn-sm" 
          onClick={() => setConfirmClean('old_pageviews')}
          disabled={cleaning !== null}
        >
          Очистить старые просмотры (30+ дней)
        </button>
        <button 
          className="cms-btn cms-btn-sm" 
          onClick={() => setConfirmClean('closed_inquiries')}
          disabled={cleaning !== null}
        >
          Удалить закрытые заявки
        </button>
        <button 
          className="cms-btn cms-btn-sm cms-btn-danger" 
          onClick={() => setConfirmClean('all_pageviews')}
          disabled={cleaning !== null}
        >
          Очистить всю аналитику
        </button>
      </div>

      <div style={{ marginTop: "12px", fontSize: "12px", color: "var(--cms-text-muted)" }}>
        Если счётчики просмотров завышены — нажмите «Пересчитать статистику»
      </div>

      {/* Confirm Modal */}
      {confirmClean && (
        <div className="cms-modal-overlay" onClick={() => setConfirmClean(null)}>
          <div className="cms-modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 420 }}>
            <div className="cms-modal-header">
              <h3>Подтверждение очистки</h3>
              <button className="cms-modal-close" onClick={() => setConfirmClean(null)}>×</button>
            </div>
            <div className="cms-modal-body">
              <p>Вы уверены, что хотите выполнить очистку?</p>
              <p style={{ fontSize: "13px", color: "var(--cms-text-muted)" }}>
                {confirmClean === 'old_pageviews' && 'Будут удалены записи просмотров страниц старше 30 дней.'}
                {confirmClean === 'closed_inquiries' && 'Будут удалены все закрытые заявки.'}
                {confirmClean === 'all_pageviews' && 'Будут удалены ВСЕ записи аналитики. Это действие нельзя отменить!'}
                {confirmClean === 'recalculate_stats' && 'Дневная статистика будет пересчитана из реальных данных. Завышенные счётчики будут исправлены.'}
              </p>
            </div>
            <div className="cms-modal-footer">
              <button className="cms-btn" onClick={() => setConfirmClean(null)}>Отмена</button>
              <button 
                className={`cms-btn ${confirmClean === 'all_pageviews' ? 'cms-btn-danger' : 'cms-btn-primary'}`}
                onClick={() => cleanData(confirmClean)}
                disabled={cleaning !== null}
              >
                {cleaning ? 'Очистка...' : 'Подтвердить'}
              </button>
            </div>
          </div>
        </div>
      )}
    </SettingSection>
  );
}

function ResendSettings({ notify, getToken }: { notify: (msg: string) => void; getToken: () => string | null }) {
  const [apiKey, setApiKey] = useState('');
  const [masked, setMasked] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savingBoxes, setSavingBoxes] = useState(false);
  const [testing, setTesting] = useState(false);
  const [configured, setConfigured] = useState<boolean | null>(null);
  const [testTo, setTestTo] = useState('');
  const [testFrom, setTestFrom] = useState('mail@errani.ru');
  const [mailboxEnabled, setMailboxEnabled] = useState<Record<string, boolean>>({
    'mail@errani.ru': true,
    'sales@errani.ru': true,
    'info@errani.ru': true,
    'katy@errani.ru': true,
  });

  useEffect(() => {
    const token = getToken();
    if (!token) return;
    fetch('/api/admin/settings?key=resend_api_key', { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json())
      .then(d => {
        if (d.value) { setApiKey(d.value); setConfigured(true); }
        else setConfigured(false);
      })
      .catch(() => setConfigured(false));
    fetch('/api/admin/settings?key=mailboxes_v1', { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json())
      .then(d => {
        if (!d.value) return;
        try {
          const parsed = JSON.parse(d.value) as Record<string, { enabled?: boolean } | boolean>;
          setMailboxEnabled((prev) => {
            const next = { ...prev };
            for (const addr of Object.keys(next)) {
              const entry = parsed[addr];
              if (typeof entry === 'boolean') next[addr] = entry;
              else if (entry && typeof entry === 'object') next[addr] = entry.enabled !== false;
            }
            return next;
          });
        } catch { /* ignore */ }
      })
      .catch(() => undefined);
  }, [getToken]);

  const save = async () => {
    const key = apiKey.trim();
    if (!key) { notify('Введите API ключ'); return; }
    setSaving(true);
    const token = getToken();
    const res = await fetch('/api/admin/settings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ key: 'resend_api_key', value: key }),
    });
    if (res.ok) { setConfigured(true); notify('Resend API Key сохранён'); }
    else notify('Ошибка сохранения');
    setSaving(false);
  };

  const saveMailboxes = async () => {
    setSavingBoxes(true);
    const token = getToken();
    const value = Object.fromEntries(
      Object.entries(mailboxEnabled).map(([addr, enabled]) => [addr, { enabled }])
    );
    const res = await fetch('/api/admin/settings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ key: 'mailboxes_v1', value: JSON.stringify(value) }),
    });
    if (res.ok) notify('Ящики сохранены');
    else notify('Ошибка сохранения ящиков');
    setSavingBoxes(false);
  };

  const sendTest = async () => {
    if (!testTo.trim()) { notify('Укажите email для теста'); return; }
    setTesting(true);
    const token = getToken();
    const res = await fetch('/api/admin/email', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({
        to: testTo.trim(),
        from: testFrom,
        subject: 'Тест почты errani',
        body: `<p>Это тестовое письмо с адреса ${testFrom}. Если вы его получили — почта работает!</p>`,
      }),
    });
    const data = await res.json();
    if (res.ok) notify('Тестовое письмо отправлено!');
    else notify(`Ошибка: ${data.error || 'неизвестно'}`);
    setTesting(false);
  };

  return (
    <SettingSection title="Resend">
      <div style={{ marginBottom: '14px', padding: '12px', borderRadius: '8px', display: 'flex', alignItems: 'center', gap: '12px', background: configured === true ? 'rgba(34,197,94,0.1)' : configured === false ? 'rgba(239,68,68,0.1)' : 'var(--cms-surface)' }}>
        {configured === true
          ? <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#22c55e" strokeWidth="2"><path d="M22 11.08V12a10 10 0 11-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
          : configured === false
            ? <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
            : <div className="cms-spinner" style={{ width: 18, height: 18 }} />
        }
        <div>
          <div style={{ fontWeight: 600, fontSize: '14px' }}>
            {configured === true ? 'API Key настроен — почта работает' : configured === false ? 'API Key не задан — письма не отправляются' : 'Проверка...'}
          </div>
          <div style={{ fontSize: '12px', color: 'var(--cms-text-muted)' }}>
            Отправка через Resend с выбранных ящиков errani.ru
          </div>
        </div>
      </div>

      <div style={{ display: 'grid', gap: '12px' }}>
        <div>
          <label className="cms-label">Resend API Key</label>
          <div style={{ display: 'flex', gap: '6px' }}>
            <input
              className="cms-input"
              type={masked ? 'password' : 'text'}
              value={apiKey}
              onChange={e => setApiKey(e.target.value)}
              placeholder="re_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
              style={{ flex: 1, fontFamily: 'monospace', fontSize: '13px' }}
            />
            <button type="button" className="cms-btn cms-btn-sm cms-btn-ghost" onClick={() => setMasked(m => !m)} title={masked ? 'Показать' : 'Скрыть'}>
              {masked ? <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg> : <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19m-6.72-1.07a3 3 0 11-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>}
            </button>
            <button className="cms-btn cms-btn-sm cms-btn-primary" onClick={save} disabled={saving}>
              {saving ? 'Сохранение...' : 'Сохранить'}
            </button>
          </div>
        </div>

        <div>
          <label className="cms-label">Ящики (интеграция)</label>
          <div style={{ display: 'grid', gap: 8, marginTop: 6 }}>
            {Object.keys(mailboxEnabled).map((addr) => (
              <label key={addr} className="cms-toggle-row" style={{ justifyContent: 'space-between' }}>
                <span style={{ fontSize: 13 }}>{addr}</span>
                <input
                  type="checkbox"
                  checked={mailboxEnabled[addr]}
                  onChange={(e) => setMailboxEnabled((prev) => ({ ...prev, [addr]: e.target.checked }))}
                />
              </label>
            ))}
          </div>
          <button className="cms-btn cms-btn-sm cms-btn-primary" style={{ marginTop: 10 }} onClick={saveMailboxes} disabled={savingBoxes}>
            {savingBoxes ? 'Сохранение...' : 'Сохранить ящики'}
          </button>
          <div style={{ fontSize: 11, color: 'var(--cms-text-muted)', marginTop: 8, lineHeight: 1.5 }}>
            Включите адреса, которые настроены в Resend (Domains → Inbound). В шапке «Почта» можно переключать ящик — список писем фильтруется по отправителю/получателю.
          </div>
        </div>

        <div>
          <label className="cms-label">Тестовое письмо</label>
          <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
            <select className="cms-select" value={testFrom} onChange={(e) => setTestFrom(e.target.value)} style={{ minWidth: 180 }}>
              {Object.keys(mailboxEnabled).filter((a) => mailboxEnabled[a]).map((addr) => (
                <option key={addr} value={addr}>{addr}</option>
              ))}
            </select>
            <input className="cms-input" type="email" value={testTo} onChange={e => setTestTo(e.target.value)} placeholder="your@email.com" style={{ flex: 1, minWidth: 160 }} />
            <button className="cms-btn cms-btn-sm" onClick={sendTest} disabled={testing}>
              {testing ? 'Отправка...' : 'Отправить тест'}
            </button>
          </div>
        </div>
      </div>

      <div style={{ marginTop: '14px', padding: '12px', background: 'var(--cms-surface)', borderRadius: '8px', fontSize: '12px', color: 'var(--cms-text-muted)', lineHeight: 1.8 }}>
        <strong>Как восстановить почту:</strong>
        <ol style={{ margin: '6px 0 0 16px', padding: 0 }}>
          <li>Войдите в <a href="https://resend.com/api-keys" target="_blank" rel="noreferrer" style={{ color: 'var(--cms-accent)' }}>resend.com/api-keys</a></li>
          <li>Создайте новый ключ с правами <strong>Sending access</strong></li>
          <li>Вставьте его выше и нажмите «Сохранить»</li>
          <li>Убедитесь что домен <strong>errani.ru</strong> верифицирован в Resend → Domains</li>
          <li>Добавьте inbound-адреса: mail@ / sales@ / info@ / katy@errani.ru</li>
        </ol>
        <div style={{ marginTop: '8px', paddingTop: '8px', borderTop: '1px solid var(--cms-border)' }}>
          <strong>Для входящих писем</strong> (Resend → Inbound):<br/>
          MX-запись: <code style={{ background: 'rgba(255,255,255,0.07)', padding: '1px 5px', borderRadius: 3 }}>errani.ru MX 10 inbound-smtp.resend.com</code><br/>
          Webhook URL: <code style={{ background: 'rgba(255,255,255,0.07)', padding: '1px 5px', borderRadius: 3 }}>https://errani.ru/api/admin/email/webhook</code>
        </div>
      </div>
    </SettingSection>
  );
}

function IntegrationsTab({ notify, getToken }: { notify: (msg: string) => void; getToken: () => string | null }) {
  return (
    <div className="cms-settings-stack">
      <ResendSettings notify={notify} getToken={getToken} />
      <SettingSection title="Экспорт данных" hint="Выгрузка из админки в XLS">
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
          <a className="cms-btn cms-btn-sm" href="/api/admin/export?type=orders&format=xls">Экспорт заказов</a>
          <a className="cms-btn cms-btn-sm" href="/api/admin/export?type=inquiries&format=xls">Экспорт заявок</a>
          <a className="cms-btn cms-btn-sm" href="/api/admin/export?type=waitlist&format=xls">Экспорт ожидания</a>
          <a className="cms-btn cms-btn-sm" href="/api/admin/export?type=users&format=xls">Экспорт клиентов</a>
        </div>
      </SettingSection>
    </div>
  );
}

function NotificationsTab({ getToken, notify }: { getToken: () => string | null; notify: (msg: string) => void }) {
  const [enabled, setEnabled] = useState(true);
  const [soundUrl, setSoundUrl] = useState("");
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    const token = getToken();
    if (!token) return;
    fetch("/api/admin/settings?key=notificationsEnabled", { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json())
      .then(d => setEnabled(d.value !== "false"))
      .catch(() => {});
    fetch("/api/admin/settings?key=notificationSoundUrl", { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json())
      .then(d => { if (d.value) setSoundUrl(d.value); })
      .catch(() => {});
  }, [getToken]);

  const saveSetting = async (key: string, value: string) => {
    const token = getToken();
    await fetch("/api/admin/settings", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ key, value }),
    });
  };

  const toggleEnabled = async (v: boolean) => {
    setEnabled(v);
    await saveSetting("notificationsEnabled", v ? "true" : "false");
  };

  const handleUpload = async (file: File) => {
    if (!file.name.toLowerCase().endsWith(".mp3") && file.type !== "audio/mpeg") {
      notify("Разрешён только формат MP3");
      return;
    }
    setUploading(true);
    const token = getToken();
    const formData = new FormData();
    formData.append("file", file);
    try {
      const res = await fetch("/api/admin/notification-sound", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });
      const data = await res.json();
      if (data.success) {
        setSoundUrl(data.url);
        await saveSetting("notificationSoundUrl", data.url);
        notify("Звук уведомлений обновлён");
      } else {
        notify(data.error || "Ошибка загрузки");
      }
    } catch {
      notify("Ошибка сети");
    }
    setUploading(false);
  };

  const preview = () => {
    if (soundUrl) new Audio(soundUrl).play().catch(() => {});
  };

  return (
    <div className="cms-settings-stack">
      <SettingSection title="Уведомления">
        <Toggle
          checked={enabled}
          onChange={toggleEnabled}
          label="Звуковые уведомления"
          description="Проигрывать звук в браузере при новом заказе, письме или заявке, пока открыта админка"
        />
        {enabled && (
          <div style={{ marginTop: "14px", display: "flex", flexWrap: "wrap", alignItems: "center", gap: 10 }}>
            {!soundUrl && (
              <label className="cms-btn cms-btn-sm" style={{ cursor: uploading ? "wait" : "pointer" }}>
                <Icon name="attach" size={14} />
                Прикрепить
                <input
                  type="file"
                  accept="audio/mpeg,.mp3"
                  style={{ display: "none" }}
                  disabled={uploading}
                  onChange={(e) => { const f = e.target.files?.[0]; if (f) handleUpload(f); e.target.value = ""; }}
                />
              </label>
            )}
            {soundUrl && (
              <>
                <Button icon="play" onClick={preview}>Прослушать</Button>
                <label className="cms-btn cms-btn-sm" style={{ cursor: uploading ? "wait" : "pointer" }}>
                  <Icon name="replace" size={14} />
                  Заменить
                  <input
                    type="file"
                    accept="audio/mpeg,.mp3"
                    style={{ display: "none" }}
                    disabled={uploading}
                    onChange={(e) => { const f = e.target.files?.[0]; if (f) handleUpload(f); e.target.value = ""; }}
                  />
                </label>
                <Icon name="check" size={14} style={{ color: "#4ade80" }} />
              </>
            )}
            {uploading && <span style={{ fontSize: 12, color: "var(--cms-text-muted)" }}>Загрузка...</span>}
          </div>
        )}
      </SettingSection>
    </div>
  );
}

interface PageSeo {
  title: string;
  description: string;
  keywords: string;
  ogTitle: string;
  ogDescription: string;
  ogImage: string;
  titleEn: string;
  descriptionEn: string;
  keywordsEn: string;
  ogTitleEn: string;
  ogDescriptionEn: string;
  ogImageEn: string;
}

const SEO_PAGE_CONFIGS = [
  { key: "seo_global", label: "Главная страница", url: "/" },
  { key: "seo_catalog", label: "Каталог", url: "/catalog" },
  { key: "seo_oferta", label: "Публичная оферта", url: "/oferta" },
  { key: "seo_privacy", label: "Политика конфиденциальности", url: "/privacy" },
];

const EMPTY_PAGE_SEO: PageSeo = {
  title: "", description: "", keywords: "", ogTitle: "", ogDescription: "", ogImage: "",
  titleEn: "", descriptionEn: "", keywordsEn: "", ogTitleEn: "", ogDescriptionEn: "", ogImageEn: "",
};

function SeoPagesEditor({ getToken, notify }: { getToken: () => string | null; notify: (msg: string) => void }) {
  const [settings, setSettings] = useState<Record<string, PageSeo>>({});
  const [saving, setSaving] = useState<Record<string, boolean>>({});

  useEffect(() => {
    const token = getToken();
    if (!token) return;
    const loadSettings = async () => {
      const loaded: Record<string, PageSeo> = {};
      await Promise.all(
        SEO_PAGE_CONFIGS.map(async ({ key }) => {
          try {
            const res = await fetch(`/api/admin/settings?key=${encodeURIComponent(key)}`, { headers: { Authorization: `Bearer ${token}` } });
            if (res.ok) {
              const data = await res.json();
              if (data.value) {
                const seo = JSON.parse(data.value) as Partial<PageSeo & { keywords: string[] | string; keywordsEn: string[] | string }>;
                loaded[key] = {
                  title: seo.title || "",
                  description: seo.description || "",
                  keywords: Array.isArray(seo.keywords) ? seo.keywords.join(", ") : (seo.keywords || ""),
                  ogTitle: seo.ogTitle || "",
                  ogDescription: seo.ogDescription || "",
                  ogImage: seo.ogImage || "",
                  titleEn: seo.titleEn || "",
                  descriptionEn: seo.descriptionEn || "",
                  keywordsEn: Array.isArray(seo.keywordsEn) ? seo.keywordsEn.join(", ") : (seo.keywordsEn || ""),
                  ogTitleEn: seo.ogTitleEn || "",
                  ogDescriptionEn: seo.ogDescriptionEn || "",
                  ogImageEn: seo.ogImageEn || "",
                };
              } else {
                loaded[key] = { ...EMPTY_PAGE_SEO };
              }
            }
          } catch {
            loaded[key] = { ...EMPTY_PAGE_SEO };
          }
        })
      );
      setSettings(loaded);
    };
    loadSettings();
  }, [getToken]);

  const updateField = (key: string, field: keyof PageSeo, value: string) => {
    setSettings(prev => ({ ...prev, [key]: { ...(prev[key] ?? EMPTY_PAGE_SEO), [field]: value } }));
  };

  const handleSave = async (key: string) => {
    const token = getToken();
    if (!token) return;
    setSaving(prev => ({ ...prev, [key]: true }));
    const seo = settings[key] ?? EMPTY_PAGE_SEO;
    try {
      const res = await fetch("/api/admin/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          key,
          value: JSON.stringify({
            title: seo.title.trim(),
            description: seo.description.trim(),
            keywords: seo.keywords.split(",").map(k => k.trim()).filter(Boolean),
            ogTitle: seo.ogTitle.trim(),
            ogDescription: seo.ogDescription.trim(),
            ogImage: seo.ogImage.trim(),
            titleEn: seo.titleEn.trim(),
            descriptionEn: seo.descriptionEn.trim(),
            keywordsEn: seo.keywordsEn.split(",").map(k => k.trim()).filter(Boolean),
            ogTitleEn: seo.ogTitleEn.trim(),
            ogDescriptionEn: seo.ogDescriptionEn.trim(),
            ogImageEn: seo.ogImageEn.trim(),
          }),
        }),
      });
      notify(res.ok ? "SEO сохранено" : "Ошибка при сохранении");
    } catch {
      notify("Ошибка сети");
    }
    setSaving(prev => ({ ...prev, [key]: false }));
  };

  return (
    <div className="cms-settings-stack">
      {SEO_PAGE_CONFIGS.map(({ key, label, url }) => {
        const seo = settings[key] ?? EMPTY_PAGE_SEO;
        const charTitle = seo.title.length;
        const charDesc = seo.description.length;
        return (
          <div key={key} className="cms-table-wrap cms-settings-section">
            <div className="cms-settings-section-head has-divider" style={{ justifyContent: "space-between", width: "100%" }}>
              <div>
                <div className="cms-settings-section-title">{label}</div>
                <a href={url} target="_blank" rel="noopener noreferrer" style={{ fontSize: "12px", color: "var(--cms-text-muted)", marginTop: "2px", display: "inline-block", textDecoration: "none" }}>
                  errani.ru{url} ↗
                </a>
              </div>
              <button onClick={() => handleSave(key)} disabled={saving[key]} className="cms-btn cms-btn-primary" style={{ minWidth: "100px" }}>
                {saving[key] ? "Сохраняем…" : "Сохранить"}
              </button>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "14px" }}>
              <label className="cms-label">
                Title (RU)
                <input className="cms-input" value={seo.title} onChange={e => updateField(key, "title", e.target.value)} placeholder="Заголовок RU" style={{ marginTop: "5px" }} />
                <div style={{ fontSize: "11px", color: charTitle > 60 ? "var(--cms-danger)" : "var(--cms-text-muted)", marginTop: "4px" }}>{charTitle}/60</div>
              </label>
              <label className="cms-label">
                Title (EN)
                <input className="cms-input" value={seo.titleEn} onChange={e => updateField(key, "titleEn", e.target.value)} placeholder="Title EN" style={{ marginTop: "5px" }} />
              </label>
              <label className="cms-label">
                Description (RU)
                <textarea className="cms-textarea" rows={3} value={seo.description} onChange={e => updateField(key, "description", e.target.value)} placeholder="Описание RU" style={{ marginTop: "5px" }} />
                <div style={{ fontSize: "11px", color: charDesc > 160 ? "var(--cms-danger)" : "var(--cms-text-muted)", marginTop: "4px" }}>{charDesc}/160</div>
              </label>
              <label className="cms-label">
                Description (EN)
                <textarea className="cms-textarea" rows={3} value={seo.descriptionEn} onChange={e => updateField(key, "descriptionEn", e.target.value)} placeholder="Description EN" style={{ marginTop: "5px" }} />
              </label>
              <label className="cms-label">
                Keywords (RU)
                <input className="cms-input" value={seo.keywords} onChange={e => updateField(key, "keywords", e.target.value)} placeholder="таро, колода" style={{ marginTop: "5px" }} />
              </label>
              <label className="cms-label">
                Keywords (EN)
                <input className="cms-input" value={seo.keywordsEn} onChange={e => updateField(key, "keywordsEn", e.target.value)} placeholder="tarot, deck" style={{ marginTop: "5px" }} />
              </label>
              <label className="cms-label">
                OG Title (RU)
                <input className="cms-input" value={seo.ogTitle} onChange={e => updateField(key, "ogTitle", e.target.value)} style={{ marginTop: "5px" }} />
              </label>
              <label className="cms-label">
                OG Title (EN)
                <input className="cms-input" value={seo.ogTitleEn} onChange={e => updateField(key, "ogTitleEn", e.target.value)} style={{ marginTop: "5px" }} />
              </label>
              <label className="cms-label">
                OG Image (RU)
                <input className="cms-input" value={seo.ogImage} onChange={e => updateField(key, "ogImage", e.target.value)} placeholder="/media/preview.jpg" style={{ marginTop: "5px" }} />
              </label>
              <label className="cms-label">
                OG Image (EN)
                <input className="cms-input" value={seo.ogImageEn} onChange={e => updateField(key, "ogImageEn", e.target.value)} placeholder="/media/preview-en.jpg" style={{ marginTop: "5px" }} />
              </label>
              <label className="cms-label">
                OG Description (RU)
                <textarea className="cms-textarea" rows={3} value={seo.ogDescription} onChange={e => updateField(key, "ogDescription", e.target.value)} placeholder="Описание для соцсетей" style={{ marginTop: "5px" }} />
              </label>
              <label className="cms-label">
                OG Description (EN)
                <textarea className="cms-textarea" rows={3} value={seo.ogDescriptionEn} onChange={e => updateField(key, "ogDescriptionEn", e.target.value)} placeholder="Social description EN" style={{ marginTop: "5px" }} />
              </label>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function MobileNavEditor({
  slots,
  onChange,
}: {
  slots: MobileNavSlotId[];
  onChange: (next: MobileNavSlotId[]) => void;
}) {
  return (
    <div style={{ display: "grid", gap: 12 }}>
      <div style={{ fontSize: 12, color: "var(--cms-text-muted)", lineHeight: 1.45 }}>
        4 быстрых раздела в нижнем меню. Поиск справа всегда на месте. Полный список разделов — через кнопку меню сверху.
      </div>
      {slots.map((slotId, index) => (
        <label key={`mobile-slot-${index}`} className="cms-label">
          Слот {index + 1}
          <select
            className="cms-select"
            value={slotId}
            onChange={(e) => {
              const next = [...slots] as MobileNavSlotId[];
              next[index] = e.target.value as MobileNavSlotId;
              onChange(parseMobileNavSlots(next));
            }}
            style={{ marginTop: 6 }}
          >
            {MOBILE_NAV_CATALOG.map((opt) => (
              <option key={opt.id} value={opt.id} disabled={slots.includes(opt.id) && opt.id !== slotId}>
                {opt.label}
              </option>
            ))}
          </select>
        </label>
      ))}
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 4 }}>
        {slots.map((id) => {
          const opt = MOBILE_NAV_CATALOG.find((o) => o.id === id);
          if (!opt) return null;
          return (
            <span key={id} className="cms-badge" style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
              <Icon name={opt.icon} size={12} />
              {opt.label}
            </span>
          );
        })}
        <span className="cms-badge" style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
          <Icon name="search" size={12} />
          Поиск
        </span>
      </div>
    </div>
  );
}

export default function AdminSettingsPage() {
  const router = useRouter();
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [saving, setSaving] = useState(false);
  const [notification, setNotification] = useState("");
  const [activeTab, setActiveTab] = useState("general");
  const [appearance, setAppearance] = useState<AdminAppearance>(DEFAULT_APPEARANCE);
  const [savedAppearance, setSavedAppearance] = useState<AdminAppearance>(DEFAULT_APPEARANCE);
  const [mobileNavSlots, setMobileNavSlots] = useState<MobileNavSlotId[]>(DEFAULT_MOBILE_NAV_SLOTS);
  const [dirty, setDirty] = useState(false);

  const [settingsSearch, setSettingsSearch] = useState("");
  const [dbStats, setDbStats] = useState({ users: 0, orders: 0, products: 0, pageViews: 0 });
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [featuredProductLink, setFeaturedProductLink] = useState("");
  const [productOptions, setProductOptions] = useState<Array<{ slug: string; name: string }>>([]);
  const [deliveryEstimate, setDeliveryEstimate] = useState("Ориентировочный срок доставки ~ начало Мая");
  const [orderDeliveryFootnote, setOrderDeliveryFootnote] = useState("");
  const [adminSessions, setAdminSessions] = useState<AdminSessionEntry[]>([]);
  const [seoSettings, setSeoSettings] = useState<SeoSettings>(DEFAULT_SEO_SETTINGS);
  const [robotsText, setRobotsText] = useState("User-agent: *\nAllow: /\nDisallow: /admin\nDisallow: /api\n\nSitemap: https://errani.ru/sitemap.xml");

  const getToken = useCallback(() => localStorage.getItem("admin_token"), []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const tab = new URLSearchParams(window.location.search).get("tab");
    if (tab) setActiveTab(tab);
  }, []);

  useEffect(() => {
    const token = getToken();
    if (!token) { router.push("/admin/login"); return; }

    // Load from DB first, fallback to localStorage
    fetch("/api/admin/settings?key=general_settings", { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json())
      .then(data => {
        if (data.value) {
          try { setSettings({ ...DEFAULT_SETTINGS, ...JSON.parse(data.value) }); } catch {}
        } else {
          const saved = localStorage.getItem("cms_settings");
          if (saved) { try { setSettings(JSON.parse(saved)); } catch {} }
        }
      })
      .catch(() => {
        const saved = localStorage.getItem("cms_settings");
        if (saved) { try { setSettings(JSON.parse(saved)); } catch {} }
      });

    adminFetch(`/api/admin/settings?key=${MOBILE_NAV_SETTING_KEY}`)
      .then((r) => r.json())
      .then((d) => {
        if (d?.value) setMobileNavSlots(parseMobileNavSlots(d.value));
      })
      .catch(() => undefined);

    // Fetch DB stats
    fetch("/api/admin/dashboard", { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => r.json())
      .then((d) => setDbStats({ users: 0, orders: d.orderCount || 0, products: d.productCount || 0, pageViews: 0 }))
      .catch(() => {});

    // Fetch featured product link
    fetch("/api/admin/settings?key=featuredProductLink", { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => r.json())
      .then((d) => {
        if (!d.value) return;
        const v = String(d.value).trim();
        setFeaturedProductLink(v.startsWith("/") ? v : `/${v}`);
      })
      .catch(() => {});

    // Products for nav star link
    adminFetch("/api/products?summary=1")
      .then((r) => r.json())
      .then((d) => {
        const list = Array.isArray(d) ? d : Array.isArray(d?.products) ? d.products : [];
        setProductOptions(
          list
            .map((p: { slug?: string; name?: string; nameRu?: string }) => ({
              slug: String(p.slug || "").trim(),
              name: String(p.nameRu || p.name || p.slug || "").trim(),
            }))
            .filter((p: { slug: string }) => p.slug)
        );
      })
      .catch(() => setProductOptions([]));

    // Fetch delivery estimate
    fetch("/api/admin/settings?key=deliveryEstimate", { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => r.json())
      .then((d) => { if (d.value) setDeliveryEstimate(d.value); })
      .catch(() => {});

    fetch("/api/admin/settings?key=orderDeliveryFootnote", { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => r.json())
      .then((d) => { if (d.value !== null && d.value !== undefined) setOrderDeliveryFootnote(d.value); })
      .catch(() => {});

    fetch("/api/admin/settings?key=admin_sessions_v1", { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => r.json())
      .then((d) => {
        if (!d.value) return;
        try {
          const parsed = JSON.parse(d.value);
          if (Array.isArray(parsed)) setAdminSessions(parsed.slice(0, 100));
        } catch {}
      })
      .catch(() => {});

    fetch("/api/admin/settings?key=seo_global", { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => r.json())
      .then((d) => {
        if (!d.value) return;
        try { setSeoSettings({ ...DEFAULT_SEO_SETTINGS, ...JSON.parse(d.value) }); } catch {}
      })
      .catch(() => {});

    fetch("/api/admin/settings?key=seo_robots", { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => r.json())
      .then((d) => { if (d.value) setRobotsText(d.value); })
      .catch(() => {});
  }, [getToken, router]);

  const update = <K extends keyof Settings>(key: K, value: Settings[K]) => {
    setSettings((prev) => ({ ...prev, [key]: value }));
    setDirty(true);
  };

  /** Persist site on/off immediately so the public gate reacts without waiting for «Сохранить». */
  const persistSiteFlag = async <K extends "siteEnabled" | "maintenanceMode">(key: K, value: Settings[K]) => {
    const next = { ...settings, [key]: value };
    setSettings(next);
    const token = getToken();
    if (!token) return;
    try {
      const res = await fetch("/api/admin/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ key: "general_settings", value: JSON.stringify(next) }),
      });
      if (!res.ok) {
        notify("Не удалось сохранить статус сайта");
        return;
      }
      notify(key === "siteEnabled" ? (value ? "Сайт включён" : "Сайт выключен") : "Режим обслуживания обновлён");
    } catch {
      notify("Не удалось сохранить статус сайта");
    }
  };

  const updateSocial = (key: string, value: string) => {
    setSettings((prev) => ({ ...prev, socialLinks: { ...prev.socialLinks, [key]: value } }));
  };

  const toggleArrayItem = (key: "shippingMethods" | "paymentMethods", item: string) => {
    setSettings((prev) => ({
      ...prev,
      [key]: prev[key].includes(item) ? prev[key].filter((i) => i !== item) : [...prev[key], item],
    }));
  };

  const handleSave = async () => {
    setSaving(true);
    const token = getToken();
    try {
      await Promise.all([
        fetch("/api/admin/settings", {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
          body: JSON.stringify({ key: "general_settings", value: JSON.stringify(settings) }),
        }),
        fetch("/api/admin/settings", {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
          body: JSON.stringify({ key: "featuredProductLink", value: featuredProductLink }),
        }),
        fetch("/api/admin/settings", {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
          body: JSON.stringify({ key: "deliveryEstimate", value: deliveryEstimate }),
        }),
        fetch("/api/admin/settings", {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
          body: JSON.stringify({ key: "orderDeliveryFootnote", value: orderDeliveryFootnote }),
        }),
        fetch("/api/admin/settings", {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
          body: JSON.stringify({ key: "seo_global", value: JSON.stringify(seoSettings) }),
        }),
        fetch("/api/admin/settings", {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
          body: JSON.stringify({ key: "seo_robots", value: robotsText }),
        }),
      ]);
      localStorage.setItem("cms_settings", JSON.stringify(settings));
      notify("Настройки сохранены");
    } catch {
      notify("Ошибка сохранения");
    }
    setSaving(false);
  };

  const handleReset = () => {
    setSettings(DEFAULT_SETTINGS);
    localStorage.removeItem("cms_settings");
    setShowResetConfirm(false);
    notify("Настройки сброшены");
  };

  const handleExportConfig = () => {
    const blob = new Blob([JSON.stringify(settings, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = "errani-cms-config.json"; a.click();
    URL.revokeObjectURL(url);
  };

  const handleImportConfig = () => {
    const input = document.createElement("input");
    input.type = "file"; input.accept = ".json";
    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (ev) => {
        try {
          const imported = JSON.parse(ev.target?.result as string);
          setSettings({ ...DEFAULT_SETTINGS, ...imported });
          notify("Конфигурация импортирована");
        } catch { notify("Некорректный файл конфигурации"); }
      };
      reader.readAsText(file);
    };
    input.click();
  };


  useEffect(() => {
    const token = typeof window !== "undefined" ? localStorage.getItem("admin_token") : null;
    if (!token) return;
    fetch(`/api/admin/settings?key=${APPEARANCE_SETTING_KEY}`, { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => r.ok ? r.json() : null)
      .then((data) => {
        if (!data) return;
        const next = parseAppearance(data.value ?? data);
        setAppearance(next);
        setSavedAppearance(next);
        applyAppearance(next);
        cacheAppearance(next);
      })
      .catch(() => {});
  }, []);

  const notify = (msg: string) => { setNotification(msg); setTimeout(() => setNotification(""), 3000); };

  // Ctrl+S keyboard shortcut to save
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "s") {
        e.preventDefault();
        handleSave();
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  });

  const TABS = [
    { id: "general", label: "Основное" },
    { id: "integrations", label: "Интеграции" },
    { id: "notifications", label: "Уведомления" },
    { id: "seo", label: "SEO" },
    { id: "sessions", label: "Сессии" },
  ] as const;

  const saveAppearance = async () => {
    const token = localStorage.getItem("admin_token");
    if (!token) return;
    const res = await fetch("/api/admin/settings", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ key: APPEARANCE_SETTING_KEY, value: JSON.stringify(appearance) }),
    });
    if (!res.ok) {
      notify("Не удалось сохранить оформление");
      return;
    }
    setSavedAppearance(appearance);
    applyAppearance(appearance);
    cacheAppearance(appearance);
  };

  const patchAppearance = (patch: Partial<AdminAppearance>) => {
    setAppearance((prev) => {
      const next = { ...prev, ...patch, glass: 0 };
      applyAppearance(next);
      return next;
    });
    setDirty(true);
  };

  const saveMobileNav = async () => {
    const value = JSON.stringify(mobileNavSlots);
    const res = await adminFetch("/api/admin/settings", {
      method: "POST",
      body: JSON.stringify({ key: MOBILE_NAV_SETTING_KEY, value }),
    });
    if (!res.ok) {
      notify("Не удалось сохранить мобильное меню");
      return;
    }
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("admin:mobile-nav", { detail: value }));
    }
  };

  const saveAll = async () => {
    await handleSave();
    await saveAppearance();
    await saveMobileNav();
    setDirty(false);
  };

  return (
    <AdminPage
      title="Настройки"
      actions={
        <HeaderActions>
          <SearchField value={settingsSearch} onChange={setSettingsSearch} style={{ width: 220 }} />
          {dirty && (
            <Button variant="primary" icon="save" onClick={saveAll} disabled={saving}>
              {saving ? "Сохранение..." : "Сохранить"}
            </Button>
          )}
        </HeaderActions>
      }
    >
          <div style={{ marginBottom: 16 }}>
            <SegmentedControl
              options={TABS.map((t) => ({ value: t.id, label: t.label }))}
              value={activeTab}
              onChange={(v) => setActiveTab(v)}
            />
          </div>

          {/* Site Status Banner */}
          {!settings.siteEnabled && (
            <div style={{ background: "rgba(239,68,68,0.15)", border: "1px solid var(--cms-danger)", borderRadius: "8px", padding: "12px 16px", marginBottom: "16px", display: "flex", alignItems: "center", gap: "10px" }}>
              <span style={{ fontSize: "18px" }} aria-hidden>{"\u26A0\uFE0F"}</span>
              <div>
                <div style={{ fontWeight: 700, fontSize: "14px", color: "var(--cms-danger)" }}>Сайт ОТКЛЮЧЁН</div>
                <div style={{ fontSize: "12px", color: "var(--cms-text-muted)" }}>Посетители увидят страницу обслуживания</div>
              </div>
              <button
                className="cms-btn cms-btn-sm cms-btn-primary"
                style={{ marginLeft: "auto" }}
                onClick={() => void persistSiteFlag("siteEnabled", true)}
              >
                Включить
              </button>
            </div>
          )}

          {activeTab === "general" && (
            <div className="cms-settings-stack">
              <div className="cms-mobile-only">
                <SettingSection title="Нижнее меню">
                  <MobileNavEditor
                    slots={mobileNavSlots}
                    onChange={(next) => {
                      setMobileNavSlots(next);
                      setDirty(true);
                      if (typeof window !== "undefined") {
                        window.dispatchEvent(new CustomEvent("admin:mobile-nav", { detail: JSON.stringify(next) }));
                      }
                    }}
                  />
                </SettingSection>
              </div>

              <SettingSection title="Оформление">
                <div style={{ display: "grid", gap: 14 }}>
                  <div>
                    <label className="cms-label" style={{ display: "block", marginBottom: 6 }}>Обои</label>
                    <WallpaperPicker
                      currentUrl={appearance.wallpaperUrl}
                      getToken={getToken}
                      onPick={(url) => patchAppearance({ wallpaperUrl: url })}
                      onClear={() => patchAppearance({ wallpaperUrl: "" })}
                    />
                  </div>

                  <div>
                    <label className="cms-label" style={{ display: "block", marginBottom: 8 }}>Тема</label>
                    <SegmentedControl
                      size="sm"
                      options={[
                        { value: "system", label: "Системная", title: "Системная" },
                        { value: "light", label: "Светлая", title: "Светлая" },
                        { value: "dark", label: "Тёмная", title: "Тёмная" },
                      ]}
                      value={appearance.theme}
                      onChange={(v) => patchAppearance({ theme: v as AdminTheme })}
                      ariaLabel="Тема"
                    />
                  </div>

                  <Slider
                    compact
                    label="Затемнение обоя"
                    value={appearance.wallpaperDim}
                    onChange={(v) => patchAppearance({ wallpaperDim: v })}
                    leading={
                      <span className="cms-slider-leading" title={appearance.wallpaperDim > 0 ? "есть" : "нету"}>
                        <i className={`fi ${appearance.wallpaperDim > 0 ? "fi-rr-brightness" : "fi-rr-circle"}`} style={{ fontSize: 16 }} />
                      </span>
                    }
                  />
                </div>
              </SettingSection>

              <SettingSection title="Управление сайтом">
                <Toggle
                  checked={settings.siteEnabled}
                  onChange={(v) => void persistSiteFlag("siteEnabled", v)}
                  label="Сайт включён"
                  description="Включить или выключить весь сайт. Когда выключен, посетители видят страницу обслуживания."
                />
                <Toggle
                  checked={settings.maintenanceMode}
                  onChange={(v) => void persistSiteFlag("maintenanceMode", v)}
                  label="Режим обслуживания"
                  description="Показывать сообщение об обслуживании, но сайт частично доступен."
                />
                {settings.maintenanceMode && (
                  <label className="cms-label" style={{ marginTop: "8px" }}>
                    Сообщение об обслуживании
                    <textarea
                      className="cms-textarea"
                      rows={2}
                      value={settings.maintenanceMessage}
                      onChange={(e) => { update("maintenanceMessage", e.target.value); setDirty(true); }}
                      style={{ width: "100%" }}
                    />
                  </label>
                )}
              </SettingSection>

              <SettingSection title="Навигация">
                <label className="cms-label">
                  Ссылка на избранный товар (звёздочка в навбаре)
                  <select
                    className="cms-select"
                    value={featuredProductLink}
                    onChange={(e) => { setFeaturedProductLink(e.target.value); setDirty(true); }}
                    style={{ width: "100%", marginTop: 6 }}
                  >
                    <option value="">Не выбрано</option>
                    {productOptions.map((p) => {
                      const href = p.slug.startsWith("/") ? p.slug : `/${p.slug}`;
                      return (
                        <option key={p.slug} value={href}>
                          {p.name}
                        </option>
                      );
                    })}
                  </select>
                  <div style={{ fontSize: "12px", color: "var(--cms-text-muted)", marginTop: "4px" }}>
                    Товар, на который ведёт иконка ★ в навигации
                  </div>
                </label>
              </SettingSection>

              <SettingSection title="Уведомления">
                <Toggle
                  checked={settings.emailNotifications}
                  onChange={(v) => update("emailNotifications", v)}
                  label="На мою личную почту"
                  description="Уведомления при новых заказах и заявках"
                />
                {settings.emailNotifications && (
                  <label className="cms-label" style={{ marginTop: "8px" }}>
                    Email для уведомлений
                    <input className="cms-input" type="email" value={settings.orderNotifyEmail} onChange={(e) => update("orderNotifyEmail", e.target.value)} placeholder="you@email.com" />
                  </label>
                )}
              </SettingSection>
            </div>
          )}

          {activeTab === "integrations" && (
            <IntegrationsTab notify={notify} getToken={getToken} />
          )}

          {activeTab === "sessions" && (
            <div className="cms-settings-stack">
              <SettingSection
                title="Сессии"
                hint="История входов в админку: устройство, IP, время входа."
                divider={false}
              >
                <div className="cms-table-wrap" style={{ padding: 0, background: "transparent", border: 0, boxShadow: "none" }}>
                  <table className="cms-table">
                    <thead>
                      <tr>
                        <th>Пользователь</th>
                        <th>Устройство</th>
                        <th>IP</th>
                        <th>Дата</th>
                      </tr>
                    </thead>
                    <tbody>
                      {adminSessions.map((session, idx) => (
                        <tr key={`${session.at}-${session.ip}-${idx}`}>
                          <td>{session.name || session.email}</td>
                          <td style={{ maxWidth: 280, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{session.userAgent || "—"}</td>
                          <td className="cms-td-mono">{session.ip || "—"}</td>
                          <td>{new Date(session.at).toLocaleString("ru-RU")}</td>
                        </tr>
                      ))}
                      {adminSessions.length === 0 && (
                        <tr><td colSpan={4} style={{ textAlign: "center", padding: "18px", color: "var(--cms-text-muted)" }}>Входов пока нет</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </SettingSection>
            </div>
          )}

          {activeTab === "notifications" && (
            <NotificationsTab getToken={getToken} notify={notify} />
          )}

          {activeTab === "seo" && (
            <div className="cms-settings-stack">
              <SeoPagesEditor getToken={getToken} notify={notify} />

              <SettingSection title="Глобальные настройки сайта">
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                  <label className="cms-label">
                    Meta title (RU)
                    <input className="cms-input" value={seoSettings.title} onChange={(e) => setSeoSettings((prev) => ({ ...prev, title: e.target.value }))} />
                  </label>
                  <label className="cms-label">
                    Meta title (EN)
                    <input className="cms-input" value={seoSettings.titleEn} onChange={(e) => setSeoSettings((prev) => ({ ...prev, titleEn: e.target.value }))} />
                  </label>
                  <label className="cms-label">
                    Meta description (RU)
                    <textarea className="cms-textarea" rows={3} value={seoSettings.description} onChange={(e) => setSeoSettings((prev) => ({ ...prev, description: e.target.value }))} />
                  </label>
                  <label className="cms-label">
                    Meta description (EN)
                    <textarea className="cms-textarea" rows={3} value={seoSettings.descriptionEn} onChange={(e) => setSeoSettings((prev) => ({ ...prev, descriptionEn: e.target.value }))} />
                  </label>
                  <label className="cms-label">
                    Keywords (RU)
                    <input className="cms-input" value={seoSettings.keywords} onChange={(e) => setSeoSettings((prev) => ({ ...prev, keywords: e.target.value }))} />
                  </label>
                  <label className="cms-label">
                    Keywords (EN)
                    <input className="cms-input" value={seoSettings.keywordsEn} onChange={(e) => setSeoSettings((prev) => ({ ...prev, keywordsEn: e.target.value }))} />
                  </label>
                </div>
              </SettingSection>

              <SettingSection title="robots.txt">
                <textarea className="cms-textarea" rows={8} value={robotsText} onChange={(e) => setRobotsText(e.target.value)} style={{ width: "100%", fontFamily: "monospace" }} />
              </SettingSection>

              <SettingSection title="Sitemap">
                <div style={{ fontSize: "13px" }}>
                  <a href="https://errani.ru/sitemap.xml" target="_blank" rel="noreferrer">https://errani.ru/sitemap.xml</a>
                </div>
              </SettingSection>
            </div>
          )}

      {/* Reset Confirm Modal */}
      {showResetConfirm && (
        <div className="cms-modal-overlay" onClick={() => setShowResetConfirm(false)}>
          <div className="cms-modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 420 }}>
            <div className="cms-modal-header">
              <h3>Сброс настроек</h3>
              <button className="cms-modal-close" onClick={() => setShowResetConfirm(false)}>&times;</button>
            </div>
            <div className="cms-modal-body">
              <p style={{ fontSize: "14px" }}>Вы уверены, что хотите сбросить все настройки к значениям по умолчанию? Это действие нельзя отменить.</p>
            </div>
            <div className="cms-modal-actions">
              <button className="cms-btn cms-btn-danger" onClick={handleReset}>Сбросить</button>
              <button className="cms-btn" onClick={() => setShowResetConfirm(false)}>Отмена</button>
            </div>
          </div>
        </div>
      )}

      {notification && <div className={adminToastClass(notification)}>{notification}</div>}
    </AdminPage>
  );
}
