"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { AdminSidebar } from "../AdminSidebar";

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
}

const DEFAULT_SEO_SETTINGS: SeoSettings = {
  title: "errani — Авторские Колоды Таро",
  description: "Авторские колоды Таро от Екатерины Эррани.",
  keywords: "таро, колода таро, errani",
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

function SettingSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="cms-table-wrap" style={{ padding: "20px" }}>
      <div style={{ fontWeight: 700, fontSize: "15px", marginBottom: "16px", paddingBottom: "10px", borderBottom: "1px solid var(--cms-border)" }}>{title}</div>
      {children}
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

const EXPORT_PERIODS = [
  { label: "1 день", value: 1 },
  { label: "3 дня", value: 3 },
  { label: "7 дней", value: 7 },
  { label: "14 дней", value: 14 },
  { label: "30 дней", value: 30 },
  { label: "90 дней", value: 90 },
  { label: "120 дней", value: 120 },
  { label: "366 дней", value: 366 },
];

const EXPORT_TYPES = [
  { id: "orders", label: "Заказы", description: "Полная информация по заказам: клиент, товары, суммы, адреса, статусы" },
  { id: "products", label: "Товары", description: "Каталог товаров: названия, цены, наличие, slug" },
  { id: "inquiries", label: "Заявки", description: "Все заявки: имя, контакты, сообщение, статус, источник" },
];

function ExportSection({ getToken, notify }: { getToken: () => string | null; notify: (msg: string) => void }) {
  const [period, setPeriod] = useState(30);
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");
  const [useCustom, setUseCustom] = useState(false);
  const [downloading, setDownloading] = useState<string | null>(null);

  const handleDownload = async (type: string) => {
    setDownloading(type);
    const token = getToken();
    if (!token) return;

    let url = `/api/admin/export?type=${type}&format=xls&period=${period}`;
    if (useCustom && customFrom && customTo) {
      url = `/api/admin/export?type=${type}&format=xls&from=${customFrom}&to=${customTo}`;
    }

    try {
      const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
      if (res.ok) {
        const blob = await res.blob();
        const blobUrl = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = blobUrl;
        a.download = `${type}_report.xls`;
        a.click();
        URL.revokeObjectURL(blobUrl);
        notify(`Отчёт "${EXPORT_TYPES.find(t => t.id === type)?.label}" скачан`);
      } else {
        notify("Ошибка экспорта");
      }
    } catch {
      notify("Ошибка скачивания");
    }
    setDownloading(null);
  };

  return (
    <SettingSection title="Экспорт отчётности (XLS)">
      <div style={{ marginBottom: "16px" }}>
        <div style={{ fontSize: "13px", fontWeight: 600, marginBottom: "8px" }}>Период</div>
        <div style={{ display: "flex", gap: "6px", flexWrap: "wrap", marginBottom: "10px" }}>
          {EXPORT_PERIODS.map(p => (
            <button
              key={p.value}
              className={`cms-btn cms-btn-xs ${!useCustom && period === p.value ? "cms-btn-primary" : ""}`}
              onClick={() => { setPeriod(p.value); setUseCustom(false); }}
            >
              {p.label}
            </button>
          ))}
          <button
            className={`cms-btn cms-btn-xs ${useCustom ? "cms-btn-primary" : ""}`}
            onClick={() => setUseCustom(true)}
          >
            Свой период
          </button>
        </div>
        {useCustom && (
          <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
            <input type="date" className="cms-input" value={customFrom} onChange={e => setCustomFrom(e.target.value)} style={{ width: "auto" }} />
            <span style={{ color: "var(--cms-text-muted)" }}>—</span>
            <input type="date" className="cms-input" value={customTo} onChange={e => setCustomTo(e.target.value)} style={{ width: "auto" }} />
          </div>
        )}
      </div>

      <div style={{ display: "grid", gap: "10px" }}>
        {EXPORT_TYPES.map(t => (
          <div key={t.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px", background: "var(--cms-bg)", borderRadius: "8px" }}>
            <div>
              <div style={{ fontWeight: 600, fontSize: "13px" }}>{t.label}</div>
              <div style={{ fontSize: "11px", color: "var(--cms-text-muted)" }}>{t.description}</div>
            </div>
            <button
              className="cms-btn cms-btn-sm cms-btn-primary"
              onClick={() => handleDownload(t.id)}
              disabled={downloading !== null}
              style={{ whiteSpace: "nowrap" }}
            >
              {downloading === t.id ? "Скачивание..." : "Скачать XLS"}
            </button>
          </div>
        ))}
      </div>

      <div style={{ marginTop: "12px", fontSize: "12px", color: "var(--cms-text-muted)" }}>
        Отчёты формируются в формате XLS с максимальной детализацией. Все данные за выбранный период.
      </div>
    </SettingSection>
  );
}

function ResendSettings({ notify, getToken }: { notify: (msg: string) => void; getToken: () => string | null }) {
  const [apiKey, setApiKey] = useState('');
  const [masked, setMasked] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [configured, setConfigured] = useState<boolean | null>(null);
  const [testTo, setTestTo] = useState('');

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

  const sendTest = async () => {
    if (!testTo.trim()) { notify('Укажите email для теста'); return; }
    setTesting(true);
    const token = getToken();
    const res = await fetch('/api/admin/email', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({
        to: testTo.trim(),
        subject: 'Тест почты errani',
        body: '<p>Это тестовое письмо с сайта errani. Если вы его получили — почта работает!</p>',
      }),
    });
    const data = await res.json();
    if (res.ok) notify('Тестовое письмо отправлено!');
    else notify(`Ошибка: ${data.error || 'неизвестно'}`);
    setTesting(false);
  };

  return (
    <SettingSection title="Resend (отправка email)">
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
            Отправка от имени mail@errani.ru через Resend
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
          <label className="cms-label">Тестовое письмо</label>
          <div style={{ display: 'flex', gap: '6px' }}>
            <input className="cms-input" type="email" value={testTo} onChange={e => setTestTo(e.target.value)} placeholder="your@email.com" style={{ flex: 1 }} />
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
  const [avitoConfig, setAvitoConfig] = useState({ clientId: '', clientSecret: '', userId: '' });
  const [avitoStatus, setAvitoStatus] = useState<{ configured: boolean; products: number; lastSync: string | null }>({ configured: false, products: 0, lastSync: null });
  const [syncing, setSyncing] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    // Load Avito status
    const token = getToken();
    if (token) {
      fetch('/api/avito/sync', { headers: { Authorization: `Bearer ${token}` } })
        .then(r => r.json())
        .then(data => {
          setAvitoStatus({
            configured: data.configured,
            products: data.products?.length || 0,
            lastSync: data.lastSync,
          });
        })
        .catch(() => {});

      // Load saved config from localStorage
      const savedConfig = localStorage.getItem('avito_config');
      if (savedConfig) {
        try { setAvitoConfig(JSON.parse(savedConfig)); } catch {}
      }
    }
  }, [getToken]);

  const saveAvitoConfig = async () => {
    setSaving(true);
    localStorage.setItem('avito_config', JSON.stringify(avitoConfig));
    
    // Save to database
    const token = getToken();
    await fetch('/api/admin/settings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ key: 'avito_config', value: JSON.stringify(avitoConfig) }),
    });
    
    notify('Настройки Avito сохранены');
    setSaving(false);
  };

  const syncAvito = async () => {
    setSyncing(true);
    const token = getToken();
    const res = await fetch('/api/avito/sync', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
    });
    const data = await res.json();
    
    if (data.success) {
      notify(data.message);
      setAvitoStatus(prev => ({ ...prev, products: data.total, lastSync: new Date().toISOString() }));
    } else {
      notify(data.error || 'Ошибка синхронизации');
    }
    setSyncing(false);
  };

  return (
    <div style={{ display: "grid", gap: "16px" }}>
      <ResendSettings notify={notify} getToken={getToken} />
      <SettingSection title="Avito API">
        <div style={{ marginBottom: "16px", padding: "12px", background: avitoStatus.configured ? "rgba(34, 197, 94, 0.1)" : "rgba(245, 158, 11, 0.1)", borderRadius: "8px", display: "flex", alignItems: "center", gap: "12px" }}>
          <span style={{ display: "flex", alignItems: "center" }}>{avitoStatus.configured ? <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#22c55e" strokeWidth="2"><path d="M22 11.08V12a10 10 0 11-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg> : <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" strokeWidth="2"><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>}</span>
          <div>
            <div style={{ fontWeight: 600, fontSize: "14px" }}>
              {avitoStatus.configured ? "API настроен" : "API не настроен"}
            </div>
            <div style={{ fontSize: "12px", color: "var(--cms-text-muted)" }}>
              {avitoStatus.configured 
                ? `${avitoStatus.products} товаров синхронизировано`
                : "Введите данные API для синхронизации товаров"
              }
            </div>
          </div>
          {avitoStatus.configured && (
            <div style={{ display: "flex", gap: "8px", marginLeft: "auto" }}>
              <a 
                href="/api/avito/export" 
                className="cms-btn cms-btn-sm"
                download="avito-feed.xml"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg> XML фид
              </a>
              <button 
                className="cms-btn cms-btn-sm cms-btn-primary" 
                onClick={syncAvito}
                disabled={syncing}
              >
                {syncing ? "Синхронизация..." : "Синхронизировать"}
              </button>
            </div>
          )}
        </div>

        <div style={{ display: "grid", gap: "12px" }}>
          <div>
            <label className="cms-label">Client ID</label>
            <input 
              className="cms-input" 
              value={avitoConfig.clientId}
              onChange={(e) => setAvitoConfig(prev => ({ ...prev, clientId: e.target.value }))}
              placeholder="Введите client_id от Avito API"
            />
          </div>
          <div>
            <label className="cms-label">Client Secret</label>
            <input 
              className="cms-input" 
              type="password"
              value={avitoConfig.clientSecret}
              onChange={(e) => setAvitoConfig(prev => ({ ...prev, clientSecret: e.target.value }))}
              placeholder="Введите client_secret от Avito API"
            />
          </div>
          <div>
            <label className="cms-label">User ID</label>
            <input 
              className="cms-input" 
              value={avitoConfig.userId}
              onChange={(e) => setAvitoConfig(prev => ({ ...prev, userId: e.target.value }))}
              placeholder="ID вашего профиля на Avito"
            />
          </div>
        </div>

        <div style={{ marginTop: "16px", display: "flex", gap: "10px" }}>
          <button className="cms-btn cms-btn-sm cms-btn-primary" onClick={saveAvitoConfig} disabled={saving}>
            {saving ? "Сохранение..." : "Сохранить настройки"}
          </button>
        </div>

        <div style={{ marginTop: "16px", padding: "12px", background: "var(--cms-surface)", borderRadius: "8px", fontSize: "12px", color: "var(--cms-text-muted)" }}>
          <strong>Как получить API ключи:</strong>
          <ol style={{ margin: "8px 0 0 16px", padding: 0 }}>
            <li>Зайдите в <a href="https://www.avito.ru/professionals/api" target="_blank" style={{ color: "var(--cms-accent)" }}>Avito для бизнеса</a></li>
            <li>Создайте приложение и получите client_id и client_secret</li>
            <li>User ID можно найти в URL вашего профиля</li>
          </ol>
        </div>

        {avitoStatus.lastSync && (
          <div style={{ marginTop: "12px", fontSize: "12px", color: "var(--cms-text-muted)" }}>
            Последняя синхронизация: {new Date(avitoStatus.lastSync).toLocaleString("ru-RU")}
          </div>
        )}
      </SettingSection>

      <SettingSection title="Другие интеграции">
        <div style={{ padding: "20px", textAlign: "center", color: "var(--cms-text-muted)" }}>
          <div style={{ fontSize: "32px", marginBottom: "10px" }}>🔌</div>
          <div>Дополнительные интеграции будут добавлены в будущих обновлениях</div>
          <div style={{ fontSize: "12px", marginTop: "8px" }}>Telegram бот, WooCommerce, 1С и другие</div>
        </div>
      </SettingSection>
    </div>
  );
}

export default function AdminSettingsPage() {
  const router = useRouter();
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [saving, setSaving] = useState(false);
  const [notification, setNotification] = useState("");
  const [activeTab, setActiveTab] = useState("general");
  const [settingsSearch, setSettingsSearch] = useState("");
  const [dbStats, setDbStats] = useState({ users: 0, orders: 0, products: 0, pageViews: 0 });
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [featuredProductLink, setFeaturedProductLink] = useState("/tenderly-vibe");
  const [deliveryEstimate, setDeliveryEstimate] = useState("Ориентировочный срок доставки ~ начало Мая");
  const [orderDeliveryFootnote, setOrderDeliveryFootnote] = useState("");
  const [adminSessions, setAdminSessions] = useState<AdminSessionEntry[]>([]);
  const [seoSettings, setSeoSettings] = useState<SeoSettings>(DEFAULT_SEO_SETTINGS);
  const [robotsText, setRobotsText] = useState("User-agent: *\nAllow: /\nDisallow: /admin\nDisallow: /api\n\nSitemap: https://errani.ru/sitemap.xml");

  const getToken = useCallback(() => localStorage.getItem("admin_token"), []);

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

    // Fetch DB stats
    fetch("/api/admin/dashboard", { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => r.json())
      .then((d) => setDbStats({ users: 0, orders: d.orderCount || 0, products: d.productCount || 0, pageViews: 0 }))
      .catch(() => {});

    // Fetch featured product link
    fetch("/api/admin/settings?key=featuredProductLink", { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => r.json())
      .then((d) => { if (d.value) setFeaturedProductLink(d.value); })
      .catch(() => {});

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
    { id: "sessions", label: "Сессии" },
    { id: "seo", label: "SEO" },
  ];

  return (
    <div className="cms-root">
      <AdminSidebar />
      <main className="cms-main">
        <div className="cms-header">
          <h1 className="cms-header-title">Настройки</h1>
          <div className="cms-header-actions">
            <input
              className="cms-input cms-input-sm"
              placeholder="Поиск по настройкам..."
              value={settingsSearch}
              onChange={(e) => setSettingsSearch(e.target.value)}
              style={{ width: "220px" }}
            />
            <button className="cms-btn cms-btn-sm cms-btn-ghost" onClick={handleExportConfig}>Экспорт</button>
            <button className="cms-btn cms-btn-sm cms-btn-ghost" onClick={handleImportConfig}>Импорт</button>
            <button className="cms-btn cms-btn-sm cms-btn-primary" onClick={handleSave} disabled={saving}>
              {saving ? "Сохранение..." : "Сохранить"}
            </button>
          </div>
        </div>

        <div className="cms-content">
          {/* Tabs */}
          <div className="cms-tabs" style={{ marginBottom: "20px" }}>
            {TABS.map((tab) => (
              <button key={tab.id} className={`cms-tab ${activeTab === tab.id ? "active" : ""}`} onClick={() => setActiveTab(tab.id)}>
                {tab.label}
              </button>
            ))}
          </div>

          {/* Site Status Banner */}
          {!settings.siteEnabled && (
            <div style={{ background: "rgba(239,68,68,0.15)", border: "1px solid var(--cms-danger)", borderRadius: "8px", padding: "12px 16px", marginBottom: "16px", display: "flex", alignItems: "center", gap: "10px" }}>
              <span style={{ fontSize: "18px" }}>\u26a0\ufe0f</span>
              <div>
                <div style={{ fontWeight: 700, fontSize: "14px", color: "var(--cms-danger)" }}>Сайт ОТКЛЮЧЁН</div>
                <div style={{ fontSize: "12px", color: "var(--cms-text-muted)" }}>Посетители увидят страницу обслуживания</div>
              </div>
              <button className="cms-btn cms-btn-sm cms-btn-primary" style={{ marginLeft: "auto" }} onClick={() => update("siteEnabled", true)}>
                Включить
              </button>
            </div>
          )}

          {activeTab === "general" && (
            <div style={{ display: "grid", gap: "16px" }}>
              <SettingSection title="Управление сайтом">
                <Toggle checked={settings.siteEnabled} onChange={(v) => update("siteEnabled", v)} label="Сайт включён" description="Включить или выключить весь сайт. Когда выключен, посетители видят страницу обслуживания." />
                <Toggle checked={settings.maintenanceMode} onChange={(v) => update("maintenanceMode", v)} label="Режим обслуживания" description="Показывать сообщение об обслуживании, но сайт частично доступен." />
                {settings.maintenanceMode && (
                  <label className="cms-label" style={{ marginTop: "8px" }}>
                    Сообщение об обслуживании
                    <textarea className="cms-textarea" rows={2} value={settings.maintenanceMessage} onChange={(e) => update("maintenanceMessage", e.target.value)} style={{ width: "100%" }} />
                  </label>
                )}
              </SettingSection>

              <SettingSection title="Информация о сайте">
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                  <label className="cms-label">
                    Название сайта
                    <input className="cms-input" value={settings.siteName} onChange={(e) => update("siteName", e.target.value)} />
                  </label>
                  <label className="cms-label">
                    URL сайта
                    <input className="cms-input" value={settings.siteUrl} onChange={(e) => update("siteUrl", e.target.value)} />
                  </label>
                  <label className="cms-label">
                    Email для связи
                    <input className="cms-input" type="email" value={settings.contactEmail} onChange={(e) => update("contactEmail", e.target.value)} />
                  </label>
                  <label className="cms-label">
                    Язык по умолчанию
                    <select className="cms-select" value={settings.defaultLang} onChange={(e) => update("defaultLang", e.target.value)}>
                      {LANGS.map((l) => <option key={l.code} value={l.code}>{l.name}</option>)}
                    </select>
                  </label>
                </div>
              </SettingSection>

              <SettingSection title="Навигация">
                <label className="cms-label">
                  Ссылка на избранный товар (звёздочка в навбаре)
                  <input
                    className="cms-input"
                    value={featuredProductLink}
                    onChange={(e) => setFeaturedProductLink(e.target.value)}
                    placeholder="/tenderly-vibe"
                  />
                  <div style={{ fontSize: "12px", color: "var(--cms-text-muted)", marginTop: "4px" }}>
                    Slug товара, на который ведёт иконка ★ в навигации. Например: /tenderly-vibe
                  </div>
                </label>
              </SettingSection>
            </div>
          )}

          {activeTab === "general" && (
            <div style={{ display: "grid", gap: "16px" }}>
              <SettingSection title="Настройки магазина">
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                  <label className="cms-label">
                    Валюта по умолчанию
                    <select className="cms-select" value={settings.currency} onChange={(e) => update("currency", e.target.value)}>
                      {CURRENCIES.map((c) => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </label>
                  <label className="cms-label">
                    Макс. товаров в корзине
                    <input className="cms-input" type="number" value={settings.maxCartItems} onChange={(e) => update("maxCartItems", Number(e.target.value))} />
                  </label>
                  <label className="cms-label">
                    Порог бесплатной доставки
                    <input className="cms-input" type="number" value={settings.freeShippingThreshold} onChange={(e) => update("freeShippingThreshold", Number(e.target.value))} />
                  </label>
                </div>
              </SettingSection>

              <SettingSection title="Функции">
                <Toggle checked={settings.enablePreorders} onChange={(v) => update("enablePreorders", v)} label="Предзаказы" description="Разрешить предзаказ товаров" />
                <Toggle checked={settings.enableFavorites} onChange={(v) => update("enableFavorites", v)} label="Избранное" description="Разрешить добавлять товары в избранное" />
                <Toggle checked={settings.enableReviews} onChange={(v) => update("enableReviews", v)} label="Отзывы" description="Разрешить оставлять отзывы о товарах" />
              </SettingSection>
            </div>
          )}

          {activeTab === "general" && (
            <div style={{ display: "grid", gap: "16px" }}>
              <SettingSection title="Информация о доставке">
                <label className="cms-label">
                  Ориентировочный срок доставки
                  <input
                    className="cms-input"
                    value={deliveryEstimate}
                    onChange={(e) => setDeliveryEstimate(e.target.value)}
                    placeholder="Например: Ориентировочный срок доставки ~ начало Мая"
                  />
                  <div style={{ fontSize: "12px", color: "var(--cms-text-muted)", marginTop: "4px" }}>
                    Отображается в плашке оформления заказа (в блоке Доставка). Оставьте пустым — не показывать.
                  </div>
                </label>
                <label className="cms-label" style={{ marginTop: "12px" }}>
                  Сноска в блоке «Ваш заказ»
                  <textarea
                    className="cms-textarea"
                    rows={2}
                    value={orderDeliveryFootnote}
                    onChange={(e) => setOrderDeliveryFootnote(e.target.value)}
                    placeholder="Например: Доставка оплачивается при получении."
                    style={{ width: "100%" }}
                  />
                  <div style={{ fontSize: "12px", color: "var(--cms-text-muted)", marginTop: "4px" }}>
                    Показывается под строкой доставки в checkout. Оставьте пустым — не показывать.
                  </div>
                </label>
              </SettingSection>

              <SettingSection title="Способы оплаты">
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px" }}>
                  {PAYMENT.map((p) => (
                    <label key={p.id} className="cms-checkbox-label" style={{ padding: "10px 14px", borderRadius: "8px", border: `1px solid ${settings.paymentMethods.includes(p.id) ? "var(--cms-accent)" : "var(--cms-border)"}`, background: settings.paymentMethods.includes(p.id) ? "rgba(232,114,42,0.08)" : "transparent" }}>
                      <input type="checkbox" checked={settings.paymentMethods.includes(p.id)} onChange={() => toggleArrayItem("paymentMethods", p.id)} />
                      {p.label}
                    </label>
                  ))}
                </div>
              </SettingSection>
            </div>
          )}

          {activeTab === "general" && (
            <div style={{ display: "grid", gap: "16px" }}>
              <SettingSection title="Соцсети">
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                  {Object.entries(settings.socialLinks).map(([key, val]) => (
                    <label key={key} className="cms-label">
                      <span style={{ textTransform: "capitalize" }}>{key}</span>
                      <input className="cms-input" value={val} onChange={(e) => updateSocial(key, e.target.value)} placeholder={`https://${key}.com/...`} />
                    </label>
                  ))}
                </div>
              </SettingSection>

              <SettingSection title="Уведомления">
                <Toggle checked={settings.emailNotifications} onChange={(v) => update("emailNotifications", v)} label="Email уведомления" description="Получать уведомления о новых заказах на email" />
                {settings.emailNotifications && (
                  <label className="cms-label" style={{ marginTop: "8px" }}>
                    Email для уведомлений
                    <input className="cms-input" type="email" value={settings.orderNotifyEmail} onChange={(e) => update("orderNotifyEmail", e.target.value)} />
                  </label>
                )}
              </SettingSection>
            </div>
          )}

          {activeTab === "integrations" && (
            <IntegrationsTab notify={notify} getToken={getToken} />
          )}

          {activeTab === "sessions" && (
            <div style={{ display: "grid", gap: "16px" }}>
              <SettingSection title="Сессии">
                <div style={{ fontSize: "12px", color: "var(--cms-text-muted)", marginBottom: "10px" }}>
                  История входов в админку: устройство, IP, страна/город (если передаётся прокси), время входа.
                </div>
                <div className="cms-table-wrap" style={{ padding: 0 }}>
                  <table className="cms-table">
                    <thead>
                      <tr>
                        <th>Email</th>
                        <th>Устройство</th>
                        <th>IP</th>
                        <th>Гео</th>
                        <th>Вход</th>
                      </tr>
                    </thead>
                    <tbody>
                      {adminSessions.map((session, idx) => (
                        <tr key={`${session.at}-${session.ip}-${idx}`}>
                          <td>{session.email}</td>
                          <td style={{ maxWidth: 280, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{session.userAgent || "—"}</td>
                          <td className="cms-td-mono">{session.ip || "—"}</td>
                          <td>{[session.country, session.city].filter(Boolean).join(", ") || "—"}</td>
                          <td>{new Date(session.at).toLocaleString("ru-RU")}</td>
                        </tr>
                      ))}
                      {adminSessions.length === 0 && (
                        <tr><td colSpan={5} style={{ textAlign: "center", padding: "18px", color: "var(--cms-text-muted)" }}>Входов пока нет</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </SettingSection>

              <ExportSection getToken={getToken} notify={notify} />
            </div>
          )}

          {activeTab === "seo" && (
            <div style={{ display: "grid", gap: "16px" }}>
              <SettingSection title="Глобальные настройки сайта">
                <div style={{ display: "grid", gap: "12px" }}>
                  <label className="cms-label">
                    Meta title
                    <input className="cms-input" value={seoSettings.title} onChange={(e) => setSeoSettings((prev) => ({ ...prev, title: e.target.value }))} />
                  </label>
                  <label className="cms-label">
                    Meta description
                    <textarea className="cms-textarea" rows={3} value={seoSettings.description} onChange={(e) => setSeoSettings((prev) => ({ ...prev, description: e.target.value }))} />
                  </label>
                  <label className="cms-label">
                    Keywords
                    <input className="cms-input" value={seoSettings.keywords} onChange={(e) => setSeoSettings((prev) => ({ ...prev, keywords: e.target.value }))} />
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
        </div>
      </main>

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

      {notification && <div className="cms-toast">{notification}</div>}
    </div>
  );
}
