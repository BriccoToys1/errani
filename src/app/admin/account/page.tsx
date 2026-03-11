"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { AdminSidebar } from "../AdminSidebar";

export default function AdminAccountPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [notification, setNotification] = useState("");
  const [error, setError] = useState("");

  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [createdAt, setCreatedAt] = useState("");

  const getToken = useCallback(() => localStorage.getItem("admin_token"), []);

  const fetchProfile = useCallback(async () => {
    const token = getToken();
    if (!token) { router.push("/admin/login"); return; }
    try {
      const res = await fetch("/api/admin/account", { headers: { Authorization: `Bearer ${token}` } });
      if (res.status === 401) { router.push("/admin/login"); return; }
      if (res.ok) {
        const data = await res.json();
        setEmail(data.email);
        setName(data.name);
        setCreatedAt(data.createdAt);
      }
    } catch { /* ignore */ }
    setLoading(false);
  }, [getToken, router]);

  useEffect(() => { fetchProfile(); }, [fetchProfile]);

  const notify = (msg: string) => { setNotification(msg); setTimeout(() => setNotification(""), 3000); };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!currentPassword) {
      setError("Введите текущий пароль для подтверждения");
      return;
    }
    if (newPassword && newPassword !== confirmPassword) {
      setError("Пароли не совпадают");
      return;
    }
    if (newPassword && newPassword.length < 8) {
      setError("Новый пароль: минимум 8 символов");
      return;
    }

    setSaving(true);
    const token = getToken();
    try {
      const res = await fetch("/api/admin/account", {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ email, name, currentPassword, newPassword: newPassword || undefined }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Ошибка");
      } else {
        if (data.token) {
          localStorage.setItem("admin_token", data.token);
          document.cookie = `admin_token=${data.token}; path=/; max-age=${7 * 24 * 60 * 60}; samesite=lax`;
        }
        notify("Аккаунт обновлён");
        setCurrentPassword("");
        setNewPassword("");
        setConfirmPassword("");
      }
    } catch {
      setError("Ошибка сети");
    }
    setSaving(false);
  };

  const handleLogout = () => {
    localStorage.removeItem("admin_token");
    document.cookie = "admin_token=; path=/; max-age=0";
    router.push("/admin/login");
  };

  if (loading) return <div className="cms-loading"><div className="cms-spinner" /> Загрузка...</div>;

  return (
    <div className="cms-root">
      <AdminSidebar />
      <main className="cms-main">
        <div className="cms-header">
          <h1 className="cms-header-title">Аккаунт</h1>
        </div>

        <div className="cms-content" style={{ maxWidth: 520 }}>
          <form onSubmit={handleSave}>
            {error && (
              <div style={{
                background: "var(--cms-danger-bg, #fee2e2)", color: "var(--cms-danger, #dc2626)",
                padding: "10px 14px", borderRadius: 8, fontSize: 13, marginBottom: 16,
                display: "flex", alignItems: "center", gap: 8
              }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>
                {error}
              </div>
            )}

            <div style={{ marginBottom: 20 }}>
              <h3 style={{ fontSize: 14, fontWeight: 600, marginBottom: 12, color: "var(--cms-text)" }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ verticalAlign: -3, marginRight: 6 }}>
                  <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/>
                </svg>
                Данные аккаунта
              </h3>
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                <label className="cms-label">
                  Имя
                  <input className="cms-input" value={name} onChange={(e) => setName(e.target.value)} />
                </label>
                <label className="cms-label">
                  Email (логин)
                  <input className="cms-input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
                </label>
              </div>
            </div>

            <div style={{ marginBottom: 20 }}>
              <h3 style={{ fontSize: 14, fontWeight: 600, marginBottom: 12, color: "var(--cms-text)" }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ verticalAlign: -3, marginRight: 6 }}>
                  <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0110 0v4"/>
                </svg>
                Смена пароля
              </h3>
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                <label className="cms-label">
                  Новый пароль <span style={{ color: "var(--cms-text-muted)", fontWeight: 400 }}>(оставьте пустым, если не меняете)</span>
                  <input className="cms-input" type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} autoComplete="new-password" placeholder="Минимум 8 символов" />
                </label>
                {newPassword && (
                  <label className="cms-label">
                    Подтвердите новый пароль
                    <input className="cms-input" type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} autoComplete="new-password" />
                  </label>
                )}
              </div>
            </div>

            <div style={{ borderTop: "1px solid var(--cms-border)", paddingTop: 16, marginBottom: 20 }}>
              <label className="cms-label">
                <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ color: "var(--cms-text-muted)" }}>
                    <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0110 0v4"/>
                  </svg>
                  Текущий пароль <span style={{ color: "var(--cms-danger, #dc2626)" }}>*</span>
                </span>
                <input className="cms-input" type="password" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} required autoComplete="current-password" placeholder="Для подтверждения изменений" />
              </label>
            </div>

            <div style={{ display: "flex", gap: 10, justifyContent: "space-between", alignItems: "center" }}>
              <button type="submit" className="cms-btn cms-btn-primary" disabled={saving}>
                {saving ? "Сохранение..." : "Сохранить изменения"}
              </button>
              <button type="button" className="cms-btn cms-btn-danger" onClick={handleLogout} style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4M16 17l5-5-5-5M21 12H9"/>
                </svg>
                Выйти
              </button>
            </div>

            {createdAt && (
              <div style={{ marginTop: 24, fontSize: 12, color: "var(--cms-text-muted)", textAlign: "center" }}>
                Аккаунт создан: {new Date(createdAt).toLocaleDateString("ru-RU")}
              </div>
            )}
          </form>
        </div>
      </main>

      {notification && <div className="cms-toast">{notification}</div>}
    </div>
  );
}
