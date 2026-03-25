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

interface NlCustomer {
  email: string;
  name: string;
  city: string;
  orderCount: number;
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

  // Newsletter state
  const [showNewsletter, setShowNewsletter] = useState(false);
  const [nlView, setNlView] = useState<'select' | 'sending' | 'done'>('select');
  const [nlCustomers, setNlCustomers] = useState<NlCustomer[]>([]);
  const [nlLoadingCustomers, setNlLoadingCustomers] = useState(false);
  const [nlSearch, setNlSearch] = useState('');
  const [nlSelected, setNlSelected] = useState<Set<string>>(new Set());
  const [nlSubject, setNlSubject] = useState('');
  const [nlBody, setNlBody] = useState('');
  const [nlResult, setNlResult] = useState<{ sent: number; failed: number; errors: string[] } | null>(null);

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
            <button className="cms-btn cms-btn-sm" onClick={openNewsletter} title="Рассылка">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ marginRight: 4 }}>
                <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/>
              </svg>
              Рассылка
            </button>
            <button className="cms-btn cms-btn-sm cms-btn-primary" onClick={handleCompose}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ marginRight: 4 }}>
                <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
              </svg>
              Написать
            </button>
            <button className="cms-btn cms-btn-sm" onClick={markAllRead} title="Отметить все как прочитанные">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
            </button>
            <button className="cms-btn cms-btn-sm" onClick={() => { setLoading(true); fetchEmails(); }} title="Обновить">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M23 4v6h-6M1 20v-6h6"/><path d="M3.51 9a9 9 0 0114.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0020.49 15"/></svg>
            </button>
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

      {/* Newsletter Modal */}
      {showNewsletter && (
        <div className="cms-modal-overlay" onClick={() => { if (nlView !== 'sending') setShowNewsletter(false); }}>
          <div
            className="cms-modal"
            onClick={e => e.stopPropagation()}
            style={{ maxWidth: 960, width: '95vw', maxHeight: '90vh', display: 'flex', flexDirection: 'column', padding: 0 }}
          >
            {/* Header */}
            <div className="cms-modal-header" style={{ padding: '14px 20px', borderBottom: '1px solid var(--cms-border)' }}>
              <h3 style={{ fontSize: 15, display: 'flex', alignItems: 'center', gap: 8 }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/>
                </svg>
                Рассылка
              </h3>
              {nlView !== 'sending' && (
                <button className="cms-modal-close" onClick={() => setShowNewsletter(false)}>&times;</button>
              )}
            </div>

            {/* SELECT VIEW */}
            {nlView === 'select' && (
              <>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', flex: 1, overflow: 'hidden', minHeight: 0 }}>
                  {/* Left: Recipients */}
                  <div style={{ display: 'flex', flexDirection: 'column', borderRight: '1px solid var(--cms-border)', padding: 16, overflow: 'hidden' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                      <span style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--cms-text-muted)' }}>Получатели</span>
                      {nlSelected.size > 0 && (
                        <span style={{ fontSize: 11, fontWeight: 700, background: 'rgba(232,96,28,0.12)', color: 'var(--cms-accent)', padding: '2px 10px', borderRadius: 20 }}>
                          {nlSelected.size} выбрано
                        </span>
                      )}
                    </div>
                    <div style={{ display: 'flex', gap: 6, marginBottom: 10 }}>
                      <input
                        className="cms-input cms-input-sm"
                        placeholder="Поиск по имени, email, городу..."
                        value={nlSearch}
                        onChange={e => setNlSearch(e.target.value)}
                        style={{ flex: 1 }}
                      />
                      <button
                        className={`cms-btn cms-btn-sm${nlAllFilteredSelected ? ' cms-btn-primary' : ''}`}
                        onClick={() => nlAllFilteredSelected ? nlDeselectFiltered() : nlSelectFiltered()}
                        title={nlAllFilteredSelected ? 'Снять выделение' : 'Выбрать всех из списка'}
                      >
                        {nlAllFilteredSelected ? 'Снять' : 'Все'}
                      </button>
                    </div>
                    {nlLoadingCustomers ? (
                      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <div className="cms-spinner" />
                      </div>
                    ) : (
                      <div style={{ flex: 1, overflowY: 'auto' }}>
                        <table className="cms-table" style={{ fontSize: 12 }}>
                          <thead>
                            <tr>
                              <th style={{ width: 32 }}>
                                <input
                                  type="checkbox"
                                  checked={nlAllFilteredSelected && nlFiltered.length > 0}
                                  onChange={() => nlAllFilteredSelected ? nlDeselectFiltered() : nlSelectFiltered()}
                                  style={{ cursor: 'pointer' }}
                                />
                              </th>
                              <th>Имя</th>
                              <th>Email</th>
                              <th style={{ width: 80 }}>Город</th>
                              <th style={{ width: 44, textAlign: 'center' }}>Зак.</th>
                            </tr>
                          </thead>
                          <tbody>
                            {nlFiltered.map(c => (
                              <tr
                                key={c.email}
                                style={{ cursor: 'pointer', background: nlSelected.has(c.email) ? 'var(--cms-surface-hover)' : undefined }}
                                onClick={() => nlToggle(c.email)}
                              >
                                <td onClick={e => e.stopPropagation()}>
                                  <input type="checkbox" checked={nlSelected.has(c.email)} onChange={() => nlToggle(c.email)} style={{ cursor: 'pointer' }} />
                                </td>
                                <td style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 100 }}>
                                  {c.name || <span style={{ color: 'var(--cms-text-muted)' }}>—</span>}
                                </td>
                                <td style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 150, color: 'var(--cms-accent)' }}>
                                  {c.email}
                                </td>
                                <td style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                  {c.city || <span style={{ color: 'var(--cms-text-muted)' }}>—</span>}
                                </td>
                                <td style={{ textAlign: 'center', fontWeight: 600 }}>{c.orderCount}</td>
                              </tr>
                            ))}
                            {nlFiltered.length === 0 && (
                              <tr>
                                <td colSpan={5} style={{ textAlign: 'center', padding: '28px', color: 'var(--cms-text-muted)', fontSize: 12 }}>
                                  {nlCustomers.length === 0 ? 'Нет клиентов с email-адресом' : 'Ничего не найдено'}
                                </td>
                              </tr>
                            )}
                          </tbody>
                        </table>
                      </div>
                    )}
                    <div style={{ paddingTop: 8, marginTop: 8, borderTop: '1px solid var(--cms-border)', fontSize: 11, color: 'var(--cms-text-muted)' }}>
                      Всего клиентов с email: {nlCustomers.length}
                    </div>
                  </div>

                  {/* Right: Compose */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 12, padding: 16 }}>
                    <span style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--cms-text-muted)' }}>Письмо</span>
                    <label className="cms-label">
                      Тема
                      <input
                        className="cms-input"
                        value={nlSubject}
                        onChange={e => setNlSubject(e.target.value)}
                        placeholder="Тема рассылки..."
                      />
                    </label>
                    <label className="cms-label" style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
                      Текст письма
                      <textarea
                        className="cms-textarea"
                        value={nlBody}
                        onChange={e => setNlBody(e.target.value)}
                        placeholder={"Здравствуйте!\n\nТекст вашего сообщения...\n\nПоддерживается HTML: <b>жирный</b>, <a href=\"https://errani.ru\">ссылка</a>"}
                        style={{ flex: 1, resize: 'none', minHeight: 200, fontFamily: 'monospace', fontSize: 12, lineHeight: 1.6 }}
                      />
                    </label>
                    <div style={{ fontSize: 11, color: 'var(--cms-text-muted)', background: 'var(--cms-surface)', padding: '8px 10px', borderRadius: 6, lineHeight: 1.7 }}>
                      HTML:&nbsp;
                      <code style={{ background: 'rgba(255,255,255,0.07)', padding: '1px 5px', borderRadius: 3 }}>&lt;b&gt;</code>{' '}
                      <code style={{ background: 'rgba(255,255,255,0.07)', padding: '1px 5px', borderRadius: 3 }}>&lt;i&gt;</code>{' '}
                      <code style={{ background: 'rgba(255,255,255,0.07)', padding: '1px 5px', borderRadius: 3 }}>&lt;a href=&quot;...&quot;&gt;</code>{' '}
                      <code style={{ background: 'rgba(255,255,255,0.07)', padding: '1px 5px', borderRadius: 3 }}>&lt;br&gt;</code>
                      &nbsp;·&nbsp; Двойной Enter = новый абзац
                    </div>
                  </div>
                </div>

                {/* Footer */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 20px', borderTop: '1px solid var(--cms-border)' }}>
                  <span style={{ marginRight: 'auto', fontSize: 12, color: nlSelected.size > 0 ? 'var(--cms-text-primary)' : 'var(--cms-text-muted)' }}>
                    {nlSelected.size > 0
                      ? <><strong>{nlSelected.size}</strong>{' '}{nlSelected.size === 1 ? 'получатель выбран' : nlSelected.size < 5 ? 'получателя выбрано' : 'получателей выбрано'}</>
                      : 'Выберите получателей слева'}
                  </span>
                  <button className="cms-btn" onClick={() => setShowNewsletter(false)}>Отмена</button>
                  <button
                    className="cms-btn cms-btn-primary"
                    disabled={nlSelected.size === 0 || !nlSubject.trim() || !nlBody.trim()}
                    onClick={handleSendNewsletter}
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ marginRight: 5, verticalAlign: 'middle' }}>
                      <line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/>
                    </svg>
                    Отправить ({nlSelected.size})
                  </button>
                </div>
              </>
            )}

            {/* SENDING VIEW */}
            {nlView === 'sending' && (
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 48, gap: 16 }}>
                <div className="cms-spinner" style={{ width: 36, height: 36 }} />
                <h3 style={{ fontSize: 16, fontWeight: 600 }}>Идёт отправка...</h3>
                <p style={{ color: 'var(--cms-text-muted)', fontSize: 13, textAlign: 'center', lineHeight: 1.7 }}>
                  Рассылка отправляется {nlSelected.size} получателям.<br />
                  Пожалуйста, не закрывайте окно.
                </p>
              </div>
            )}

            {/* DONE VIEW */}
            {nlView === 'done' && nlResult && (
              <>
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '32px 24px', gap: 12 }}>
                  <div style={{ fontSize: 44, lineHeight: 1, marginBottom: 4 }}>
                    {nlResult.failed === 0 ? '✅' : '⚠️'}
                  </div>
                  <h3 style={{ fontSize: 18, fontWeight: 700 }}>Рассылка завершена</h3>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, width: '100%', maxWidth: 300, margin: '8px 0' }}>
                    <div style={{ background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.25)', borderRadius: 12, padding: '18px 12px', textAlign: 'center' }}>
                      <div style={{ fontSize: 36, fontWeight: 900, color: '#10b981', lineHeight: 1 }}>{nlResult.sent}</div>
                      <div style={{ fontSize: 10, color: 'var(--cms-text-muted)', marginTop: 6, textTransform: 'uppercase', letterSpacing: '0.1em' }}>Отправлено</div>
                    </div>
                    <div style={{ background: nlResult.failed > 0 ? 'rgba(239,68,68,0.1)' : 'var(--cms-surface)', border: `1px solid ${nlResult.failed > 0 ? 'rgba(239,68,68,0.25)' : 'var(--cms-border)'}`, borderRadius: 12, padding: '18px 12px', textAlign: 'center' }}>
                      <div style={{ fontSize: 36, fontWeight: 900, color: nlResult.failed > 0 ? '#ef4444' : 'var(--cms-text-muted)', lineHeight: 1 }}>{nlResult.failed}</div>
                      <div style={{ fontSize: 10, color: 'var(--cms-text-muted)', marginTop: 6, textTransform: 'uppercase', letterSpacing: '0.1em' }}>Ошибок</div>
                    </div>
                  </div>
                  {nlResult.errors.length > 0 && (
                    <div style={{ width: '100%', maxWidth: 420, background: 'var(--cms-surface)', borderRadius: 8, padding: '10px 12px', fontSize: 11, color: 'var(--cms-text-muted)', maxHeight: 100, overflowY: 'auto', lineHeight: 1.8 }}>
                      {nlResult.errors.map((e, i) => <div key={i}>{e}</div>)}
                    </div>
                  )}
                </div>
                <div style={{ padding: '12px 20px', borderTop: '1px solid var(--cms-border)', display: 'flex', justifyContent: 'flex-end' }}>
                  <button className="cms-btn cms-btn-primary" onClick={() => { setShowNewsletter(false); setNlView('select'); setNlResult(null); }}>
                    Готово
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {notification && <div className="cms-toast">{notification}</div>}
    </div>
  );
}
