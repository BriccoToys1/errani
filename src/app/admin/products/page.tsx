"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { AdminSidebar } from "../AdminSidebar";

// Image uploader component with drag & drop
function ImageUploader({
  value,
  onChange,
  label,
  placeholder,
}: {
  value: string;
  onChange: (url: string) => void;
  label: string;
  placeholder?: string;
}) {
  const [isDragging, setIsDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const uploadFile = async (file: File) => {
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch("/api/upload", { method: "POST", body: formData });
      const data = await res.json();
      if (data.url) onChange(data.url);
      else alert(data.error || "Ошибка загрузки");
    } catch {
      alert("Ошибка загрузки файла");
    }
    setUploading(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file && file.type.startsWith("image/")) uploadFile(file);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    const items = e.clipboardData.items;
    for (const item of items) {
      if (item.type.startsWith("image/")) {
        const file = item.getAsFile();
        if (file) uploadFile(file);
        break;
      }
    }
  };

  return (
    <div style={{ marginBottom: "12px" }}>
      <span className="cms-label" style={{ display: "block", marginBottom: "6px" }}>{label}</span>
      <div
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={() => setIsDragging(false)}
        onPaste={handlePaste}
        onClick={() => fileInputRef.current?.click()}
        style={{
          border: isDragging ? "2px dashed #9b87f5" : "2px dashed #444",
          borderRadius: "8px",
          padding: "16px",
          textAlign: "center",
          cursor: "pointer",
          backgroundColor: isDragging ? "rgba(155,135,245,0.1)" : "transparent",
          transition: "all 0.2s",
        }}
      >
        {uploading ? (
          <span style={{ color: "#9b87f5" }}>Загрузка...</span>
        ) : value ? (
          <div style={{ display: "flex", alignItems: "center", gap: "12px", justifyContent: "center" }}>
            <img src={value} alt="" style={{ maxHeight: "60px", borderRadius: "4px" }} />
            <span style={{ color: "#aaa", fontSize: "13px" }}>{value}</span>
          </div>
        ) : (
          <span style={{ color: "#888" }}>{placeholder || "Перетащите фото или нажмите для выбора"}</span>
        )}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          style={{ display: "none" }}
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) uploadFile(file);
          }}
        />
      </div>
      <input
        className="cms-input"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder || "/media/photo.jpeg"}
        style={{ marginTop: "6px" }}
      />
    </div>
  );
}

// Multi-image uploader for additional photos
function MultiImageUploader({
  value,
  onChange,
  label,
}: {
  value: string;
  onChange: (json: string) => void;
  label: string;
}) {
  const [isDragging, setIsDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const images: string[] = (() => {
    try { return JSON.parse(value) || []; } catch { return []; }
  })();

  const uploadFile = async (file: File) => {
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch("/api/upload", { method: "POST", body: formData });
      const data = await res.json();
      if (data.url) {
        const newImages = [...images, data.url];
        onChange(JSON.stringify(newImages));
      } else {
        alert(data.error || "Ошибка загрузки");
      }
    } catch {
      alert("Ошибка загрузки файла");
    }
    setUploading(false);
  };

  const removeImage = (index: number) => {
    const newImages = images.filter((_, i) => i !== index);
    onChange(JSON.stringify(newImages));
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const files = Array.from(e.dataTransfer.files);
    files.filter(f => f.type.startsWith("image/")).forEach(uploadFile);
  };

  return (
    <div style={{ marginBottom: "12px" }}>
      <span className="cms-label" style={{ display: "block", marginBottom: "6px" }}>{label}</span>
      {images.length > 0 && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: "8px", marginBottom: "8px" }}>
          {images.map((img, i) => (
            <div key={i} style={{ position: "relative" }}>
              <img src={img} alt="" style={{ height: "60px", borderRadius: "4px" }} />
              <button
                type="button"
                onClick={() => removeImage(i)}
                style={{
                  position: "absolute", top: "-6px", right: "-6px",
                  width: "20px", height: "20px", borderRadius: "50%",
                  background: "#e74c3c", color: "#fff", border: "none",
                  cursor: "pointer", fontSize: "14px", lineHeight: "1"
                }}
              >×</button>
            </div>
          ))}
        </div>
      )}
      <div
        onDrop={handleDrop}
        onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
        onDragLeave={() => setIsDragging(false)}
        onClick={() => fileInputRef.current?.click()}
        style={{
          border: isDragging ? "2px dashed #9b87f5" : "2px dashed #444",
          borderRadius: "8px", padding: "12px", textAlign: "center",
          cursor: "pointer", backgroundColor: isDragging ? "rgba(155,135,245,0.1)" : "transparent",
        }}
      >
        {uploading ? (
          <span style={{ color: "#9b87f5" }}>Загрузка...</span>
        ) : (
          <span style={{ color: "#888", fontSize: "13px" }}>+ Добавить фото</span>
        )}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          multiple
          style={{ display: "none" }}
          onChange={(e) => {
            Array.from(e.target.files || []).forEach(uploadFile);
          }}
        />
      </div>
    </div>
  );
}

interface Product {
  id: string;
  name: string;
  nameRu: string;
  slug: string;
  description: string;
  descriptionRu: string;
  price: number;
  oldPrice: number | null;
  discount: number;
  stock: number;
  currency: string;
  image: string;
  images: string;
  inStock: boolean;
  isPreorder: boolean;
  isHit: boolean;
  isAuthor: boolean;
  isActive: boolean;
  sortOrder: number;
  createdAt: string;
}

const emptyProduct = {
  name: "", nameRu: "", slug: "", description: "", descriptionRu: "",
  price: 0, oldPrice: null as number | null, discount: 0, stock: 0,
  currency: "RUB", image: "", images: "[]", inStock: true, isPreorder: false,
  isHit: false, isAuthor: false, isActive: true, sortOrder: 0,
};

export default function AdminProductsPage() {
  const router = useRouter();
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Product | null>(null);
  const [isNew, setIsNew] = useState(false);
  const [form, setForm] = useState(emptyProduct);
  const [saving, setSaving] = useState(false);
  const [notification, setNotification] = useState("");
  const [deleteConfirm, setDeleteConfirm] = useState<string[] | null>(null);
  const [checkedIds, setCheckedIds] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState("");
  const [filterStock, setFilterStock] = useState("all");
  const [filterType, setFilterType] = useState("all");

  const getToken = useCallback(() => localStorage.getItem("admin_token"), []);

  const fetchProducts = useCallback(async () => {
    const token = getToken();
    if (!token) { router.push("/admin/login"); return; }
    const res = await fetch("/api/products");
    const data = await res.json();
    setProducts(Array.isArray(data) ? data : []);
    setLoading(false);
  }, [getToken, router]);

  useEffect(() => {
    const token = getToken();
    if (!token) { router.push("/admin/login"); return; }
    fetchProducts();
  }, [fetchProducts, getToken, router]);

  const openProduct = (product: Product) => {
    setSelected(product);
    setIsNew(false);
    setForm({
      name: product.name, nameRu: product.nameRu || "", slug: product.slug,
      description: product.description, descriptionRu: product.descriptionRu || "",
      price: product.price, oldPrice: product.oldPrice, discount: product.discount,
      stock: product.stock, currency: product.currency, image: product.image,
      images: product.images, inStock: product.inStock, isPreorder: product.isPreorder,
      isHit: product.isHit, isAuthor: product.isAuthor, isActive: product.isActive,
      sortOrder: product.sortOrder,
    });
  };

  const openNew = () => { setIsNew(true); setSelected(null); setForm({ ...emptyProduct }); };
  const closeDialog = () => { setSelected(null); setIsNew(false); };

  const handleSave = async () => {
    setSaving(true);
    const token = getToken();
    const url = isNew ? "/api/products" : `/api/products/${selected!.id}`;
    const method = isNew ? "POST" : "PUT";
    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({
        ...form,
        price: Number(form.price),
        oldPrice: form.oldPrice ? Number(form.oldPrice) : null,
        discount: Number(form.discount),
        stock: Number(form.stock),
        sortOrder: Number(form.sortOrder),
      }),
    });
    if (res.ok) {
      notify(isNew ? "Product created" : "Product updated");
      closeDialog();
      fetchProducts();
    } else {
      const err = await res.json();
      notify(`Error: ${err.error || "Unknown error"}`);
    }
    setSaving(false);
  };

  const handleDelete = async (ids: string[]) => {
    const token = getToken();
    for (const id of ids) {
      await fetch(`/api/products/${id}`, { method: "DELETE", headers: { Authorization: `Bearer ${token}` } });
    }
    notify(`${ids.length} product(s) deleted`);
    setDeleteConfirm(null);
    setCheckedIds(new Set());
    fetchProducts();
  };

  const notify = (msg: string) => { setNotification(msg); setTimeout(() => setNotification(""), 3000); };

  const toggleCheck = (id: string) => {
    setCheckedIds((prev) => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
  };

  const formatPrice = (n: number) =>
    new Intl.NumberFormat("ru-RU", { style: "currency", currency: "RUB", minimumFractionDigits: 0 }).format(n);

  const filtered = products.filter((p) => {
    // Search filter
    if (search) {
      const q = search.toLowerCase();
      if (!p.name.toLowerCase().includes(q) && !p.slug.toLowerCase().includes(q)) return false;
    }
    // Stock filter
    if (filterStock === "inStock" && !p.inStock) return false;
    if (filterStock === "outOfStock" && p.inStock) return false;
    if (filterStock === "preorder" && !p.isPreorder) return false;
    // Type filter
    if (filterType === "hit" && !p.isHit) return false;
    if (filterType === "author" && !p.isAuthor) return false;
    return true;
  });

  const toggleAll = () => {
    if (checkedIds.size === filtered.length) setCheckedIds(new Set());
    else setCheckedIds(new Set(filtered.map((p) => p.id)));
  };

  if (loading) return <div className="cms-loading"><div className="cms-spinner" /> Loading...</div>;

  return (
    <div className="cms-root">
      <AdminSidebar />
      <main className="cms-main">
        <div className="cms-header">
          <h1 className="cms-header-title">Товары</h1>
          <div className="cms-header-actions">
            <span style={{ fontSize: "13px", color: "var(--cms-text-muted)" }}>{products.length} всего</span>
            <a href="/api/admin/export?type=products&format=csv" className="cms-btn cms-btn-sm" download><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg> CSV</a>
            <a href="/api/admin/export?type=products&format=xls" className="cms-btn cms-btn-sm" download><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg> XLS</a>
            <button className="cms-btn cms-btn-sm cms-btn-primary" onClick={openNew}>+ Новый товар</button>
          </div>
        </div>

        <div className="cms-content">
          <div style={{ display: "flex", gap: "8px", alignItems: "center", marginBottom: "12px" }}>
            <input className="cms-input cms-input-sm" placeholder="Поиск..." value={search} onChange={(e) => setSearch(e.target.value)} style={{ width: "180px" }} />
            <select className="cms-select" value={filterStock} onChange={(e) => setFilterStock(e.target.value)}>
              <option value="all">Все статусы</option>
              <option value="inStock">В наличии</option>
              <option value="outOfStock">Нет в наличии</option>
              <option value="preorder">Предзаказ</option>
            </select>
            <select className="cms-select" value={filterType} onChange={(e) => setFilterType(e.target.value)}>
              <option value="all">Все типы</option>
              <option value="hit">Хит</option>
              <option value="author">Авторская</option>
            </select>
            {checkedIds.size > 0 && (
              <button className="cms-btn cms-btn-sm cms-btn-danger" onClick={() => setDeleteConfirm(Array.from(checkedIds))}>
                Удалить ({checkedIds.size})
              </button>
            )}
          </div>

          <div className="cms-table-wrap">
            <table className="cms-table">
              <thead>
                <tr>
                  <th style={{ width: 36 }}><input type="checkbox" checked={checkedIds.size === filtered.length && filtered.length > 0} onChange={toggleAll} /></th>
                  <th style={{ width: 50 }}>Фото</th>
                  <th>Название</th>
                  <th>Slug</th>
                  <th>Цена</th>
                  <th>Скидка</th>
                  <th>Остаток</th>
                  <th>Активен</th>
                  <th>Хит</th>
                  <th>Авторская</th>
                  <th style={{ width: 80 }}>Действия</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((p) => (
                  <tr key={p.id} className={checkedIds.has(p.id) ? "cms-row-selected" : ""}>
                    <td><input type="checkbox" checked={checkedIds.has(p.id)} onChange={() => toggleCheck(p.id)} /></td>
                    <td>
                      {p.image && <img src={p.image} alt="" style={{ width: 36, height: 36, borderRadius: 6, objectFit: "cover" }} />}
                    </td>
                    <td className="cms-td-bold">{p.name}</td>
                    <td className="cms-td-mono" style={{ fontSize: "11px" }}>{p.slug}</td>
                    <td>{formatPrice(p.price)}</td>
                    <td>{p.discount > 0 ? <span className="cms-badge cms-badge-green">-{p.discount}%</span> : "\u2014"}</td>
                    <td>{p.stock}</td>
                    <td>{p.isActive ? <span className="cms-badge cms-badge-green">Да</span> : <span className="cms-badge cms-badge-red">Нет</span>}</td>
                    <td>{p.isHit ? <svg width="14" height="14" viewBox="0 0 24 24" fill="#f59e0b"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg> : "\u2014"}</td>
                    <td>{p.isAuthor ? <svg width="14" height="14" viewBox="0 0 24 24" fill="#9b59b6"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/></svg> : "\u2014"}</td>
                    <td>
                      <button className="cms-btn cms-btn-xs cms-btn-ghost" onClick={() => openProduct(p)} title="Edit">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 013 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>
                      </button>
                      <button className="cms-btn cms-btn-xs cms-btn-ghost" onClick={() => setDeleteConfirm([p.id])} title="Delete" style={{ color: "var(--cms-danger)" }}>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/></svg>
                      </button>
                    </td>
                  </tr>
                ))}
                {filtered.length === 0 && (
                  <tr><td colSpan={11} style={{ textAlign: "center", padding: "32px", color: "var(--cms-text-muted)" }}>Товары не найдены</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </main>

      {/* Product Edit Modal */}
      {(selected || isNew) && (
        <div className="cms-modal-overlay" onClick={closeDialog}>
          <div className="cms-modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 640 }}>
            <div className="cms-modal-header">
              <h3>{isNew ? "Новый товар" : `Редактирование: ${selected!.name}`}</h3>
              <button className="cms-modal-close" onClick={closeDialog}>&times;</button>
            </div>
            <div className="cms-modal-body" style={{ maxHeight: "65vh", overflow: "auto" }}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px", marginBottom: "12px" }}>
                <label className="cms-label">
                  Название (EN)
                  <input className="cms-input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
                </label>
                <label className="cms-label">
                  Название (RU)
                  <input className="cms-input" value={form.nameRu} onChange={(e) => setForm({ ...form, nameRu: e.target.value })} />
                </label>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: "12px", marginBottom: "12px" }}>
                <label className="cms-label">
                  Slug
                  <input className="cms-input" value={form.slug} onChange={(e) => setForm({ ...form, slug: e.target.value })} />
                </label>
              </div>
              <label className="cms-label" style={{ marginBottom: "12px", display: "block" }}>
                Описание (EN)
                <textarea className="cms-textarea" rows={2} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} style={{ width: "100%" }} />
              </label>
              <label className="cms-label" style={{ marginBottom: "12px", display: "block" }}>
                Описание (RU)
                <textarea className="cms-textarea" rows={2} value={form.descriptionRu} onChange={(e) => setForm({ ...form, descriptionRu: e.target.value })} style={{ width: "100%" }} />
              </label>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: "12px", marginBottom: "12px" }}>
                <label className="cms-label">
                  Цена
                  <input className="cms-input" type="number" value={form.price} onChange={(e) => setForm({ ...form, price: Number(e.target.value) })} />
                </label>
                <label className="cms-label">
                  Старая цена
                  <input className="cms-input" type="number" value={form.oldPrice || ""} onChange={(e) => setForm({ ...form, oldPrice: e.target.value ? Number(e.target.value) : null })} placeholder="Для скидки" />
                </label>
                <label className="cms-label">
                  Скидка %
                  <input className="cms-input" type="number" min="0" max="100" value={form.discount} onChange={(e) => setForm({ ...form, discount: Number(e.target.value) })} />
                </label>
                <label className="cms-label">
                  Остаток
                  <input className="cms-input" type="number" min="0" value={form.stock} onChange={(e) => setForm({ ...form, stock: Number(e.target.value) })} />
                </label>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px", marginBottom: "12px" }}>
                <label className="cms-label">
                  Валюта
                  <select className="cms-select" value={form.currency} onChange={(e) => setForm({ ...form, currency: e.target.value })}>
                    <option value="RUB">RUB</option><option value="USD">USD</option><option value="EUR">EUR</option>
                  </select>
                </label>
                <label className="cms-label">
                  Порядок сортировки
                  <input className="cms-input" type="number" value={form.sortOrder} onChange={(e) => setForm({ ...form, sortOrder: Number(e.target.value) })} />
                </label>
              </div>
              <ImageUploader
                label="Основное фото"
                value={form.image}
                onChange={(url) => setForm({ ...form, image: url })}
                placeholder="Перетащите фото или нажмите для выбора"
              />
              <MultiImageUploader
                label="Дополнительные фото"
                value={form.images}
                onChange={(json) => setForm({ ...form, images: json })}
              />
              <div style={{ display: "flex", gap: "20px", flexWrap: "wrap" }}>
                {(["isActive", "inStock", "isPreorder", "isHit", "isAuthor"] as const).map((key) => (
                  <label key={key} className="cms-checkbox-label">
                    <input type="checkbox" checked={form[key] as boolean} onChange={(e) => setForm({ ...form, [key]: e.target.checked })} />
                    {key === "isActive" ? "Активен" : key === "inStock" ? "В наличии" : key === "isPreorder" ? "Предзаказ" : key === "isHit" ? "Хит" : "Авторская"}
                  </label>
                ))}
              </div>
            </div>
            <div className="cms-modal-actions">
              <button className="cms-btn cms-btn-primary" onClick={handleSave} disabled={saving}>{saving ? "Сохранение..." : "Сохранить"}</button>
              <button className="cms-btn" onClick={closeDialog}>Отмена</button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirm */}
      {deleteConfirm && (
        <div className="cms-modal-overlay" onClick={() => setDeleteConfirm(null)}>
          <div className="cms-modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 420 }}>
            <div className="cms-modal-header">
              <h3>Подтверждение удаления</h3>
              <button className="cms-modal-close" onClick={() => setDeleteConfirm(null)}>&times;</button>
            </div>
            <div className="cms-modal-body">
              <p style={{ fontSize: "14px" }}>
                Вы уверены, что хотите удалить <strong>{deleteConfirm.length}</strong> товар(ов)?<br />Это действие нельзя отменить.
              </p>
            </div>
            <div className="cms-modal-actions">
              <button className="cms-btn cms-btn-danger" onClick={() => handleDelete(deleteConfirm)}>Удалить</button>
              <button className="cms-btn" onClick={() => setDeleteConfirm(null)}>Отмена</button>
            </div>
          </div>
        </div>
      )}

      {notification && <div className="cms-toast">{notification}</div>}
    </div>
  );
}
