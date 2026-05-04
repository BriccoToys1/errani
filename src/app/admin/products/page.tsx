"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { AdminSidebar } from "../AdminSidebar";

const SUPPORTED_IMAGE_EXTENSIONS = [".png", ".jpg", ".jpeg", ".webp"];
const SUPPORTED_IMAGE_MIME_TYPES = [
  "image/png",
  "image/jpeg",
  "image/jpg",
  "image/webp",
];
const IMAGE_ACCEPT = SUPPORTED_IMAGE_EXTENSIONS.join(",");
const MAX_IMAGES = 20;
const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024;
const MAX_FILE_SIZE_MB = 10;

function isSupportedImageFile(file: File): boolean {
  const lowerName = (file.name || "").toLowerCase();
  const hasAllowedExt = SUPPORTED_IMAGE_EXTENSIONS.some((ext) => lowerName.endsWith(ext));
  const hasAllowedMime = SUPPORTED_IMAGE_MIME_TYPES.includes((file.type || "").toLowerCase());
  return hasAllowedExt || hasAllowedMime;
}

function parseImageList(value: string): string[] {
  try {
    const parsed = JSON.parse(value || "[]");
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((item): item is string => typeof item === "string" && item.trim().length > 0);
  } catch {
    return [];
  }
}

function toImageListJson(images: string[]): string {
  return JSON.stringify(images);
}

async function uploadProductImage(file: File, token: string): Promise<{ url: string; filename: string }> {
  if (!isSupportedImageFile(file)) {
    throw new Error("Допустимы только JPG, JPEG, PNG, WEBP");
  }

  if (file.size > MAX_FILE_SIZE_BYTES) {
    throw new Error(`Размер файла больше ${MAX_FILE_SIZE_MB} MB`);
  }

  const formData = new FormData();
  formData.append("image", file);

  const response = await fetch("/api/admin/upload/image", {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
    body: formData,
  });

  const data = await response.json();
  if (!response.ok || !data?.success || !data?.url) {
    throw new Error(data?.message || "Ошибка загрузки изображения");
  }

  return {
    url: String(data.url),
    filename: String(data.filename || ""),
  };
}

async function copyText(value: string): Promise<boolean> {
  if (!value) return false;
  try {
    await navigator.clipboard.writeText(value);
    return true;
  } catch {
    return false;
  }
}

function ImageUploader({
  value,
  onChange,
  onUploaded,
  token,
  label,
  placeholder,
}: {
  value: string;
  onChange: (url: string) => void;
  onUploaded?: (url: string) => void;
  token: string;
  label: string;
  placeholder?: string;
}) {
  const [isDragging, setIsDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [statusText, setStatusText] = useState("");
  const [lastUploadedUrl, setLastUploadedUrl] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const uploadFile = async (file: File) => {
    if (!token) {
      alert("Сессия истекла. Войдите заново.");
      return;
    }

    setUploading(true);
    setStatusText("");
    try {
      const uploaded = await uploadProductImage(file, token);
      setLastUploadedUrl(uploaded.url);
      setStatusText("Файл загружен и конвертирован в WEBP");
      onChange(uploaded.url);
      onUploaded?.(uploaded.url);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Ошибка загрузки файла";
      setStatusText(message);
      alert(message);
    } finally {
      setUploading(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file && isSupportedImageFile(file)) uploadFile(file);
  };

  return (
    <div style={{ marginBottom: "12px" }}>
      <span className="cms-label" style={{ display: "block", marginBottom: "6px" }}>{label}</span>

      {/* Preview */}
      {value && (
        <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "8px", padding: "8px", background: "rgba(155,135,245,0.08)", borderRadius: "6px" }}>
          <img src={value} alt="" style={{ maxHeight: "50px", borderRadius: "4px" }} onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
          <span style={{ color: "#aaa", fontSize: "12px", flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{value}</span>
          <button type="button" onClick={() => onChange("")} style={{ background: "none", border: "none", color: "#888", cursor: "pointer", fontSize: "16px" }}>×</button>
        </div>
      )}

      <div
        className={`cms-uploader-zone ${isDragging ? "dragging" : ""}`}
        onDrop={handleDrop}
        onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
        onDragLeave={() => setIsDragging(false)}
        onClick={() => fileInputRef.current?.click()}
        style={{ padding: "20px" }}
      >
        {uploading ? (
          <span style={{ color: "#9b87f5" }}>Загрузка...</span>
        ) : (
          <span style={{ color: "#888" }}>{placeholder || "Перетащите фото или нажмите для выбора"}</span>
        )}
        <input
          ref={fileInputRef}
          type="file"
          accept={IMAGE_ACCEPT}
          style={{ display: "none" }}
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) uploadFile(file);
          }}
        />
      </div>

      {statusText && (
        <div style={{ marginTop: "6px", fontSize: "12px", color: "var(--cms-text-muted)" }}>{statusText}</div>
      )}

      {(lastUploadedUrl || value) && (
        <div className="cms-uploader-url-card" style={{ marginTop: "8px" }}>
          <div style={{ fontSize: "11px", color: "var(--cms-text-muted)", marginBottom: "6px" }}>Прямая ссылка</div>
          <div style={{ fontSize: "12px", color: "#ddd", wordBreak: "break-all", marginBottom: "8px" }}>{lastUploadedUrl || value}</div>
          <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
            <button
              type="button"
              className="cms-btn cms-btn-xs"
              onClick={async () => {
                const ok = await copyText(lastUploadedUrl || value);
                if (!ok) alert("Не удалось скопировать ссылку");
              }}
            >
              Скопировать URL
            </button>
            <button
              type="button"
              className="cms-btn cms-btn-xs cms-btn-primary"
              onClick={() => {
                const url = lastUploadedUrl || value;
                if (!url) return;
                onChange(url);
                onUploaded?.(url);
              }}
            >
              Вставить в товар
            </button>
            <a
              className="cms-btn cms-btn-xs cms-btn-ghost"
              href={lastUploadedUrl || value}
              target="_blank"
              rel="noreferrer"
            >
              Открыть изображение
            </a>
          </div>
        </div>
      )}
    </div>
  );
}

function MultiImageUploader({
  value,
  onChange,
  mainImage,
  onMainImageChange,
  token,
  label,
}: {
  value: string;
  onChange: (json: string) => void;
  mainImage: string;
  onMainImageChange: (url: string) => void;
  token: string;
  label: string;
}) {
  const [isDragging, setIsDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [lastUploadedUrl, setLastUploadedUrl] = useState("");
  const [statusText, setStatusText] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const images = parseImageList(value);

  const setImages = (next: string[]) => {
    onChange(toImageListJson(next));
  };

  const addImage = (url: string) => {
    const cleanUrl = url.trim();
    if (!cleanUrl) return;
    if (images.length >= MAX_IMAGES) {
      alert(`Максимум ${MAX_IMAGES} фотографий`);
      return;
    }

    if (!images.includes(cleanUrl)) {
      setImages([...images, cleanUrl]);
    }

    if (!mainImage) {
      onMainImageChange(cleanUrl);
    }
  };

  const uploadFile = async (file: File) => {
    if (images.length >= MAX_IMAGES) { alert(`Максимум ${MAX_IMAGES} фотографий`); return; }
    if (!token) {
      alert("Сессия истекла. Войдите заново.");
      return;
    }

    setUploading(true);
    setStatusText("");
    try {
      const uploaded = await uploadProductImage(file, token);
      setLastUploadedUrl(uploaded.url);
      setStatusText("Файл загружен и добавлен в галерею");
      addImage(uploaded.url);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Ошибка загрузки файла";
      setStatusText(message);
      alert(message);
    } finally {
      setUploading(false);
    }
  };

  const removeImage = (index: number) => {
    const next = images.filter((_, i) => i !== index);
    const removed = images[index];
    setImages(next);

    if (removed && removed === mainImage) {
      onMainImageChange(next[0] || "");
    }
  };

  const moveImage = (index: number, shift: -1 | 1) => {
    const targetIndex = index + shift;
    if (targetIndex < 0 || targetIndex >= images.length) return;

    const next = [...images];
    [next[index], next[targetIndex]] = [next[targetIndex], next[index]];
    setImages(next);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const files = Array.from(e.dataTransfer.files);
    files.forEach(uploadFile);
  };

  return (
    <div style={{ marginBottom: "12px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "6px" }}>
        <span className="cms-label">{label}</span>
        <span style={{ fontSize: "11px", color: "var(--cms-text-muted)" }}>{images.length} / {MAX_IMAGES}</span>
      </div>
      {images.length > 0 && (
        <div style={{ display: "grid", gap: "8px", marginBottom: "8px" }}>
          {images.map((img, i) => (
            <div key={`${img}-${i}`} style={{ display: "grid", gridTemplateColumns: "60px 1fr auto", gap: "8px", alignItems: "center", border: "1px solid var(--cms-border)", borderRadius: "8px", padding: "8px" }}>
              <img src={img} alt="" style={{ width: "60px", height: "60px", borderRadius: "6px", objectFit: "cover" }} />
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: "11px", color: "#ddd", wordBreak: "break-all", marginBottom: "5px" }}>{img}</div>
                <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
                  <button
                    type="button"
                    className={`cms-btn cms-btn-xs ${mainImage === img ? "cms-btn-primary" : ""}`}
                    onClick={() => onMainImageChange(img)}
                  >
                    {mainImage === img ? "Главное фото" : "Сделать главным"}
                  </button>
                  <a className="cms-btn cms-btn-xs cms-btn-ghost" href={img} target="_blank" rel="noreferrer">Открыть</a>
                </div>
              </div>
              <div style={{ display: "grid", gap: "4px" }}>
                <button type="button" className="cms-btn cms-btn-xs" onClick={() => moveImage(i, -1)} disabled={i === 0}>↑</button>
                <button type="button" className="cms-btn cms-btn-xs" onClick={() => moveImage(i, 1)} disabled={i === images.length - 1}>↓</button>
                <button type="button" className="cms-btn cms-btn-xs cms-btn-danger" onClick={() => removeImage(i)}>Удалить</button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* File upload drop zone */}
      {images.length < MAX_IMAGES && (
        <div
          className={`cms-uploader-zone ${isDragging ? "dragging" : ""}`}
          onDrop={handleDrop}
          onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
          onDragLeave={() => setIsDragging(false)}
          onClick={() => fileInputRef.current?.click()}
          style={{ padding: "10px" }}
        >
          {uploading ? (
            <span style={{ color: "#9b87f5", fontSize: "12px" }}>Загрузка...</span>
          ) : (
            <span style={{ color: "#888", fontSize: "12px" }}>или перетащите / выберите файл</span>
          )}
          <input
            ref={fileInputRef}
            type="file"
            accept={IMAGE_ACCEPT}
            multiple
            style={{ display: "none" }}
            onChange={(e) => {
              Array.from(e.target.files || []).forEach(uploadFile);
            }}
          />
        </div>
      )}

      {statusText && (
        <div style={{ marginTop: "6px", fontSize: "12px", color: "var(--cms-text-muted)" }}>{statusText}</div>
      )}

      {lastUploadedUrl && (
        <div className="cms-uploader-url-card" style={{ marginTop: "8px" }}>
          <div style={{ fontSize: "11px", color: "var(--cms-text-muted)", marginBottom: "6px" }}>Последняя загруженная ссылка</div>
          <div style={{ fontSize: "12px", color: "#ddd", wordBreak: "break-all", marginBottom: "8px" }}>{lastUploadedUrl}</div>
          <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
            <button
              type="button"
              className="cms-btn cms-btn-xs"
              onClick={async () => {
                const ok = await copyText(lastUploadedUrl);
                if (!ok) alert("Не удалось скопировать ссылку");
              }}
            >
              Скопировать URL
            </button>
            <button
              type="button"
              className="cms-btn cms-btn-xs cms-btn-primary"
              onClick={() => addImage(lastUploadedUrl)}
            >
              Вставить в товар
            </button>
            <a className="cms-btn cms-btn-xs cms-btn-ghost" href={lastUploadedUrl} target="_blank" rel="noreferrer">Открыть изображение</a>
          </div>
        </div>
      )}
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
  preorderClosed: boolean;
  preorderAvailableDate: string | null;
  isAuthor: boolean;
  isLimited: boolean;
  limitedEditionText: string;
  isActive: boolean;
  isSaleDisabled: boolean;
  isSoldOut: boolean;
  sortOrder: number;
  characteristics: string;
  colors: string;
  createdAt: string;
}

const emptyProduct = {
  name: "", nameRu: "", slug: "", description: "", descriptionRu: "",
  price: 0, oldPrice: null as number | null, discount: 0, stock: 0,
  currency: "RUB", image: "", images: "[]", inStock: true, isPreorder: false,
  preorderClosed: false, preorderAvailableDate: "",
  isAuthor: false, isLimited: false, limitedEditionText: "", isActive: true,
  isSaleDisabled: false, isSoldOut: false, sortOrder: 0,
  characteristics: "[]",
  colors: "[]",
};

function slugify(text: string): string {
  return text.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

function ColorsEditor({ value, onChange }: { value: string; onChange: (val: string) => void }) {
  let colors: Array<{ name: string; hex: string }> = [];
  try { colors = JSON.parse(value || '[]'); } catch { colors = []; }

  const update = (newColors: typeof colors) => onChange(JSON.stringify(newColors));

  return (
    <div style={{ marginTop: '16px' }}>
      <label className="cms-label" style={{ display: 'block', marginBottom: '8px' }}>Цвета товара</label>
      {colors.length > 0 && (
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '8px' }}>
          {colors.map((c, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '6px', background: '#2a2a2a', borderRadius: '6px', padding: '4px 8px' }}>
              <span style={{ width: '16px', height: '16px', borderRadius: '50%', background: c.hex, display: 'inline-block', border: '1px solid rgba(255,255,255,0.2)' }} />
              <span style={{ fontSize: '12px', color: '#ddd' }}>{c.name}</span>
              <button type="button" onClick={() => update(colors.filter((_, j) => j !== i))} style={{ background: 'none', border: 'none', color: '#888', cursor: 'pointer', fontSize: '14px', lineHeight: 1, padding: 0 }}>×</button>
            </div>
          ))}
        </div>
      )}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 80px auto', gap: '6px', alignItems: 'center' }}>
        <input
          className="cms-input"
          placeholder="Название цвета (напр. Красный)"
          id="color-name-input"
          style={{ fontSize: '12px' }}
        />
        <input
          type="color"
          id="color-hex-input"
          defaultValue="#ffffff"
          style={{ width: '100%', height: '36px', borderRadius: '6px', border: '1px solid #444', cursor: 'pointer', background: 'none', padding: '2px' }}
        />
        <button
          type="button"
          className="cms-btn cms-btn-sm"
          onClick={() => {
            const nameInput = document.getElementById('color-name-input') as HTMLInputElement;
            const hexInput = document.getElementById('color-hex-input') as HTMLInputElement;
            const name = nameInput?.value.trim();
            const hex = hexInput?.value || '#ffffff';
            if (!name) return;
            update([...colors, { name, hex }]);
            if (nameInput) nameInput.value = '';
          }}
        >
          + Добавить
        </button>
      </div>
    </div>
  );
}

function CharacteristicsEditor({ value, onChange }: { value: string; onChange: (val: string) => void }) {
  let chars: Array<{ key: string; keyEn?: string; value: string; valueEn?: string }> = [];
  try { chars = JSON.parse(value || '[]'); } catch { chars = []; }

  const update = (newChars: typeof chars) => onChange(JSON.stringify(newChars));

  return (
    <div style={{ marginTop: "16px" }}>
      <label className="cms-label" style={{ display: "block", marginBottom: "8px" }}>Характеристики</label>
      {chars.map((c, i) => (
        <div key={i} style={{ border: "1px solid #333", borderRadius: "6px", padding: "10px", marginBottom: "8px" }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "6px", marginBottom: "6px" }}>
            <input
              className="cms-input"
              placeholder="Название (RU)"
              value={c.key}
              onChange={(e) => { const nc = chars.map((x, j) => j === i ? { ...x, key: e.target.value } : x); update(nc); }}
            />
            <input
              className="cms-input"
              placeholder="Name (EN)"
              value={c.keyEn || ""}
              onChange={(e) => { const nc = chars.map((x, j) => j === i ? { ...x, keyEn: e.target.value } : x); update(nc); }}
            />
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr auto", gap: "6px", alignItems: "center" }}>
            <input
              className="cms-input"
              placeholder="Значение (RU)"
              value={c.value}
              onChange={(e) => { const nc = chars.map((x, j) => j === i ? { ...x, value: e.target.value } : x); update(nc); }}
            />
            <input
              className="cms-input"
              placeholder="Value (EN)"
              value={c.valueEn || ""}
              onChange={(e) => { const nc = chars.map((x, j) => j === i ? { ...x, valueEn: e.target.value } : x); update(nc); }}
            />
            <button type="button" className="cms-btn cms-btn-xs cms-btn-danger" onClick={() => update(chars.filter((_, j) => j !== i))}>×</button>
          </div>
        </div>
      ))}
      <button type="button" className="cms-btn cms-btn-xs" onClick={() => update([...chars, { key: "", keyEn: "", value: "", valueEn: "" }])}>+ Добавить характеристику</button>
    </div>
  );
}

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
  const [archiveView, setArchiveView] = useState<"active" | "archived" | "all">("active");

  const getToken = useCallback(() => localStorage.getItem("admin_token"), []);

  const fetchProducts = useCallback(async () => {
    const token = getToken();
    if (!token) { router.push("/admin/login"); return; }
    const res = await fetch("/api/products?showAll=true&includeArchived=true");
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
      preorderClosed: product.preorderClosed || false,
      preorderAvailableDate: product.preorderAvailableDate ? new Date(product.preorderAvailableDate).toISOString().split('T')[0] : "",
      isAuthor: product.isAuthor, isLimited: product.isLimited || false, limitedEditionText: (product as unknown as { limitedEditionText?: string }).limitedEditionText || "", isActive: product.isActive,
      isSaleDisabled: product.isSaleDisabled || false,
      isSoldOut: product.isSoldOut || false,
      sortOrder: product.sortOrder,
      characteristics: product.characteristics || "[]",
      colors: product.colors || "[]",
    });
  };

  const openNew = () => { setIsNew(true); setSelected(null); setForm({ ...emptyProduct }); };
  const closeDialog = () => { setSelected(null); setIsNew(false); };

  const duplicateProduct = (product: Product) => {
    setIsNew(true);
    setSelected(null);
    setForm({
      name: product.name + " (copy)",
      nameRu: (product.nameRu || product.name) + " (копия)",
      slug: product.slug + "-copy",
      description: product.description,
      descriptionRu: product.descriptionRu || "",
      price: product.price,
      oldPrice: product.oldPrice,
      discount: product.discount,
      stock: product.stock,
      currency: product.currency,
      image: product.image,
      images: product.images,
      inStock: product.inStock,
      isPreorder: product.isPreorder,
      preorderClosed: product.preorderClosed || false,
      preorderAvailableDate: product.preorderAvailableDate ? new Date(product.preorderAvailableDate).toISOString().split('T')[0] : "",
      isAuthor: product.isAuthor,
      isLimited: product.isLimited || false,
      limitedEditionText: (product as unknown as { limitedEditionText?: string }).limitedEditionText || "",
      isActive: false,
      isSaleDisabled: product.isSaleDisabled || false,
      isSoldOut: product.isSoldOut || false,
      characteristics: product.characteristics || "[]",
      colors: product.colors || "[]",
      sortOrder: product.sortOrder,
    });
  };

  const toggleActive = async (product: Product) => {
    const token = getToken();
    if (!token) return;
    // Send full product data to avoid overwriting nameRu/descriptionRu with null
    await fetch(`/api/products/${product.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({
        name: product.name,
        nameRu: product.nameRu || "",
        slug: product.slug,
        description: product.description,
        descriptionRu: product.descriptionRu || "",
        price: product.price,
        oldPrice: product.oldPrice,
        discount: product.discount,
        stock: product.stock,
        currency: product.currency,
        image: product.image,
        images: product.images,
        inStock: product.inStock,
        isPreorder: product.isPreorder,
        preorderClosed: product.preorderClosed || false,
        preorderAvailableDate: product.preorderAvailableDate || null,
        isAuthor: product.isAuthor,
        isLimited: product.isLimited,
        limitedEditionText: (product as unknown as { limitedEditionText?: string }).limitedEditionText || "",
        isActive: !product.isActive,
        isSaleDisabled: product.isSaleDisabled || false,
        isSoldOut: product.isSoldOut || false,
        characteristics: product.characteristics || "[]",
        colors: product.colors || "[]",
        sortOrder: product.sortOrder,
      }),
    });
    fetchProducts();
  };

  const toggleOrderAvailability = async (product: Product) => {
    const token = getToken();
    if (!token) return;
    await fetch(`/api/products/${product.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({
        name: product.name, nameRu: product.nameRu || "", slug: product.slug,
        description: product.description, descriptionRu: product.descriptionRu || "",
        price: product.price, oldPrice: product.oldPrice, discount: product.discount,
        stock: product.stock, currency: product.currency, image: product.image,
        images: product.images, inStock: !product.inStock, isPreorder: product.isPreorder,
        preorderClosed: product.preorderClosed || false, preorderAvailableDate: product.preorderAvailableDate || null,
        isAuthor: product.isAuthor, isLimited: product.isLimited,
        limitedEditionText: (product as unknown as { limitedEditionText?: string }).limitedEditionText || "",
        isActive: product.isActive, isSaleDisabled: product.isSaleDisabled || false,
        isSoldOut: product.isSoldOut || false,
        characteristics: product.characteristics || "[]", colors: product.colors || "[]", sortOrder: product.sortOrder,
      }),
    });
    fetchProducts();
  };

  const toggleSaleDisabled = async (product: Product) => {
    const token = getToken();
    if (!token) return;
    await fetch(`/api/products/${product.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({
        name: product.name, nameRu: product.nameRu || "", slug: product.slug,
        description: product.description, descriptionRu: product.descriptionRu || "",
        price: product.price, oldPrice: product.oldPrice, discount: product.discount,
        stock: product.stock, currency: product.currency, image: product.image,
        images: product.images, inStock: product.inStock, isPreorder: product.isPreorder,
        preorderClosed: product.preorderClosed || false, preorderAvailableDate: product.preorderAvailableDate || null,
        isAuthor: product.isAuthor, isLimited: product.isLimited,
        limitedEditionText: (product as unknown as { limitedEditionText?: string }).limitedEditionText || "",
        isActive: product.isActive, isSaleDisabled: !product.isSaleDisabled,
        isSoldOut: product.isSoldOut || false,
        characteristics: product.characteristics || "[]", colors: product.colors || "[]", sortOrder: product.sortOrder,
      }),
    });
    fetchProducts();
  };

  const toggleSoldOut = async (product: Product) => {
    const token = getToken();
    if (!token) return;
    await fetch(`/api/products/${product.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({
        name: product.name, nameRu: product.nameRu || "", slug: product.slug,
        description: product.description, descriptionRu: product.descriptionRu || "",
        price: product.price, oldPrice: product.oldPrice, discount: product.discount,
        stock: product.stock, currency: product.currency, image: product.image,
        images: product.images, inStock: product.inStock, isPreorder: product.isPreorder,
        preorderClosed: product.preorderClosed || false, preorderAvailableDate: product.preorderAvailableDate || null,
        isAuthor: product.isAuthor, isLimited: product.isLimited,
        limitedEditionText: (product as unknown as { limitedEditionText?: string }).limitedEditionText || "",
        isActive: product.isActive, isSaleDisabled: product.isSaleDisabled || false,
        isSoldOut: !product.isSoldOut,
        characteristics: product.characteristics || "[]", colors: product.colors || "[]", sortOrder: product.sortOrder,
      }),
    });
    fetchProducts();
  };

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
        limitedEditionText: form.limitedEditionText,
        characteristics: form.characteristics,
        preorderAvailableDate: form.preorderAvailableDate ? new Date(form.preorderAvailableDate).toISOString() : null,
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
    notify(`${ids.length} товар(ов) обработано`);
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

  const addImageToProductForm = useCallback((url: string) => {
    const cleanUrl = url.trim();
    if (!cleanUrl) return;

    setForm((prev) => {
      const images = parseImageList(prev.images);
      const nextImages = images.includes(cleanUrl) ? images : [...images, cleanUrl];

      return {
        ...prev,
        image: prev.image || cleanUrl,
        images: toImageListJson(nextImages),
      };
    });
  }, []);

  const filtered = products.filter((p) => {
    if (archiveView === "active" && !p.isActive) return false;
    if (archiveView === "archived" && p.isActive) return false;
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
    if (filterType === "author" && !p.isAuthor) return false;
    return true;
  });

  const toggleAll = () => {
    if (checkedIds.size === filtered.length) setCheckedIds(new Set());
    else setCheckedIds(new Set(filtered.map((p) => p.id)));
  };

  const adminToken = typeof window !== "undefined" ? (getToken() || "") : "";

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
              <option value="author">Авторская</option>
            </select>
            <select className="cms-select" value={archiveView} onChange={(e) => setArchiveView(e.target.value as "active" | "archived" | "all")}>
              <option value="active">Активные</option>
              <option value="archived">Архив</option>
              <option value="all">Все</option>
            </select>
            {checkedIds.size > 0 && (
              <button className="cms-btn cms-btn-sm cms-btn-danger" onClick={() => setDeleteConfirm(Array.from(checkedIds))}>
                {archiveView === "archived" ? `Удалить навсегда (${checkedIds.size})` : `В архив (${checkedIds.size})`}
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
                  <th>Доступно</th>
                  <th title="Disable of Sale — кнопка «Скоро»">Скоро</th>
                  <th title="Плашка Sold Out на фото">Sold Out</th>
                  <th>Авторская</th>
                  <th style={{ width: 110 }}>Действия</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((p) => (
                  <tr key={p.id} className={checkedIds.has(p.id) ? "cms-row-selected" : ""}>
                    <td><input type="checkbox" checked={checkedIds.has(p.id)} onChange={() => toggleCheck(p.id)} /></td>
                    <td>
                      {p.image && <img src={p.image} alt="" style={{ width: 36, height: 36, borderRadius: 6, objectFit: "cover" }} />}
                    </td>
                    <td className="cms-td-bold">{p.nameRu || p.name}</td>
                    <td className="cms-td-mono" style={{ fontSize: "11px" }}>{p.slug}</td>
                    <td>{formatPrice(p.price)}</td>
                    <td>{p.discount > 0 ? <span className="cms-badge cms-badge-green">-{p.discount}%</span> : "\u2014"}</td>
                    <td>{p.stock}</td>
                    <td>
                      <button
                        className={`cms-badge ${p.isActive ? "cms-badge-green" : "cms-badge-red"}`}
                        style={{ cursor: "pointer", border: "none" }}
                        onClick={() => toggleActive(p)}
                        title="Переключить активность"
                      >
                        {p.isActive ? "Да" : "Нет"}
                      </button>
                    </td>
                    <td>
                      <button
                        className={`cms-badge ${p.inStock ? "cms-badge-green" : "cms-badge-red"}`}
                        style={{ cursor: "pointer", border: "none" }}
                        onClick={() => toggleOrderAvailability(p)}
                        title="Переключить доступность для заказа"
                      >
                        {p.inStock ? "Да" : "Нет"}
                      </button>
                    </td>
                    <td>
                      <button
                        className={`cms-badge ${p.isSaleDisabled ? "cms-badge-yellow" : "cms-badge-green"}`}
                        style={{ cursor: "pointer", border: "none" }}
                        onClick={() => toggleSaleDisabled(p)}
                        title="Disable of Sale — показывает «Скоро» вместо кнопки купить"
                      >
                        {p.isSaleDisabled ? "Скоро" : "—"}
                      </button>
                    </td>
                    <td>
                      <button
                        className={`cms-badge ${p.isSoldOut ? "cms-badge-red" : "cms-badge-green"}`}
                        style={{ cursor: "pointer", border: "none" }}
                        onClick={() => toggleSoldOut(p)}
                        title="Плашка Sold Out на фото товара"
                      >
                        {p.isSoldOut ? "Да" : "—"}
                      </button>
                    </td>
                    <td>{p.isAuthor ? <svg width="14" height="14" viewBox="0 0 24 24" fill="#9b59b6"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/></svg> : "\u2014"}</td>
                    <td>
                      <button className="cms-btn cms-btn-xs cms-btn-ghost" onClick={() => openProduct(p)} title="Редактировать">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 013 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>
                      </button>
                      <button className="cms-btn cms-btn-xs cms-btn-ghost" onClick={() => setDeleteConfirm([p.id])} title="Архив / удалить" style={{ color: "var(--cms-danger)" }}>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/></svg>
                      </button>
                    </td>
                  </tr>
                ))}
                {filtered.length === 0 && (
                  <tr><td colSpan={13} style={{ textAlign: "center", padding: "32px", color: "var(--cms-text-muted)" }}>Товары не найдены</td></tr>
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
                  Название (RU) — основное
                  <input className="cms-input" value={form.nameRu} onChange={(e) => {
                    const nameRu = e.target.value;
                    const updates: Partial<typeof form> = { nameRu };
                    if (isNew && (!form.slug || form.slug === slugify(form.nameRu))) {
                      updates.slug = slugify(nameRu);
                    }
                    setForm({ ...form, ...updates });
                  }} />
                </label>
                <label className="cms-label">
                  Name (EN) — перевод
                  <input className="cms-input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="English translation" />
                </label>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: "12px", marginBottom: "12px" }}>
                <label className="cms-label">
                  Slug
                  <input className="cms-input" value={form.slug} onChange={(e) => setForm({ ...form, slug: e.target.value })} />
                </label>
              </div>
              <label className="cms-label" style={{ marginBottom: "12px", display: "block" }}>
                Описание (RU) — основное
                <textarea className="cms-textarea" rows={3} value={form.descriptionRu} onChange={(e) => setForm({ ...form, descriptionRu: e.target.value })} style={{ width: "100%" }} />
              </label>
              <label className="cms-label" style={{ marginBottom: "12px", display: "block" }}>
                Description (EN) — перевод
                <textarea className="cms-textarea" rows={3} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} style={{ width: "100%" }} placeholder="English translation" />
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
                onUploaded={addImageToProductForm}
                token={adminToken}
                placeholder="Перетащите фото или нажмите для выбора"
              />
              <MultiImageUploader
                label="Дополнительные фото"
                value={form.images}
                onChange={(json) => setForm({ ...form, images: json })}
                mainImage={form.image}
                onMainImageChange={(url) => setForm((prev) => ({ ...prev, image: url }))}
                token={adminToken}
              />
              <div style={{ display: "flex", gap: "20px", flexWrap: "wrap" }}>
                {(["isActive", "inStock", "isPreorder", "isAuthor", "isLimited"] as const).map((key) => (
                  <label key={key} className="cms-checkbox-label">
                    <input type="checkbox" checked={form[key] as boolean} onChange={(e) => setForm({ ...form, [key]: e.target.checked })} />
                    {key === "isActive" ? "Активен" : key === "inStock" ? "В наличии" : key === "isPreorder" ? "Это предзаказ?" : key === "isAuthor" ? "Авторская" : "Лимитированный тираж"}
                  </label>
                ))}
                <label className="cms-checkbox-label">
                  <input type="checkbox" checked={form.isSaleDisabled} onChange={(e) => setForm({ ...form, isSaleDisabled: e.target.checked })} />
                  Скоро (кнопка «Скоро»)
                </label>
                <label className="cms-checkbox-label">
                  <input type="checkbox" checked={form.isSoldOut} onChange={(e) => setForm({ ...form, isSoldOut: e.target.checked })} />
                  Sold Out (плашка на фото)
                </label>
              </div>
              {form.isPreorder && (
                <div style={{ marginTop: "12px", padding: "12px", background: "rgba(232,96,28,0.08)", borderRadius: "8px", border: "1px solid rgba(232,96,28,0.25)" }}>
                  <label className="cms-checkbox-label" style={{ marginBottom: "10px", display: "flex", alignItems: "center", gap: "8px" }}>
                    <input type="checkbox" checked={form.preorderClosed} onChange={(e) => setForm({ ...form, preorderClosed: e.target.checked })} />
                    <span>Предзаказ закрыт</span>
                  </label>
                  <label className="cms-label" style={{ display: "block" }}>
                    Доступна к продаже с (дата показывается в сообщении)
                    <input
                      className="cms-input"
                      type="date"
                      value={form.preorderAvailableDate || ""}
                      onChange={(e) => setForm({ ...form, preorderAvailableDate: e.target.value })}
                      style={{ marginTop: "4px" }}
                    />
                  </label>
                </div>
              )}
              {form.isLimited && (
                <div style={{ marginTop: "12px" }}>
                  <label className="cms-label" style={{ display: "block", marginBottom: "6px" }}>Описание лимитированного тиража</label>
                  <textarea
                    className="cms-textarea"
                    rows={3}
                    style={{ width: "100%" }}
                    value={form.limitedEditionText || "Тираж ограничен — всего 30 экземпляров. Каждая колода будет сопровождаться номерным сертификатом, подтверждающим её уникальность и принадлежность к первому выпуску. Tenderly Vibe — это не массовая история."}
                    onChange={(e) => setForm({ ...form, limitedEditionText: e.target.value })}
                    onFocus={(e) => { if (!form.limitedEditionText) setForm({ ...form, limitedEditionText: e.target.value }); }}
                  />
                </div>
              )}

              {/* Colors editor */}
              <ColorsEditor
                value={form.colors}
                onChange={(val) => setForm(prev => ({ ...prev, colors: val }))}
              />

              {/* Characteristics editor */}
              <CharacteristicsEditor
                value={form.characteristics}
                onChange={(val) => setForm(prev => ({ ...prev, characteristics: val }))}
              />
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
              <h3>{archiveView === "archived" ? "Удаление из архива" : "Подтверждение архивации"}</h3>
              <button className="cms-modal-close" onClick={() => setDeleteConfirm(null)}>&times;</button>
            </div>
            <div className="cms-modal-body">
              <p style={{ fontSize: "14px" }}>
                {archiveView === "archived" ? (
                  <>Вы уверены, что хотите удалить навсегда <strong>{deleteConfirm.length}</strong> товар(ов) из архива?</>
                ) : (
                  <>Вы уверены, что хотите архивировать <strong>{deleteConfirm.length}</strong> товар(ов)?<br />Архивированные товары будут скрыты из витрины, но не будут удалены навсегда.</>
                )}
              </p>
            </div>
            <div className="cms-modal-actions">
              <button className="cms-btn cms-btn-danger" onClick={() => handleDelete(deleteConfirm)}>
                {archiveView === "archived" ? "Удалить навсегда" : "Архивировать"}
              </button>
              <button className="cms-btn" onClick={() => setDeleteConfirm(null)}>Отмена</button>
            </div>
          </div>
        </div>
      )}

      {notification && <div className="cms-toast">{notification}</div>}
    </div>
  );
}
