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
  shippingMethods: ["ozon", "yandex", "pochta_ru", "cdek", "pochta_int"],
  paymentMethods: ["yukassa", "stripe", "apple_pay", "google_pay"],
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

const SHIPPING = [
  { id: "ozon", label: "OZON" }, { id: "yandex", label: "Яндекс Доставка" },
  { id: "pochta_ru", label: "Почта России" }, { id: "cdek", label: "СДЭК" },
  { id: "pochta_int", label: "Почта международная" }, { id: "dhl", label: "DHL" },
];

const PAYMENT = [
  { id: "yukassa", label: "ЮKassa" }, { id: "stripe", label: "Stripe" },
  { id: "apple_pay", label: "Apple Pay" }, { id: "google_pay", label: "Google Pay" },
  { id: "crypto", label: "Криптовалюта" },
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
            <div className="cms-stat-label">Обращения</div>
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
          Удалить закрытые обращения
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
        💡 Очистка старых данных поможет уменьшить размер базы данных и ускорить работу сайта
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
                {confirmClean === 'closed_inquiries' && 'Будут удалены все закрытые обращения.'}
                {confirmClean === 'all_pageviews' && 'Будут удалены ВСЕ записи аналитики. Это действие нельзя отменить!'}
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
  const [dbStats, setDbStats] = useState({ users: 0, orders: 0, products: 0, pageViews: 0 });
  const [showResetConfirm, setShowResetConfirm] = useState(false);

  const getToken = useCallback(() => localStorage.getItem("admin_token"), []);

  useEffect(() => {
    const token = getToken();
    if (!token) { router.push("/admin/login"); return; }
    const saved = localStorage.getItem("cms_settings");
    if (saved) { try { setSettings(JSON.parse(saved)); } catch {} }

    // Fetch DB stats
    fetch("/api/admin/dashboard", { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => r.json())
      .then((d) => setDbStats({ users: 0, orders: d.orderCount || 0, products: d.productCount || 0, pageViews: 0 }))
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

  const handleSave = () => {
    setSaving(true);
    localStorage.setItem("cms_settings", JSON.stringify(settings));
    notify("Настройки сохранены");
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

  const TABS = [
    { id: "general", label: "Основные" },
    { id: "commerce", label: "Магазин" },
    { id: "shipping", label: "Доставка и оплата" },
    { id: "social", label: "Соцсети и уведомления" },
    { id: "integrations", label: "Интеграции" },
    { id: "advanced", label: "Расширенные" },
  ];

  return (
    <div className="cms-root">
      <AdminSidebar />
      <main className="cms-main">
        <div className="cms-header">
          <h1 className="cms-header-title">Настройки</h1>
          <div className="cms-header-actions">
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
            </div>
          )}

          {activeTab === "commerce" && (
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

          {activeTab === "shipping" && (
            <div style={{ display: "grid", gap: "16px" }}>
              <SettingSection title="Способы доставки">
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px" }}>
                  {SHIPPING.map((s) => (
                    <label key={s.id} className="cms-checkbox-label" style={{ padding: "10px 14px", borderRadius: "8px", border: `1px solid ${settings.shippingMethods.includes(s.id) ? "var(--cms-accent)" : "var(--cms-border)"}`, background: settings.shippingMethods.includes(s.id) ? "rgba(232,114,42,0.08)" : "transparent" }}>
                      <input type="checkbox" checked={settings.shippingMethods.includes(s.id)} onChange={() => toggleArrayItem("shippingMethods", s.id)} />
                      {s.label}
                    </label>
                  ))}
                </div>
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

          {activeTab === "social" && (
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

          {activeTab === "advanced" && (
            <div style={{ display: "grid", gap: "16px" }}>
              <SettingSection title="Аналитика и приватность">
                <Toggle checked={settings.analyticsEnabled} onChange={(v) => update("analyticsEnabled", v)} label="Сбор аналитики" description="Отслеживание просмотров страниц и статистики посетителей" />
                <Toggle checked={settings.cookieConsent} onChange={(v) => update("cookieConsent", v)} label="Баннер cookies" description="Показывать уведомление о файлах cookie новым посетителям" />
              </SettingSection>

              <SettingSection title="База данных">
                <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "10px", marginBottom: "16px" }}>
                  <div className="cms-stat-card"><div className="cms-stat-label">Заказы</div><div className="cms-stat-value">{dbStats.orders}</div></div>
                  <div className="cms-stat-card"><div className="cms-stat-label">Товары</div><div className="cms-stat-value">{dbStats.products}</div></div>
                  <div className="cms-stat-card"><div className="cms-stat-label">Юзеры</div><div className="cms-stat-value">{dbStats.users}</div></div>
                  <div className="cms-stat-card"><div className="cms-stat-label">Движок</div><div className="cms-stat-value" style={{ fontSize: "14px" }}>PostgreSQL</div></div>
                </div>
              </SettingSection>

              <MemoryManagement getToken={getToken} notify={notify} />

              <SettingSection title="Резервное копирование">
                <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
                  <button className="cms-btn cms-btn-sm" onClick={handleExportConfig}>Экспорт конфигурации</button>
                  <button className="cms-btn cms-btn-sm" onClick={handleImportConfig}>Импорт конфигурации</button>
                  <button className="cms-btn cms-btn-sm cms-btn-danger" onClick={() => setShowResetConfirm(true)}>Сбросить настройки</button>
                </div>
              </SettingSection>

              <SettingSection title="Информация о системе">
                <div style={{ display: "grid", gridTemplateColumns: "150px 1fr", gap: "6px", fontSize: "13px" }}>
                  <strong>Платформа:</strong> <span>Next.js + Prisma</span>
                  <strong>База данных:</strong> <span>PostgreSQL</span>
                  <strong>Авторизация:</strong> <span>JWT (admin_token)</span>
                  <strong>Хранилище:</strong> <span>Локальная ФС (/public)</span>
                  <strong>Версия CMS:</strong> <span>1.0.0</span>
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
