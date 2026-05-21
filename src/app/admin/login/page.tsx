"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";

export default function AdminLoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  
  // Challenge state
  const [challengeToken, setChallengeToken] = useState("");
  const [challengeQuestion, setChallengeQuestion] = useState("");
  const [challengeAnswer, setChallengeAnswer] = useState("");
  const [challengeLoading, setChallengeLoading] = useState(true);

  const loadChallenge = useCallback(async () => {
    setChallengeLoading(true);
    try {
      const res = await fetch("/api/admin/login");
      if (res.ok) {
        const data = await res.json();
        setChallengeToken(data.challengeToken);
        setChallengeQuestion(data.question);
        setChallengeAnswer("");
      }
    } catch { /* ignore */ }
    setChallengeLoading(false);
  }, []);

  useEffect(() => { loadChallenge(); }, [loadChallenge]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const res = await fetch("/api/admin/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password, challengeToken, challengeAnswer }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Ошибка входа");
        setLoading(false);
        // Reload challenge on failure
        loadChallenge();
        return;
      }

      localStorage.setItem("admin_token", data.token);
      document.cookie = `admin_token=${data.token}; path=/; max-age=${7 * 24 * 60 * 60}; samesite=lax`;
      router.push("/admin");
    } catch {
      setError("Ошибка сети");
      setLoading(false);
    }
  };

  return (
    <div className="cms-login-wrap">
      <form onSubmit={handleSubmit} className="cms-login-card">
        <div className="cms-login-brand">
          <div className="cms-login-logo">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <rect x="3" y="3" width="7" height="9" rx="1.5"/>
              <rect x="14" y="3" width="7" height="5" rx="1.5"/>
              <rect x="3" y="16" width="7" height="5" rx="1.5"/>
              <rect x="14" y="12" width="7" height="9" rx="1.5"/>
            </svg>
          </div>
          <h1 className="cms-login-title">errani</h1>
          <p className="cms-login-subtitle">Панель управления</p>
        </div>

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
              type="text"
              className="cms-input"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoFocus
              autoComplete="off"
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
                autoComplete="new-password"
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
              >
                {showPassword ? (
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19m-6.72-1.07a3 3 0 11-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>
                ) : (
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                )}
              </button>
            </div>
          </label>

          {/* Security challenge */}
          <label className="cms-label">
            <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ color: "var(--cms-text-muted)" }}>
                <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0110 0v4"/>
              </svg>
              Проверка: сколько будет {challengeLoading ? "..." : challengeQuestion}?
            </span>
            <input
              type="text"
              className="cms-input"
              value={challengeAnswer}
              onChange={(e) => setChallengeAnswer(e.target.value.replace(/[^0-9]/g, ""))}
              required
              autoComplete="off"
              placeholder="Ответ"
              inputMode="numeric"
              maxLength={3}
              disabled={challengeLoading}
            />
          </label>

          <button type="submit" className="cms-login-submit" disabled={loading || challengeLoading}>
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

        <div style={{ textAlign: "center", marginTop: "16px", fontSize: "11px", color: "var(--cms-text-muted)" }}>
          Защищённый вход · errani.ru
        </div>
      </form>
    </div>
  );
}
