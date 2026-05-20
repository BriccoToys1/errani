"use client";

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
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

async function uploadProductImage(file: File, token: string): Promise<{ url: string; filename: string; fullUrl?: string }> {
  if (!isSupportedImageFile(file)) {
    throw new Error("Допустимы только JPG, JPEG, PNG, WEBP");
  }

  if (file.size > MAX_FILE_SIZE_BYTES) {
    throw new Error(`Размер файла больше ${MAX_FILE_SIZE_MB} MB`);
  }

  const formData = new FormData();
  formData.append("image", file);

  let lastMessage = "Ошибка загрузки изображения";
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    const response = await fetch("/api/admin/media/upload", {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
      body: formData,
    });
    const data = await response.json().catch(() => ({}));
    if (response.ok && data?.success && data?.url) {
      return {
        url: String(data.url),
        filename: String(data.filename || ""),
        fullUrl: data.fullUrl ? String(data.fullUrl) : undefined,
      };
    }
    lastMessage = data?.message || lastMessage;
    if (![429, 500, 502, 503, 504].includes(response.status) || attempt === 3) break;
    await new Promise((resolve) => setTimeout(resolve, 180 * attempt));
  }

  throw new Error(lastMessage);
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
  onSetMain,
  onAddToGallery,
  token,
  label,
  placeholder,
}: {
  value: string;
  onSetMain: (url: string) => void;
  onAddToGallery: (url: string) => void;
  token: string;
  label: string;
  placeholder?: string;
}) {
  const [isDragging, setIsDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [statusText, setStatusText] = useState("");
  const [lastUploadedUrl, setLastUploadedUrl] = useState("");
  const [errorText, setErrorText] = useState("");
  const [pendingPreviewUrl, setPendingPreviewUrl] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    return () => {
      if (pendingPreviewUrl) {
        URL.revokeObjectURL(pendingPreviewUrl);
      }
    };
  }, [pendingPreviewUrl]);

  const setPendingPreview = (file: File) => {
    if (pendingPreviewUrl) {
      URL.revokeObjectURL(pendingPreviewUrl);
    }
    setPendingPreviewUrl(URL.createObjectURL(file));
  };

  const uploadFile = async (file: File) => {
    if (!token) {
      alert("Сессия истекла. Войдите заново.");
      return;
    }

    setPendingPreview(file);
    setUploading(true);
    setStatusText("");
    setErrorText("");
    try {
      const uploaded = await uploadProductImage(file, token);
      setLastUploadedUrl(uploaded.url);
      setStatusText("Файл загружен и конвертирован в WEBP");
      if (!value) {
        onSetMain(uploaded.url);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "Ошибка загрузки файла";
      setStatusText(message);
      setErrorText(message);
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
          <button type="button" onClick={() => onSetMain("")} style={{ background: "none", border: "none", color: "#888", cursor: "pointer", fontSize: "16px" }}>×</button>
        </div>
      )}

      {pendingPreviewUrl && (
        <div style={{ marginBottom: "8px", border: "1px solid var(--cms-border)", borderRadius: "8px", padding: "8px" }}>
          <div style={{ fontSize: "11px", color: "var(--cms-text-muted)", marginBottom: "6px" }}>Превью перед загрузкой</div>
          <img src={pendingPreviewUrl} alt="preview" style={{ width: "100%", maxHeight: "220px", objectFit: "contain", borderRadius: "6px", background: "#0e1017" }} />
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

      {statusText && !errorText && (
        <div style={{ marginTop: "6px", fontSize: "12px", color: "var(--cms-text-muted)" }}>{statusText}</div>
      )}

      {errorText && (
        <div style={{ marginTop: "6px", fontSize: "12px", color: "#ff7d7d" }}>{errorText}</div>
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
                onSetMain(url);
              }}
            >
              Вставить как главное фото
            </button>
            <button
              type="button"
              className="cms-btn cms-btn-xs"
              onClick={() => {
                const url = lastUploadedUrl || value;
                if (!url) return;
                onAddToGallery(url);
              }}
            >
              Добавить в галерею
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
  const [uploadingIndex, setUploadingIndex] = useState<number | null>(null);
  const [lastUploadedUrl, setLastUploadedUrl] = useState("");
  const [statusText, setStatusText] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const replaceInputRef = useRef<HTMLInputElement>(null);
  const pendingReplaceIndex = useRef<number | null>(null);

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
    const next = images.includes(cleanUrl) ? images : [...images, cleanUrl];
    setImages(next);
    if (!mainImage) {
      onMainImageChange(next[0] || cleanUrl);
    }
  };

  const uploadFile = async (file: File) => {
    if (images.length >= MAX_IMAGES) { alert(`Максимум ${MAX_IMAGES} фотографий`); return; }
    if (!token) { alert("Сессия истекла. Войдите заново."); return; }

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

  const replaceImage = async (index: number, file: File) => {
    if (!token) { alert("Сессия истекла. Войдите заново."); return; }

    setUploadingIndex(index);
    try {
      const uploaded = await uploadProductImage(file, token);
      const next = [...images];
      const oldUrl = next[index];
      next[index] = uploaded.url;
      setImages(next);
      if (mainImage === oldUrl) {
        onMainImageChange(uploaded.url);
      }
      setStatusText("Фото заменено");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Ошибка загрузки файла";
      alert(message);
    } finally {
      setUploadingIndex(null);
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

    // Auto-sync primary to first image when first position changes
    if (index === 0 || targetIndex === 0) {
      onMainImageChange(next[0]);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const files = Array.from(e.dataTransfer.files);
    files.forEach(uploadFile);
  };

  const openReplace = (index: number) => {
    pendingReplaceIndex.current = index;
    replaceInputRef.current?.click();
  };

  return (
    <div style={{ marginBottom: "12px" }}>
      {/* Hidden input for replacing a specific image */}
      <input
        ref={replaceInputRef}
        type="file"
        accept={IMAGE_ACCEPT}
        style={{ display: "none" }}
        onChange={(e) => {
          const file = e.target.files?.[0];
          e.target.value = "";
          const idx = pendingReplaceIndex.current;
          if (file && idx !== null) replaceImage(idx, file);
          pendingReplaceIndex.current = null;
        }}
      />

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "6px" }}>
        <span className="cms-label">{label}</span>
        <span style={{ fontSize: "11px", color: "var(--cms-text-muted)" }}>{images.length} / {MAX_IMAGES}</span>
      </div>
      {images.length > 0 && (
        <div style={{ display: "grid", gap: "8px", marginBottom: "8px" }}>
          {images.map((img, i) => (
            <div key={`${img}-${i}`} style={{ display: "grid", gridTemplateColumns: "70px 1fr auto", gap: "8px", alignItems: "center", border: `1px solid ${i === 0 ? "rgba(155,135,245,0.4)" : "var(--cms-border)"}`, borderRadius: "8px", padding: "8px", background: i === 0 ? "rgba(155,135,245,0.05)" : "transparent" }}>
              <div style={{ position: "relative", cursor: "pointer" }} onClick={() => openReplace(i)} title="Нажмите для замены фото">
                <img
                  src={img}
                  alt=""
                  style={{ width: "70px", height: "70px", borderRadius: "6px", objectFit: "cover", display: "block" }}
                  onError={(e) => { (e.target as HTMLImageElement).style.opacity = "0.3"; }}
                />
                {uploadingIndex === i ? (
                  <div style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.6)", display: "flex", alignItems: "center", justifyContent: "center", borderRadius: "6px" }}>
                    <span style={{ color: "#9b87f5", fontSize: "11px" }}>...</span>
                  </div>
                ) : (
                  <div style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.45)", display: "flex", alignItems: "center", justifyContent: "center", borderRadius: "6px", opacity: 0, transition: "opacity 0.15s" }}
                    onMouseEnter={(e) => (e.currentTarget.style.opacity = "1")}
                    onMouseLeave={(e) => (e.currentTarget.style.opacity = "0")}
                  >
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2"><path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 013 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>
                  </div>
                )}
                {i === 0 && (
                  <div style={{ position: "absolute", bottom: "-2px", left: 0, right: 0, textAlign: "center", fontSize: "9px", background: "rgba(155,135,245,0.85)", color: "#fff", borderRadius: "0 0 4px 4px", padding: "1px 0" }}>
                    ПЕРВАЯ
                  </div>
                )}
              </div>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: "11px", color: "#ddd", wordBreak: "break-all", marginBottom: "5px" }}>{img}</div>
                <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
                  <button type="button" className="cms-btn cms-btn-xs" onClick={() => openReplace(i)} disabled={uploadingIndex === i}>
                    {uploadingIndex === i ? "Загрузка..." : "Заменить"}
                  </button>
                </div>
              </div>
              <div style={{ display: "grid", gap: "4px" }}>
                <button type="button" className="cms-btn cms-btn-xs" onClick={() => moveImage(i, -1)} disabled={i === 0} title="Вверх">↑</button>
                <button type="button" className="cms-btn cms-btn-xs" onClick={() => moveImage(i, 1)} disabled={i === images.length - 1} title="Вниз">↓</button>
                <button type="button" className="cms-btn cms-btn-xs cms-btn-danger" onClick={() => removeImage(i)}>×</button>
              </div>
            </div>
          ))}
        </div>
      )}

      {images.length > 0 && (
        <div style={{ fontSize: "11px", color: "var(--cms-text-muted)", marginBottom: "8px", padding: "5px 8px", background: "rgba(155,135,245,0.06)", borderRadius: "6px", border: "1px solid rgba(155,135,245,0.15)" }}>
          Первое фото в списке — это то, что отображается в каталоге и корзине. Используйте ↑↓ для сортировки.
        </div>
      )}

      {/* Add new photos drop zone */}
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
            <span style={{ color: "#888", fontSize: "12px" }}>+ Добавить фото (перетащите или нажмите)</span>
          )}
          <input
            ref={fileInputRef}
            type="file"
            accept={IMAGE_ACCEPT}
            multiple
            style={{ display: "none" }}
            onChange={(e) => {
              const files = Array.from(e.target.files || []);
              e.target.value = "";
              files.forEach(uploadFile);
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
              Добавить в галерею
            </button>
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
  shippingFee: number;
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

interface MediaLibraryItem {
  filename: string;
  relativePath: string;
  url: string;
  size: number;
  updatedAt: string;
}

const emptyProduct = {
  name: "", nameRu: "", slug: "", description: "", descriptionRu: "",
  price: 0, shippingFee: 0, oldPrice: null as number | null, discount: 0, stock: 0,
  currency: "RUB", image: "", images: "[]", inStock: true, isPreorder: false,
  preorderClosed: false, preorderAvailableDate: "",
  isAuthor: false, isLimited: false, limitedEditionText: "", isActive: true,
  isSaleDisabled: false, isSoldOut: false, sortOrder: 0,
  characteristics: "[]",
  colors: "[]",
};

const LOW_STOCK_THRESHOLD = 3;

type StockFilter = "all" | "inStock" | "outOfStock" | "preorder" | "lowStock";
type TypeFilter = "all" | "author" | "limited";
type StatusFilter = "all" | "onSale" | "soon" | "soldOut";
type SortMode = "updatedDesc" | "priceAsc" | "priceDesc" | "stockAsc" | "stockDesc" | "nameAsc";
type BulkAction =
  | "none"
  | "activate"
  | "deactivate"
  | "makeAvailable"
  | "makeUnavailable"
  | "markSoon"
  | "unmarkSoon"
  | "markSoldOut"
  | "unmarkSoldOut"
  | "archive";

function slugify(text: string): string {
  const map: Record<string, string> = {
    а: "a", б: "b", в: "v", г: "g", д: "d", е: "e", ё: "e", ж: "zh", з: "z", и: "i", й: "y",
    к: "k", л: "l", м: "m", н: "n", о: "o", п: "p", р: "r", с: "s", т: "t", у: "u", ф: "f",
    х: "h", ц: "ts", ч: "ch", ш: "sh", щ: "sch", ъ: "", ы: "y", ь: "", э: "e", ю: "yu", я: "ya",
  };
  const transliterated = text
    .toLowerCase()
    .split("")
    .map((ch) => map[ch] ?? ch)
    .join("");
  return transliterated.replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

type ColorEntry = { name: string; nameEn?: string; hex: string; stock?: number };

function ColorsEditor({ value, onChange }: { value: string; onChange: (val: string) => void }) {
  const [colorNameRu, setColorNameRu] = useState("");
  const [colorNameEn, setColorNameEn] = useState("");
  const [colorHex, setColorHex] = useState("#ffffff");
  const [colorStock, setColorStock] = useState<number | "">("");

  let colors: ColorEntry[] = [];
  try {
    const parsed = JSON.parse(value || '[]');
    if (Array.isArray(parsed)) {
      colors = parsed
        .map((item) => ({
          name: String(item?.name || '').trim(),
          nameEn: String(item?.nameEn || '').trim() || undefined,
          hex: String(item?.hex || '#ffffff').trim(),
          stock: typeof item?.stock === 'number' ? item.stock : undefined,
        }))
        .filter((item) => item.name && item.hex);
    }
  } catch {
    colors = [];
  }

  const update = (newColors: ColorEntry[]) => onChange(JSON.stringify(newColors));

  const updateColorStock = (index: number, stock: number | "") => {
    const newColors = [...colors];
    newColors[index] = {
      ...newColors[index],
      stock: stock === "" ? undefined : Math.max(0, stock),
    };
    update(newColors);
  };

  const hasColorStock = colors.some(c => typeof c.stock === 'number');

  return (
    <div style={{ marginTop: '16px' }}>
      <label className="cms-label" style={{ display: 'block', marginBottom: '8px' }}>
        Цвета товара
        {hasColorStock && (
          <span style={{ marginLeft: '8px', fontSize: '11px', color: 'var(--cms-text-muted)', fontWeight: 400 }}>
            — остатки по цветам
          </span>
        )}
      </label>
      {colors.length > 0 && (
        <div style={{ marginBottom: '10px', border: '1px solid var(--cms-border)', borderRadius: '8px', overflow: 'hidden' }}>
          {colors.map((c, i) => (
            <div key={i} style={{ display: 'grid', gridTemplateColumns: '24px 1fr 1fr 110px 28px', gap: '6px', alignItems: 'center', padding: '7px 10px', borderBottom: i < colors.length - 1 ? '1px solid var(--cms-border)' : 'none', background: i % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.02)' }}>
              <span style={{ width: '18px', height: '18px', borderRadius: '50%', background: c.hex, display: 'inline-block', border: '1px solid rgba(255,255,255,0.2)', flexShrink: 0 }} />
              <span style={{ fontSize: '12px', color: '#ddd', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {c.name}{c.nameEn ? ` / ${c.nameEn}` : ''}
              </span>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span style={{ fontSize: '11px', color: 'var(--cms-text-muted)', whiteSpace: 'nowrap' }}>Остаток:</span>
                <input
                  type="number"
                  min="0"
                  className="cms-input"
                  value={c.stock ?? ""}
                  placeholder="—"
                  onChange={(e) => updateColorStock(i, e.target.value === "" ? "" : Number(e.target.value))}
                  style={{ width: '60px', fontSize: '12px', padding: '2px 6px', height: '28px' }}
                />
              </div>
              <div />
              <button type="button" onClick={() => update(colors.filter((_, j) => j !== i))} style={{ background: 'none', border: 'none', color: '#666', cursor: 'pointer', fontSize: '16px', lineHeight: 1, padding: 0 }}>×</button>
            </div>
          ))}
        </div>
      )}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 70px 80px auto', gap: '6px', alignItems: 'center' }}>
        <input
          className="cms-input"
          placeholder="Название (RU)"
          value={colorNameRu}
          onChange={(e) => setColorNameRu(e.target.value)}
          style={{ fontSize: '12px' }}
        />
        <input
          className="cms-input"
          placeholder="Name (EN)"
          value={colorNameEn}
          onChange={(e) => setColorNameEn(e.target.value)}
          style={{ fontSize: '12px' }}
        />
        <input
          type="color"
          value={colorHex}
          onChange={(e) => setColorHex(e.target.value)}
          style={{ width: '100%', height: '36px', borderRadius: '6px', border: '1px solid #444', cursor: 'pointer', background: 'none', padding: '2px' }}
        />
        <input
          type="number"
          min="0"
          className="cms-input"
          placeholder="Остаток"
          value={colorStock}
          onChange={(e) => setColorStock(e.target.value === "" ? "" : Number(e.target.value))}
          style={{ fontSize: '12px' }}
        />
        <button
          type="button"
          className="cms-btn cms-btn-sm"
          onClick={() => {
            const name = colorNameRu.trim();
            const nameEn = colorNameEn.trim();
            if (!name) return;
            update([...colors, {
              name,
              nameEn: nameEn || undefined,
              hex: colorHex,
              stock: colorStock === "" ? undefined : Number(colorStock),
            }]);
            setColorNameRu('');
            setColorNameEn('');
            setColorStock("");
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
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [filterStock, setFilterStock] = useState<StockFilter>("all");
  const [filterType, setFilterType] = useState<TypeFilter>("all");
  const [filterStatus, setFilterStatus] = useState<StatusFilter>("all");
  const [sortMode, setSortMode] = useState<SortMode>("updatedDesc");
  const [bulkAction, setBulkAction] = useState<BulkAction>("none");
  const [bulkApplying, setBulkApplying] = useState(false);
  const [archiveView, setArchiveView] = useState<"active" | "archived" | "all">("active");
  const [mediaPickerTarget, setMediaPickerTarget] = useState<"main" | "gallery" | null>(null);
  const [mediaItems, setMediaItems] = useState<MediaLibraryItem[]>([]);
  const [mediaLoading, setMediaLoading] = useState(false);
  const [mediaSearch, setMediaSearch] = useState("");

  const getToken = useCallback(() => localStorage.getItem("admin_token"), []);
  const notify = useCallback((msg: string) => {
    setNotification(msg);
    setTimeout(() => setNotification(""), 3000);
  }, []);

  const requestJson = useCallback(async (
    url: string,
    init: RequestInit = {},
    attempts = 3
  ): Promise<{ ok: boolean; status: number; data: unknown }> => {
    const retriableStatus = new Set([429, 500, 502, 503, 504]);
    let lastStatus = 0;

    for (let attempt = 1; attempt <= attempts; attempt += 1) {
      try {
        const response = await fetch(url, { cache: "no-store", ...init });
        lastStatus = response.status;
        const data = await response.json().catch(() => ({}));
        if (response.ok) return { ok: true, status: response.status, data };

        if (!retriableStatus.has(response.status) || attempt === attempts) {
          return { ok: false, status: response.status, data };
        }
      } catch {
        if (attempt === attempts) {
          return { ok: false, status: lastStatus || 0, data: { error: "Network error" } };
        }
      }
      await new Promise((resolve) => setTimeout(resolve, 180 * attempt));
    }

    return { ok: false, status: lastStatus || 0, data: { error: "Request failed" } };
  }, []);

  const fetchProducts = useCallback(async () => {
    const token = getToken();
    if (!token) { router.push("/admin/login"); return; }
    const result = await requestJson("/api/products?showAll=true&includeArchived=true");
    if (result.ok && Array.isArray(result.data)) {
      const next = result.data as Product[];
      setProducts((prev) => {
        if (next.length === 0 && prev.length > 0) {
          notify("Временный сбой чтения. Показаны последние сохранённые данные.");
          return prev;
        }
        return next;
      });
    } else {
      notify("Не удалось загрузить товары. Повторите ещё раз.");
    }
    setLoading(false);
  }, [getToken, notify, requestJson, router]);

  const fetchMediaItems = useCallback(async () => {
    const token = getToken();
    if (!token) return;
    setMediaLoading(true);
    try {
      const result = await requestJson("/api/admin/upload/images", {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = result.data as { success?: boolean; items?: unknown[] };
      if (result.ok && data?.success && Array.isArray(data.items)) {
        const normalized: MediaLibraryItem[] = data.items
          .filter((item): item is Record<string, unknown> => typeof item === "object" && item !== null)
          .map((item) => ({
            filename: String(item.filename || ""),
            relativePath: String(item.relativePath || ""),
            url: String(item.url || ""),
            size: Number(item.size || 0),
            updatedAt: String(item.updatedAt || new Date().toISOString()),
          }));
        setMediaItems(normalized);
      }
    } catch {
      // no-op
    } finally {
      setMediaLoading(false);
    }
  }, [getToken, requestJson]);

  const buildProductPayload = useCallback((product: Product, overrides: Record<string, unknown> = {}) => ({
    name: product.name,
    nameRu: product.nameRu || "",
    slug: product.slug,
    description: product.description,
    descriptionRu: product.descriptionRu || "",
    price: product.price,
    shippingFee: product.shippingFee ?? 0,
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
    isLimited: product.isLimited || false,
    limitedEditionText: (product as unknown as { limitedEditionText?: string }).limitedEditionText || "",
    isActive: product.isActive,
    isSaleDisabled: product.isSaleDisabled || false,
    isSoldOut: product.isSoldOut || false,
    characteristics: product.characteristics || "[]",
    colors: product.colors || "[]",
    sortOrder: product.sortOrder,
    ...overrides,
  }), []);

  const updateProductById = useCallback(async (product: Product, overrides: Record<string, unknown>) => {
    const token = getToken();
    if (!token) return false;

    const result = await requestJson(`/api/products/${product.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify(buildProductPayload(product, overrides)),
    });

    if (!result.ok) {
      const err = result.data as { error?: string };
      notify(err?.error || "Не удалось сохранить изменения");
      return false;
    }
    return true;
  }, [buildProductPayload, getToken, notify, requestJson]);

  useEffect(() => {
    const token = getToken();
    if (!token) { router.push("/admin/login"); return; }
    fetchProducts();
  }, [fetchProducts, getToken, router]);

  useEffect(() => {
    const timer = setTimeout(() => {
      setSearch(searchInput.trim().toLowerCase());
    }, 180);
    return () => clearTimeout(timer);
  }, [searchInput]);

  const openProduct = (product: Product) => {
    setSelected(product);
    setIsNew(false);
    setForm({
      name: product.name, nameRu: product.nameRu || "", slug: product.slug,
      description: product.description, descriptionRu: product.descriptionRu || "",
      price: product.price, shippingFee: product.shippingFee ?? 0, oldPrice: product.oldPrice, discount: product.discount,
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
      shippingFee: product.shippingFee ?? 0,
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
    const ok = await updateProductById(product, { isActive: !product.isActive });
    if (ok) fetchProducts();
  };

  const toggleOrderAvailability = async (product: Product) => {
    const ok = await updateProductById(product, { inStock: !product.inStock });
    if (ok) fetchProducts();
  };

  const toggleSaleDisabled = async (product: Product) => {
    const ok = await updateProductById(product, { isSaleDisabled: !product.isSaleDisabled });
    if (ok) fetchProducts();
  };

  const toggleSoldOut = async (product: Product) => {
    const ok = await updateProductById(product, { isSoldOut: !product.isSoldOut });
    if (ok) fetchProducts();
  };

  const restoreFromArchive = async (product: Product) => {
    const ok = await updateProductById(product, { isActive: true });
    if (ok) fetchProducts();
  };

  const getProductStatusBadges = useCallback((product: Product) => {
    const badges: Array<{ label: string; cls: string }> = [];
    if (!product.isActive) badges.push({ label: "Архив", cls: "cms-badge-red" });
    if (product.isPreorder) badges.push({ label: "Предзаказ", cls: "cms-badge-blue" });
    if (product.isSaleDisabled) badges.push({ label: "Скоро", cls: "cms-badge-yellow" });
    if (product.isSoldOut) badges.push({ label: "Sold Out", cls: "cms-badge-red" });
    if (product.discount > 0) badges.push({ label: `-${product.discount}%`, cls: "cms-badge-green" });
    if (product.isAuthor) badges.push({ label: "Авторский", cls: "cms-badge-blue" });
    if (product.isLimited) badges.push({ label: "Limited", cls: "cms-badge-yellow" });
    if (product.inStock && product.stock <= LOW_STOCK_THRESHOLD && !product.isSaleDisabled && !product.isSoldOut) {
      badges.push({ label: `Мало: ${product.stock}`, cls: "cms-badge-red" });
    }
    if (badges.length === 0 && product.inStock) {
      badges.push({ label: "В продаже", cls: "cms-badge-green" });
    }
    return badges;
  }, []);

  const applyBulkAction = useCallback(async () => {
    const ids = Array.from(checkedIds);
    if (ids.length === 0) {
      notify("Выберите товары для массового действия");
      return;
    }
    if (bulkAction === "none") {
      notify("Выберите действие");
      return;
    }
    if (bulkAction === "archive") {
      setDeleteConfirm(ids);
      return;
    }

    const selectedProducts = products.filter((p) => checkedIds.has(p.id));
    if (selectedProducts.length === 0) {
      notify("Выбранные товары не найдены");
      return;
    }

    const toOverrides = (action: BulkAction): Record<string, unknown> => {
      switch (action) {
        case "activate": return { isActive: true };
        case "deactivate": return { isActive: false };
        case "makeAvailable": return { inStock: true };
        case "makeUnavailable": return { inStock: false };
        case "markSoon": return { isSaleDisabled: true };
        case "unmarkSoon": return { isSaleDisabled: false };
        case "markSoldOut": return { isSoldOut: true };
        case "unmarkSoldOut": return { isSoldOut: false };
        default: return {};
      }
    };

    const overrides = toOverrides(bulkAction);
    setBulkApplying(true);
    let okCount = 0;
    for (const product of selectedProducts) {
      const ok = await updateProductById(product, overrides);
      if (ok) okCount += 1;
    }
    setBulkApplying(false);
    setBulkAction("none");
    setCheckedIds(new Set());
    await fetchProducts();
    notify(okCount === selectedProducts.length ? `Обновлено: ${okCount}` : `Обновлено: ${okCount}, ошибок: ${selectedProducts.length - okCount}`);
  }, [bulkAction, checkedIds, fetchProducts, notify, products, updateProductById]);

  const handleSave = async () => {
    setSaving(true);
    const token = getToken();
    const url = isNew ? "/api/products" : `/api/products/${selected!.id}`;
    const method = isNew ? "POST" : "PUT";
    const result = await requestJson(url, {
      method,
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({
        ...form,
        price: Number(form.price),
        shippingFee: Number(form.shippingFee) || 0,
        oldPrice: form.oldPrice !== null && form.oldPrice !== undefined
          ? Number(form.oldPrice)
          : null,
        discount: Number(form.discount),
        stock: Number(form.stock),
        sortOrder: Number(form.sortOrder),
        limitedEditionText: form.limitedEditionText,
        characteristics: form.characteristics,
        colors: form.colors,
        preorderAvailableDate: form.preorderAvailableDate ? new Date(form.preorderAvailableDate).toISOString() : null,
      }),
    });
    if (result.ok) {
      const saved = result.data as Product;
      setProducts((prev) => {
        if (isNew) return [saved, ...prev];
        return prev.map((p) => (p.id === selected?.id ? saved : p));
      });
      notify(isNew ? "Product created" : "Product updated");
      closeDialog();
      fetchProducts();
    } else {
      const err = result.data as { error?: string };
      notify(`Error: ${err.error || "Unknown error"}`);
    }
    setSaving(false);
  };

  const handleDelete = async (ids: string[]) => {
    const token = getToken();
    const hardDelete = archiveView === "archived";
    let failed = 0;
    for (const id of ids) {
      const result = await requestJson(`/api/products/${id}${hardDelete ? "?hard=true" : ""}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!result.ok) failed += 1;
    }
    notify(failed > 0 ? `Обработано: ${ids.length - failed}, ошибок: ${failed}` : `${ids.length} товар(ов) обработано`);
    if (failed < ids.length) {
      setProducts((prev) => prev.filter((p) => !ids.includes(p.id)));
    }
    setDeleteConfirm(null);
    setCheckedIds(new Set());
    fetchProducts();
  };

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

  const openMediaPicker = useCallback(async (target: "main" | "gallery") => {
    setMediaPickerTarget(target);
    setMediaSearch("");
    await fetchMediaItems();
  }, [fetchMediaItems]);

  const closeMediaPicker = useCallback(() => {
    setMediaPickerTarget(null);
    setMediaSearch("");
  }, []);

  const selectMediaImage = useCallback((url: string) => {
    if (!url) return;
    if (mediaPickerTarget === "main") {
      setForm((prev) => ({ ...prev, image: url }));
    } else {
      addImageToProductForm(url);
    }
    closeMediaPicker();
  }, [addImageToProductForm, closeMediaPicker, mediaPickerTarget]);

  const filteredMediaItems = mediaItems.filter((item) => {
    const q = mediaSearch.trim().toLowerCase();
    if (!q) return true;
    return item.filename.toLowerCase().includes(q) || item.relativePath.toLowerCase().includes(q);
  });

  const catalogStats = useMemo(() => {
    const active = products.filter((p) => p.isActive).length;
    const archived = products.length - active;
    const onSale = products.filter((p) => p.isActive && p.inStock && !p.isSaleDisabled && !p.isSoldOut).length;
    const soon = products.filter((p) => p.isSaleDisabled).length;
    const soldOut = products.filter((p) => p.isSoldOut).length;
    const lowStock = products.filter((p) => p.inStock && p.stock <= LOW_STOCK_THRESHOLD && !p.isSoldOut).length;
    return { active, archived, onSale, soon, soldOut, lowStock };
  }, [products]);

  const filtered = useMemo(() => {
    const rows = products.filter((p) => {
      if (archiveView === "active" && !p.isActive) return false;
      if (archiveView === "archived" && p.isActive) return false;

      if (search) {
        const haystack = [p.name, p.nameRu, p.slug, p.description, p.descriptionRu].join(" ").toLowerCase();
        if (!haystack.includes(search)) return false;
      }

      if (filterStock === "inStock" && !p.inStock) return false;
      if (filterStock === "outOfStock" && p.inStock) return false;
      if (filterStock === "preorder" && !p.isPreorder) return false;
      if (filterStock === "lowStock" && !(p.inStock && p.stock <= LOW_STOCK_THRESHOLD)) return false;

      if (filterType === "author" && !p.isAuthor) return false;
      if (filterType === "limited" && !p.isLimited) return false;

      if (filterStatus === "onSale" && !(p.isActive && p.inStock && !p.isSaleDisabled && !p.isSoldOut)) return false;
      if (filterStatus === "soon" && !p.isSaleDisabled) return false;
      if (filterStatus === "soldOut" && !p.isSoldOut) return false;

      return true;
    });

    rows.sort((a, b) => {
      switch (sortMode) {
        case "priceAsc": return a.price - b.price;
        case "priceDesc": return b.price - a.price;
        case "stockAsc": return a.stock - b.stock;
        case "stockDesc": return b.stock - a.stock;
        case "nameAsc": return (a.nameRu || a.name).localeCompare(b.nameRu || b.name, "ru");
        case "updatedDesc":
        default:
          return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      }
    });
    return rows;
  }, [archiveView, filterStatus, filterStock, filterType, products, search, sortMode]);

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
            <button className="cms-btn cms-btn-sm cms-btn-primary" onClick={openNew} title="Добавить">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
            </button>
            <a href="/api/admin/export?type=products&format=xls" className="cms-btn cms-btn-sm" download title="Импорт/Экспорт">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M8 3H5a2 2 0 00-2 2v3"/><path d="M16 3h3a2 2 0 012 2v3"/><path d="M8 21H5a2 2 0 01-2-2v-3"/><path d="M16 21h3a2 2 0 002-2v-3"/><path d="M12 8v8"/><path d="M8 12h8"/></svg>
            </a>
            <button className="cms-btn cms-btn-sm" onClick={() => { setLoading(true); fetchProducts(); }} title="Обновить">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M23 4v6h-6M1 20v-6h6"/><path d="M3.51 9a9 9 0 0114.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0020.49 15"/></svg>
            </button>
          </div>
        </div>

        <div className="cms-content cms-products-content">
          <div className="cms-products-kpi-grid">
            <button className={`cms-products-kpi-card ${archiveView === "active" ? "active" : ""}`} onClick={() => setArchiveView("active")}>
              <span className="cms-products-kpi-label">Активные</span>
              <span className="cms-products-kpi-value">{catalogStats.active}</span>
            </button>
            <button className={`cms-products-kpi-card ${filterStatus === "onSale" ? "active" : ""}`} onClick={() => setFilterStatus(filterStatus === "onSale" ? "all" : "onSale")}>
              <span className="cms-products-kpi-label">В продаже</span>
              <span className="cms-products-kpi-value">{catalogStats.onSale}</span>
            </button>
            <button className={`cms-products-kpi-card ${filterStatus === "soon" ? "active" : ""}`} onClick={() => setFilterStatus(filterStatus === "soon" ? "all" : "soon")}>
              <span className="cms-products-kpi-label">Скоро</span>
              <span className="cms-products-kpi-value">{catalogStats.soon}</span>
            </button>
            <button className={`cms-products-kpi-card ${filterStatus === "soldOut" ? "active" : ""}`} onClick={() => setFilterStatus(filterStatus === "soldOut" ? "all" : "soldOut")}>
              <span className="cms-products-kpi-label">Sold Out</span>
              <span className="cms-products-kpi-value">{catalogStats.soldOut}</span>
            </button>
            <button className={`cms-products-kpi-card ${filterStock === "lowStock" ? "active" : ""}`} onClick={() => setFilterStock(filterStock === "lowStock" ? "all" : "lowStock")}>
              <span className="cms-products-kpi-label">Низкий остаток</span>
              <span className="cms-products-kpi-value">{catalogStats.lowStock}</span>
            </button>
          </div>

          <div className="cms-products-toolbar">
            <div className="cms-products-toolbar-row">
              <input
                className="cms-input cms-products-search"
                placeholder="Поиск по названию, slug, описанию..."
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
              />
              <select className="cms-select cms-products-select" value={filterStock} onChange={(e) => setFilterStock(e.target.value as StockFilter)}>
                <option value="all">Наличие: все</option>
                <option value="inStock">Только в наличии</option>
                <option value="outOfStock">Нет в наличии</option>
                <option value="preorder">Только предзаказ</option>
                <option value="lowStock">Низкий остаток</option>
              </select>
              <select className="cms-select cms-products-select" value={filterType} onChange={(e) => setFilterType(e.target.value as TypeFilter)}>
                <option value="all">Тип: все</option>
                <option value="author">Авторские</option>
                <option value="limited">Лимитированные</option>
              </select>
              <select className="cms-select cms-products-select" value={filterStatus} onChange={(e) => setFilterStatus(e.target.value as StatusFilter)}>
                <option value="all">Статус: все</option>
                <option value="onSale">В продаже</option>
                <option value="soon">Скоро</option>
                <option value="soldOut">Sold Out</option>
              </select>
              <select className="cms-select cms-products-select" value={archiveView} onChange={(e) => setArchiveView(e.target.value as "active" | "archived" | "all")}>
                <option value="active">Активные</option>
                <option value="archived">Архив</option>
                <option value="all">Все</option>
              </select>
              <select className="cms-select cms-products-select" value={sortMode} onChange={(e) => setSortMode(e.target.value as SortMode)}>
                <option value="updatedDesc">Сначала новые</option>
                <option value="nameAsc">По имени</option>
                <option value="priceAsc">Цена ↑</option>
                <option value="priceDesc">Цена ↓</option>
                <option value="stockAsc">Остаток ↑</option>
                <option value="stockDesc">Остаток ↓</option>
              </select>
            </div>

            <div className="cms-products-toolbar-row">
              <div className="cms-products-results">
                Показано: <strong>{filtered.length}</strong> из {products.length}
              </div>
              <button
                className="cms-btn cms-btn-sm"
                onClick={() => {
                  setSearchInput("");
                  setSearch("");
                  setFilterStock("all");
                  setFilterType("all");
                  setFilterStatus("all");
                  setSortMode("updatedDesc");
                  setArchiveView("active");
                }}
              >
                Сбросить фильтры
              </button>
              <div className="cms-products-bulk">
                <select
                  className="cms-select cms-products-select"
                  value={bulkAction}
                  onChange={(e) => setBulkAction(e.target.value as BulkAction)}
                  disabled={bulkApplying}
                >
                  <option value="none">Быстрое действие...</option>
                  <option value="activate">Сделать активными</option>
                  <option value="deactivate">Снять с витрины</option>
                  <option value="makeAvailable">Открыть для заказа</option>
                  <option value="makeUnavailable">Закрыть для заказа</option>
                  <option value="markSoon">Пометить «Скоро»</option>
                  <option value="unmarkSoon">Снять «Скоро»</option>
                  <option value="markSoldOut">Поставить Sold Out</option>
                  <option value="unmarkSoldOut">Снять Sold Out</option>
                  <option value="archive">{archiveView === "archived" ? "Удалить выбранные" : "Архивировать выбранные"}</option>
                </select>
                <button className="cms-btn cms-btn-sm cms-btn-primary" onClick={applyBulkAction} disabled={bulkApplying || checkedIds.size === 0}>
                  {bulkApplying ? "Применяем..." : `Применить (${checkedIds.size})`}
                </button>
              </div>
            </div>
          </div>

          <div className="cms-table-wrap cms-products-desktop-table">
            <table className="cms-table">
              <thead>
                <tr>
                  <th style={{ width: 36 }}><input type="checkbox" checked={checkedIds.size === filtered.length && filtered.length > 0} onChange={toggleAll} /></th>
                  <th style={{ width: 54 }}>Фото</th>
                  <th>Товар</th>
                  <th>Статусы</th>
                  <th>Цена</th>
                  <th>Остаток</th>
                  <th style={{ width: 220 }}>Быстрые действия</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((p) => (
                  <tr key={p.id} className={checkedIds.has(p.id) ? "cms-row-selected" : ""}>
                    <td><input type="checkbox" checked={checkedIds.has(p.id)} onChange={() => toggleCheck(p.id)} /></td>
                    <td>
                      {p.image ? (
                        <img
                          src={p.image}
                          alt=""
                          className="cms-products-thumb"
                          title="Нажмите для редактирования"
                          onClick={() => openProduct(p)}
                        />
                      ) : (
                        <div className="cms-products-thumb cms-products-thumb-empty">—</div>
                      )}
                    </td>
                    <td>
                      <div className="cms-td-bold">{p.nameRu || p.name}</div>
                      <div className="cms-td-mono" style={{ fontSize: "11px", marginTop: "2px" }}>{p.slug}</div>
                    </td>
                    <td>
                      <div className="cms-products-badges">
                        {getProductStatusBadges(p).map((badge, index) => (
                          <span key={`${badge.label}-${index}`} className={`cms-badge ${badge.cls}`}>{badge.label}</span>
                        ))}
                      </div>
                    </td>
                    <td>
                      <div>{formatPrice(p.price)}</div>
                      {p.oldPrice && p.oldPrice > p.price && (
                        <div style={{ fontSize: "11px", color: "var(--cms-text-muted)", textDecoration: "line-through" }}>{formatPrice(p.oldPrice)}</div>
                      )}
                    </td>
                    <td style={{ fontWeight: 700 }}>{p.stock}</td>
                    <td>
                      <div className="cms-products-row-actions">
                        <button className="cms-btn cms-btn-xs" onClick={() => openProduct(p)} title="Изменить">
                          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 013 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>
                        </button>
                        <button className="cms-btn cms-btn-xs" onClick={() => duplicateProduct(p)} title="Дубль">
                          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="9" y="9" width="13" height="13" rx="2"/><rect x="2" y="2" width="13" height="13" rx="2"/></svg>
                        </button>
                        <button className="cms-btn cms-btn-xs" onClick={() => (p.isActive ? toggleActive(p) : restoreFromArchive(p))} title={p.isActive ? "Скрыть" : "Вернуть"}>
                          {p.isActive ? <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17.94 17.94A10.94 10.94 0 0112 20C7 20 2.73 16.89 1 12c.82-2.33 2.23-4.31 4.06-5.94M9.9 4.24A10.95 10.95 0 0112 4c5 0 9.27 3.11 11 8a11.81 11.81 0 01-2.16 3.19"/><line x1="1" y1="1" x2="23" y2="23"/></svg> : <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>}
                        </button>
                        <button className="cms-btn cms-btn-xs cms-btn-danger" onClick={() => setDeleteConfirm([p.id])} title={archiveView === "archived" ? "Удалить" : "В архив"}>
                          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/></svg>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {filtered.length === 0 && (
                  <tr><td colSpan={7} style={{ textAlign: "center", padding: "32px", color: "var(--cms-text-muted)" }}>Товары не найдены</td></tr>
                )}
              </tbody>
            </table>
          </div>

          <div className="cms-products-mobile-list">
            {filtered.map((p) => (
              <div key={p.id} className="cms-products-mobile-card">
                <div className="cms-products-mobile-head">
                  <label style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                    <input type="checkbox" checked={checkedIds.has(p.id)} onChange={() => toggleCheck(p.id)} />
                    {p.image ? <img src={p.image} alt="" className="cms-products-thumb" /> : <div className="cms-products-thumb cms-products-thumb-empty">—</div>}
                  </label>
                  <div style={{ flex: 1 }}>
                    <div className="cms-td-bold">{p.nameRu || p.name}</div>
                    <div className="cms-td-mono" style={{ fontSize: "11px" }}>{p.slug}</div>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <div style={{ fontWeight: 700 }}>{formatPrice(p.price)}</div>
                    <button className="cms-btn cms-btn-xs" onClick={() => openProduct(p)}>Остаток: {p.stock}</button>
                  </div>
                </div>
                <div className="cms-products-badges">
                  {getProductStatusBadges(p).map((badge, index) => (
                    <span key={`${p.id}-${badge.label}-${index}`} className={`cms-badge ${badge.cls}`}>{badge.label}</span>
                  ))}
                </div>
                <div className="cms-products-row-actions">
                  <button className="cms-btn cms-btn-xs cms-btn-primary" onClick={() => openProduct(p)}>Редактировать</button>
                  <button className="cms-btn cms-btn-xs" onClick={() => duplicateProduct(p)}>Дубль</button>
                  <button className="cms-btn cms-btn-xs" onClick={() => toggleSaleDisabled(p)}>{p.isSaleDisabled ? "Снять «Скоро»" : "Поставить «Скоро»"}</button>
                  <button className="cms-btn cms-btn-xs" onClick={() => toggleSoldOut(p)}>{p.isSoldOut ? "Снять Sold Out" : "Поставить Sold Out"}</button>
                  <button className="cms-btn cms-btn-xs cms-btn-danger" onClick={() => setDeleteConfirm([p.id])}>
                    {archiveView === "archived" ? "Удалить" : "В архив"}
                  </button>
                </div>
              </div>
            ))}
            {filtered.length === 0 && (
              <div className="cms-products-mobile-empty">Товары не найдены</div>
            )}
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
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr 1fr", gap: "12px", marginBottom: "12px" }}>
                <label className="cms-label">
                  Цена
                  <input className="cms-input" type="number" value={form.price} onChange={(e) => setForm({ ...form, price: Number(e.target.value) })} />
                </label>
                <label className="cms-label">
                  Доставка (товар), ₽
                  <input className="cms-input" type="number" min="0" value={form.shippingFee} onChange={(e) => setForm({ ...form, shippingFee: Number(e.target.value) })} />
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
                onSetMain={(url) => setForm({ ...form, image: url })}
                onAddToGallery={addImageToProductForm}
                token={adminToken}
                placeholder="Перетащите фото или нажмите для выбора"
              />
              <div style={{ marginTop: "-4px", marginBottom: "10px" }}>
                <button type="button" className="cms-btn cms-btn-xs" onClick={() => openMediaPicker("main")}>
                  Выбрать из медиа
                </button>
              </div>
              <MultiImageUploader
                label="Дополнительные фото"
                value={form.images}
                onChange={(json) => setForm({ ...form, images: json })}
                mainImage={form.image}
                onMainImageChange={(url) => setForm((prev) => ({ ...prev, image: url }))}
                token={adminToken}
              />
              <div style={{ marginTop: "-4px", marginBottom: "10px" }}>
                <button type="button" className="cms-btn cms-btn-xs" onClick={() => openMediaPicker("gallery")}>
                  Добавить из медиа
                </button>
              </div>
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

      {mediaPickerTarget && (
        <div className="cms-modal-overlay" onClick={closeMediaPicker}>
          <div className="cms-modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 760 }}>
            <div className="cms-modal-header">
              <h3>{mediaPickerTarget === "main" ? "Выбрать главное фото" : "Добавить фото в галерею"}</h3>
              <button className="cms-modal-close" onClick={closeMediaPicker}>&times;</button>
            </div>
            <div className="cms-modal-body" style={{ maxHeight: "68vh", overflow: "auto" }}>
              <input
                className="cms-input"
                placeholder="Поиск по имени файла"
                value={mediaSearch}
                onChange={(e) => setMediaSearch(e.target.value)}
                style={{ marginBottom: "12px" }}
              />
              {mediaLoading ? (
                <div style={{ padding: "18px 0", color: "var(--cms-text-muted)" }}>Загрузка медиа...</div>
              ) : (
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))", gap: "10px" }}>
                  {filteredMediaItems.map((item) => (
                    <button
                      key={`${item.relativePath}-${item.updatedAt}`}
                      type="button"
                      onClick={() => selectMediaImage(item.relativePath)}
                      style={{
                        border: "1px solid var(--cms-border)",
                        borderRadius: "10px",
                        background: "var(--cms-surface)",
                        padding: "8px",
                        textAlign: "left",
                        cursor: "pointer",
                      }}
                    >
                      <img
                        src={item.url}
                        alt={item.filename}
                        style={{
                          width: "100%",
                          height: "140px",
                          objectFit: "contain",
                          borderRadius: "8px",
                          background: "#0e1017",
                        }}
                      />
                      <div style={{ marginTop: "6px", fontSize: "11px", color: "var(--cms-text-muted)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {item.filename}
                      </div>
                    </button>
                  ))}
                </div>
              )}
              {!mediaLoading && filteredMediaItems.length === 0 && (
                <div style={{ padding: "18px 0", color: "var(--cms-text-muted)" }}>Нет изображений</div>
              )}
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
