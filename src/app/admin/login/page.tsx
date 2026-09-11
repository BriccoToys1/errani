"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { setAdminAuthToken } from '@/lib/admin-client';

export default function AdminLoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
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
        body: JSON.stringify({ email, password }),
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
        {error && (
          <div className="cms-login-error">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ flexShrink: 0 }}>
              <circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/>
            </svg>
            {error}
          </div>
        )}

        <div className="cms-login-form">
          <label className="cms-label">
            Email
            <input
              type="email"
              className="cms-input"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoFocus
              autoComplete="username"
              autoCorrect="off"
              autoCapitalize="off"
              spellCheck={false}
              placeholder="admin@errani.ru"
            />
          </label>

          <label className="cms-label">
            Пароль
            <div style={{ position: "relative" }}>
              <input
                type={showPassword ? "text" : "password"}
                className="cms-input"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoComplete="current-password"
                style={{ paddingRight: "40px" }}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                style={{
                  position: "absolute", right: 8, top: "50%", transform: "translateY(-50%)",
                  background: "none", border: "none", cursor: "pointer", padding: "4px",
                  color: "var(--cms-text-muted)", display: "flex"
                }}
                tabIndex={-1}
                aria-label={showPassword ? "Скрыть пароль" : "Показать пароль"}
              >
                {showPassword ? (
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19m-6.72-1.07a3 3 0 11-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>
                ) : (
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                )}
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
              <span style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M15 3h4a2 2 0 012 2v14a2 2 0 01-2 2h-4M10 17l5-5-5-5M15 12H3"/>
                </svg>
                Войти
              </span>
            )}
          </button>
        </div>

      </form>
    </div>
  );
}
