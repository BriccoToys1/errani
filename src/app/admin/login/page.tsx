"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function AdminLoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

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
        setError(data.error || "Login failed");
        setLoading(false);
        return;
      }

      localStorage.setItem("admin_token", data.token);
      // Also set cookie for middleware protection
      document.cookie = `admin_token=${data.token}; path=/; max-age=${7 * 24 * 60 * 60}; samesite=lax`;
      router.push("/admin");
    } catch {
      setError("Network error");
      setLoading(false);
    }
  };

  return (
    <div className="cms-login-wrap">
      <form onSubmit={handleSubmit} className="cms-login-card">
          <div className="cms-login-brand">
            <div className="cms-login-logo">E</div>
            <h1 className="cms-login-title">errani</h1>
            <p className="cms-login-subtitle">Panel management</p>
          </div>

          {error && <div className="cms-login-error">{error}</div>}

          <div className="cms-login-form">
            <label className="cms-label">Email
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
            />
          </label>

            <label className="cms-label">Password
            <input
              type="password"
              className="cms-input"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoComplete="new-password"
            />
          </label>

          <button type="submit" className="cms-login-submit" disabled={loading}>
            {loading ? "Signing in..." : "Sign in"}
          </button>
          </div>
      </form>
    </div>
  );
}
