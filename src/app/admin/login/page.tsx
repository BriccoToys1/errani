"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { setAdminAuthToken } from "@/lib/admin-client";
import { Icon } from "@/components/admin";

export default function AdminLoginPage() {
  const router = useRouter();
  const [login, setLogin] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const res = await fetch("/api/admin/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: login, password }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Ошибка входа");
        setLoading(false);
        return;
      }

      if (res.ok && data?.authenticated) {
        const token = data.token || "";
        setAdminAuthToken(token);
        if (typeof window !== "undefined") {
          window.localStorage.setItem("admin_token", token);
          document.cookie = `admin_token=${encodeURIComponent(token)}; path=/; max-age=43200; samesite=strict; ${window.location.protocol === "https:" ? "Secure" : ""}`.trim();
        }
        router.replace("/admin");
        window.location.assign("/admin");
        return;
      }

      setError(data.error || "Ошибка входа");
      setLoading(false);
    } catch {
      setError("Ошибка сети");
      setLoading(false);
    }
  };

  return (
    <div className="cms-login-wrap">
      <form onSubmit={handleSubmit} className="cms-login-card">
        <div className="cms-login-brand">
          <h1 className="cms-login-title">errani</h1>
        </div>

        {error && (
          <div className="cms-login-error">
            <Icon name="info" size={14} />
            {error}
          </div>
        )}

        <div className="cms-login-form">
          <label className="cms-label">
            Логин
            <input
              type="text"
              className="cms-input"
              value={login}
              onChange={(e) => setLogin(e.target.value)}
              required
              autoFocus
              autoComplete="username"
              autoCorrect="off"
              autoCapitalize="off"
              spellCheck={false}
              placeholder="Логин"
            />
          </label>

          <label className="cms-label">
            Пароль
            <div className="cms-login-password">
              <input
                type={showPassword ? "text" : "password"}
                className="cms-input"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoComplete="current-password"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="cms-iconbtn cms-iconbtn-plain cms-login-password-toggle"
                tabIndex={-1}
                aria-label={showPassword ? "Скрыть пароль" : "Показать пароль"}
              >
                <Icon name={showPassword ? "hide" : "view"} size={16} />
              </button>
            </div>
          </label>

          <button type="submit" className="cms-login-submit" disabled={loading}>
            {loading ? (
              <span style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
                <span className="cms-spinner" style={{ width: 16, height: 16, borderWidth: 2 }} />
                Вход...
              </span>
            ) : (
              <span style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
                Войти
              </span>
            )}
          </button>
        </div>
      </form>
    </div>
  );
}
