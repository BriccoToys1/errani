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
      router.push("/admin");
    } catch {
      setError("Network error");
      setLoading(false);
    }
  };

  return (
    <div className="cms-login-screen">
      <form onSubmit={handleSubmit}>
        <div className="cms-login-box">
          <div className="cms-login-brand">
            <h1>errani &mdash; CMS</h1>
            <p>Panel management</p>
          </div>

          {error && <div className="cms-login-error">{error}</div>}

          <div className="cms-form-group">
            <label className="cms-label">Email</label>
            <input
              type="email"
              className="cms-input"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoFocus
              placeholder="admin@errani.ru"
            />
          </div>

          <div className="cms-form-group">
            <label className="cms-label">Password</label>
            <input
              type="password"
              className="cms-input"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              placeholder="password"
            />
          </div>

          <button type="submit" className="cms-btn cms-btn-primary" disabled={loading}
            style={{ width: "100%", justifyContent: "center", padding: "10px" }}>
            {loading ? "Signing in..." : "Sign in"}
          </button>
        </div>
      </form>
    </div>
  );
}
