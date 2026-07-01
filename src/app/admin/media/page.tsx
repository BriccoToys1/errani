"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { AdminSidebar } from "../AdminSidebar";

interface MediaItem {
  filename: string;
  relativePath: string;
  url: string;
  size: number;
  updatedAt: string;
}

interface ProductInfo {
  id: string;
  name: string;
  nameRu: string | null;
  image: string;
  images: string;
  isActive?: boolean;
}

const ACCEPT = ".jpg,.jpeg,.png,.webp";
const MAX_SIZE_BYTES = 10 * 1024 * 1024;
const MAX_BULK = 10;

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

function isAllowed(file: File): boolean {
  const ext = (file.name.split(".").pop() || "").toLowerCase();
  const allowedExt = ["jpg", "jpeg", "png", "webp"].includes(ext);
  const allowedMime = ["image/jpeg", "image/jpg", "image/png", "image/webp"].includes((file.type || "").toLowerCase());
  return allowedExt || allowedMime;
}

async function copyText(value: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(value);
    return true;
  } catch {
    return false;
  }
}

function getProductUrls(product: ProductInfo): string[] {
  const urls: string[] = [];
  if (product.image) urls.push(product.image);
  try {
    const arr = JSON.parse(product.images);
    if (Array.isArray(arr)) arr.forEach((u) => { if (u) urls.push(String(u)); });
  } catch { /* ignore */ }
  return urls;
}

export default function AdminMediaPage() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [items, setItems] = useState<MediaItem[]>([]);
  const [products, setProducts] = useState<ProductInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState({ current: 0, total: 0 });
  const [dragging, setDragging] = useState(false);
  const [search, setSearch] = useState("");
  const [message, setMessage] = useState("");
  const [folder, setFolder] = useState<string | null>(null); // null = Все, productId = product folder
  const [movingUrl, setMovingUrl] = useState<string | null>(null); // which photo we're moving
  const [lastUploaded, setLastUploaded] = useState("");

  const getToken = useCallback(() => localStorage.getItem("admin_token"), []);

  const showMessage = (text: string) => {
    setMessage(text);
    setTimeout(() => setMessage(""), 4000);
  };

  const requestJson = useCallback(async (
    url: string,
    init: RequestInit = {},
    attempts = 3
  ): Promise<{ ok: boolean; status: number; data: unknown }> => {
    const retriable = new Set([429, 500, 502, 503, 504]);
    for (let attempt = 1; attempt <= attempts; attempt += 1) {
      try {
        const response = await fetch(url, { cache: "no-store", ...init });
        const data = await response.json().catch(() => ({}));
        if (response.ok) return { ok: true, status: response.status, data };
        if (!retriable.has(response.status) || attempt === attempts) {
          return { ok: false, status: response.status, data };
        }
      } catch {
        if (attempt === attempts) {
          return { ok: false, status: 0, data: { message: "Network error" } };
        }
      }
      await new Promise((resolve) => setTimeout(resolve, 180 * attempt));
    }
    return { ok: false, status: 0, data: { message: "Request failed" } };
  }, []);

  const loadMediaList = useCallback(async (showFullLoader = false) => {
    const token = getToken();
    if (!token) { router.push("/admin/login"); return; }
    if (showFullLoader) setLoading(true);
    try {
      const [mediaResult, productsResult] = await Promise.all([
        requestJson("/api/admin/upload/images", { headers: { Authorization: `Bearer ${token}` } }),
        requestJson("/api/products?showAll=true&includeArchived=true", { headers: { Authorization: `Bearer ${token}` } }),
      ]);

      if (mediaResult.status === 401) {
        localStorage.removeItem("admin_token");
        router.push("/admin/login");
        return;
      }

      const data = mediaResult.data as { success?: boolean; items?: unknown[]; message?: string };
      if (mediaResult.ok && data?.success && Array.isArray(data.items)) {
        const normalized = data.items
          .filter((item): item is Record<string, unknown> => typeof item === "object" && item !== null)
          .map((item) => ({
            filename: String(item.filename || ""),
            relativePath: String(item.relativePath || ""),
            url: String(item.url || ""),
            size: Number(item.size || 0),
            updatedAt: String(item.updatedAt || new Date().toISOString()),
          }));
        setItems(normalized);
      } else if (showFullLoader) {
        showMessage(data?.message || "Не удалось загрузить медиатеку");
      }

      if (Array.isArray(productsResult.data)) {
        setProducts((productsResult.data as ProductInfo[]).filter((p) => p.isActive !== false));
      } else if (showFullLoader) {
        showMessage("Не удалось загрузить товары для медиатеки");
      }
    } catch {
      if (showFullLoader) showMessage("Не удалось загрузить медиатеку");
    } finally {
      if (showFullLoader) setLoading(false);
    }
  }, [getToken, requestJson, router]);

  useEffect(() => { loadMediaList(true); }, [loadMediaList]);

  // Build a map of url → productId
  const urlToProduct = useMemo(() => {
    const map = new Map<string, string>();
    for (const p of products) {
      for (const url of getProductUrls(p)) {
        if (!map.has(url)) map.set(url, p.id);
      }
    }
    return map;
  }, [products]);

  // Build product url sets for filtering
  const productUrlSets = useMemo(() => {
    const map = new Map<string, Set<string>>();
    for (const p of products) {
      map.set(p.id, new Set(getProductUrls(p)));
    }
    return map;
  }, [products]);

  const uploadOne = async (file: File): Promise<string | null> => {
    if (!isAllowed(file)) { showMessage(`Файл «${file.name}» пропущен — допустимы только JPG, PNG, WEBP`); return null; }
    if (file.size > MAX_SIZE_BYTES) { showMessage(`Файл «${file.name}» слишком большой (макс. 10 MB)`); return null; }

    const token = getToken();
    if (!token) { router.push("/admin/login"); return null; }

    const formData = new FormData();
    formData.append("image", file);

    let successUrl: string | null = null;
    let lastMessage = "Ошибка загрузки";

    for (let attempt = 1; attempt <= 3; attempt += 1) {
      try {
        const response = await fetch("/api/admin/media/upload", {
          method: "POST",
          headers: { Authorization: `Bearer ${token}` },
          body: formData,
        });
        const data = await response.json().catch(() => ({}));
        if (response.ok && data?.success && data?.url) { successUrl = String(data.url); break; }
        lastMessage = data?.message || lastMessage;
        if (![429, 500, 502, 503, 504].includes(response.status) || attempt === 3) break;
        await new Promise((resolve) => setTimeout(resolve, 180 * attempt));
      } catch {
        if (attempt === 3) break;
        await new Promise((resolve) => setTimeout(resolve, 180 * attempt));
      }
    }

    if (!successUrl) { showMessage(`Ошибка загрузки «${file.name}»: ${lastMessage}`); return null; }
    return successUrl;
  };

  const uploadFiles = async (files: File[]) => {
    if (files.length === 0) return;
    const limited = files.slice(0, MAX_BULK);
    if (files.length > MAX_BULK) showMessage(`Максимум ${MAX_BULK} файлов за раз. Загружаются первые ${MAX_BULK}.`);

    setUploading(true);
    setUploadProgress({ current: 0, total: limited.length });
    let lastUrl: string | null = null;
    let successCount = 0;

    for (let i = 0; i < limited.length; i++) {
      setUploadProgress({ current: i + 1, total: limited.length });
      const url = await uploadOne(limited[i]);
      if (url) { lastUrl = url; successCount++; }
    }

    setUploadProgress({ current: 0, total: 0 });
    setUploading(false);
    if (lastUrl) setLastUploaded(lastUrl);
    if (successCount > 0) {
      showMessage(limited.length === 1 ? "Изображение загружено" : `Загружено ${successCount} из ${limited.length} изображений`);
      await loadMediaList(false);
    }
  };

  const onDrop = async (event: React.DragEvent) => {
    event.preventDefault();
    setDragging(false);
    await uploadFiles(Array.from(event.dataTransfer.files));
  };

  const onFileInputChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    e.target.value = "";
    await uploadFiles(files);
  };

  const deleteImage = useCallback(async (relativePath: string) => {
    const token = getToken();
    if (!token) return;
    if (!confirm("Удалить это изображение?")) return;
    try {
      const result = await requestJson("/api/admin/upload/images", {
        method: "DELETE",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ path: relativePath }),
      });
      const data = result.data as { success?: boolean; message?: string };
      if (!result.ok || !data?.success) throw new Error(data?.message || "Не удалось удалить файл");
      showMessage("Изображение удалено");
      await loadMediaList(false);
    } catch (error) {
      showMessage(error instanceof Error ? error.message : "Не удалось удалить файл");
    }
  }, [loadMediaList, getToken, requestJson]);

  // Move photo to product folder by adding it to product images
  const moveToProduct = useCallback(async (imageUrl: string, productId: string) => {
    const token = getToken();
    if (!token) return;
    const product = products.find((p) => p.id === productId);
    if (!product) return;
    try {
      const existingImages: string[] = (() => { try { return JSON.parse(product.images) || []; } catch { return []; } })();
      const heroImage = product.image || imageUrl;
      const newImages = existingImages.includes(imageUrl) ? existingImages : [...existingImages, imageUrl];
      const res = await fetch(`/api/products/${productId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ image: heroImage, images: JSON.stringify(newImages) }),
      });
      if (res.ok) {
        showMessage(`Фото добавлено к «${product.nameRu || product.name}»`);
        setMovingUrl(null);
        await loadMediaList(false);
      } else {
        showMessage("Ошибка при перемещении");
      }
    } catch {
      showMessage("Ошибка сети");
    }
  }, [getToken, products, loadMediaList]);

  const filtered = useMemo(() => {
    let list = items;
    if (folder) {
      const urlSet = productUrlSets.get(folder);
      list = urlSet ? items.filter((item) => urlSet.has(item.url)) : [];
    }
    const query = search.trim().toLowerCase();
    if (!query) return list;
    return list.filter((item) => item.filename.toLowerCase().includes(query) || item.url.toLowerCase().includes(query));
  }, [items, folder, productUrlSets, search]);

  if (loading) {
    return <div className="cms-loading"><div className="cms-spinner" /> Загрузка медиатеки...</div>;
  }

  return (
    <div className="cms-root">
      <AdminSidebar />
      <main className="cms-main">
        <div className="cms-header">
          <h1 className="cms-header-title">Медиа</h1>
          <div className="cms-header-actions">
            <span style={{ fontSize: "13px", color: "var(--cms-text-muted)" }}>{items.length} файлов</span>
            <button
              className="cms-btn cms-btn-sm cms-btn-primary"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              style={{ fontSize: 20, lineHeight: 1, padding: "2px 14px", fontWeight: 300 }}
              title="Загрузить фото"
            >+</button>
          </div>
        </div>

        <div className="cms-content cms-media-layout" style={{ display: "flex", gap: 16, alignItems: "flex-start" }}>
          {/* Directory tree */}
          <div className="cms-media-folders" style={{ width: 200, flexShrink: 0, background: "var(--cms-surface)", border: "1px solid var(--cms-border)", borderRadius: 10, padding: "8px 0", position: "sticky", top: 16 }}>
            <button
              onClick={() => setFolder(null)}
              style={{ display: "block", width: "100%", textAlign: "left", padding: "7px 14px", background: folder === null ? "rgba(232,114,42,0.1)" : "none", borderLeft: folder === null ? "2px solid var(--cms-accent)" : "2px solid transparent", border: "none", borderRadius: 0, color: folder === null ? "var(--cms-accent)" : "var(--cms-text)", fontSize: 13, cursor: "pointer", fontWeight: folder === null ? 600 : 400 }}
            >
              Все ({items.length})
            </button>
            <div style={{ height: 1, background: "var(--cms-border)", margin: "4px 0" }} />
            {products.map((p) => {
              const count = productUrlSets.get(p.id)?.size ?? 0;
              return (
                <button
                  key={p.id}
                  onClick={() => setFolder(p.id)}
                  style={{ display: "block", width: "100%", textAlign: "left", padding: "6px 14px", background: folder === p.id ? "rgba(232,114,42,0.1)" : "none", borderLeft: folder === p.id ? "2px solid var(--cms-accent)" : "2px solid transparent", border: "none", borderRadius: 0, color: folder === p.id ? "var(--cms-accent)" : "var(--cms-text)", fontSize: 12, cursor: "pointer", fontWeight: folder === p.id ? 600 : 400 }}
                >
                  <div style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.nameRu || p.name}</div>
                  <div style={{ fontSize: 10, color: "var(--cms-text-muted)" }}>{count} фото</div>
                </button>
              );
            })}
          </div>

          {/* Main content area */}
          <div style={{ flex: 1, minWidth: 0 }}>
            {/* Upload zone */}
            <div
              className={`cms-uploader-zone ${dragging ? "dragging" : ""}`}
              onDrop={onDrop}
              onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
              onDragLeave={() => setDragging(false)}
              onClick={() => !uploading && fileInputRef.current?.click()}
              style={{ padding: "16px", marginBottom: "12px", cursor: uploading ? "default" : "pointer" }}
            >
              {uploading ? (
                <div style={{ textAlign: "center" }}>
                  <div style={{ fontSize: "14px", color: "#9b87f5", marginBottom: "4px" }}>
                    {uploadProgress.total > 1 ? `Загрузка ${uploadProgress.current} из ${uploadProgress.total}...` : "Загрузка..."}
                  </div>
                  {uploadProgress.total > 1 && (
                    <div style={{ width: "200px", height: "4px", background: "#2a2a3e", borderRadius: "2px", margin: "0 auto" }}>
                      <div style={{ width: `${(uploadProgress.current / uploadProgress.total) * 100}%`, height: "100%", background: "#9b87f5", borderRadius: "2px", transition: "width 0.3s" }} />
                    </div>
                  )}
                </div>
              ) : (
                <>
                  <div style={{ fontSize: "14px", color: "var(--cms-text)" }}>Перетащите фото сюда или нажмите для выбора</div>
                  <div style={{ fontSize: "12px", color: "var(--cms-text-muted)", marginTop: "4px" }}>JPG, PNG, WEBP · до 10 MB · авто-конвертация в WEBP · до {MAX_BULK} файлов</div>
                </>
              )}
              <input ref={fileInputRef} type="file" accept={ACCEPT} multiple style={{ display: "none" }} onChange={onFileInputChange} />
            </div>

            {lastUploaded && (
              <div className="cms-uploader-url-card" style={{ marginBottom: "12px" }}>
                <div style={{ fontSize: "11px", color: "var(--cms-text-muted)", marginBottom: "6px" }}>Последняя загруженная ссылка</div>
                <div style={{ fontSize: "12px", color: "var(--cms-text)", marginBottom: "8px" }}>{lastUploaded.split("/").pop() || lastUploaded}</div>
                <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
                  <button className="cms-btn cms-btn-xs" onClick={async () => { const ok = await copyText(lastUploaded); showMessage(ok ? "Ссылка скопирована" : "Не удалось скопировать ссылку"); }}>Скопировать URL</button>
                  <a className="cms-btn cms-btn-xs cms-btn-ghost" href={lastUploaded} target="_blank" rel="noreferrer">Открыть</a>
                  <button className="cms-btn cms-btn-xs cms-btn-primary" onClick={() => router.push("/admin/products")}>Вставить в товар</button>
                </div>
              </div>
            )}

            <div style={{ marginBottom: "10px" }}>
              <input className="cms-input" placeholder="Поиск по имени или URL" value={search} onChange={(e) => setSearch(e.target.value)} />
            </div>

            <div className="cms-media-grid" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))", gap: "10px" }}>
              {filtered.map((item) => {
                const ownerProductId = urlToProduct.get(item.url);
                const ownerProduct = ownerProductId ? products.find((p) => p.id === ownerProductId) : null;
                return (
                  <div key={item.relativePath} style={{ border: "1px solid var(--cms-border)", borderRadius: "10px", padding: "8px", background: "var(--cms-surface)", position: "relative" }}>
                    <a href={item.url} target="_blank" rel="noreferrer">
                      <img src={item.url} alt={item.filename} style={{ width: "100%", height: "160px", objectFit: "contain", borderRadius: "8px", background: "#0c0e14", display: "block" }} />
                    </a>
                    {ownerProduct && (
                      <div style={{ fontSize: "10px", color: "var(--cms-accent)", marginTop: 4, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={ownerProduct.nameRu || ownerProduct.name}>
                        📁 {ownerProduct.nameRu || ownerProduct.name}
                      </div>
                    )}
                    <div style={{ fontSize: "11px", color: "var(--cms-text-muted)", marginTop: "4px" }}>{formatSize(item.size)}</div>
                    <div style={{ fontSize: "11px", color: "var(--cms-text)", marginTop: "2px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={item.url}>{item.filename}</div>
                    <div style={{ display: "flex", gap: "4px", marginTop: "6px", flexWrap: "wrap" }}>
                      <button className="cms-btn cms-btn-xs" onClick={async () => { const ok = await copyText(item.url); showMessage(ok ? "Скопировано" : "Не удалось скопировать"); }}>URL</button>
                      {/* Move to product folder icon */}
                      <button
                        className="cms-btn cms-btn-xs cms-btn-ghost"
                        title="Перенести в папку товара"
                        onClick={() => setMovingUrl(movingUrl === item.url ? null : item.url)}
                        style={{ color: movingUrl === item.url ? "var(--cms-accent)" : undefined }}
                      >
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z"/></svg>
                      </button>
                      <button className="cms-btn cms-btn-xs cms-btn-danger" onClick={() => deleteImage(item.relativePath)}>
                        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/></svg>
                      </button>
                    </div>
                    {/* Product folder picker */}
                    {movingUrl === item.url && (
                      <div style={{ position: "absolute", zIndex: 20, left: 0, right: 0, top: "100%", marginTop: 4, background: "var(--cms-surface)", border: "1px solid var(--cms-border)", borderRadius: 8, boxShadow: "0 8px 24px rgba(0,0,0,0.5)", maxHeight: 200, overflowY: "auto" }}>
                        <div style={{ padding: "6px 10px", fontSize: 11, color: "var(--cms-text-muted)", borderBottom: "1px solid var(--cms-border)", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em" }}>Выберите товар</div>
                        {products.map((p) => (
                          <button
                            key={p.id}
                            onClick={() => void moveToProduct(item.url, p.id)}
                            style={{ display: "block", width: "100%", textAlign: "left", padding: "7px 10px", background: "none", border: "none", color: "var(--cms-text)", fontSize: 12, cursor: "pointer" }}
                            onMouseOver={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "rgba(232,114,42,0.1)"; }}
                            onMouseOut={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "none"; }}
                          >
                            {p.nameRu || p.name}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {filtered.length === 0 && (
              <div style={{ padding: "24px", textAlign: "center", color: "var(--cms-text-muted)" }}>Нет изображений</div>
            )}
          </div>
        </div>
      </main>

      {message && <div className="cms-toast">{message}</div>}
    </div>
  );
}
