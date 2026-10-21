"use client";

import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { AdminPage } from "../AdminPage";
import {
  Button,
  ConfirmPopover,
  CountBadge,
  HeaderActions,
  Icon,
  IconButton,
  Modal,
  SearchField,
  SegmentedControl,
  PageLoading,
} from "@/components/admin";
import { adminFetch, adminToastClass, refreshAdminCounts } from "@/lib/admin-client";
import { isBrandedEmail } from "@/lib/email-template";
import { DEFAULT_MAILBOX, MAILBOX_INFO, MAILBOXES, type MailboxAddress, normalizeMailbox } from "@/lib/mailboxes";

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
  inReplyTo: string;
  kind: string;
  threadId: string;
  contactEmail: string;
  createdAt: string;
}

interface ParentPreview {
  id: string;
  subject: string;
  textBody: string;
  body: string;
  direction: string;
  kind: string;
  createdAt: string;
  fromAddr: string;
}

interface Conversation {
  threadId: string;
  contactEmail: string;
  name: string;
  subject: string;
  lastText: string;
  lastAt: string;
  lastDirection: string;
  unread: number;
  count: number;
}

interface Campaign {
  threadId: string;
  subject: string;
  body: string;
  preview: string;
  createdAt: string;
  recipients: string[];
  sent: number;
  failed: number;
}

interface NlCustomer {
  email: string;
  name: string;
  city: string;
  orderCount: number;
}

type Pane = "dialogs" | "newsletters";

function buildSafeEmailDocument(html: string): string {
  return `<!doctype html><html><head><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src data: cid: https:; style-src 'unsafe-inline'; font-src 'self'"><style>html{color-scheme:light}body{margin:0;padding:14px;background:#ffffff;color:#1a1a1a;font:14px/1.6 -apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;overflow-wrap:anywhere}a{color:#b0378f}img{max-width:100%;height:auto}pre{white-space:pre-wrap;font:inherit}</style></head><body>${html}</body></html>`;
}

/** Plain-text messages (no real HTML or our own branded wrapper) are shown natively for readability. */
function isPlainMessage(m: { body: string; textBody: string; direction: string }): boolean {
  const body = (m.body || "").trim();
  if (!body || body.startsWith("<pre")) return true;
  if (isBrandedEmail(body)) return true;
  return !/<[a-z][\s\S]*>/i.test(body);
}

function plainText(m: { body: string; textBody: string }): string {
  const text = (m.textBody || "").trim();
  if (text) return text;
  return (m.body || "").replace(/<br\s*\/?>/gi, "\n").replace(/<[^>]*>/g, "").trim();
}

function stripReplyPrefix(subject: string): string {
  let s = (subject || "").trim();
  const re = /^(re|fw|fwd|ответ)\s*:\s*/i;
  while (re.test(s)) s = s.replace(re, "").trim();
  return s;
}

function formatListDate(d: string) {
  const date = new Date(d);
  const today = new Date();
  if (date.toDateString() === today.toDateString()) {
    return date.toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" });
  }
  return date.toLocaleDateString("ru-RU", { day: "2-digit", month: "2-digit", year: "2-digit" });
}

function dayLabel(d: string) {
  const date = new Date(d);
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);
  if (date.toDateString() === today.toDateString()) return "Сегодня";
  if (date.toDateString() === yesterday.toDateString()) return "Вчера";
  return date.toLocaleDateString("ru-RU", { day: "numeric", month: "long", year: "numeric" });
}

function initials(nameOrEmail: string) {
  const s = (nameOrEmail || "?").trim();
  const parts = s.split(/\s+/).filter(Boolean);
  if (parts.length >= 2 && !s.includes("@")) return (parts[0][0] + parts[1][0]).toUpperCase();
  return s.charAt(0).toUpperCase();
}

const BUBBLE_COLLAPSE_PX = 112;

function AutoHeightFrame({
  html,
  title,
  expanded,
  onMeasure,
}: {
  html: string;
  title: string;
  expanded: boolean;
  onMeasure?: (fullHeight: number) => void;
}) {
  const ref = useRef<HTMLIFrameElement>(null);
  const [fullHeight, setFullHeight] = useState(BUBBLE_COLLAPSE_PX);
  const onLoad = () => {
    const doc = ref.current?.contentDocument;
    if (!doc?.body) return;
    const next = Math.min(Math.max(doc.body.scrollHeight + 4, 60), 1200);
    setFullHeight(next);
    onMeasure?.(next);
  };
  const height = expanded ? fullHeight : Math.min(fullHeight, BUBBLE_COLLAPSE_PX);
  return (
    <iframe
      ref={ref}
      title={title}
      sandbox="allow-same-origin"
      srcDoc={buildSafeEmailDocument(html)}
      className={`mail-html-frame${expanded ? "" : " is-collapsed"}`}
      style={{ height }}
      onLoad={onLoad}
    />
  );
}

function MessageBody({ message }: { message: { body: string; textBody: string; direction: string; subject?: string } }) {
  const [expanded, setExpanded] = useState(false);
  const textRef = useRef<HTMLDivElement>(null);
  const [overflows, setOverflows] = useState(false);
  const plain = isPlainMessage(message);

  useEffect(() => {
    if (!plain || !textRef.current) return;
    setOverflows(textRef.current.scrollHeight > BUBBLE_COLLAPSE_PX + 8);
  }, [plain, message.body, message.textBody]);

  return (
    <div className="messenger-bubble-body-wrap">
      {plain ? (
        <div
          ref={textRef}
          className={`messenger-bubble-text${expanded ? " is-expanded" : " is-collapsed"}`}
        >
          {plainText(message) || "(без текста)"}
        </div>
      ) : (
        <AutoHeightFrame
          html={message.body}
          title={`Письмо: ${message.subject || "без темы"}`}
          expanded={expanded}
          onMeasure={(h) => setOverflows(h > BUBBLE_COLLAPSE_PX + 8)}
        />
      )}
      {overflows && (
        <button type="button" className="messenger-bubble-toggle" onClick={() => setExpanded((v) => !v)}>
          {expanded ? "Свернуть" : "Показать полностью"}
        </button>
      )}
    </div>
  );
}

async function filesToAttachments(files: File[]) {
  return Promise.all(
    files.slice(0, 10).map(
      (file) =>
        new Promise<{ filename: string; content: string; contentType: string }>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => {
            const raw = String(reader.result || "");
            resolve({
              filename: file.name,
              contentType: file.type || "application/octet-stream",
              content: raw.includes(",") ? raw.split(",")[1] : raw,
            });
          };
          reader.onerror = () => reject(reader.error);
          reader.readAsDataURL(file);
        })
    )
  );
}

function RecipientsLine({ recipients }: { recipients: string[] }) {
  const [open, setOpen] = useState(false);
  const shown = open ? recipients : recipients.slice(0, 3);
  const rest = recipients.length - 3;
  return (
    <div className="mail-recipients">
      {shown.map((r) => (
        <span key={r} className="mail-recipient">{r}</span>
      ))}
      {rest > 0 && (
        <button type="button" className="mail-recipients-more" onClick={() => setOpen((v) => !v)}>
          {open ? "свернуть" : `и ещё ${rest}+`}
        </button>
      )}
    </div>
  );
}

function AdminEmailPageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [pane, setPane] = useState<Pane>(searchParams.get("pane") === "newsletters" ? "newsletters" : "dialogs");
  const [search, setSearch] = useState(searchParams.get("q") || "");
  const [loading, setLoading] = useState(true);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [activeThread, setActiveThread] = useState<string | null>(null);
  const [newContact, setNewContact] = useState<string>("");
  const [messages, setMessages] = useState<Email[]>([]);
  const [outsideParents, setOutsideParents] = useState<ParentPreview[]>([]);
  const [threadLoading, setThreadLoading] = useState(false);
  const [expandedQuotes, setExpandedQuotes] = useState<Set<string>>(new Set());
  const [replyTarget, setReplyTarget] = useState<Email | null>(null);
  const [replyDraft, setReplyDraft] = useState("");
  const [newSubject, setNewSubject] = useState("");
  const [replySending, setReplySending] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [notification, setNotification] = useState("");
  const [syncing, setSyncing] = useState(false);
  const [activeCampaign, setActiveCampaign] = useState<string | null>(null);
  const [mailboxOpen, setMailboxOpen] = useState(false);
  const [activeMailbox, setActiveMailbox] = useState<MailboxAddress>(DEFAULT_MAILBOX);
  const [availableMailboxes, setAvailableMailboxes] = useState<MailboxAddress[]>([...MAILBOXES]);
  const mailboxRef = useRef<HTMLDivElement>(null);
  const composerRef = useRef<HTMLTextAreaElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesScrollRef = useRef<HTMLDivElement>(null);
  const attachInputRef = useRef<HTMLInputElement>(null);
  const [stickyDate, setStickyDate] = useState("");
  const [replyFiles, setReplyFiles] = useState<File[]>([]);
  const [highlightId, setHighlightId] = useState<string | null>(null);
  const highlightTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Compose modal
  const [composing, setComposing] = useState(false);
  const [compTo, setCompTo] = useState("");
  const [compSubject, setCompSubject] = useState("");
  const [compBody, setCompBody] = useState("");
  const [compFiles, setCompFiles] = useState<File[]>([]);
  const [sending, setSending] = useState(false);

  // Newsletter modal
  const [showNewsletter, setShowNewsletter] = useState(false);
  const [nlView, setNlView] = useState<"select" | "sending" | "done">("select");
  const [nlCustomers, setNlCustomers] = useState<NlCustomer[]>([]);
  const [nlLoadingCustomers, setNlLoadingCustomers] = useState(false);
  const [nlSearch, setNlSearch] = useState("");
  const [nlSelected, setNlSelected] = useState<Set<string>>(new Set());
  const [nlSubject, setNlSubject] = useState("");
  const [nlBody, setNlBody] = useState("");
  const [nlConfirm, setNlConfirm] = useState(false);
  const [nlResult, setNlResult] = useState<{ sent: number; failed: number; errors: string[] } | null>(null);

  const notify = useCallback((msg: string) => {
    setNotification(msg);
    setTimeout(() => setNotification(""), 3000);
  }, []);

  const fetchList = useCallback(async () => {
    try {
      const params = new URLSearchParams({ view: pane, mailbox: activeMailbox });
      if (search.trim()) params.set("search", search.trim());
      const res = await adminFetch(`/api/admin/email?${params}`);
      if (res.status === 401) { router.push("/admin/login"); return; }
      if (!res.ok) {
        notify("Не удалось загрузить почту — данные на экране сохранены");
        return;
      }
      const data = await res.json();
      if (pane === "dialogs") {
        if (Array.isArray(data.conversations)) {
          setConversations(data.conversations);
          setUnreadCount(data.unreadCount || 0);
        }
      } else if (Array.isArray(data.campaigns)) {
        setCampaigns(data.campaigns);
      }
    } catch {
      notify("Не удалось загрузить почту — данные на экране сохранены");
    } finally {
      setLoading(false);
    }
  }, [pane, search, router, activeMailbox, notify]);

  const fetchThread = useCallback(async (threadId: string) => {
    setThreadLoading(true);
    try {
      const res = await adminFetch(`/api/admin/email?thread=${encodeURIComponent(threadId)}&mailbox=${encodeURIComponent(activeMailbox)}`);
      if (!res.ok) {
        notify("Не удалось загрузить переписку");
        return;
      }
      const data = await res.json();
      if (Array.isArray(data.messages)) {
        setMessages(data.messages);
        setOutsideParents(data.parents || []);
      }
    } catch {
      notify("Не удалось загрузить переписку");
    } finally {
      setThreadLoading(false);
    }
  }, [activeMailbox, notify]);

  useEffect(() => {
    adminFetch("/api/admin/email?mailboxes=1")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (!d) return;
        const list = (d.mailboxes || []).map((m: string) => normalizeMailbox(m));
        if (list.length) {
          setAvailableMailboxes(list);
          if (!list.includes(activeMailbox)) setActiveMailbox(list[0]);
        }
      })
      .catch(() => undefined);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const selectMailbox = (addr: MailboxAddress) => {
    setActiveMailbox(addr);
    setMailboxOpen(false);
    setActiveThread(null);
    setActiveCampaign(null);
    setMessages([]);
  };

  const syncEmails = useCallback(async (showResult = false) => {
    if (showResult) setSyncing(true);
    try {
      const res = await adminFetch("/api/admin/email/sync", { method: "POST" });
      const data = await res.json();
      if (showResult) notify(data.error ? `Ошибка: ${data.error}` : `Синхронизировано: +${data.synced || 0}`);
    } catch {
      if (showResult) notify("Ошибка сети");
    }
    if (showResult) setSyncing(false);
  }, [notify]);

  useEffect(() => {
    syncEmails().then(() => fetchList());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const t = setTimeout(() => { fetchList(); }, search ? 250 : 0);
    return () => clearTimeout(t);
  }, [fetchList, search]);

  useEffect(() => {
    const interval = setInterval(() => {
      fetchList();
      if (activeThread) fetchThread(activeThread);
    }, 60000);
    return () => clearInterval(interval);
  }, [fetchList, fetchThread, activeThread]);

  // Deep link: /admin/email?thread=<email> or ?contact=<email> opens the dialog with that recipient.
  useEffect(() => {
    const contact = (searchParams.get("thread") || searchParams.get("contact") || "").trim().toLowerCase();
    if (!contact) return;
    setPane("dialogs");
    openConversation(contact);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  useEffect(() => {
    if (!mailboxOpen) return;
    const onClick = (e: MouseEvent) => {
      if (mailboxRef.current && !mailboxRef.current.contains(e.target as Node)) setMailboxOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [mailboxOpen]);

  useEffect(() => {
    const el = composerRef.current;
    if (!el) return;
    const maxHeight = 152;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, maxHeight)}px`;
    el.style.overflowY = el.scrollHeight > maxHeight ? "auto" : "hidden";
  }, [replyDraft]);

  useEffect(() => {
    const t = window.setTimeout(() => {
      messagesEndRef.current?.scrollIntoView({ block: "end", behavior: "auto" });
    }, 40);
    return () => window.clearTimeout(t);
  }, [messages.length, activeThread]);

  const updateStickyDate = useCallback(() => {
    const root = messagesScrollRef.current;
    if (!root) return;
    const markers = Array.from(root.querySelectorAll<HTMLElement>("[data-day-label]"));
    if (markers.length === 0) return;
    const top = root.getBoundingClientRect().top + 28;
    let current = markers[0].dataset.dayLabel || "";
    for (const el of markers) {
      if (el.getBoundingClientRect().top <= top) current = el.dataset.dayLabel || current;
      else break;
    }
    setStickyDate(current);
  }, []);

  const jumpToMessage = useCallback((messageId: string) => {
    if (!messageId) return;
    const el = document.getElementById(`mail-msg-${messageId}`);
    if (!el) return;
    el.scrollIntoView({ block: "center", behavior: "smooth" });
    setHighlightId(messageId);
    if (highlightTimerRef.current) clearTimeout(highlightTimerRef.current);
    highlightTimerRef.current = setTimeout(() => setHighlightId(null), 1000);
  }, []);

  const openConversation = async (threadId: string) => {
    setActiveThread(threadId);
    setReplyTarget(null);
    setExpandedQuotes(new Set());
    setConfirmDelete(false);
    setNewSubject("");
    await fetchThread(threadId);
    const conv = conversations.find((c) => c.threadId === threadId);
    setNewContact(conv ? "" : threadId);
    if (!conv || conv.unread > 0) {
      await adminFetch("/api/admin/email", { method: "PUT", body: JSON.stringify({ threadId }) }).catch(() => undefined);
      setConversations((prev) => prev.map((c) => (c.threadId === threadId ? { ...c, unread: 0 } : c)));
      setUnreadCount((prev) => Math.max(0, prev - (conv?.unread || 0)));
    }
  };

  const activeConversation = conversations.find((c) => c.threadId === activeThread) || null;
  const contactEmail = activeConversation?.contactEmail || newContact || activeThread || "";
  const contactName = activeConversation?.name || "";

  const byId = useMemo(() => {
    const map = new Map<string, ParentPreview>();
    for (const p of outsideParents) map.set(p.id, p);
    for (const m of messages) map.set(m.id, m);
    return map;
  }, [messages, outsideParents]);

  const lastInbound = useMemo(() => [...messages].reverse().find((m) => m.direction === "inbound") || null, [messages]);

  const handleInlineSend = async () => {
    if (!contactEmail || (!replyDraft.trim() && replyFiles.length === 0)) return;
    const target = replyTarget || lastInbound || messages[messages.length - 1] || null;
    const subject = target
      ? `Re: ${stripReplyPrefix(target.subject) || "(без темы)"}`
      : newSubject.trim();
    if (!subject) {
      notify("Укажите тему письма");
      return;
    }
    setReplySending(true);
    try {
      const attachments = replyFiles.length ? await filesToAttachments(replyFiles) : [];
      const res = await adminFetch("/api/admin/email", {
        method: "POST",
        body: JSON.stringify({
          to: contactEmail,
          from: activeMailbox,
          subject,
          body: replyDraft.trim() || "(вложение)",
          replyTo: target?.id || "",
          attachments,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        setReplyDraft("");
        setReplyTarget(null);
        setReplyFiles([]);
        setNewContact("");
        const threadId = data.threadId || contactEmail;
        setActiveThread(threadId);
        await fetchThread(threadId);
        fetchList();
      } else {
        notify(data.error || "Ошибка отправки");
      }
    } catch {
      notify("Ошибка сети");
    }
    setReplySending(false);
  };

  const handleCompose = () => {
    setComposing(true);
    setCompTo("");
    setCompSubject("");
    setCompBody("");
    setCompFiles([]);
  };

  const handleForward = (m: Email) => {
    setComposing(true);
    setCompTo("");
    setCompFiles([]);
    setCompSubject(`Fwd: ${stripReplyPrefix(m.subject)}`);
    setCompBody(`\n\n---------- Пересланное сообщение ----------\nОт: ${m.fromAddr}\nДата: ${new Date(m.createdAt).toLocaleString("ru-RU")}\nТема: ${m.subject}\n\n${plainText(m)}`);
  };

  const handleSend = async () => {
    if (!compTo.trim() || !compSubject || !compBody) {
      notify("Заполните все поля");
      return;
    }
    setSending(true);
    try {
      const recipients = compTo.split(/[,;\s]+/).map((s) => s.trim()).filter(Boolean);
      const attachments = compFiles.length ? await filesToAttachments(compFiles) : [];
      const res = await adminFetch("/api/admin/email", {
        method: "POST",
        body: JSON.stringify({
          to: recipients,
          from: activeMailbox,
          subject: compSubject,
          body: compBody,
          attachments,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        notify(recipients.length > 1 ? `Отправлено: ${data.sent || recipients.length}` : "Письмо отправлено");
        setComposing(false);
        setCompFiles([]);
        if (data.kind === "newsletter") {
          setPane("newsletters");
          setActiveCampaign(data.threadId || null);
          fetchList();
        } else {
          setPane("dialogs");
          fetchList();
          if (data.threadId) openConversation(data.threadId);
        }
      } else {
        notify(data.error || "Ошибка отправки");
      }
    } catch {
      notify("Ошибка сети");
    }
    setSending(false);
  };

  const deleteConversation = async () => {
    if (!activeThread) return;
    try {
      await adminFetch("/api/admin/email", { method: "DELETE", body: JSON.stringify({ threadId: activeThread }) });
      setConversations((prev) => prev.filter((c) => c.threadId !== activeThread));
      setActiveThread(null);
      setMessages([]);
      notify("Переписка удалена");
    } catch {
      notify("Ошибка удаления");
    }
    setConfirmDelete(false);
  };

  const markAllRead = async () => {
    try {
      await adminFetch("/api/admin/email", { method: "PUT", body: JSON.stringify({ markAll: true }) });
      setConversations((prev) => prev.map((c) => ({ ...c, unread: 0 })));
      setUnreadCount(0);
      refreshAdminCounts();
      notify("Все письма отмечены как прочитанные");
    } catch { /* ignore */ }
  };

  // Newsletter
  const nlFiltered = nlCustomers.filter((c) =>
    !nlSearch ||
    c.email.toLowerCase().includes(nlSearch.toLowerCase()) ||
    c.name.toLowerCase().includes(nlSearch.toLowerCase()) ||
    c.city.toLowerCase().includes(nlSearch.toLowerCase())
  );
  const nlAllFilteredSelected = nlFiltered.length > 0 && nlFiltered.every((c) => nlSelected.has(c.email));

  const openNewsletter = async () => {
    setShowNewsletter(true);
    setNlView("select");
    setNlResult(null);
    setNlSearch("");
    setNlSelected(new Set());
    setNlConfirm(false);
    if (nlCustomers.length === 0) {
      setNlLoadingCustomers(true);
      try {
        const res = await adminFetch("/api/admin/newsletter");
        if (res.ok) setNlCustomers((await res.json()).customers || []);
      } catch { /* ignore */ }
      setNlLoadingCustomers(false);
    }
  };

  const nlToggleAll = () =>
    setNlSelected((prev) => {
      const n = new Set(prev);
      nlFiltered.forEach((c) => (nlAllFilteredSelected ? n.delete(c.email) : n.add(c.email)));
      return n;
    });
  const nlToggle = (email: string) =>
    setNlSelected((prev) => {
      const n = new Set(prev);
      if (n.has(email)) n.delete(email);
      else n.add(email);
      return n;
    });

  const handleSendNewsletter = async () => {
    setNlConfirm(false);
    setNlView("sending");
    const recipients = nlCustomers.filter((c) => nlSelected.has(c.email)).map((c) => ({ email: c.email, name: c.name }));
    try {
      const res = await adminFetch("/api/admin/newsletter", {
        method: "POST",
        body: JSON.stringify({ recipients, subject: nlSubject, body: nlBody, from: MAILBOX_INFO }),
      });
      const data = await res.json();
      setNlResult({ sent: data.sent || 0, failed: data.failed || 0, errors: data.errors || (data.error ? [data.error] : []) });
      setPane("newsletters");
      if (data.threadId) setActiveCampaign(data.threadId);
      fetchList();
    } catch {
      setNlResult({ sent: 0, failed: nlSelected.size, errors: ["Сетевая ошибка"] });
    }
    setNlView("done");
  };

  const activeCampaignData = campaigns.find((c) => c.threadId === activeCampaign) || null;

  // Group thread by day for dividers
  const groupedMessages = useMemo(() => {
    const groups: { day: string; items: Email[] }[] = [];
    for (const m of messages) {
      const day = new Date(m.createdAt).toDateString();
      const last = groups[groups.length - 1];
      if (last && last.day === day) last.items.push(m);
      else groups.push({ day, items: [m] });
    }
    return groups;
  }, [messages]);

  useEffect(() => {
    if (groupedMessages.length > 0) {
      setStickyDate(dayLabel(groupedMessages[groupedMessages.length - 1].items[0].createdAt));
    } else {
      setStickyDate("");
    }
  }, [groupedMessages, activeThread]);

  if (loading) return <PageLoading />;

  return (
    <AdminPage
      fill
      className="cms-mail-page"
      title={
        <span style={{ display: "inline-flex", alignItems: "center", gap: 10 }}>
          Почта
          <CountBadge count={unreadCount} />
          <span className="mail-mailbox-select" ref={mailboxRef}>
            <button type="button" className="mail-mailbox-btn" onClick={() => setMailboxOpen((o) => !o)}>
              {activeMailbox}
              <Icon name={mailboxOpen ? "up" : "down"} size={14} className="cms-btn-trailing" />
            </button>
            {mailboxOpen && (
              <span className="mail-mailbox-dropdown">
                {availableMailboxes.map((addr) => (
                  <button
                    key={addr}
                    type="button"
                    className={`mail-mailbox-option${addr === activeMailbox ? " active" : ""}`}
                    onClick={() => selectMailbox(addr)}
                  >
                    {addr}
                  </button>
                ))}
              </span>
            )}
          </span>
        </span>
      }
      actions={
        <HeaderActions>
          <IconButton icon="newsletter" label="Рассылка" shape="plain" onClick={openNewsletter} />
          <IconButton icon="add" label="Написать" shape="plain" onClick={handleCompose} />
          <IconButton
            icon="refresh"
            label="Обновить"
            shape="plain"
            disabled={syncing}
            onClick={() => syncEmails(true).then(() => { fetchList(); if (activeThread) fetchThread(activeThread); })}
          />
          {unreadCount > 0 && <IconButton icon="view" label="Просмотреть (отметить прочитанными)" shape="plain" onClick={markAllRead} />}
        </HeaderActions>
      }
    >
      <div className={`messenger-layout mail-fill${(pane === "dialogs" && activeThread) || (pane === "newsletters" && activeCampaign) ? " mail-thread-open" : ""}`}>
        <div className="messenger-list">
          <div className="mail-list-header">
            <SegmentedControl<Pane>
              fullWidth
              value={pane}
              onChange={(v) => { setPane(v); setActiveThread(null); setActiveCampaign(null); }}
              options={[
                { value: "dialogs", label: "Диалоги", badge: unreadCount },
                { value: "newsletters", label: "Рассылки" },
              ]}
            />
            <SearchField value={search} onChange={setSearch} style={{ width: "100%", flex: "none" }} />
          </div>
          <div className="mail-list-scroll">
            {pane === "dialogs" && conversations.map((conv) => (
              <div
                key={conv.threadId}
                className={`messenger-list-item${activeThread === conv.threadId ? " active" : ""}${conv.unread > 0 ? " has-unread" : ""}`}
                onClick={() => openConversation(conv.threadId)}
              >
                <div className="messenger-avatar">{initials(conv.contactEmail || conv.name)}</div>
                <div className="messenger-list-meta">
                  <div className="messenger-list-top">
                    <span className="messenger-list-name">{conv.contactEmail || conv.name}</span>
                    <span className="messenger-list-time">{formatListDate(conv.lastAt)}</span>
                  </div>
                  <div className={`messenger-list-preview${conv.unread > 0 ? " is-unread" : ""}`}>
                    {conv.lastDirection === "outbound" ? "Вы: " : ""}
                    {conv.lastText || conv.subject || "(без текста)"}
                  </div>
                </div>
                {conv.unread > 0 && (
                  <span className="messenger-list-badge" aria-label={`${conv.unread} непрочитанных`}>
                    {conv.unread > 99 ? "99+" : conv.unread}
                  </span>
                )}
              </div>
            ))}
            {pane === "newsletters" && campaigns.map((c) => (
              <div
                key={c.threadId}
                className={`messenger-list-item${activeCampaign === c.threadId ? " active" : ""}`}
                onClick={() => setActiveCampaign(c.threadId)}
              >
                <div className="messenger-avatar mail-avatar-newsletter"><Icon name="newsletter" size={16} /></div>
                <div className="messenger-list-meta">
                  <div className="messenger-list-top">
                    <span className="messenger-list-name">{c.subject || "(без темы)"}</span>
                    <span className="messenger-list-time">{formatListDate(c.createdAt)}</span>
                  </div>
                  <div className="messenger-list-preview">
                    {c.recipients.slice(0, 2).join(", ")}
                    {c.recipients.length > 2 ? ` и ещё ${c.recipients.length - 2}+` : ""}
                  </div>
                </div>
              </div>
            ))}
            {((pane === "dialogs" && conversations.length === 0) || (pane === "newsletters" && campaigns.length === 0)) && (
              <div className="mail-list-empty">{pane === "dialogs" ? "Нет диалогов" : "Рассылок пока нет"}</div>
            )}
          </div>
        </div>

        <div className="messenger-thread">
          {pane === "dialogs" && activeThread ? (
            <>
              <div className="messenger-thread-header">
                <div className="mail-thread-contact">
                  <div className="messenger-avatar">{initials(contactEmail || contactName)}</div>
                  <div style={{ minWidth: 0 }}>
                    <div className="mail-thread-name">{contactEmail || contactName}</div>
                    {contactName ? <div className="mail-thread-email">{contactName}</div> : null}
                  </div>
                </div>
                {messages.length > 0 && (
                  <ConfirmPopover
                    open={confirmDelete}
                    placement="bottom"
                    align="end"
                    message="Удалить всю переписку с этим контактом?"
                    confirmLabel="Удалить"
                    confirmIcon="delete"
                    onConfirm={deleteConversation}
                    onCancel={() => setConfirmDelete(false)}
                  >
                    <IconButton icon="delete" label="Удалить переписку" tone="danger" onClick={() => setConfirmDelete((v) => !v)} />
                  </ConfirmPopover>
                )}
              </div>
              <div className="messenger-messages" ref={messagesScrollRef} onScroll={updateStickyDate}>
                {stickyDate && (
                  <div className="messenger-date-sticky" aria-hidden>
                    <span>{stickyDate}</span>
                  </div>
                )}
                {threadLoading && messages.length === 0 && <div className="messenger-empty"><span className="cms-spinner" /></div>}
                {!threadLoading && messages.length === 0 && (
                  <div className="messenger-empty">Новая переписка с {contactEmail}</div>
                )}
                {groupedMessages.map((group) => {
                  const label = dayLabel(group.items[0].createdAt);
                  return (
                  <div key={group.day} className="mail-day-group" data-day-label={label}>
                    <div className="messenger-date-divider" aria-hidden><span>{label}</span></div>
                    {group.items.map((m) => {
                      const out = m.direction === "outbound";
                      const parent = m.inReplyTo ? byId.get(m.inReplyTo) : undefined;
                      const quoteOpen = expandedQuotes.has(m.id);
                      return (
                        <div key={m.id} className={`messenger-bubble-row ${out ? "out" : "in"}`}>
                          <div
                            id={`mail-msg-${m.id}`}
                            className={`messenger-bubble ${out ? "out" : "in"}${highlightId === m.id ? " is-flash" : ""}`}
                          >
                            {parent && (
                              <button
                                type="button"
                                className={`messenger-quote ${quoteOpen ? "open" : ""}`}
                                onClick={() => {
                                  const inThread = messages.some((x) => x.id === parent.id);
                                  if (inThread) {
                                    jumpToMessage(parent.id);
                                    return;
                                  }
                                  setExpandedQuotes((prev) => {
                                    const n = new Set(prev);
                                    if (n.has(m.id)) n.delete(m.id);
                                    else n.add(m.id);
                                    return n;
                                  });
                                }}
                              >
                                <span className="messenger-quote-label">
                                  <Icon name="reply" size={11} />
                                  {parent.kind === "newsletter" ? "В ответ на рассылку" : "В ответ на"}: {stripReplyPrefix(parent.subject) || "(без темы)"}
                                </span>
                                {quoteOpen ? (
                                  <span className="messenger-quote-expanded">{plainText(parent) || "(без текста)"}</span>
                                ) : (
                                  <span className="messenger-quote-text">{plainText(parent).slice(0, 140)}</span>
                                )}
                              </button>
                            )}
                            <div className="messenger-bubble-subject">{m.subject || "(без темы)"}</div>
                            <MessageBody message={m} />
                            <div className="messenger-bubble-footer">
                              <span className="messenger-bubble-actions">
                                <button type="button" onClick={() => { setReplyTarget(m); composerRef.current?.focus(); }} title="Ответить">
                                  <Icon name="reply" size={12} /> Ответить
                                </button>
                                <button type="button" onClick={() => handleForward(m)} title="Переслать">
                                  <Icon name="forward" size={12} /> Переслать
                                </button>
                              </span>
                              <span className="messenger-bubble-time">
                                {new Date(m.createdAt).toLocaleString("ru-RU", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" })}
                              </span>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  );
                })}
                <div ref={messagesEndRef} />
              </div>
              <div className="messenger-composer">
                {replyTarget && (
                  <div className="messenger-composer-quote">
                    <button
                      type="button"
                      className="messenger-composer-quote-jump"
                      onClick={() => jumpToMessage(replyTarget.id)}
                    >
                      <Icon name="reply" size={11} /> Ответ на: <strong>{stripReplyPrefix(replyTarget.subject) || "(без темы)"}</strong>
                    </button>
                    <IconButton icon="close" label="Отменить ответ" shape="plain" onClick={() => setReplyTarget(null)} />
                  </div>
                )}
                {messages.length === 0 && (
                  <input
                    className="cms-input mail-new-subject"
                    placeholder="Тема письма"
                    value={newSubject}
                    onChange={(e) => setNewSubject(e.target.value)}
                  />
                )}
                {replyFiles.length > 0 && (
                  <div className="messenger-attach-list">
                    {replyFiles.map((f, i) => (
                      <span key={`${f.name}-${i}`} className="messenger-attach-chip">
                        {f.name}
                        <button type="button" onClick={() => setReplyFiles((prev) => prev.filter((_, idx) => idx !== i))} aria-label="Убрать файл">×</button>
                      </span>
                    ))}
                  </div>
                )}
                <div className="messenger-composer-row">
                  <textarea
                    ref={composerRef}
                    className="messenger-composer-textarea"
                    rows={1}
                    placeholder="Написать сообщение…"
                    value={replyDraft}
                    onChange={(e) => setReplyDraft(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.shiftKey) {
                        e.preventDefault();
                        handleInlineSend();
                      }
                    }}
                  />
                  <input
                    ref={attachInputRef}
                    type="file"
                    multiple
                    accept="*/*"
                    hidden
                    onChange={(e) => {
                      const next = Array.from(e.target.files || []);
                      if (next.length) setReplyFiles((prev) => [...prev, ...next].slice(0, 10));
                      e.target.value = "";
                    }}
                  />
                  <IconButton
                    icon="attach"
                    label="Вложение"
                    shape="circle"
                    size="md"
                    className="messenger-attach-btn"
                    onClick={() => attachInputRef.current?.click()}
                  />
                  <IconButton
                    icon="send"
                    label="Отправить"
                    shape="circle"
                    size="md"
                    tone="accent"
                    className="messenger-send-btn"
                    onClick={handleInlineSend}
                    disabled={replySending || (!replyDraft.trim() && replyFiles.length === 0)}
                  />
                </div>
              </div>
            </>
          ) : pane === "newsletters" && activeCampaignData ? (
            <>
              <div className="messenger-thread-header mail-campaign-header">
                <div className="mail-campaign-header-meta" style={{ minWidth: 0 }}>
                  <div className="mail-thread-name">{activeCampaignData.subject || "(без темы)"}</div>
                  <div className="mail-thread-email">
                    {new Date(activeCampaignData.createdAt).toLocaleString("ru-RU")} · отправлено {activeCampaignData.sent}
                    {activeCampaignData.failed > 0 ? ` · ошибок ${activeCampaignData.failed}` : ""}
                  </div>
                  <RecipientsLine recipients={activeCampaignData.recipients} />
                </div>
              </div>
              <div className="messenger-messages">
                <div className="messenger-bubble-row out">
                  <div className="messenger-bubble out mail-campaign-bubble" style={{ maxWidth: "100%", width: "100%" }}>
                    <MessageBody
                      message={{
                        body: activeCampaignData.body,
                        textBody: activeCampaignData.preview,
                        direction: "outbound",
                        subject: activeCampaignData.subject,
                      }}
                    />
                  </div>
                </div>
              </div>
            </>
          ) : (
            <div className="messenger-empty" role="status">
              <div className="messenger-empty-title">
                {pane === "dialogs" ? "Выберите диалог" : "Выберите рассылку"}
              </div>
              <div className="messenger-empty-hint">
                {pane === "dialogs"
                  ? "Откройте переписку слева — письма не пропали, просто ещё ничего не выбрано."
                  : "Выберите рассылку в списке слева, чтобы посмотреть содержимое."}
              </div>
            </div>
          )}
        </div>
      </div>

      <Modal
        open={composing}
        title="Новое письмо"
        width={600}
        onClose={() => setComposing(false)}
        footer={
          <>
            <Button onClick={() => setComposing(false)}>Отмена</Button>
            <Button variant="primary" icon="send" onClick={handleSend} disabled={sending}>
              {sending ? "Отправка…" : "Отправить"}
            </Button>
          </>
        }
      >
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <label className="cms-label">
            Кому
            <input
              className="cms-input"
              value={compTo}
              onChange={(e) => setCompTo(e.target.value)}
              placeholder="email@example.com, second@mail.com"
            />
          </label>
          <div style={{ fontSize: 11, color: "var(--cms-text-muted)" }}>
            Несколько адресов через запятую — отправится как рассылка
          </div>
          <label className="cms-label">
            Тема
            <input className="cms-input" value={compSubject} onChange={(e) => setCompSubject(e.target.value)} placeholder="Тема письма" />
          </label>
          <label className="cms-label">
            Сообщение
            <textarea className="cms-textarea" value={compBody} onChange={(e) => setCompBody(e.target.value)} rows={10} placeholder="Текст письма…" style={{ width: "100%" }} />
          </label>
          <div className="messenger-compose-attach">
            <input
              type="file"
              multiple
              accept="*/*"
              id="mail-compose-attach"
              hidden
              onChange={(e) => {
                const next = Array.from(e.target.files || []);
                if (next.length) setCompFiles((prev) => [...prev, ...next].slice(0, 10));
                e.target.value = "";
              }}
            />
            <Button size="sm" icon="attach" onClick={() => document.getElementById("mail-compose-attach")?.click()}>
              Вложение
            </Button>
            {compFiles.map((f, i) => (
              <span key={`${f.name}-${i}`} className="messenger-attach-chip">
                {f.name}
                <button type="button" onClick={() => setCompFiles((prev) => prev.filter((_, idx) => idx !== i))} aria-label="Убрать файл">×</button>
              </span>
            ))}
          </div>
          <div style={{ fontSize: 11, color: "var(--cms-text-muted)" }}>Файлы уходят только во вложении письма и не сохраняются в галерее</div>
        </div>
      </Modal>

      <Modal
        open={showNewsletter}
        title={<h3 style={{ display: "flex", alignItems: "center", gap: 8 }}><Icon name="newsletter" size={16} /> Рассылка</h3>}
        width={960}
        className="mail-newsletter-modal"
        onClose={() => { if (nlView !== "sending") setShowNewsletter(false); }}
        footer={
          nlView === "select" ? (
            <>
              <span style={{ marginRight: "auto", fontSize: 12, color: "var(--cms-text-muted)" }}>
                {nlSelected.size > 0 ? `Выбрано получателей: ${nlSelected.size}` : "Выберите получателей слева"}
              </span>
              <Button onClick={() => setShowNewsletter(false)}>Отмена</Button>
              <ConfirmPopover
                open={nlConfirm}
                placement="top"
                tone="primary"
                message={`Отправить рассылку ${nlSelected.size} получателям?`}
                confirmLabel="Отправить"
                confirmIcon="send"
                onConfirm={handleSendNewsletter}
                onCancel={() => setNlConfirm(false)}
              >
                <Button
                  variant="primary"
                  icon="send"
                  disabled={nlSelected.size === 0 || !nlSubject.trim() || !nlBody.trim()}
                  onClick={() => setNlConfirm(true)}
                >
                  Отправить ({nlSelected.size})
                </Button>
              </ConfirmPopover>
            </>
          ) : nlView === "done" ? (
            <Button variant="primary" icon="check" onClick={() => { setShowNewsletter(false); setNlView("select"); setNlResult(null); }}>
              Готово
            </Button>
          ) : null
        }
      >
        {nlView === "select" && (
          <div className="mail-newsletter-grid">
            <div className="mail-newsletter-col">
              <div className="mail-newsletter-colhead">
                <span>Получатели</span>
                <Button size="xs" onClick={nlToggleAll}>{nlAllFilteredSelected ? "Снять" : "Все"}</Button>
              </div>
              <SearchField value={nlSearch} onChange={setNlSearch} style={{ width: "100%", flex: "none" }} />
              {nlLoadingCustomers ? (
                <div className="messenger-empty"><div className="cms-spinner" /></div>
              ) : (
                <div className="mail-newsletter-list">
                  {nlFiltered.map((c) => (
                    <label key={c.email} className={`mail-newsletter-item ${nlSelected.has(c.email) ? "active" : ""}`}>
                      <input type="checkbox" checked={nlSelected.has(c.email)} onChange={() => nlToggle(c.email)} />
                      <span className="mail-newsletter-item-name">{c.name || "—"}</span>
                      <span className="mail-newsletter-item-email">{c.email}</span>
                      <span className="mail-newsletter-item-count">{c.orderCount}</span>
                    </label>
                  ))}
                  {nlFiltered.length === 0 && (
                    <div className="mail-list-empty">{nlCustomers.length === 0 ? "Нет клиентов с email-адресом" : "Ничего не найдено"}</div>
                  )}
                </div>
              )}
            </div>
            <div className="mail-newsletter-col">
              <label className="cms-label">
                Тема
                <input className="cms-input" value={nlSubject} onChange={(e) => setNlSubject(e.target.value)} placeholder="Тема рассылки…" />
              </label>
              <label className="cms-label" style={{ flex: 1, display: "flex", flexDirection: "column" }}>
                Текст письма
                <textarea
                  className="cms-textarea"
                  value={nlBody}
                  onChange={(e) => setNlBody(e.target.value)}
                  placeholder={"Здравствуйте!\n\nТекст вашего сообщения…\n\nПоддерживается HTML: <b>жирный</b>, <a href=\"https://errani.ru\">ссылка</a>"}
                  style={{ flex: 1, minHeight: 220, fontSize: 12.5, lineHeight: 1.6 }}
                />
              </label>
            </div>
          </div>
        )}
        {nlView === "sending" && (
          <div className="messenger-empty" style={{ flexDirection: "column", gap: 14, padding: 40 }}>
            <div className="cms-spinner" style={{ width: 32, height: 32 }} />
            <div>Рассылка отправляется {nlSelected.size} получателям. Не закрывайте окно.</div>
          </div>
        )}
        {nlView === "done" && nlResult && (
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 12, padding: "16px 0" }}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, width: "100%", maxWidth: 320 }}>
              <div className="cms-card" style={{ padding: 16, textAlign: "center" }}>
                <div style={{ fontSize: 30, fontWeight: 800, color: "#34d399" }}>{nlResult.sent}</div>
                <div style={{ fontSize: 11, color: "var(--cms-text-muted)" }}>Отправлено</div>
              </div>
              <div className="cms-card" style={{ padding: 16, textAlign: "center" }}>
                <div style={{ fontSize: 30, fontWeight: 800, color: nlResult.failed ? "#ff6b81" : "var(--cms-text-muted)" }}>{nlResult.failed}</div>
                <div style={{ fontSize: 11, color: "var(--cms-text-muted)" }}>Ошибок</div>
              </div>
            </div>
            {nlResult.errors.length > 0 && (
              <div style={{ width: "100%", maxWidth: 440, fontSize: 11, color: "var(--cms-text-muted)", maxHeight: 120, overflowY: "auto" }}>
                {nlResult.errors.map((e, i) => <div key={i}>{e}</div>)}
              </div>
            )}
          </div>
        )}
      </Modal>

      {notification && <div className={adminToastClass(notification)}>{notification}</div>}
    </AdminPage>
  );
}

export default function AdminEmailPage() {
  return (
    <Suspense fallback={<PageLoading />}>
      <AdminEmailPageInner />
    </Suspense>
  );
}
