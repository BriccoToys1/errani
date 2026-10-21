"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AdminPage } from "../AdminPage";
import { Button, PageLoading } from "@/components/admin";
import { adminFetch, adminToastClass } from "@/lib/admin-client";

export default function AdminAccountPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [login, setLogin] = useState("");
  const [name, setName] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [notification, setNotification] = useState("");
  const [error, setError] = useState("");

  const notify = (msg: string) => {
    setNotification(msg);
    setTimeout(() => setNotification(""), 3000);
  };

  const load = useCallback(async () => {
    try {
      const res = await adminFetch("/api/admin/account");
      if (res.status === 401) {
        router.push("/admin/login");
        return;
      }
      if (res.ok) {
        const data = await res.json();
        setLogin(data.email || "");
        setName(data.name || "");
      }
    } catch {
      setError("Не удалось загрузить профиль");
    }
    setLoading(false);
  }, [router]);

  useEffect(() => {
    load();
  }, [load]);

  const save = async () => {
    setError("");
    if (!currentPassword) {
      setError("Введите текущий пароль");
      return;
    }
    setSaving(true);
    try {
      const res = await adminFetch("/api/admin/account", {
        method: "PUT",
        body: JSON.stringify({
          email: login.trim(),
          name: name.trim(),
          currentPassword,
          newPassword: newPassword || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Ошибка сохранения");
      } else {
        notify("Сохранено");
        setCurrentPassword("");
        setNewPassword("");
        if (data.email) setLogin(data.email);
        if (data.name) setName(data.name);
      }
    } catch {
      setError("Ошибка сети");
    }
    setSaving(false);
  };

  if (loading) return <PageLoading />;

  return (
    <AdminPage title="Пользователи">
      <div className="cms-card" style={{ maxWidth: 480, padding: 20 }}>
        <div className="cms-section-stack">
          <label className="cms-label">
            Логин
            <input
              className="cms-input"
              type="text"
              value={login}
              onChange={(e) => setLogin(e.target.value)}
              autoComplete="username"
              placeholder="Логин"
            />
          </label>
          <label className="cms-label">
            Имя
            <input className="cms-input" value={name} onChange={(e) => setName(e.target.value)} placeholder="Имя" />
          </label>
          <label className="cms-label">
            Текущий пароль
            <input
              className="cms-input"
              type="password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              autoComplete="current-password"
            />
          </label>
          <label className="cms-label">
            Новый пароль
            <input
              className="cms-input"
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              autoComplete="new-password"
              placeholder="Оставьте пустым, если не меняете"
            />
          </label>
          {error && <div className="cms-login-error">{error}</div>}
          <div>
            <Button variant="primary" icon="save" onClick={save} disabled={saving}>
              {saving ? "Сохранение…" : "Сохранить"}
            </Button>
          </div>
        </div>
      </div>
      {notification && <div className={adminToastClass(notification)}>{notification}</div>}
    </AdminPage>
  );
}
