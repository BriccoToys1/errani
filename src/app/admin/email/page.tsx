"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { AdminSidebar } from "../AdminSidebar";

interface Email {
  id: string;
  direction: string;
  fromAddr: string;
  toAddr: string;
  subject: string;
  body: string;
  textBody: string;
  status: string;
  isRead: boolean;
  resendId: string;
  inReplyTo: string;
  createdAt: string;
}

export default function AdminEmailPage() {
  const router = useRouter();
  const [emails, setEmails] = useState<Email[]>([]);
  const [loading, setLoading] = useState(true);
  const [folder, setFolder] = useState("all");
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Email | null>(null);
  const [notification, setNotification] = useState("");
  const [composing, setComposing] = useState(false);
  const [replyTo, setReplyTo] = useState<Email | null>(null);
  const [unreadCount, setUnreadCount] = useState(0);

  // Compose state
  const [compTo, setCompTo] = useState("");
  const [compSubject, setCompSubject] = useState("");
  const [compBody, setCompBody] = useState("");
  const [sending, setSending] = useState(false);

  const getToken = useCallback(() => localStorage.getItem("admin_token"), []);

  const fetchEmails = useCallback(async () => {
    const token = getToken();
    if (!token) { router.push("/admin/login"); return; }
    try {
      const params = new URLSearchParams({ folder });
      if (search) params.set("search", search);
      const res = await fetch(`/api/admin/email?${params}`, { headers: { Authorization: `Bearer ${token}` } });
      if (res.status === 401) { router.push("/admin/login"); return; }
      if (res.ok) {
        const data = await res.json();
        setEmails(data.emails || []);
        setUnreadCount(data.unreadCount || 0);
      }
    } catch { /* ignore */ }
    setLoading(false);
  }, [getToken, router, folder, search]);

  useEffect(() => { fetchEmails(); }, [fetchEmails]);

  const notify = (msg: string) => { setNotification(msg); setTimeout(() => setNotification(""), 3000); };

  const openEmail = async (email: Email) => {
    setSelected(email);
    if (!email.isRead && email.direction === "inbound") {
      const token = getToken();
      await fetch("/api/admin/email", {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ ids: [email.id] }),
      });
      setEmails(prev => prev.map(e => e.id === email.id ? { ...e, isRead: true } : e));
      setUnreadCount(prev => Math.max(0, prev - 1));
    }
  };

  const handleReply = (email: Email) => {
    setReplyTo(email);
    setComposing(true);
    setCompTo(email.direction === "inbound" ? email.fromAddr : email.toAddr);
    setCompSubject(email.subject.startsWith("Re: ") ? email.subject : `Re: ${email.subject}`);
    setCompBody("");
    setSelected(null);
  };

  const handleCompose = () => {
    setReplyTo(null);
    setComposing(true);
    setCompTo("");
    setCompSubject("");
    setCompBody("");
    setSelected(null);
  };

  const handleSend = async () => {
    if (!compTo || !compSubject || !compBody) {
      notify("Заполните все поля");
      return;
    }
    setSending(true);
    const token = getToken();
    try {
      const res = await fetch("/api/admin/email", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          to: compTo,
          subject: compSubject,
          body: compBody.replace(/\n/g, "<br>"),
          replyTo: replyTo?.id || "",
        }),
      });
      const data = await res.json();
      if (res.ok) {
        notify("Письмо отправлено");
        setComposing(false);
        setCompTo(""); setCompSubject(""); setCompBody("");
        fetchEmails();
      } else {
        notify(data.error || "Ошибка отправки");
      }
    } catch {
      notify("Ошибка сети");
    }
    setSending(false);
  };

  const markAllRead = async () => {
    const token = getToken();
    try {
      await fetch("/api/admin/email", {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ markAll: true }),
      });
      setEmails(prev => prev.map(e => ({ ...e, isRead: true })));
      setUnreadCount(0);
      notify("Все письма отмечены как прочитанные");
    } catch { /* ignore */ }
  };

  const deleteEmail = async (ids: string[]) => {
    if (!confirm(`Удалить ${ids.length} письмо(а)?`)) return;
    const token = getToken();
    try {
      await fetch("/api/admin/email", {
        method: "DELETE",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ ids }),
      });
      setEmails(prev => prev.filter(e => !ids.includes(e.id)));
      if (selected && ids.includes(selected.id)) setSelected(null);
      notify("Удалено");
    } catch { /* ignore */ }
  };

  const formatDate = (d: string) => {
    const date = new Date(d);
    const today = new Date();
    if (date.toDateString() === today.toDateString()) {
      return date.toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" });
    }
    return date.toLocaleDateString("ru-RU", { day: "2-digit", month: "2-digit" });
  };

  if (loading) return <div className="cms-loading"><div className="cms-spinner" /> Загрузка...</div>;

  return (
    <div className="cms-root">
      <AdminSidebar />
      <main className="cms-main">
        <div className="cms-header">
          <h1 className="cms-header-title">
            Почта
            {unreadCount > 0 && <span className="cms-badge cms-badge-blue" style={{ marginLeft: "10px", fontSize: "12px" }}>{unreadCount}</span>}
          </h1>
          <div className="cms-header-actions">
            <button className="cms-btn cms-btn-sm cms-btn-primary" onClick={handleCompose}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ marginRight: 4 }}>
                <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
              </svg>
              Написать
            </button>
            <button className="cms-btn cms-btn-sm" onClick={markAllRead} title="Отметить все как прочитанные">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
            </button>
            <button className="cms-btn cms-btn-sm" onClick={() => { setLoading(true); fetchEmails(); }}>Обновить</button>
          </div>
        </div>

        <div className="cms-content">
          {/* Toolbar */}
          <div style={{ display: "flex", gap: "8px", alignItems: "center", marginBottom: "12px" }}>
            <div style={{ display: "flex", gap: "4px" }}>
              {[
                { key: "all", label: "Все" },
                { key: "inbox", label: "Входящие" },
                { key: "sent", label: "Отправленные" },
              ].map(f => (
                <button
                  key={f.key}
                  className={`cms-btn cms-btn-sm ${folder === f.key ? "cms-btn-primary" : ""}`}
                  onClick={() => setFolder(f.key)}
                  style={{ fontSize: 12 }}
                >
                  {f.label}
                </button>
              ))}
            </div>
            <input
              className="cms-input cms-input-sm"
              placeholder="Поиск..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{ width: "180px", marginLeft: "auto" }}
            />
          </div>

          {/* Email List */}
          <div className="cms-table-wrap">
            <table className="cms-table">
              <thead>
                <tr>
                  <th style={{ width: 24 }}></th>
                  <th style={{ width: 180 }}>От / Кому</th>
                  <th>Тема</th>
                  <th style={{ width: 80 }}>Дата</th>
                  <th style={{ width: 60 }}>Действия</th>
                </tr>
              </thead>
              <tbody>
                {emails.map(email => (
                  <tr
                    key={email.id}
                    style={{
                      cursor: "pointer",
                      fontWeight: !email.isRead && email.direction === "inbound" ? 600 : 400,
                      background: selected?.id === email.id ? "var(--cms-surface-hover)" : undefined,
                    }}
                    onClick={() => openEmail(email)}
                  >
                    <td>
                      {email.direction === "inbound" ? (
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--cms-accent)" strokeWidth="2"><polyline points="22 12 16 12 14 15 10 15 8 12 2 12"/><path d="M5.45 5.11L2 12v6a2 2 0 002 2h16a2 2 0 002-2v-6l-3.45-6.89A2 2 0 0016.76 4H7.24a2 2 0 00-1.79 1.11z"/></svg>
                      ) : (
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--cms-text-muted)" strokeWidth="2"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
                      )}
                    </td>
                    <td style={{ fontSize: 12, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 180 }}>
                      {email.direction === "inbound" ? email.fromAddr : email.toAddr}
                    </td>
                    <td style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {email.subject || "(без темы)"}
                      <span style={{ color: "var(--cms-text-muted)", fontWeight: 400, marginLeft: 8, fontSize: 11 }}>
                        {email.textBody.substring(0, 60)}
                      </span>
                    </td>
                    <td style={{ fontSize: 11, color: "var(--cms-text-muted)" }}>
                      {formatDate(email.createdAt)}
                    </td>
                    <td onClick={e => e.stopPropagation()}>
                      <button className="cms-btn cms-btn-xs cms-btn-ghost" onClick={() => handleReply(email)} title="Ответить">
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="9 17 4 12 9 7"/><path d="M20 18v-2a4 4 0 00-4-4H4"/></svg>
                      </button>
                      <button className="cms-btn cms-btn-xs cms-btn-ghost" onClick={() => deleteEmail([email.id])} title="Удалить" style={{ color: "var(--cms-danger)" }}>
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/></svg>
                      </button>
                    </td>
                  </tr>
                ))}
                {emails.length === 0 && (
                  <tr><td colSpan={5} style={{ textAlign: "center", padding: "32px", color: "var(--cms-text-muted)" }}>Нет писем</td></tr>
                )}
              </tbody>
            </table>
          </div>

          <div style={{ marginTop: 12, fontSize: 11, color: "var(--cms-text-muted)" }}>
            mail@errani.ru · {emails.length} писем
          </div>
        </div>
      </main>

      {/* Email View Modal */}
      {selected && !composing && (
        <div className="cms-modal-overlay" onClick={() => setSelected(null)}>
          <div className="cms-modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 640 }}>
            <div className="cms-modal-header">
              <h3 style={{ fontSize: 14, fontWeight: 600 }}>{selected.subject || "(без темы)"}</h3>
              <button className="cms-modal-close" onClick={() => setSelected(null)}>&times;</button>
            </div>
            <div className="cms-modal-body">
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 12, fontSize: 12 }}>
                <div>
                  <strong>{selected.direction === "inbound" ? "От:" : "Кому:"}</strong>{" "}
                  <span style={{ color: "var(--cms-accent)" }}>
                    {selected.direction === "inbound" ? selected.fromAddr : selected.toAddr}
                  </span>
                </div>
                <div style={{ color: "var(--cms-text-muted)" }}>
                  {new Date(selected.createdAt).toLocaleString("ru-RU")}
                </div>
              </div>
              <div
                style={{
                  background: "var(--cms-surface)", padding: 16, borderRadius: 8,
                  fontSize: 13, lineHeight: 1.7, maxHeight: 400, overflowY: "auto",
                  wordBreak: "break-word",
                }}
                dangerouslySetInnerHTML={{ __html: selected.body }}
              />
            </div>
            <div className="cms-modal-actions" style={{ display: "flex", gap: 8 }}>
              <button className="cms-btn cms-btn-primary" onClick={() => handleReply(selected)}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ marginRight: 4 }}>
                  <polyline points="9 17 4 12 9 7"/><path d="M20 18v-2a4 4 0 00-4-4H4"/>
                </svg>
                Ответить
              </button>
              <button className="cms-btn cms-btn-danger" onClick={() => deleteEmail([selected.id])}>Удалить</button>
              <button className="cms-btn" onClick={() => setSelected(null)}>Закрыть</button>
            </div>
          </div>
        </div>
      )}

      {/* Compose Modal */}
      {composing && (
        <div className="cms-modal-overlay" onClick={() => setComposing(false)}>
          <div className="cms-modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 600 }}>
            <div className="cms-modal-header">
              <h3>{replyTo ? "Ответ" : "Новое письмо"}</h3>
              <button className="cms-modal-close" onClick={() => setComposing(false)}>&times;</button>
            </div>
            <div className="cms-modal-body">
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                <label className="cms-label">
                  Кому
                  <input
                    className="cms-input"
                    value={compTo}
                    onChange={e => setCompTo(e.target.value)}
                    placeholder="email@example.com"
                    type="email"
                    required
                  />
                </label>
                <label className="cms-label">
                  Тема
                  <input
                    className="cms-input"
                    value={compSubject}
                    onChange={e => setCompSubject(e.target.value)}
                    placeholder="Тема письма"
                    required
                  />
                </label>
                <label className="cms-label">
                  Сообщение
                  <textarea
                    className="cms-textarea"
                    value={compBody}
                    onChange={e => setCompBody(e.target.value)}
                    rows={10}
                    placeholder="Текст письма..."
                    style={{ width: "100%", resize: "vertical" }}
                    required
                  />
                </label>
              </div>
              <div style={{ fontSize: 11, color: "var(--cms-text-muted)", marginTop: 8 }}>
                Отправка от имени mail@errani.ru
              </div>
            </div>
            <div className="cms-modal-actions" style={{ display: "flex", gap: 8 }}>
              <button className="cms-btn cms-btn-primary" onClick={handleSend} disabled={sending}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ marginRight: 4 }}>
                  <line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/>
                </svg>
                {sending ? "Отправка..." : "Отправить"}
              </button>
              <button className="cms-btn" onClick={() => setComposing(false)}>Отмена</button>
            </div>
          </div>
        </div>
      )}

      {notification && <div className="cms-toast">{notification}</div>}
    </div>
  );
}
