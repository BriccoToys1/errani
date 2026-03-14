"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { AdminSidebar } from "../AdminSidebar";

interface SystemInfo {
  platform: string;
  nodeVersion: string;
  uptime: string;
  hostname: string;
  dbConnected: boolean;
  cpu: { cores: number; usage: number };
  memory: { total: string; used: string; usage: number };
  disk?: { total: string; used: string; usage: number };
}

export default function AdminInfoPage() {
  const router = useRouter();
  const [info, setInfo] = useState<SystemInfo | null>(null);

  const getToken = useCallback(() => {
    const t = localStorage.getItem("admin_token");
    if (!t) router.push("/admin/login");
    return t;
  }, [router]);

  useEffect(() => {
    const token = getToken();
    if (!token) return;
    fetch("/api/admin/server-stats", { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json())
      .then(data => setInfo({
        platform: data.system?.platform ?? "—",
        nodeVersion: data.system?.nodeVersion ?? "—",
        uptime: data.system?.uptime ?? "—",
        hostname: data.system?.hostname ?? "—",
        dbConnected: data.dbConnected !== false,
        cpu: data.cpu ?? { cores: 0, usage: 0 },
        memory: data.memory ?? { total: "—", used: "—", usage: 0 },
        disk: data.disk,
      }))
      .catch(() => {});
  }, [getToken]);

  const STACK = [
    { label: "Фреймворк", value: "Next.js 15 (App Router)" },
    { label: "Язык", value: "TypeScript" },
    { label: "Стили", value: "Tailwind CSS + Custom CSS" },
    { label: "База данных", value: "PostgreSQL" },
    { label: "ORM", value: "Prisma" },
    { label: "Авторизация", value: "JWT (admin_token)" },
    { label: "Файлы", value: "Локальная ФС (/public)" },
    { label: "Почта", value: "Resend SDK" },
    { label: "Платежи", value: "ЮKassa" },
    { label: "Процесс-менеджер", value: "PM2" },
    { label: "Веб-сервер", value: "Nginx" },
    { label: "Хостинг", value: "VPS (errani.ru)" },
  ];

  const SHORTCUTS = [
    { keys: "Ctrl + S", desc: "Сохранить настройки (на странице настроек)" },
  ];

  return (
    <div className="cms-root">
      <AdminSidebar />
      <main className="cms-main">
        <div className="cms-header">
          <h1 className="cms-header-title" style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>
            Информация
          </h1>
        </div>

        <div className="cms-content cms-fade-in" style={{ display: "grid", gap: "16px" }}>
          {/* CMS Info */}
          <div className="cms-table-wrap" style={{ padding: "20px" }}>
            <div style={{ fontWeight: 700, fontSize: "15px", marginBottom: "16px", paddingBottom: "10px", borderBottom: "1px solid var(--cms-border)" }}>О системе</div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
              <div>
                <div style={{ fontSize: "11px", textTransform: "uppercase", letterSpacing: "0.5px", color: "var(--cms-text-muted)", marginBottom: "4px" }}>CMS</div>
                <div style={{ fontSize: "20px", fontWeight: 700 }}>errani admin</div>
              </div>
              <div>
                <div style={{ fontSize: "11px", textTransform: "uppercase", letterSpacing: "0.5px", color: "var(--cms-text-muted)", marginBottom: "4px" }}>Версия</div>
                <div style={{ fontSize: "20px", fontWeight: 700 }}>1.0.0</div>
              </div>
            </div>
          </div>

          {/* Tech Stack */}
          <div className="cms-table-wrap" style={{ padding: "20px" }}>
            <div style={{ fontWeight: 700, fontSize: "15px", marginBottom: "16px", paddingBottom: "10px", borderBottom: "1px solid var(--cms-border)" }}>Технологический стек</div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "6px", fontSize: "13px" }}>
              {STACK.map(s => (
                <div key={s.label} style={{ display: "flex", justifyContent: "space-between", padding: "8px 0", borderBottom: "1px solid var(--cms-border)" }}>
                  <span style={{ color: "var(--cms-text-muted)" }}>{s.label}</span>
                  <span style={{ fontWeight: 600 }}>{s.value}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Live System */}
          {info && (
            <div className="cms-table-wrap" style={{ padding: "20px" }}>
              <div style={{ fontWeight: 700, fontSize: "15px", marginBottom: "16px", paddingBottom: "10px", borderBottom: "1px solid var(--cms-border)" }}>Система (live)</div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "12px" }}>
                {[
                  { label: "Платформа", val: info.platform },
                  { label: "Node.js", val: info.nodeVersion },
                  { label: "Uptime", val: info.uptime },
                  { label: "CPU", val: `${info.cpu.usage}% (${info.cpu.cores} ядер)` },
                  { label: "ОЗУ", val: `${info.memory.used} / ${info.memory.total} (${info.memory.usage}%)` },
                  { label: "Диск", val: info.disk ? `${info.disk.used} / ${info.disk.total} (${info.disk.usage}%)` : "—" },
                  { label: "Hostname", val: info.hostname },
                  { label: "БД", val: info.dbConnected ? "PostgreSQL ✓" : "Не подключена ✗" },
                ].map(i => (
                  <div key={i.label} style={{ padding: "10px", background: "var(--cms-bg)", borderRadius: "8px" }}>
                    <div style={{ fontSize: "11px", color: "var(--cms-text-muted)", marginBottom: "4px" }}>{i.label}</div>
                    <div style={{ fontSize: "13px", fontWeight: 600 }}>{i.val}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Keyboard Shortcuts */}
          <div className="cms-table-wrap" style={{ padding: "20px" }}>
            <div style={{ fontWeight: 700, fontSize: "15px", marginBottom: "16px", paddingBottom: "10px", borderBottom: "1px solid var(--cms-border)" }}>Горячие клавиши</div>
            {SHORTCUTS.map(s => (
              <div key={s.keys} style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", fontSize: "13px" }}>
                <kbd style={{ background: "var(--cms-bg)", padding: "2px 8px", borderRadius: "4px", fontSize: "12px", fontFamily: "monospace", border: "1px solid var(--cms-border)" }}>{s.keys}</kbd>
                <span style={{ color: "var(--cms-text-muted)" }}>{s.desc}</span>
              </div>
            ))}
          </div>

          {/* Admin Pages Map */}
          <div className="cms-table-wrap" style={{ padding: "20px" }}>
            <div style={{ fontWeight: 700, fontSize: "15px", marginBottom: "16px", paddingBottom: "10px", borderBottom: "1px solid var(--cms-border)" }}>Структура админ-панели</div>
            <div style={{ fontFamily: "monospace", fontSize: "12px", color: "var(--cms-text-muted)", lineHeight: "1.8" }}>
              <div>/admin — Дашборд</div>
              <div>/admin/orders — Заказы</div>
              <div>/admin/products — Товары</div>
              <div>/admin/inquiries — Заявки</div>
              <div>/admin/email — Почта</div>
              <div>/admin/users — Клиенты</div>
              <div>/admin/technical — Техническое (Контент, Страницы, Файлы, БД, Сервер, SEO, Терминал)</div>
              <div>/admin/settings — Настройки</div>
              <div>/admin/info — Информация</div>
              <div>/admin/account — Аккаунт</div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
