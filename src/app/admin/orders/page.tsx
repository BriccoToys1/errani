"use client";

import { useState, useEffect, useCallback, useRef, type CSSProperties } from "react";
import { useRouter } from "next/navigation";
import { AdminPage } from "../AdminPage";
import {
  HeaderActions,
  ContactSheet,
  IconButton,
  SearchField,
  SegmentedControl,
  Toolbar,
  DataList,
  Button,
  Modal,
  PageLoading,
} from "@/components/admin";
import { adminToastClass, refreshAdminCounts } from "@/lib/admin-client";

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
  { key: 'pending', name: 'В ожидании', zone: 'neutral' },
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
  entrance: string;
  floor: string;
  intercom: string;
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
  pending:    { label: "В ожидании",  cls: "cms-badge-yellow" },
  unpaid:     { label: "Не оплачен",  cls: "cms-badge-red" },
  paid:       { label: "Оплачен",     cls: "cms-badge-green" },
  assembling: { label: "Сборка",      cls: "cms-badge-yellow" },
  shipped:    { label: "Отправлен",   cls: "cms-badge-pink" },
  in_transit: { label: "В пути",      cls: "cms-badge-blue" },
  delivered:  { label: "Доставлен",   cls: "cms-badge-green" },
  cancelled:  { label: "Отменён",     cls: "cms-badge-red" },
  archived:   { label: "В архиве",    cls: "cms-badge" },
};

const STATUS_BORDER: Record<string, string> = {
  pending:    '#fbbf24',
  unpaid:     '#ef4444',
  paid:       '#22c55e',
  assembling: '#fbbf24',
  shipped:    '#f58bdc',
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
  paymentMethod: "tochka",
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
    entrance: "",
    floor: "",
    intercom: "",
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
  const [showProductFilterDrop, setShowProductFilterDrop] = useState(false);
  const [productFilter, setProductFilter] = useState("all");
  const [ordersViewedAt, setOrdersViewedAt] = useState<Date>(() => new Date(0));
  const [selectedOrderIds, setSelectedOrderIds] = useState<Set<string>>(new Set());
  const [manualForm, setManualForm] = useState<typeof emptyManualForm>(emptyManualForm);
  const [creatingManual, setCreatingManual] = useState(false);
  const viewMode: 'list' = 'list';
  const [kanbanStages, setKanbanStages] = useState<KanbanStage[]>(DEFAULT_KANBAN_STAGES);
  const [showStageManager, setShowStageManager] = useState(false);
  const [stageEdits, setStageEdits] = useState<KanbanStage[]>(DEFAULT_KANBAN_STAGES);
  const [draggingOrderId, setDraggingOrderId] = useState<string | null>(null);
  const [dragOverStage, setDragOverStage] = useState<string | null>(null);
  const [showContact, setShowContact] = useState<{ orderId: string; type: 'phone' | 'email'; value: string } | null>(null);
  const [shipDraft, setShipDraft] = useState<{ order: Order; trackNumber: string; deliveryService: string } | null>(null);
  const [confirmShipSend, setConfirmShipSend] = useState(false);
  const [savingShip, setSavingShip] = useState(false);
  const filterClickRef = useRef(0);
  const sortClickRef = useRef(0);

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
      if (!res.ok) {
        setNotification("Не удалось загрузить заказы — показаны последние данные");
        setTimeout(() => setNotification(""), 3000);
        return;
      }
      const data = await res.json();
      // Never replace a loaded list with [] on a malformed/error payload.
      if (Array.isArray(data)) {
        setOrders(data);
      } else {
        setNotification("Не удалось загрузить заказы — показаны последние данные");
        setTimeout(() => setNotification(""), 3000);
      }
    } catch {
      setNotification("Не удалось загрузить заказы — показаны последние данные");
      setTimeout(() => setNotification(""), 3000);
    } finally {
      setLoading(false);
    }
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
    fetch("/api/admin/settings?key=ordersViewedAt", { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => r.json())
      .then((d) => {
        if (d?.value) setOrdersViewedAt(new Date(d.value));
      })
      .catch(() => undefined);
  }, [getToken]);

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
      entrance: order.entrance || "",
      floor: order.floor || "",
      intercom: order.intercom || "",
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
        entrance: editForm.entrance,
        floor: editForm.floor,
        intercom: editForm.intercom,
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

  const updateOrderStatus = async (order: Order, nextStatus: string, extra?: Record<string, unknown>) => {
    if (nextStatus === "shipped" && !extra?.trackNumber) {
      setShipDraft({ order, trackNumber: "", deliveryService: "" });
      setConfirmShipSend(false);
      return;
    }
    const token = getToken();
    if (!token) return;
    const res = await fetch(`/api/orders/${order.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ status: nextStatus, ...extra }),
    });
    if (res.ok) {
      const updated = await res.json();
      setOrders((prev) => prev.map((o) => (o.id === order.id ? { ...o, ...updated, items: o.items } : o)));
      notify(`Статус ${order.orderNumber} обновлён`);
    } else {
      notify("Не удалось обновить статус");
    }
  };

  const submitShipDraft = async () => {
    if (!shipDraft) return;
    if (!shipDraft.trackNumber.trim() || !shipDraft.deliveryService.trim()) {
      notify("Укажите службу доставки и трек-номер");
      return;
    }
    if (!confirmShipSend) {
      setConfirmShipSend(true);
      return;
    }
    setSavingShip(true);
    await updateOrderStatus(shipDraft.order, "shipped", {
      trackNumber: shipDraft.trackNumber.trim(),
      deliveryService: shipDraft.deliveryService.trim(),
      notifyShipped: true,
    });
    setSavingShip(false);
    setShipDraft(null);
    setConfirmShipSend(false);
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
    popup.document.write("<p style='font-family:Montserrat,Arial,sans-serif;padding:16px'>Загрузка чека...</p>");

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
      const res = await fetch("/api/orders/viewed", { method: "POST", headers: { Authorization: `Bearer ${token}` } });
      const data = await res.json().catch(() => ({}));
      const when = data?.value ? new Date(data.value) : new Date();
      setOrdersViewedAt(when);
      refreshAdminCounts();
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
      (o.customerEmail || "").toLowerCase().includes(q) ||
      o.items.some((item) => (item.product?.name || "").toLowerCase().includes(q))
    );
  });

  const filtered = scopedOrders.filter((o) => {
    if (regionFilter === "ru" && !(o.country === "RU" || o.country === "Россия")) return false;
    if (regionFilter === "foreign" && (o.country === "RU" || o.country === "Россия")) return false;
    if (productFilter !== "all") return o.items.some((item) => item.productId === productFilter);
    return true;
  });

  const newCount = filtered.filter(
    (o) => (o.status === "paid" || o.status === "assembling") && new Date(o.createdAt) > ordersViewedAt
  ).length;

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
      // Dividers only BETWEEN groups — never lead or trail the list.
      if (prevBucket !== null && bucket !== prevBucket) {
        rowsWithDividers.push({ type: "divider", bucket });
      }
      prevBucket = bucket;
      rowsWithDividers.push({ type: "order", order });
    }
  }

  const formatOrderDate = (order: Order) => {
    const d = new Date(order.createdAt);
    const dd = String(d.getDate()).padStart(2, "0");
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const yy = String(d.getFullYear()).slice(-2);
    return `от ${dd}.${mm}.${yy}`;
  };

  const statusSelectStyle = (status: string): CSSProperties => {
    const bg = STATUS_BORDER[status] || "#6b7280";
    const lightFg = status === "unpaid" || status === "cancelled";
    return {
      background: bg,
      color: lightFg ? "#fff" : "#111",
    };
  };

  const totalItems = filtered.reduce((sum, o) => sum + o.items.reduce((s, i) => s + i.quantity, 0), 0);
  const totalSum = filtered.reduce((sum, o) => sum + o.totalAmount, 0);
  const hasUnpaid = scopedOrders.some((o) => o.status === "pending" || o.status === "unpaid");
  const ruCount = scopedOrders.filter((o) => o.country === "RU" || o.country === "Россия").length;
  const foreignCount = scopedOrders.length - ruCount;
  const productFilterOptions = [...products]
    .filter((product) => scopedOrders.some((order) => order.items.some((item) => item.productId === product.id)))
    .sort((a, b) => (a.nameRu || a.name).localeCompare(b.nameRu || b.name, "ru"));
  const visibleOrderIds = sorted.map((order) => order.id);
  const allVisibleSelected = visibleOrderIds.length > 0 && visibleOrderIds.every((id) => selectedOrderIds.has(id));
  const selectedOrders = orders.filter((order) => selectedOrderIds.has(order.id));
  const selectedRecipients = Array.from(
    new Map(
      selectedOrders
        .filter((order) => order.customerEmail?.trim())
        .map((order) => [
          order.customerEmail.trim().toLowerCase(),
          { email: order.customerEmail.trim().toLowerCase(), name: order.customerName || "" },
        ])
    ).values()
  );

  const toggleOrderSelection = (orderId: string) => {
    setSelectedOrderIds((prev) => {
      const next = new Set(prev);
      next.has(orderId) ? next.delete(orderId) : next.add(orderId);
      return next;
    });
  };

  const toggleAllVisible = () => {
    setSelectedOrderIds((prev) => {
      const next = new Set(prev);
      if (allVisibleSelected) visibleOrderIds.forEach((id) => next.delete(id));
      else visibleOrderIds.forEach((id) => next.add(id));
      return next;
    });
  };

  const goToNewsletter = () => {
    if (selectedRecipients.length === 0) {
      notify("У выбранных заказов нет email");
      return;
    }
    const params = new URLSearchParams();
    params.set("recipients", selectedRecipients.map((recipient) => recipient.email).join(","));
    params.set("names", selectedRecipients.map((recipient) => `${encodeURIComponent(recipient.email)}:${encodeURIComponent(recipient.name)}`).join("|"));
    router.push(`/admin/email?${params.toString()}`);
  };

  if (loading) return <PageLoading />;

  return (
    <AdminPage
      title="Заказы"
      notifyCount={newCount > 0 ? newCount : undefined}
      fill
      actions={
        <HeaderActions>
          <IconButton icon="add" label="Добавить" shape="plain" onClick={() => setShowNewOrder(true)} />
          <IconButton icon="export" label="Скачать" shape="plain" onClick={() => downloadOrdersExport("xls")} />
          <IconButton icon="refresh" label="Обновить" shape="plain" onClick={() => { setLoading(true); fetchOrders(); }} />
          {newCount > 0 && (
            <IconButton icon="view" label="Просмотреть" shape="plain" onClick={markAllRead} />
          )}
          {hasUnpaid && (
            <IconButton icon="delete" label="Архивировать неоплаченные" shape="plain" tone="danger" onClick={deleteUnpaid} disabled={deleting} />
          )}
        </HeaderActions>
      }
    >
          <Toolbar>
            <SearchField value={search} onChange={setSearch} style={{ width: 240 }} />

            <div className="cms-popover-anchor">
              <IconButton
                icon="filter"
                label="Фильтр"
                shape="square"
                active={showFilterDrop || periodDays !== 0 || Boolean(customRange.from) || regionFilter !== "all"}
                onClick={() => {
                  const now = Date.now();
                  if (now - filterClickRef.current < 350) {
                    setPeriodDays(0); setCustomRange({ from: "", to: "" }); setRegionFilter("all"); setShowFilterDrop(false);
                    filterClickRef.current = 0;
                    return;
                  }
                  filterClickRef.current = now;
                  setShowFilterDrop(v => !v); setShowSortDrop(false); setShowProductFilterDrop(false);
                }}
              />
              {showFilterDrop && (
                <div className="cms-dropdown-panel cms-popover-start" style={{ minWidth: 240, padding: 12 }}>
                  <div className="cms-menu-title">Период</div>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 12 }}>
                    {PERIOD_OPTIONS.map((d) => (
                      <button key={d} type="button"
                        className={`cms-btn cms-btn-xs${periodDays === d && !customRange.from ? " cms-btn-primary" : ""}`}
                        onClick={() => { setPeriodDays(d); setCustomRange({ from: "", to: "" }); }}>
                        {PERIOD_LABELS[d]}
                      </button>
                    ))}
                  </div>
                  <div className="cms-menu-title">Диапазон дат</div>
                  <div style={{ display: "flex", gap: 6, marginBottom: 12 }}>
                    <input className="cms-input cms-input-sm" type="date" value={customRange.from} onChange={(e) => setCustomRange((prev) => ({ ...prev, from: e.target.value }))} style={{ flex: 1 }} />
                    <input className="cms-input cms-input-sm" type="date" value={customRange.to} onChange={(e) => setCustomRange((prev) => ({ ...prev, to: e.target.value }))} style={{ flex: 1 }} />
                  </div>
                  <div className="cms-menu-title">Регион</div>
                  <div style={{ display: "flex", gap: 6, marginBottom: 4 }}>
                    <button type="button" className={`cms-btn cms-btn-xs${regionFilter === "all" ? " cms-btn-primary" : ""}`} onClick={() => setRegionFilter("all")}>Все ({scopedOrders.length})</button>
                    <button type="button" className={`cms-btn cms-btn-xs${regionFilter === "ru" ? " cms-btn-primary" : ""}`} onClick={() => setRegionFilter("ru")}>Россия ({ruCount})</button>
                    <button type="button" className={`cms-btn cms-btn-xs${regionFilter === "foreign" ? " cms-btn-primary" : ""}`} onClick={() => setRegionFilter("foreign")}>Зарубеж ({foreignCount})</button>
                  </div>
                </div>
              )}
            </div>

            <div className="cms-popover-anchor">
              <IconButton
                icon="sort"
                label="Сортировка"
                shape="square"
                active={showSortDrop || orderSortMode !== "newest"}
                onClick={() => {
                  const now = Date.now();
                  if (now - sortClickRef.current < 350) {
                    setOrderSortMode("newest"); setShowSortDrop(false); sortClickRef.current = 0; return;
                  }
                  sortClickRef.current = now;
                  setShowSortDrop(v => !v); setShowFilterDrop(false); setShowProductFilterDrop(false);
                }}
              />
              {showSortDrop && (
                <div className="cms-dropdown-panel cms-popover-start cms-menu" style={{ minWidth: 180 }}>
                  {ORDER_SORT_OPTIONS.map((opt) => (
                    <button key={opt.value} type="button"
                      className={`cms-menu-item${orderSortMode === opt.value ? " active" : ""}`}
                      onClick={() => { setOrderSortMode(opt.value); setShowSortDrop(false); }}>
                      <span className="cms-menu-label">{opt.label}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="cms-popover-anchor">
              <IconButton
                icon="filter2"
                label="Фильтр по товару"
                shape="square"
                active={showProductFilterDrop || productFilter !== "all"}
                onClick={() => {
                  setShowProductFilterDrop((v) => !v);
                  setShowFilterDrop(false);
                  setShowSortDrop(false);
                }}
              />
              {showProductFilterDrop && (
                <div className="cms-dropdown-panel cms-popover-start cms-menu" style={{ minWidth: 260, maxHeight: 320, overflowY: "auto" }}>
                  <button type="button" className={`cms-menu-item${productFilter === "all" ? " active" : ""}`} onClick={() => { setProductFilter("all"); setShowProductFilterDrop(false); }}>
                    <span className="cms-menu-label">Все товары</span>
                  </button>
                  {productFilterOptions.map((product) => (
                    <button
                      key={product.id}
                      type="button"
                      className={`cms-menu-item${productFilter === product.id ? " active" : ""}`}
                      onClick={() => { setProductFilter(product.id); setShowProductFilterDrop(false); }}
                    >
                      <span className="cms-menu-label">{product.nameRu || product.name}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            <SegmentedControl
              options={[
                { value: "active", label: "Действующие" },
                { value: "done", label: "Завершенные" },
                { value: "archive", label: "Архив" },
              ]}
              value={orderView}
              onChange={(v) => setOrderView(v as OrderView)}
            />
          </Toolbar>

          <DataList className="cms-orders-desktop-table">
            <table className="cms-table">
              <thead>
                <tr>
                  <th className="cms-col-check">
                    <input
                      type="checkbox"
                      checked={allVisibleSelected}
                      onChange={toggleAllVisible}
                      title="Выбрать все видимые заказы"
                      style={{ cursor: "pointer" }}
                    />
                  </th>
                  <th className="cms-col-stamp">№</th>
                  <th className="cms-col-client">Клиент ({filtered.length})</th>
                  <th className="cms-col-items">Товары ({totalItems})</th>
                  <th className="cms-col-sum">Сумма ({formatPrice(totalSum)})</th>
                  <th className="cms-col-status">Статус</th>
                  <th className="cms-col-actions" />
                </tr>
              </thead>
              <tbody>
                {(rowsWithDividers.length > 0 ? rowsWithDividers : sorted.map((order) => ({ type: "order" as const, order }))).map((row, idx) => {
                  if (row.type === "divider") {
                    return (
                      <tr key={`divider-${row.bucket}-${idx}`} className="cms-orders-divider-row">
                        <td colSpan={7} style={{ padding: "10px 8px 6px" }}>
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
                    className={selectedOrderIds.has(order.id) ? "cms-row-selected" : undefined}
                    style={order.isManual ? { background: "rgba(139,92,246,0.06)", borderLeft: "3px solid rgba(139,92,246,0.5)" } : undefined}
                  >
                    <td className="cms-col-check">
                      <input
                        type="checkbox"
                        checked={selectedOrderIds.has(order.id)}
                        onChange={() => toggleOrderSelection(order.id)}
                        onClick={(e) => e.stopPropagation()}
                        title="Выбрать для рассылки"
                        style={{ cursor: "pointer" }}
                      />
                    </td>
                    <td className="cms-col-stamp">
                      <div className="cms-list-stamp cms-list-clamp-24">
                        {order.isManual && (
                          <span style={{ color: "#a78bfa", fontSize: 10, fontWeight: 700, letterSpacing: "0.04em" }}>
                            РУЧНОЙ
                          </span>
                        )}
                        <span className="cms-list-stamp-num">{order.orderNumber}</span>
                        <span className="cms-list-stamp-date">{formatOrderDate(order)}</span>
                      </div>
                    </td>
                    <td className="cms-col-client">
                      <div className="cms-list-client">
                        <span className="cms-list-client-actions">
                          {order.customerPhone && (
                            <IconButton icon="phone" label={order.customerPhone} shape="square" size="sm" onClick={() => setShowContact({ orderId: order.id, type: 'phone', value: order.customerPhone })} />
                          )}
                          {order.customerEmail && (
                            <IconButton icon="mail" label={order.customerEmail} shape="square" size="sm" onClick={() => setShowContact({ orderId: order.id, type: 'email', value: order.customerEmail })} />
                          )}
                        </span>
                        <span className="cms-list-client-name">{order.customerName}</span>
                      </div>
                    </td>
                    <td className="cms-col-items">
                      <div className="cms-list-items">
                        {order.items.length > 0 ? order.items.map((item) => (
                          <div key={item.id} className="cms-list-item-line cms-list-clamp-35">
                            {item.product?.name || "Товар удалён"} ×{item.quantity}
                          </div>
                        )) : <span style={{ color: "var(--cms-text-muted)" }}>—</span>}
                      </div>
                    </td>
                    <td className="cms-col-sum cms-list-sum">{formatPrice(order.totalAmount)}</td>
                    <td className="cms-col-status">
                      <select
                        className="cms-status-select"
                        value={order.status}
                        onChange={(e) => updateOrderStatus(order, e.target.value)}
                        style={statusSelectStyle(order.status)}
                      >
                        {ALL_STATUSES.map((s) => (
                          <option key={s} value={s}>{STATUS_MAP[s]?.label ?? s}</option>
                        ))}
                      </select>
                    </td>
                    <td className="cms-col-actions">
                      <div className="cms-row-actions">
                        <IconButton icon="receipt" label="Чек" shape="square" onClick={() => openReceipt(order.id)} />
                        <IconButton icon="edit" label="Изменить" shape="square" onClick={() => openOrder(order)} />
                        {(order.isManual || order.status === "pending" || order.status === "cancelled" || order.status === "unpaid") && (
                          <IconButton icon="archive" label="В архив" shape="square" tone="danger" onClick={() => deleteOrder(order)} />
                        )}
                      </div>
                    </td>
                  </tr>
                )})}
                {sorted.length === 0 && (
                  <tr><td colSpan={7} style={{ textAlign: "center", padding: "32px", color: "var(--cms-text-muted)" }}>Заказы не найдены</td></tr>
                )}
              </tbody>
            </table>
          </DataList>

          <div className="cms-orders-mobile-list">
            {sorted.map((order) => (
              <div
                key={order.id}
                className={`cms-orders-mobile-card${selectedOrderIds.has(order.id) ? " selected" : ""}`}
                style={order.isManual ? { borderLeft: "3px solid rgba(139,92,246,0.55)" } : undefined}
              >
                <div className="cms-orders-mobile-top">
                  <label className="cms-orders-mobile-check">
                    <input
                      type="checkbox"
                      checked={selectedOrderIds.has(order.id)}
                      onChange={() => toggleOrderSelection(order.id)}
                    />
                    <span className="cms-list-stamp cms-list-clamp-24">
                      <span className="cms-list-stamp-num">{order.orderNumber}</span>
                      <span className="cms-list-stamp-date">{formatOrderDate(order)}</span>
                    </span>
                    {order.isManual && <span className="cms-badge" style={{ fontSize: 9 }}>РУЧНОЙ</span>}
                  </label>
                </div>
                <div className="cms-orders-mobile-client">
                  <div className="cms-list-client" style={{ flex: 1, minWidth: 0 }}>
                    <span className="cms-list-client-actions">
                      {order.customerPhone && (
                        <IconButton icon="phone" label={order.customerPhone} shape="square" size="sm" onClick={() => setShowContact({ orderId: order.id, type: "phone", value: order.customerPhone })} />
                      )}
                      {order.customerEmail && (
                        <IconButton icon="mail" label={order.customerEmail} shape="square" size="sm" onClick={() => setShowContact({ orderId: order.id, type: "email", value: order.customerEmail })} />
                      )}
                    </span>
                    <strong className="cms-list-client-name">{order.customerName}</strong>
                  </div>
                  <span className="cms-list-sum">{formatPrice(order.totalAmount)}</span>
                </div>
                <div className="cms-orders-mobile-items">
                  {order.items.length > 0
                    ? order.items.map((item) => (
                        <span key={item.id} className="cms-list-clamp-35">{item.product?.name || "Товар"} ×{item.quantity}</span>
                      ))
                    : "—"}
                </div>
                <div className="cms-orders-mobile-meta">
                  <select
                    className="cms-status-select"
                    value={order.status}
                    onChange={(e) => updateOrderStatus(order, e.target.value)}
                    style={{ ...statusSelectStyle(order.status), flex: 1, minWidth: 0, height: 20, minHeight: 20 }}
                  >
                    {ALL_STATUSES.map((s) => (
                      <option key={s} value={s}>{STATUS_MAP[s]?.label ?? s}</option>
                    ))}
                  </select>
                </div>
                <div className="cms-orders-mobile-actions cms-row-actions">
                  <IconButton icon="receipt" label="Чек" shape="square" onClick={() => openReceipt(order.id)} />
                  <IconButton icon="edit" label="Изменить" shape="square" onClick={() => openOrder(order)} />
                  {(order.isManual || order.status === "pending" || order.status === "cancelled" || order.status === "unpaid") && (
                    <IconButton icon="archive" label="В архив" shape="square" tone="danger" onClick={() => deleteOrder(order)} />
                  )}
                </div>
              </div>
            ))}
            {sorted.length === 0 && <div className="cms-products-mobile-empty">Заказы не найдены</div>}
          </div>

          {selectedOrderIds.size > 0 && (
            <div style={{ position: "sticky", bottom: 16, zIndex: 30, margin: "14px auto 0", maxWidth: 520, display: "flex", alignItems: "center", gap: 10, padding: "10px 12px", border: "1px solid var(--cms-border)", borderRadius: 12, background: "var(--cms-surface-elevated)", boxShadow: "0 12px 34px rgba(0,0,0,0.35)" }}>
              <span style={{ fontSize: 12, color: "var(--cms-text-muted)", marginRight: "auto" }}>
                Выбрано заказов: <strong style={{ color: "var(--cms-text)" }}>{selectedOrderIds.size}</strong>
                {" "}· контактов: <strong style={{ color: "var(--cms-text)" }}>{selectedRecipients.length}</strong>
              </span>
              <button className="cms-btn cms-btn-sm cms-btn-primary" onClick={goToNewsletter}>
                Рассылка
              </button>
              <button className="cms-btn cms-btn-sm cms-btn-ghost" onClick={() => setSelectedOrderIds(new Set())}>
                Снять
              </button>
            </div>
          )}

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
                  Подъезд
                  <input className="cms-input" value={editForm.entrance} onChange={(e) => setEditForm((prev) => ({ ...prev, entrance: e.target.value }))} style={{ marginTop: 4 }} />
                </label>
                <label className="cms-label">
                  Этаж
                  <input className="cms-input" value={editForm.floor} onChange={(e) => setEditForm((prev) => ({ ...prev, floor: e.target.value }))} style={{ marginTop: 4 }} />
                </label>
                <label className="cms-label">
                  Домофон
                  <input className="cms-input" value={editForm.intercom} onChange={(e) => setEditForm((prev) => ({ ...prev, intercom: e.target.value }))} style={{ marginTop: 4 }} />
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
                    <option value="manual_delivery">Доставка по адресу</option>
                  </select>
                </label>
                <label className="cms-label">
                  Способ оплаты
                  <select className="cms-select" value={manualForm.paymentMethod} onChange={(e) => setManualForm({ ...manualForm, paymentMethod: e.target.value })} style={{ marginTop: 4 }}>
                    <option value="tochka">Точка Банк</option>
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

      {notification && <div className={adminToastClass(notification)}>{notification}</div>}

      <ContactSheet
        contact={showContact ? { type: showContact.type, value: showContact.value } : null}
        onClose={() => setShowContact(null)}
        onCopied={() => notify("Скопировано")}
      />

      <Modal open={Boolean(shipDraft)} onClose={() => { setShipDraft(null); setConfirmShipSend(false); }} title="Отправка заказа" width={420}>
        {shipDraft && (
          <div className="cms-section-stack" style={{ gap: 12 }}>
            <label className="cms-label">Служба доставки
              <input className="cms-input" value={shipDraft.deliveryService} onChange={(e) => { setShipDraft({ ...shipDraft, deliveryService: e.target.value }); setConfirmShipSend(false); }} placeholder="СДЭК, Почта России…" />
            </label>
            <label className="cms-label">Трек-номер
              <input className="cms-input" value={shipDraft.trackNumber} onChange={(e) => { setShipDraft({ ...shipDraft, trackNumber: e.target.value }); setConfirmShipSend(false); }} placeholder="Введите track-номер" />
            </label>
            {confirmShipSend && (
              <div style={{ fontSize: 12, color: 'var(--cms-text-muted)', padding: '8px 10px', borderRadius: 10, background: 'rgba(245,139,220,0.12)', border: '1px solid rgba(245,139,220,0.35)' }}>
                Отправить клиенту письмо «Сведения о заказе» с трек-номером?
              </div>
            )}
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <Button variant="ghost" onClick={() => { setShipDraft(null); setConfirmShipSend(false); }}>Отмена</Button>
              <Button variant="primary" icon="send" onClick={submitShipDraft} disabled={savingShip}>
                {confirmShipSend ? 'Подтвердить и отправить' : 'Далее'}
              </Button>
            </div>
          </div>
        )}
      </Modal>


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
    </AdminPage>
  );
}