"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { AdminSidebar } from "../AdminSidebar";

interface OrderItem {
  id: string;
  productId: string;
  quantity: number;
  price: number;
  selectedColor: string;
  product: { name: string };
}

type StageZone = 'neutral' | 'green' | 'red';
type KanbanStage = { key: string; name: string; zone?: StageZone };

const DEFAULT_KANBAN_STAGES = [
  { key: 'pending', name: 'Ожидает оплаты', zone: 'neutral' },
  { key: 'paid', name: 'Оплачен', zone: 'neutral' },
  { key: 'assembling', name: 'Сборка', zone: 'neutral' },
  { key: 'shipped', name: 'Отправлен', zone: 'neutral' },
  { key: 'in_transit', name: 'В пути', zone: 'neutral' },
  { key: 'delivered', name: 'Доставлен', zone: 'green' },
  { key: 'unpaid', name: 'Не оплачен', zone: 'red' },
  { key: 'cancelled', name: 'Отменён', zone: 'red' },
  { key: 'archived', name: 'В архиве', zone: 'red' },
] as KanbanStage[];
const DEFAULT_STAGE_BY_KEY: Record<string, KanbanStage> = Object.fromEntries(
  DEFAULT_KANBAN_STAGES.map((s) => [s.key, s])
) as Record<string, KanbanStage>;

interface Order {
  id: string;
  orderNumber: string;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  country: string;
  oblast: string;
  city: string;
  zipCode: string;
  street: string;
  house: string;
  apartment: string;
  shippingMethod: string;
  status: string;
  paymentMethod: string;
  totalAmount: number;
  currency: string;
  notes: string;
  isManual: boolean;
  items: OrderItem[];
  createdAt: string;
}

interface Product {
  id: string;
  name: string;
  nameRu: string;
  price: number;
}

const STATUS_MAP: Record<string, { label: string; cls: string }> = {
  pending:    { label: "Ожидает оплаты", cls: "cms-badge-yellow" },
  unpaid:     { label: "Не оплачен",  cls: "cms-badge-red" },
  paid:       { label: "Оплачен",     cls: "cms-badge-green" },
  assembling: { label: "Сборка",      cls: "cms-badge-yellow" },
  shipped:    { label: "Отправлен",   cls: "cms-badge-green" },
  in_transit: { label: "В пути",      cls: "cms-badge-blue" },
  delivered:  { label: "Доставлен",   cls: "cms-badge-green" },
  cancelled:  { label: "Отменён",     cls: "cms-badge-red" },
  archived:   { label: "В архиве",    cls: "cms-badge" },
};

const STATUS_BORDER: Record<string, string> = {
  pending:    '#f59e0b',
  unpaid:     '#ef4444',
  paid:       '#22c55e',
  assembling: '#f59e0b',
  shipped:    '#22c55e',
  in_transit: '#3b82f6',
  delivered:  '#22c55e',
  cancelled:  '#ef4444',
  archived:   '#6b7280',
};

type OrderView = 'active' | 'done' | 'archive';

const ALL_STATUSES = ["pending", "unpaid", "paid", "assembling", "shipped", "in_transit", "delivered", "cancelled", "archived"];
const PERIOD_OPTIONS = [0, 1, 3, 7, 14, 30, 60, 90, 180, 365];
const PERIOD_LABELS: Record<number, string> = { 0: "Всё время", 1: "1 день", 3: "3 дня", 7: "7 дней", 14: "14 дней", 30: "30 дней", 60: "60 дней", 90: "90 дней", 180: "180 дней", 365: "Год" };
type OrderSortMode = "newest" | "oldest" | "amountDesc" | "amountAsc";
const ORDER_SORT_OPTIONS: { value: OrderSortMode; label: string }[] = [
  { value: "newest", label: "Сначала новые" },
  { value: "oldest", label: "Сначала старые" },
  { value: "amountDesc", label: "Сумма ↓" },
  { value: "amountAsc", label: "Сумма ↑" },
];

const emptyManualForm = {
  customerName: "",
  customerEmail: "",
  customerPhone: "",
  country: "RU",
  oblast: "",
  city: "",
  zipCode: "",
  street: "",
  house: "",
  apartment: "",
  shippingMethod: "",
  paymentMethod: "cash",
  currency: "RUB",
  notes: "",
  status: "unpaid",
  totalAmount: "",
  items: [{ productId: "", quantity: 1, price: 0, name: "" }],
};

export default function AdminOrdersPage() {
  const router = useRouter();
  const [orders, setOrders] = useState<Order[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Order | null>(null);
  const [editForm, setEditForm] = useState({
    customerName: "",
    customerEmail: "",
    customerPhone: "",
    country: "",
    oblast: "",
    city: "",
    zipCode: "",
    street: "",
    house: "",
    apartment: "",
    shippingMethod: "",
    paymentMethod: "",
    totalAmount: "",
  });
  const [saving, setSaving] = useState(false);
  const [notification, setNotification] = useState("");
  const [search, setSearch] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [showNewOrder, setShowNewOrder] = useState(false);
  const [orderView, setOrderView] = useState<OrderView>('active');
  const [regionFilter, setRegionFilter] = useState<"all" | "ru" | "foreign">("all");
  const [periodDays, setPeriodDays] = useState<number>(0);
  const [customRange, setCustomRange] = useState({ from: "", to: "" });
  const [orderSortMode, setOrderSortMode] = useState<OrderSortMode>("newest");
  const [showFilterDrop, setShowFilterDrop] = useState(false);
  const [showSortDrop, setShowSortDrop] = useState(false);
  const [manualForm, setManualForm] = useState<typeof emptyManualForm>(emptyManualForm);
  const [creatingManual, setCreatingManual] = useState(false);
  const [viewMode, setViewMode] = useState<'list' | 'kanban'>('kanban');
  const [kanbanStages, setKanbanStages] = useState<KanbanStage[]>(DEFAULT_KANBAN_STAGES);
  const [showStageManager, setShowStageManager] = useState(false);
  const [stageEdits, setStageEdits] = useState<KanbanStage[]>(DEFAULT_KANBAN_STAGES);
  const [draggingOrderId, setDraggingOrderId] = useState<string | null>(null);
  const [dragOverStage, setDragOverStage] = useState<string | null>(null);
  const [showContact, setShowContact] = useState<{ orderId: string; type: 'phone' | 'email'; value: string } | null>(null);
  const kanbanRef = useRef<HTMLDivElement>(null);
  const scrollTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => () => { if (scrollTimerRef.current) clearInterval(scrollTimerRef.current); }, []);

  const stopKanbanScroll = () => {
    if (scrollTimerRef.current) { clearInterval(scrollTimerRef.current); scrollTimerRef.current = null; }
  };

  const resolveStageZone = (stage: KanbanStage): StageZone => {
    if (stage.zone) return stage.zone;
    if (stage.key === 'delivered') return 'green';
    if (['unpaid', 'cancelled', 'archived'].includes(stage.key)) return 'red';
    return 'neutral';
  };

  const startKanbanAutoScroll = (clientX: number) => {
    const el = kanbanRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const x = clientX - rect.left;
    const zone = Math.max(100, rect.width * 0.15);
    stopKanbanScroll();
    if (x >= 0 && x < zone) {
      const speed = Math.round(10 + 20 * (1 - x / zone));
      scrollTimerRef.current = setInterval(() => { el.scrollLeft -= speed; }, 16);
    } else if (x > rect.width - zone && x <= rect.width) {
      const speed = Math.round(10 + 20 * (1 - (rect.width - x) / zone));
      scrollTimerRef.current = setInterval(() => { el.scrollLeft += speed; }, 16);
    }
  };

  const handleKanbanMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    startKanbanAutoScroll(e.clientX);
  };

  const handleKanbanDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    startKanbanAutoScroll(e.clientX);
  };

  const getToken = useCallback(() => localStorage.getItem("admin_token"), []);

  const ensureAuthorized = useCallback((token: string | null) => {
    if (!token) {
      router.push("/admin/login");
      return false;
    }
    return true;
  }, [router]);

  const fetchOrders = useCallback(async () => {
    const token = getToken();
    if (!token) { router.push("/admin/login"); return; }
    try {
      const res = await fetch("/api/orders?includeArchived=1", { headers: { Authorization: `Bearer ${token}` } });
      if (res.status === 401) { localStorage.removeItem("admin_token"); router.push("/admin/login"); return; }
      const data = await res.json();
      setOrders(Array.isArray(data) ? data : []);
    } catch { /* ignore */ }
    setLoading(false);
  }, [getToken, router]);

  const fetchProducts = useCallback(async () => {
    try {
      const res = await fetch("/api/products?summary=1");
      const data = await res.json();
      setProducts(Array.isArray(data) ? data : []);
    } catch { /* ignore */ }
  }, []);

  useEffect(() => { fetchOrders(); fetchProducts(); }, [fetchOrders, fetchProducts]);

  useEffect(() => {
    const token = getToken();
    if (!token) return;
    fetch('/api/admin/settings?key=order_kanban_stages_v1', { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json())
      .then(d => {
        if (d.value) {
          const s = JSON.parse(d.value);
          if (Array.isArray(s) && s.length > 0) {
            const normalizedBase = s
              .filter((x: unknown) => Boolean(x && typeof x === 'object' && 'key' in (x as Record<string, unknown>) && 'name' in (x as Record<string, unknown>)))
              .map((x: Record<string, unknown>) => ({
                key: String(x.key),
                name: String(x.name),
                zone: (x.zone === 'green' || x.zone === 'red' || x.zone === 'neutral') ? x.zone : undefined,
              })) as KanbanStage[];
            const missingDefaults = DEFAULT_KANBAN_STAGES.filter((def) => !normalizedBase.some((item) => item.key === def.key));
            const base = normalizedBase.map((stage) => ({
              ...stage,
              zone: stage.zone || DEFAULT_STAGE_BY_KEY[stage.key]?.zone || resolveStageZone(stage),
            }));
            const result = [...base];
            for (const def of missingDefaults) {
              const defIdx = DEFAULT_KANBAN_STAGES.findIndex(d => d.key === def.key);
              let insertAt = result.length;
              for (let i = defIdx + 1; i < DEFAULT_KANBAN_STAGES.length; i++) {
                const existingIdx = result.findIndex(s => s.key === DEFAULT_KANBAN_STAGES[i].key);
                if (existingIdx !== -1) { insertAt = existingIdx; break; }
              }
              result.splice(insertAt, 0, { ...def, zone: def.zone ?? 'neutral' });
            }
            if (result.length > 0) {
              setKanbanStages(result);
              setStageEdits(result);
            }
          }
        }
      })
      .catch(() => {});
  }, [getToken]);

  const saveKanbanStages = async (stages: KanbanStage[]) => {
    const token = getToken();
    if (!token) return;
    try {
      await fetch('/api/admin/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ key: 'order_kanban_stages_v1', value: JSON.stringify(stages) }),
      });
    } catch { /* network error — still update UI */ }
    setKanbanStages(stages);
    setStageEdits(stages);
    setShowStageManager(false);
  };

  const openOrder = (order: Order) => {
    setSelected(order);
    setEditForm({
      customerName: order.customerName || "",
      customerEmail: order.customerEmail || "",
      customerPhone: order.customerPhone || "",
      country: order.country || "",
      oblast: order.oblast || "",
      city: order.city || "",
      zipCode: order.zipCode || "",
      street: order.street || "",
      house: order.house || "",
      apartment: order.apartment || "",
      shippingMethod: order.shippingMethod || "",
      paymentMethod: order.paymentMethod || "",
      totalAmount: String(order.totalAmount || ""),
    });
  };

  const handleSave = async () => {
    if (!selected) return;
    if (!confirm("Подтвердить изменение данных клиента и заказа?")) return;
    setSaving(true);
    const token = getToken();
    const res = await fetch(`/api/orders/${selected.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({
        customerName: editForm.customerName,
        customerEmail: editForm.customerEmail,
        customerPhone: editForm.customerPhone,
        country: editForm.country,
        oblast: editForm.oblast,
        city: editForm.city,
        zipCode: editForm.zipCode,
        street: editForm.street,
        house: editForm.house,
        apartment: editForm.apartment,
        shippingMethod: editForm.shippingMethod,
        paymentMethod: editForm.paymentMethod,
        totalAmount: Number(editForm.totalAmount || selected.totalAmount),
      }),
    });
    if (res.ok) {
      notify(`Заказ ${selected.orderNumber} обновлён`);
      setSelected(null);
      fetchOrders();
    }
    setSaving(false);
  };

  const deleteOrder = async (order: Order) => {
    if (!confirm(`Архивировать заказ ${order.orderNumber}?`)) return;
    const token = getToken();
    const res = await fetch(`/api/orders/${order.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ status: "archived" }),
    });
    if (res.ok) {
      notify(`Заказ ${order.orderNumber} в архиве`);
      fetchOrders();
    }
  };

  const updateOrderStatus = async (order: Order, nextStatus: string) => {
    const token = getToken();
    if (!token) return;
    const res = await fetch(`/api/orders/${order.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ status: nextStatus }),
    });
    if (res.ok) {
      setOrders((prev) => prev.map((o) => (o.id === order.id ? { ...o, status: nextStatus } : o)));
      notify(`Статус ${order.orderNumber} обновлён`);
    } else {
      notify("Не удалось обновить статус");
    }
  };

  const notify = (msg: string) => {
    setNotification(msg);
    setTimeout(() => setNotification(""), 3000);
  };

  const downloadOrdersExport = async (format: "csv" | "xls") => {
    const token = getToken();
    if (!ensureAuthorized(token)) return;

    try {
      const res = await fetch(`/api/admin/export?type=orders&format=${format}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.status === 401) {
        localStorage.removeItem("admin_token");
        router.push("/admin/login");
        return;
      }
      if (!res.ok) {
        notify("Не удалось скачать экспорт");
        return;
      }

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `orders_${new Date().toISOString().slice(0, 10)}.${format}`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
    } catch {
      notify("Ошибка сети");
    }
  };

  const openReceipt = async (orderId: string) => {
    const token = getToken();
    if (!ensureAuthorized(token)) return;
    const popup = window.open("", "_blank");
    if (!popup) {
      notify("Браузер заблокировал открытие вкладки");
      return;
    }
    popup.opener = null;
    popup.document.write("<p style='font-family:Arial,sans-serif;padding:16px'>Загрузка чека...</p>");

    try {
      const res = await fetch(`/api/admin/orders/${orderId}/receipt`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.status === 401) {
        popup.close();
        localStorage.removeItem("admin_token");
        router.push("/admin/login");
        return;
      }
      if (!res.ok) {
        popup.close();
        notify("Не удалось открыть чек");
        return;
      }

      const html = await res.text();
      popup.document.open();
      popup.document.write(html);
      popup.document.close();
    } catch {
      popup.close();
      notify("Ошибка сети");
    }
  };

  const deleteUnpaid = async () => {
    if (!confirm("Архивировать все неоплаченные заказы?")) return;
    setDeleting(true);
    const token = getToken();
    try {
      const res = await fetch("/api/orders", { method: "DELETE", headers: { Authorization: `Bearer ${token}` } });
      if (res.ok) {
        const data = await res.json();
        notify(`Архивировано ${data.archived || 0} неоплаченных заказов`);
        fetchOrders();
      } else {
        notify("Ошибка архивации");
      }
    } catch {
      notify("Ошибка сети");
    }
    setDeleting(false);
  };

  const formatPrice = (n: number) =>
    new Intl.NumberFormat("ru-RU", { style: "currency", currency: "RUB", minimumFractionDigits: 0 }).format(n);

  const markAllRead = async () => {
    const token = getToken();
    try {
      await fetch("/api/orders/viewed", { method: "POST", headers: { Authorization: `Bearer ${token}` } });
      notify("Все заказы отмечены как просмотренные");
    } catch { /* ignore */ }
  };

  const updateManualItem = (idx: number, field: string, value: string | number) => {
    const items = manualForm.items.map((item, i) => {
      if (i !== idx) return item;
      const updated = { ...item, [field]: value };
      if (field === "productId") {
        const prod = products.find((p) => p.id === value);
        if (prod) { updated.price = prod.price; updated.name = prod.nameRu || prod.name; }
      }
      return updated;
    });
    const total = items.reduce((s, it) => s + Number(it.price) * Number(it.quantity), 0);
    setManualForm({ ...manualForm, items, totalAmount: total > 0 ? String(total) : manualForm.totalAmount });
  };

  const handleCreateManual = async () => {
    if (!manualForm.customerName || !manualForm.totalAmount) {
      notify("Укажите имя клиента и сумму");
      return;
    }
    setCreatingManual(true);
    const token = getToken();
    const validItems = manualForm.items.filter((i) => i.productId && i.price > 0);
    const res = await fetch("/api/admin/orders", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({
        customerName: manualForm.customerName,
        customerEmail: manualForm.customerEmail,
        customerPhone: manualForm.customerPhone,
        country: manualForm.country,
        oblast: manualForm.oblast,
        city: manualForm.city,
        zipCode: manualForm.zipCode,
        street: manualForm.street,
        house: manualForm.house,
        apartment: manualForm.apartment,
        shippingMethod: manualForm.shippingMethod,
        paymentMethod: manualForm.paymentMethod,
        currency: manualForm.currency,
        notes: manualForm.notes,
        status: manualForm.status,
        totalAmount: Number(manualForm.totalAmount),
        items: validItems.map((i) => ({ productId: i.productId, quantity: Number(i.quantity), price: Number(i.price) })),
      }),
    });
    if (res.ok) {
      notify("Заказ создан");
      setShowNewOrder(false);
      setManualForm(emptyManualForm);
      fetchOrders();
    } else {
      const err = await res.json();
      notify(`Ошибка: ${err.error || "неизвестная ошибка"}`);
    }
    setCreatingManual(false);
  };

  const periodLabel = customRange.from && customRange.to
    ? `${customRange.from} — ${customRange.to}`
    : (PERIOD_LABELS[periodDays] ?? `${periodDays} дн.`);

  const nowMs = Date.now();
  const scopedOrders = orders.filter((o) => {
    if (viewMode === 'list') {
      if (orderView === 'active' && ['delivered', 'unpaid', 'cancelled', 'archived'].includes(o.status)) return false;
      if (orderView === 'done' && o.status !== 'delivered') return false;
      if (orderView === 'archive' && !['unpaid', 'cancelled', 'archived'].includes(o.status)) return false;
    }

    if (customRange.from && customRange.to) {
      const from = new Date(customRange.from).getTime();
      const to = new Date(customRange.to).getTime() + 24 * 60 * 60 * 1000 - 1;
      const ts = new Date(o.createdAt).getTime();
      if (Number.isFinite(from) && Number.isFinite(to) && (ts < from || ts > to)) return false;
    } else if (periodDays > 0) {
      const cutoff = nowMs - periodDays * 24 * 60 * 60 * 1000;
      if (new Date(o.createdAt).getTime() < cutoff) return false;
    }

    if (!search) return true;
    const q = search.toLowerCase();
    return (
      o.orderNumber.toLowerCase().includes(q) ||
      o.customerName.toLowerCase().includes(q) ||
      (o.customerEmail || "").toLowerCase().includes(q)
    );
  });

  const filtered = scopedOrders.filter((o) => {
    if (regionFilter === "ru") return o.country === "RU" || o.country === "Россия";
    if (regionFilter === "foreign") return o.country !== "RU" && o.country !== "Россия";
    return true;
  });

  const newCount = filtered.filter((o) => o.status === "paid" || o.status === "assembling").length;

  const sorted = [...filtered].sort((a, b) => {
    if (a.isManual && !b.isManual) return -1;
    if (!a.isManual && b.isManual) return 1;
    if (orderSortMode === "oldest") return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
    if (orderSortMode === "amountDesc") return b.totalAmount - a.totalAmount;
    if (orderSortMode === "amountAsc") return a.totalAmount - b.totalAmount;
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
  });

  const getOrderAgeBucket = (order: Order): "3" | "7" | "14" | "30" | "rest" => {
    const days = Math.floor((nowMs - new Date(order.createdAt).getTime()) / (24 * 60 * 60 * 1000));
    if (days <= 3) return "3";
    if (days <= 7) return "7";
    if (days <= 14) return "14";
    if (days <= 30) return "30";
    return "rest";
  };
  const BUCKET_LABEL: Record<"3" | "7" | "14" | "30" | "rest", string> = {
    "3": "За 3 дня",
    "7": "За 7 дней",
    "14": "За 14 дней",
    "30": "За 30 дней",
    "rest": "Остальные",
  };
  const rowsWithDividers: Array<{ type: "divider"; bucket: "3" | "7" | "14" | "30" | "rest" } | { type: "order"; order: Order }> = [];
  if (viewMode === "list") {
    let prevBucket: "3" | "7" | "14" | "30" | "rest" | null = null;
    for (const order of sorted) {
      const bucket = getOrderAgeBucket(order);
      if (bucket !== prevBucket) {
        rowsWithDividers.push({ type: "divider", bucket });
        prevBucket = bucket;
      }
      rowsWithDividers.push({ type: "order", order });
    }
  }

  const totalItems = filtered.reduce((sum, o) => sum + o.items.reduce((s, i) => s + i.quantity, 0), 0);
  const totalSum = filtered.reduce((sum, o) => sum + o.totalAmount, 0);
  const hasUnpaid = scopedOrders.some((o) => o.status === "pending" || o.status === "unpaid");
  const ruCount = scopedOrders.filter((o) => o.country === "RU" || o.country === "Россия").length;
  const foreignCount = scopedOrders.length - ruCount;

  if (loading) return <div className="cms-loading"><div className="cms-spinner" /> Загрузка...</div>;

  return (
    <div className="cms-root">
      <AdminSidebar />
      <main className="cms-main">
        <div className="cms-header">
          <h1 className="cms-header-title">
            Заказы
            {newCount > 0 && <span className="cms-badge cms-badge-blue" style={{ marginLeft: "10px", fontSize: "12px" }}>{newCount}</span>}
          </h1>
          <div className="cms-header-actions">
            <button className="cms-btn cms-btn-sm cms-btn-primary" onClick={() => setShowNewOrder(true)} title="Добавить">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
            </button>
            {hasUnpaid && (
              <button className="cms-btn cms-btn-sm cms-btn-danger" onClick={deleteUnpaid} disabled={deleting} title="Архивировать неоплаченные">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/></svg>
              </button>
            )}
            <button className="cms-btn cms-btn-sm" onClick={() => downloadOrdersExport("csv")} title="Экспорт CSV">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
            </button>
            <button className="cms-btn cms-btn-sm" onClick={() => downloadOrdersExport("xls")} title="Импорт/Экспорт XLS">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M8 3H5a2 2 0 00-2 2v3"/><path d="M16 3h3a2 2 0 012 2v3"/><path d="M8 21H5a2 2 0 01-2-2v-3"/><path d="M16 21h3a2 2 0 002-2v-3"/><path d="M12 8v8"/><path d="M8 12h8"/></svg>
            </button>
            <button className="cms-btn cms-btn-sm" onClick={() => { setLoading(true); fetchOrders(); }} title="Обновить">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M23 4v6h-6M1 20v-6h6"/><path d="M3.51 9a9 9 0 0114.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0020.49 15"/></svg>
            </button>
            <button className="cms-btn cms-btn-sm" onClick={markAllRead} title="Отметить просмотренными">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
            </button>
          </div>
        </div>

        <div className="cms-content">
          <div style={{ display: "flex", gap: "8px", alignItems: "center", marginBottom: "12px", flexWrap: "wrap" }}>
            {/* List / Kanban toggle */}
            <div style={{ display: 'flex', border: '1px solid var(--cms-border)', borderRadius: 6, overflow: 'hidden' }}>
              <button className={`cms-btn cms-btn-xs${viewMode === 'list' ? ' cms-btn-primary' : ''}`} onClick={() => setViewMode('list')} title="Список" style={{ borderRadius: 0, border: 'none' }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></svg>
              </button>
              <button className={`cms-btn cms-btn-xs${viewMode === 'kanban' ? ' cms-btn-primary' : ''}`} onClick={() => setViewMode('kanban')} title="Канбан" style={{ borderRadius: 0, border: 'none', borderLeft: '1px solid var(--cms-border)' }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="5" height="18" rx="1"/><rect x="10" y="3" width="5" height="12" rx="1"/><rect x="17" y="3" width="5" height="15" rx="1"/></svg>
              </button>
            </div>
            <input
              className="cms-input cms-input-sm"
              placeholder="Поиск по номеру, имени, email..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{ width: "240px" }}
            />

            {/* Filter icon + dropdown */}
            <div style={{ position: "relative" }}>
              <button
                className={`cms-btn cms-btn-sm${showFilterDrop ? " cms-btn-primary" : ""}${(periodDays !== 0 || customRange.from || regionFilter !== "all") ? " cms-btn-primary" : ""}`}
                title="Фильтр"
                onClick={() => { setShowFilterDrop(v => !v); setShowSortDrop(false); }}
              >
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"/></svg>
              </button>
              {showFilterDrop && (
                <div style={{ position: "absolute", top: "calc(100% + 4px)", left: 0, zIndex: 40, background: "var(--cms-surface, #1a1d27)", border: "1px solid var(--cms-border)", borderRadius: 8, padding: "12px", boxShadow: "0 8px 24px rgba(0,0,0,0.5)", minWidth: 240 }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: "var(--cms-text-muted)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 8 }}>Период</div>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 12 }}>
                    {PERIOD_OPTIONS.map((d) => (
                      <button key={d} type="button"
                        className={`cms-btn cms-btn-xs${periodDays === d && !customRange.from ? " cms-btn-primary" : ""}`}
                        onClick={() => { setPeriodDays(d); setCustomRange({ from: "", to: "" }); }}>
                        {PERIOD_LABELS[d]}
                      </button>
                    ))}
                  </div>
                  <div style={{ fontSize: 11, fontWeight: 700, color: "var(--cms-text-muted)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 6 }}>Диапазон дат</div>
                  <div style={{ display: "flex", gap: 6, marginBottom: 12 }}>
                    <input className="cms-input cms-input-sm" type="date" value={customRange.from} onChange={(e) => setCustomRange((prev) => ({ ...prev, from: e.target.value }))} style={{ flex: 1 }} />
                    <input className="cms-input cms-input-sm" type="date" value={customRange.to} onChange={(e) => setCustomRange((prev) => ({ ...prev, to: e.target.value }))} style={{ flex: 1 }} />
                  </div>
                  <div style={{ fontSize: 11, fontWeight: 700, color: "var(--cms-text-muted)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 6 }}>Регион</div>
                  <div style={{ display: "flex", gap: 6, marginBottom: 4 }}>
                    <button type="button" className={`cms-btn cms-btn-xs${regionFilter === "all" ? " cms-btn-primary" : ""}`} onClick={() => setRegionFilter("all")}>Все ({scopedOrders.length})</button>
                    <button type="button" className={`cms-btn cms-btn-xs${regionFilter === "ru" ? " cms-btn-primary" : ""}`} onClick={() => setRegionFilter("ru")}>Россия ({ruCount})</button>
                    <button type="button" className={`cms-btn cms-btn-xs${regionFilter === "foreign" ? " cms-btn-primary" : ""}`} onClick={() => setRegionFilter("foreign")}>Зарубеж ({foreignCount})</button>
                  </div>
                  {(periodDays !== 0 || customRange.from || regionFilter !== "all") && (
                    <button type="button" className="cms-btn cms-btn-xs" style={{ marginTop: 8 }}
                      onClick={() => { setPeriodDays(0); setCustomRange({ from: "", to: "" }); setRegionFilter("all"); }}>
                      Сбросить фильтры
                    </button>
                  )}
                </div>
              )}
            </div>

            {/* Sort icon + dropdown */}
            <div style={{ position: "relative" }}>
              <button
                className={`cms-btn cms-btn-sm${showSortDrop ? " cms-btn-primary" : ""}${orderSortMode !== "newest" ? " cms-btn-primary" : ""}`}
                title="Сортировка"
                onClick={() => { setShowSortDrop(v => !v); setShowFilterDrop(false); }}
              >
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="15" y2="12"/><line x1="3" y1="18" x2="9" y2="18"/></svg>
              </button>
              {showSortDrop && (
                <div style={{ position: "absolute", top: "calc(100% + 4px)", left: 0, zIndex: 40, background: "var(--cms-surface, #1a1d27)", border: "1px solid var(--cms-border)", borderRadius: 8, padding: "8px", boxShadow: "0 8px 24px rgba(0,0,0,0.5)", minWidth: 180 }}>
                  {ORDER_SORT_OPTIONS.map((opt) => (
                    <button key={opt.value} type="button"
                      onClick={() => { setOrderSortMode(opt.value); setShowSortDrop(false); }}
                      style={{ display: "block", width: "100%", textAlign: "left", padding: "6px 10px", background: orderSortMode === opt.value ? "rgba(155,135,245,0.15)" : "none", border: "none", borderRadius: 4, color: orderSortMode === opt.value ? "var(--cms-accent, #9b87f5)" : "var(--cms-text)", fontSize: 13, cursor: "pointer" }}>
                      {opt.label}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {viewMode === 'list' && (
              <div style={{ display: 'flex', gap: 4, background: 'rgba(255,255,255,0.04)', borderRadius: 8, padding: 3 }}>
                <button className={`cms-btn cms-btn-sm${orderView === 'active' ? " cms-btn-primary" : ""}`} onClick={() => setOrderView('active')} style={{ fontSize: 12 }}>Действующие</button>
                <button className={`cms-btn cms-btn-sm${orderView === 'done' ? " cms-btn-primary" : ""}`} onClick={() => setOrderView('done')} style={{ fontSize: 12 }}>Завершенные</button>
                <button className={`cms-btn cms-btn-sm${orderView === 'archive' ? " cms-btn-primary" : ""}`} onClick={() => setOrderView('archive')} style={{ fontSize: 12 }}>Архив</button>
              </div>
            )}
            {viewMode === 'kanban' && (
              <button className="cms-btn cms-btn-sm" onClick={() => { setStageEdits(kanbanStages); setShowStageManager(true); }} title="Управление стадиями">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20.59 13.41l-7.17 7.17a2 2 0 01-2.83 0L2 12V2h10l8.59 8.59a2 2 0 010 2.82z"/><line x1="7" y1="7" x2="7.01" y2="7"/></svg>
              </button>
            )}

            <span style={{ fontSize: "12px", color: "var(--cms-text-muted)", marginLeft: "auto" }}>
              {periodLabel} · {filtered.length} заказов
            </span>

            {sorted.some((o) => o.isManual) && (
              <span style={{ fontSize: "11px", display: "flex", alignItems: "center", gap: 5, color: "var(--cms-text-muted)" }}>
                <span style={{ background: "rgba(139,92,246,0.15)", border: "1px solid rgba(139,92,246,0.4)", color: "#a78bfa", borderRadius: 4, padding: "1px 6px", fontSize: 10, fontWeight: 700 }}>РУЧНОЙ</span>
                — закреплён наверху
              </span>
            )}
          </div>

          {viewMode === 'kanban' && (
            <>
              {showContact && (
                <div style={{ position: 'fixed', inset: 0, zIndex: 200 }} onClick={() => setShowContact(null)}>
                  <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', background: 'var(--cms-surface)', border: '1px solid var(--cms-border)', borderRadius: 10, padding: '14px 20px', fontSize: 14, boxShadow: '0 8px 32px rgba(0,0,0,0.6)', zIndex: 201, minWidth: 220 }} onClick={e => e.stopPropagation()}>
                    <div style={{ fontWeight: 700, fontSize: 11, color: 'var(--cms-text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>{showContact.type === 'phone' ? 'Телефон' : 'Email'}</div>
                    <div style={{ fontSize: 15, userSelect: 'all', fontWeight: 600 }}>{showContact.value}</div>
                  </div>
                </div>
              )}
              <div style={{ position: 'relative', width: '100%' }}>
                <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 60, zIndex: 10, background: 'linear-gradient(to right, rgba(0,0,0,0.07), transparent)', pointerEvents: 'none', borderRadius: '10px 0 0 10px' }} />
                <div style={{ position: 'absolute', right: 0, top: 0, bottom: 0, width: 60, zIndex: 10, background: 'linear-gradient(to left, rgba(0,0,0,0.07), transparent)', pointerEvents: 'none', borderRadius: '0 10px 10px 0' }} />
                <div
                  ref={kanbanRef}
                  className="kanban-board"
                  style={{
                    display: 'flex',
                    gap: 12,
                    padding: '4px 2px 4px',
                    alignItems: 'flex-start',
                    width: '100%',
                  }}
                  onMouseMove={handleKanbanMouseMove}
                  onDragOver={handleKanbanDragOver}
                  onMouseLeave={stopKanbanScroll}
                  onDrop={stopKanbanScroll}
                >
                  {kanbanStages.map(stage => {
                  const stageOrders = sorted.filter(o => o.status === stage.key);
                  const zone = resolveStageZone(stage);
                  const stageColor = zone === 'green'
                    ? '#22c55e'
                    : zone === 'red'
                      ? '#ef4444'
                      : (STATUS_BORDER[stage.key] || 'var(--cms-border)');
                  const zoneTint = zone === 'green'
                    ? 'rgba(16,185,129,0.07)'
                    : zone === 'red'
                      ? 'rgba(244,63,94,0.08)'
                      : 'rgba(255,255,255,0.01)';
                  const isOver = dragOverStage === stage.key;
                  return (
                    <div
                      key={stage.key}
                      style={{ minWidth: 250, maxWidth: 280, flexShrink: 0 }}
                      onDragOver={(e) => { e.preventDefault(); startKanbanAutoScroll(e.clientX); setDragOverStage(stage.key); }}
                      onDragEnter={(e) => { e.preventDefault(); startKanbanAutoScroll(e.clientX); setDragOverStage(stage.key); }}
                      onDragLeave={() => setDragOverStage(null)}
                      onDrop={(e) => {
                        e.preventDefault();
                        setDragOverStage(null);
                        const droppedOrderId = draggingOrderId || e.dataTransfer.getData('text/plain');
                        if (droppedOrderId) {
                          const o = orders.find(x => x.id === droppedOrderId);
                          if (o && o.status !== stage.key) updateOrderStatus(o, stage.key);
                          setDraggingOrderId(null);
                        }
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 12px', background: 'var(--cms-surface)', borderRadius: '8px 8px 0 0', border: '1px solid var(--cms-border)', borderBottom: `2px solid ${stageColor}` }}>
                        <span style={{ fontWeight: 700, fontSize: 13 }}>{stage.name}</span>
                        <span style={{ fontSize: 11, background: 'rgba(255,255,255,0.07)', borderRadius: 10, padding: '1px 7px', color: 'var(--cms-text-muted)' }}>{stageOrders.length}</span>
                      </div>
                      <div style={{ border: '1px solid var(--cms-border)', borderTop: 'none', borderRadius: '0 0 8px 8px', padding: '8px', minHeight: 80, background: isOver ? 'rgba(232,114,42,0.07)' : zoneTint, transition: 'background 0.15s', boxShadow: isOver ? `inset 0 0 0 2px ${stageColor}40` : 'none' }}>
                        {stageOrders.map(order => (
                          <div
                            key={order.id}
                            draggable
                            onDragStart={(e) => {
                              setDraggingOrderId(order.id);
                              e.dataTransfer.effectAllowed = 'move';
                              e.dataTransfer.setData('text/plain', order.id);
                            }}
                            onDragEnd={() => { setDraggingOrderId(null); setDragOverStage(null); stopKanbanScroll(); }}
                            style={{ background: 'var(--cms-surface)', border: `1px solid ${draggingOrderId === order.id ? 'var(--cms-accent)' : 'var(--cms-border)'}`, borderRadius: 8, padding: '10px 12px', marginBottom: 8, cursor: 'grab', opacity: draggingOrderId === order.id ? 0.45 : 1, transition: 'opacity 0.15s, border-color 0.15s' }}
                          >
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                              <span style={{ fontSize: 11, color: 'var(--cms-text-muted)', fontFamily: 'monospace' }}>#{order.orderNumber}</span>
                              <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--cms-accent)' }}>{formatPrice(order.totalAmount)}</span>
                            </div>
                            <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 4 }}>{order.customerName}</div>
                            {order.items.length > 0 && (
                              <div style={{ fontSize: 11, color: 'var(--cms-text-muted)', marginBottom: 6 }}>
                                {order.items.map((item, idx) => (
                                  <div key={idx}>{item.product?.name} ×{item.quantity}{item.selectedColor ? ` · ${item.selectedColor}` : ''}</div>
                                ))}
                              </div>
                            )}
                            <div style={{ fontSize: 10, color: 'var(--cms-text-muted)', marginBottom: 8 }}>{new Date(order.createdAt).toLocaleDateString('ru-RU')}</div>
                            <div style={{ display: 'flex', gap: 6 }}>
                              {order.customerPhone && (
                                <button className="cms-btn cms-btn-xs cms-btn-ghost" title="Показать телефон" onClick={() => setShowContact({ orderId: order.id, type: 'phone', value: order.customerPhone })}>
                                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07A19.5 19.5 0 013.07 9.81 19.79 19.79 0 011 1.18 2 2 0 013 0h3a2 2 0 012 1.72 12.84 12.84 0 00.7 2.81 2 2 0 01-.45 2.11L7.09 7a16 16 0 006.91 6.91l1.27-1.27a2 2 0 012.11-.45 12.84 12.84 0 002.81.7A2 2 0 0122 14.92z"/></svg>
                                </button>
                              )}
                              {order.customerEmail && (
                                <button className="cms-btn cms-btn-xs cms-btn-ghost" title="Показать email" onClick={() => setShowContact({ orderId: order.id, type: 'email', value: order.customerEmail })}>
                                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>
                                </button>
                              )}
                              <button className="cms-btn cms-btn-xs cms-btn-ghost" onClick={() => openReceipt(order.id)} title="Чек">
                                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="20 6 9 17 4 12"/></svg>
                              </button>
                              <button className="cms-btn cms-btn-xs cms-btn-ghost" onClick={() => openOrder(order)} title="Изменить">
                                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 013 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>
                              </button>
                            </div>
                          </div>
                        ))}
                        {stageOrders.length === 0 && (
                          <div style={{ padding: '20px 0', textAlign: 'center', fontSize: 12, color: 'var(--cms-text-muted)' }}>—</div>
                        )}
                      </div>
                    </div>
                  );
                  })}
                </div>
              </div>
            </>
          )}

          {viewMode === 'list' && <div className="cms-table-wrap">
            <table className="cms-table">
              <thead>
                <tr>
                  <th>Order #</th>
                  <th>Клиент ({filtered.length})</th>
                  <th>Товары ({totalItems})</th>
                  <th>Сумма ({formatPrice(totalSum)})</th>
                  <th>Статус</th>
                  <th>Доставка</th>
                  <th>Дата</th>
                  <th style={{ width: 80 }}>Действия</th>
                </tr>
              </thead>
              <tbody>
                {(rowsWithDividers.length > 0 ? rowsWithDividers : sorted.map((order) => ({ type: "order" as const, order }))).map((row, idx) => {
                  if (row.type === "divider") {
                    return (
                      <tr key={`divider-${row.bucket}-${idx}`}>
                        <td colSpan={8} style={{ padding: "10px 8px 6px" }}>
                          <div style={{ borderTop: "1px solid var(--cms-border-light)", paddingTop: 6, fontSize: 11, color: "var(--cms-text-muted)", textTransform: "uppercase", letterSpacing: "0.06em" }}>
                            {BUCKET_LABEL[row.bucket]}
                          </div>
                        </td>
                      </tr>
                    );
                  }
                  const order = row.order;
                  return (
                  <tr
                    key={order.id}
                    style={order.isManual ? { background: "rgba(139,92,246,0.06)", borderLeft: "3px solid rgba(139,92,246,0.5)" } : undefined}
                  >
                    <td className="cms-td-mono">
                      <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                        {order.isManual && (
                          <span style={{ background: "rgba(139,92,246,0.15)", border: "1px solid rgba(139,92,246,0.4)", color: "#a78bfa", borderRadius: 3, padding: "0 5px", fontSize: 9, fontWeight: 700, letterSpacing: "0.05em", flexShrink: 0 }}>
                            РУЧНОЙ
                          </span>
                        )}
                        {order.orderNumber}
                      </div>
                    </td>
                    <td className="cms-td-bold">
                      {order.customerName}
                      {order.customerEmail && <div style={{ fontSize: "11px", color: "var(--cms-text-muted)" }}>{order.customerEmail}</div>}
                    </td>
                    <td>
                      {order.items.length > 0 ? order.items.map((item) => (
                        <div key={item.id} style={{ fontSize: "12px" }}>{item.product?.name || "Товар удалён"} ×{item.quantity}</div>
                      )) : <span style={{ color: "var(--cms-text-muted)", fontSize: 12 }}>—</span>}
                    </td>
                    <td style={{ fontWeight: 600 }}>{formatPrice(order.totalAmount)}</td>
                    <td>
                      <select
                        className="cms-select"
                        value={order.status}
                        onChange={(e) => updateOrderStatus(order, e.target.value)}
                        style={{ minWidth: "132px", borderLeft: `3px solid ${STATUS_BORDER[order.status] || 'transparent'}` }}
                      >
                        {ALL_STATUSES.map((s) => (
                          <option key={s} value={s}>{STATUS_MAP[s]?.label ?? s}</option>
                        ))}
                      </select>
                    </td>
                    <td>{order.shippingMethod || "—"}</td>
                    <td>{new Date(order.createdAt).toLocaleDateString("ru-RU")}</td>
                    <td>
                      <div style={{ display: "flex", gap: "4px", alignItems: "center" }}>
                        <button className="cms-btn cms-btn-xs cms-btn-ghost" onClick={() => openOrder(order)} title="Изменить">
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 013 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>
                        </button>
                        <button className="cms-btn cms-btn-xs cms-btn-ghost" title="Чек" onClick={() => openReceipt(order.id)}>
                          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>
                        </button>
                        {(order.isManual || order.status === "pending" || order.status === "cancelled" || order.status === "unpaid") && (
                          <button className="cms-btn cms-btn-xs cms-btn-danger" onClick={() => deleteOrder(order)} title="В архив">
                            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/></svg>
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                )})}
                {sorted.length === 0 && (
                  <tr><td colSpan={8} style={{ textAlign: "center", padding: "32px", color: "var(--cms-text-muted)" }}>Заказы не найдены</td></tr>
                )}
              </tbody>
            </table>
          </div>}
        </div>
      </main>

      {/* Order Edit Modal */}
      {selected && (
        <div className="cms-modal-overlay" onClick={() => setSelected(null)}>
          <div className="cms-modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 600 }}>
            <div className="cms-modal-header">
              <h3>
                Заказ {selected.orderNumber}
                {selected.isManual && <span style={{ marginLeft: 8, background: "rgba(139,92,246,0.15)", color: "#a78bfa", borderRadius: 4, padding: "1px 7px", fontSize: 11, fontWeight: 600 }}>Ручной</span>}
              </h3>
              <button className="cms-modal-close" onClick={() => setSelected(null)}>&times;</button>
            </div>
            <div className="cms-modal-body" style={{ maxHeight: "65vh", overflowY: "auto" }}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px", marginBottom: "14px" }}>
                <label className="cms-label">
                  Клиент
                  <input className="cms-input" value={editForm.customerName} onChange={(e) => setEditForm((prev) => ({ ...prev, customerName: e.target.value }))} style={{ marginTop: 4 }} />
                </label>
                <label className="cms-label">
                  Email
                  <input className="cms-input" value={editForm.customerEmail} onChange={(e) => setEditForm((prev) => ({ ...prev, customerEmail: e.target.value }))} style={{ marginTop: 4 }} />
                </label>
                <label className="cms-label">
                  Телефон
                  <input className="cms-input" value={editForm.customerPhone} onChange={(e) => setEditForm((prev) => ({ ...prev, customerPhone: e.target.value }))} style={{ marginTop: 4 }} />
                </label>
                <label className="cms-label">
                  Страна
                  <input className="cms-input" value={editForm.country} onChange={(e) => setEditForm((prev) => ({ ...prev, country: e.target.value }))} style={{ marginTop: 4 }} />
                </label>
                <label className="cms-label">
                  Область
                  <input className="cms-input" value={editForm.oblast} onChange={(e) => setEditForm((prev) => ({ ...prev, oblast: e.target.value }))} style={{ marginTop: 4 }} />
                </label>
                <label className="cms-label">
                  Город
                  <input className="cms-input" value={editForm.city} onChange={(e) => setEditForm((prev) => ({ ...prev, city: e.target.value }))} style={{ marginTop: 4 }} />
                </label>
                <label className="cms-label">
                  Индекс
                  <input className="cms-input" value={editForm.zipCode} onChange={(e) => setEditForm((prev) => ({ ...prev, zipCode: e.target.value }))} style={{ marginTop: 4 }} />
                </label>
                <label className="cms-label">
                  Улица
                  <input className="cms-input" value={editForm.street} onChange={(e) => setEditForm((prev) => ({ ...prev, street: e.target.value }))} style={{ marginTop: 4 }} />
                </label>
                <label className="cms-label">
                  Дом
                  <input className="cms-input" value={editForm.house} onChange={(e) => setEditForm((prev) => ({ ...prev, house: e.target.value }))} style={{ marginTop: 4 }} />
                </label>
                <label className="cms-label">
                  Квартира
                  <input className="cms-input" value={editForm.apartment} onChange={(e) => setEditForm((prev) => ({ ...prev, apartment: e.target.value }))} style={{ marginTop: 4 }} />
                </label>
                <label className="cms-label">
                  Доставка
                  <input className="cms-input" value={editForm.shippingMethod} onChange={(e) => setEditForm((prev) => ({ ...prev, shippingMethod: e.target.value }))} style={{ marginTop: 4 }} />
                </label>
                <label className="cms-label">
                  Оплата
                  <input className="cms-input" value={editForm.paymentMethod} onChange={(e) => setEditForm((prev) => ({ ...prev, paymentMethod: e.target.value }))} style={{ marginTop: 4 }} />
                </label>
              </div>

              <label className="cms-label" style={{ marginBottom: "12px", display: "block" }}>
                Сумма заказа (₽)
                <input className="cms-input" type="number" value={editForm.totalAmount} onChange={(e) => setEditForm((prev) => ({ ...prev, totalAmount: e.target.value }))} style={{ marginTop: 4 }} />
              </label>

              {!selected.isManual && selected.items.length > 0 && (
                <div style={{ marginBottom: "14px" }}>
                  <strong style={{ fontSize: "13px" }}>Товары:</strong>
                  <table className="cms-table" style={{ marginTop: "6px" }}>
                    <thead><tr><th>Название</th><th>Кол-во</th><th>Цена</th></tr></thead>
                    <tbody>
                      {selected.items.map((item) => (
                        <tr key={item.id}><td>{item.product?.name || "Товар удалён"}</td><td>{item.quantity}</td><td>{formatPrice(item.price)}</td></tr>
                      ))}
                    </tbody>
                  </table>
                  <div style={{ textAlign: "right", fontWeight: 700, padding: "6px 0", borderTop: "1px solid var(--cms-border)", marginTop: 4, fontSize: 13 }}>
                    Итого: {formatPrice(selected.totalAmount)}
                  </div>
                </div>
              )}

            </div>
            <div className="cms-modal-actions">
              <button className="cms-btn cms-btn-primary" onClick={handleSave} disabled={saving}>{saving ? "Сохранение..." : "Сохранить"}</button>
              <button className="cms-btn" onClick={() => openReceipt(selected.id)} title="Чек">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>
              </button>
              <button className="cms-btn" onClick={() => setSelected(null)}>Отмена</button>
            </div>
          </div>
        </div>
      )}

      {/* New Manual Order Modal */}
      {showNewOrder && (
        <div className="cms-modal-overlay" onClick={() => setShowNewOrder(false)}>
          <div className="cms-modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 680 }}>
            <div className="cms-modal-header">
              <h3>Добавить заказ вручную</h3>
              <button className="cms-modal-close" onClick={() => setShowNewOrder(false)}>&times;</button>
            </div>
            <div className="cms-modal-body" style={{ maxHeight: "72vh", overflowY: "auto" }}>
              {/* ── Клиент ── */}
              <div style={{ fontSize: 11, fontWeight: 700, color: "var(--cms-text-muted)", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 8 }}>Клиент</div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 16 }}>
                <label className="cms-label">
                  Имя и фамилия *
                  <input className="cms-input" value={manualForm.customerName} onChange={(e) => setManualForm({ ...manualForm, customerName: e.target.value })} placeholder="Имя Фамилия" style={{ marginTop: 4 }} />
                </label>
                <label className="cms-label">
                  Email
                  <input className="cms-input" type="email" value={manualForm.customerEmail} onChange={(e) => setManualForm({ ...manualForm, customerEmail: e.target.value })} placeholder="email@example.com" style={{ marginTop: 4 }} />
                </label>
                <label className="cms-label">
                  Телефон
                  <input className="cms-input" value={manualForm.customerPhone} onChange={(e) => setManualForm({ ...manualForm, customerPhone: e.target.value })} placeholder="+7 999 000 00 00" style={{ marginTop: 4 }} />
                </label>
              </div>

              {/* ── Адрес доставки ── */}
              <div style={{ fontSize: 11, fontWeight: 700, color: "var(--cms-text-muted)", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 8 }}>Адрес доставки</div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 16 }}>
                <label className="cms-label">
                  Страна
                  <select className="cms-select" value={manualForm.country} onChange={(e) => setManualForm({ ...manualForm, country: e.target.value })} style={{ marginTop: 4 }}>
                    <option value="RU">Россия</option>
                    <option value="BY">Беларусь</option>
                    <option value="KZ">Казахстан</option>
                    <option value="UA">Украина</option>
                    <option value="UZ">Узбекистан</option>
                    <option value="AZ">Азербайджан</option>
                    <option value="DE">Германия</option>
                    <option value="FR">Франция</option>
                    <option value="US">США</option>
                    <option value="OTHER">Другая</option>
                  </select>
                </label>
                <label className="cms-label">
                  Регион / Область
                  <input className="cms-input" value={manualForm.oblast} onChange={(e) => setManualForm({ ...manualForm, oblast: e.target.value })} placeholder="Московская область" style={{ marginTop: 4 }} />
                </label>
                <label className="cms-label">
                  Город
                  <input className="cms-input" value={manualForm.city} onChange={(e) => setManualForm({ ...manualForm, city: e.target.value })} placeholder="Москва" style={{ marginTop: 4 }} />
                </label>
                <label className="cms-label">
                  Индекс
                  <input className="cms-input" value={manualForm.zipCode} onChange={(e) => setManualForm({ ...manualForm, zipCode: e.target.value })} placeholder="123456" style={{ marginTop: 4 }} />
                </label>
                <label className="cms-label" style={{ gridColumn: "span 2" }}>
                  Улица
                  <input className="cms-input" value={manualForm.street} onChange={(e) => setManualForm({ ...manualForm, street: e.target.value })} placeholder="ул. Ленина" style={{ marginTop: 4 }} />
                </label>
                <label className="cms-label">
                  Дом
                  <input className="cms-input" value={manualForm.house} onChange={(e) => setManualForm({ ...manualForm, house: e.target.value })} placeholder="42" style={{ marginTop: 4 }} />
                </label>
                <label className="cms-label">
                  Квартира / офис
                  <input className="cms-input" value={manualForm.apartment} onChange={(e) => setManualForm({ ...manualForm, apartment: e.target.value })} placeholder="15" style={{ marginTop: 4 }} />
                </label>
              </div>

              {/* ── Доставка и оплата ── */}
              <div style={{ fontSize: 11, fontWeight: 700, color: "var(--cms-text-muted)", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 8 }}>Доставка и оплата</div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 16 }}>
                <label className="cms-label">
                  Способ доставки
                  <select className="cms-select" value={manualForm.shippingMethod} onChange={(e) => setManualForm({ ...manualForm, shippingMethod: e.target.value })} style={{ marginTop: 4 }}>
                    <option value="">— не указан —</option>
                    <option value="cdek">СДЭК</option>
                    <option value="russianpost">Почта России</option>
                    <option value="pochta_int">Почта России (межд.)</option>
                    <option value="ozon">OZON</option>
                    <option value="yandex">Яндекс Маркет</option>
                    <option value="dhl">DHL</option>
                    <option value="fedex">FedEx</option>
                    <option value="pickup">Самовывоз</option>
                    <option value="courier">Курьер</option>
                  </select>
                </label>
                <label className="cms-label">
                  Способ оплаты
                  <select className="cms-select" value={manualForm.paymentMethod} onChange={(e) => setManualForm({ ...manualForm, paymentMethod: e.target.value })} style={{ marginTop: 4 }}>
                    <option value="cash">Наличные</option>
                    <option value="card">Карта (офлайн)</option>
                    <option value="transfer">Перевод на карту</option>
                    <option value="yukassa">ЮКасса</option>
                    <option value="stripe">Stripe</option>
                    <option value="manual">Другое</option>
                  </select>
                </label>
                <label className="cms-label">
                  Валюта
                  <select className="cms-select" value={manualForm.currency} onChange={(e) => setManualForm({ ...manualForm, currency: e.target.value })} style={{ marginTop: 4 }}>
                    <option value="RUB">₽ RUB</option>
                    <option value="USD">$ USD</option>
                    <option value="EUR">€ EUR</option>
                  </select>
                </label>
                <label className="cms-label">
                  Статус
                  <select className="cms-select" value={manualForm.status} onChange={(e) => setManualForm({ ...manualForm, status: e.target.value })} style={{ marginTop: 4 }}>
                    <option value="unpaid">Не оплачен</option>
                    <option value="paid">Оплачен</option>
                    <option value="assembling">Сборка</option>
                    <option value="shipped">Отправлен</option>
                    <option value="delivered">Доставлен</option>
                    <option value="cancelled">Отменён</option>
                  </select>
                </label>
              </div>

              {/* ── Товары ── */}
              <div style={{ fontSize: 11, fontWeight: 700, color: "var(--cms-text-muted)", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 8 }}>Товары (необязательно)</div>
              <div style={{ marginBottom: 14 }}>
                {manualForm.items.map((item, idx) => (
                  <div key={idx} style={{ display: "grid", gridTemplateColumns: "2fr 60px 90px auto", gap: 6, marginBottom: 6, alignItems: "center" }}>
                    <select className="cms-select" value={item.productId} onChange={(e) => updateManualItem(idx, "productId", e.target.value)}>
                      <option value="">— выберите товар —</option>
                      {products.map((p) => (
                        <option key={p.id} value={p.id}>{p.nameRu || p.name}</option>
                      ))}
                    </select>
                    <input className="cms-input" type="number" min="1" value={item.quantity} onChange={(e) => updateManualItem(idx, "quantity", Number(e.target.value))} title="Кол-во" />
                    <input className="cms-input" type="number" value={item.price} onChange={(e) => updateManualItem(idx, "price", Number(e.target.value))} placeholder="Цена ₽" />
                    <button type="button" className="cms-btn cms-btn-xs cms-btn-danger" onClick={() => setManualForm({ ...manualForm, items: manualForm.items.filter((_, i) => i !== idx) })}>×</button>
                  </div>
                ))}
                <button type="button" className="cms-btn cms-btn-xs" onClick={() => setManualForm({ ...manualForm, items: [...manualForm.items, { productId: "", quantity: 1, price: 0, name: "" }] })}>
                  + Добавить строку
                </button>
              </div>

              {/* ── Сумма и заметки ── */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: 10, marginBottom: 14, marginTop: 4 }}>
                <label className="cms-label">
                  Сумма заказа (в выбранной валюте) *
                  <input className="cms-input" type="number" value={manualForm.totalAmount} onChange={(e) => setManualForm({ ...manualForm, totalAmount: e.target.value })} placeholder="0" style={{ marginTop: 4 }} />
                </label>
              </div>

              <label className="cms-label" style={{ display: "block" }}>
                Заметки / комментарий
                <textarea className="cms-textarea" rows={2} value={manualForm.notes} onChange={(e) => setManualForm({ ...manualForm, notes: e.target.value })} style={{ marginTop: 4, width: "100%" }} />
              </label>
            </div>
            <div className="cms-modal-actions">
              <button className="cms-btn cms-btn-primary" onClick={handleCreateManual} disabled={creatingManual}>
                {creatingManual ? "Создание..." : "Создать заказ"}
              </button>
              <button className="cms-btn" onClick={() => setShowNewOrder(false)}>Отмена</button>
            </div>
          </div>
        </div>
      )}

      {notification && <div className="cms-toast">{notification}</div>}

      {/* Stage Manager Modal */}
      {showStageManager && (
        <div className="cms-modal-overlay" onClick={() => setShowStageManager(false)}>
          <div className="cms-modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 480 }}>
            <div className="cms-modal-header">
              <h3>Управление стадиями</h3>
              <button className="cms-modal-close" onClick={() => setShowStageManager(false)}>&times;</button>
            </div>
            <div className="cms-modal-body">
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 12 }}>
                {stageEdits.map((stage, idx) => (
                  <div key={stage.key} style={{ display: 'grid', gridTemplateColumns: '1fr 136px auto auto auto', gap: 6, alignItems: 'center' }}>
                    <input
                      className="cms-input"
                      value={stage.name}
                      onChange={(e) => setStageEdits(prev => prev.map((s, i) => i === idx ? { ...s, name: e.target.value } : s))}
                      style={{ flex: 1 }}
                    />
                    <select
                      className="cms-select"
                      value={resolveStageZone(stage)}
                      onChange={(e) => setStageEdits(prev => prev.map((s, i) => i === idx ? { ...s, zone: e.target.value as StageZone } : s))}
                    >
                      <option value="neutral">Бесцветная</option>
                      <option value="green">Зелёная</option>
                      <option value="red">Красная</option>
                    </select>
                    <button
                      className="cms-btn cms-btn-xs"
                      onClick={() => setStageEdits(prev => {
                        if (idx === 0) return prev;
                        const copy = [...prev];
                        [copy[idx - 1], copy[idx]] = [copy[idx], copy[idx - 1]];
                        return copy;
                      })}
                      title="Вверх"
                    >↑</button>
                    <button
                      className="cms-btn cms-btn-xs"
                      onClick={() => setStageEdits(prev => {
                        if (idx === prev.length - 1) return prev;
                        const copy = [...prev];
                        [copy[idx], copy[idx + 1]] = [copy[idx + 1], copy[idx]];
                        return copy;
                      })}
                      title="Вниз"
                    >↓</button>
                    <button
                      className="cms-btn cms-btn-xs cms-btn-danger"
                      onClick={() => setStageEdits(prev => prev.filter((_, i) => i !== idx))}
                      title="Удалить стадию"
                    >×</button>
                  </div>
                ))}
              </div>
              <button
                className="cms-btn cms-btn-sm"
                onClick={() => setStageEdits(prev => [...prev, { key: `stage_${Date.now()}`, name: 'Новая стадия', zone: 'neutral' }])}
              >+ Добавить стадию</button>
            </div>
            <div className="cms-modal-actions">
              <button className="cms-btn cms-btn-primary" onClick={() => void saveKanbanStages(stageEdits)}>Сохранить</button>
              <button className="cms-btn" onClick={() => { setStageEdits(kanbanStages); setShowStageManager(false); }}>Отмена</button>
              <button className="cms-btn cms-btn-ghost" onClick={() => setStageEdits(DEFAULT_KANBAN_STAGES)} style={{ marginLeft: 'auto' }}>Сбросить</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
