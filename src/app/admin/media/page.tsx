"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { AdminPage } from "../AdminPage";
import { HeaderActions, Icon, IconButton, PageLoading } from "@/components/admin";
import { adminToastClass } from "@/lib/admin-client";
import {
  MEDIA_KIND_LABELS,
  mediaKindOf,
  type MediaKind,
} from "@/lib/media-kind";

interface MediaItem {
  filename: string;
  relativePath: string;
  url: string;
  size: number;
  updatedAt: string;
  mimeType: string;
}

interface ProductInfo {
  id: string;
  name: string;
  nameRu: string | null;
  image: string;
  images: string;
  isActive?: boolean;
}

const ACCEPT_BY_KIND: Record<MediaKind, string> = {
  photo: ".jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp",
  video: ".mp4,.webm,.mov,.m4v,video/mp4,video/webm,video/quicktime",
  audio: ".mp3,.wav,.ogg,.m4a,.aac,.flac,audio/mpeg,audio/wav,audio/ogg,audio/mp4,audio/aac,audio/flac",
};

const MAX_BY_KIND: Record<MediaKind, number> = {
  photo: 10 * 1024 * 1024,
  audio: 30 * 1024 * 1024,
  video: 80 * 1024 * 1024,
};

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

function fileKind(file: File): MediaKind | null {
  return mediaKindOf({ mimeType: file.type, filename: file.name });
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
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const [items, setItems] = useState<MediaItem[]>([]);
  const [products, setProducts] = useState<ProductInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState({ current: 0, total: 0 });
  const [dragging, setDragging] = useState(false);
  const [message, setMessage] = useState("");
  const [kindFilter, setKindFilter] = useState<MediaKind>("photo");
  const [folder, setFolder] = useState<string | null>(null);
  const [lightbox, setLightbox] = useState<MediaItem | null>(null);
  const [audioPlaying, setAudioPlaying] = useState(false);
  const [editingPath, setEditingPath] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [mobileActive, setMobileActive] = useState<string | null>(null);

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
            mimeType: String(item.mimeType || ""),
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

  useEffect(() => {
    setAudioPlaying(false);
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }
  }, [lightbox?.relativePath]);

  const productUrlSets = useMemo(() => {
    const map = new Map<string, Set<string>>();
    for (const p of products) {
      map.set(p.id, new Set(getProductUrls(p)));
    }
    return map;
  }, [products]);

  const uploadOne = async (file: File): Promise<string | null> => {
    const kind = fileKind(file);
    if (!kind) {
      showMessage(`Файл «${file.name}» пропущен — недопустимый формат`);
      return null;
    }
    if (kind !== kindFilter) {
      showMessage(`Файл «${file.name}» не подходит под фильтр «${MEDIA_KIND_LABELS[kindFilter]}»`);
      return null;
    }
    if (file.size > MAX_BY_KIND[kind]) {
      showMessage(`Файл «${file.name}» слишком большой`);
      return null;
    }

    const token = getToken();
    if (!token) { router.push("/admin/login"); return null; }

    const formData = new FormData();
    formData.append("file", file);

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
    const limited = files.slice(0, 10);
    if (files.length > 10) showMessage("Максимум 10 файлов за раз. Загружаются первые 10.");

    setUploading(true);
    setUploadProgress({ current: 0, total: limited.length });
    let successCount = 0;

    for (let i = 0; i < limited.length; i++) {
      setUploadProgress({ current: i + 1, total: limited.length });
      const url = await uploadOne(limited[i]);
      if (url) successCount++;
    }

    setUploadProgress({ current: 0, total: 0 });
    setUploading(false);
    if (successCount > 0) {
      showMessage(limited.length === 1 ? "Файл загружен" : `Загружено ${successCount} из ${limited.length}`);
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
    if (!confirm("Удалить этот файл?")) return;
    try {
      const result = await requestJson("/api/admin/upload/images", {
        method: "DELETE",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ path: relativePath }),
      });
      const data = result.data as { success?: boolean; message?: string };
      if (!result.ok || !data?.success) throw new Error(data?.message || "Не удалось удалить файл");
      showMessage("Файл удалён");
      if (lightbox?.relativePath === relativePath) setLightbox(null);
      await loadMediaList(false);
    } catch (error) {
      showMessage(error instanceof Error ? error.message : "Не удалось удалить файл");
    }
  }, [loadMediaList, getToken, requestJson, lightbox?.relativePath]);

  const filtered = useMemo(() => {
    let list = items.filter((item) => mediaKindOf(item) === kindFilter);
    if (folder) {
      const urlSet = productUrlSets.get(folder);
      list = urlSet ? list.filter((item) => urlSet.has(item.url)) : [];
    }
    return list;
  }, [items, folder, productUrlSets, kindFilter]);

  const saveRename = async (item: MediaItem) => {
    const next = editName.trim();
    if (!next || next === item.filename) {
      setEditingPath(null);
      return;
    }
    const token = getToken();
    if (!token) return;
    const result = await requestJson("/api/admin/upload/images", {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ path: item.relativePath, filename: next }),
    });
    const data = result.data as { success?: boolean; message?: string };
    if (result.ok && data?.success) {
      setItems((prev) => prev.map((it) => (it.relativePath === item.relativePath ? { ...it, filename: next } : it)));
      if (lightbox?.relativePath === item.relativePath) {
        setLightbox((prev) => (prev ? { ...prev, filename: next } : prev));
      }
      showMessage("Название обновлено");
    } else {
      showMessage(data?.message || "Не удалось переименовать");
    }
    setEditingPath(null);
  };

  const openItem = (item: MediaItem) => setLightbox(item);

  const toggleAudio = () => {
    if (!lightbox) return;
    if (!audioRef.current) {
      const el = new Audio(lightbox.url);
      el.addEventListener("ended", () => setAudioPlaying(false));
      audioRef.current = el;
    }
    const el = audioRef.current;
    if (audioPlaying) {
      el.pause();
      setAudioPlaying(false);
    } else {
      void el.play().then(() => setAudioPlaying(true)).catch(() => {
        showMessage("Не удалось воспроизвести аудио");
        setAudioPlaying(false);
      });
    }
  };

  const closeLightbox = () => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }
    setAudioPlaying(false);
    setLightbox(null);
  };

  if (loading) {
    return <PageLoading label="Загрузка медиатеки" />;
  }

  const dropLabel =
    kindFilter === "photo"
      ? "Перетащите фото сюда или нажмите для выбора"
      : kindFilter === "video"
        ? "Перетащите видео сюда или нажмите для выбора"
        : "Перетащите аудио сюда или нажмите для выбора";

  return (
    <AdminPage
      title="Галерея"
      fill
      actions={
        <HeaderActions>
          <IconButton icon="add" label="Загрузить" shape="plain" onClick={() => fileInputRef.current?.click()} disabled={uploading} />
          <IconButton icon="refresh" label="Обновить" shape="plain" onClick={() => loadMediaList(true)} />
        </HeaderActions>
      }
    >
      <div className="cms-media-layout">
        <aside className="cms-media-folders">
          <div className="cms-media-kind-filter">
            <select
              className="cms-select cms-select-sm"
              value={kindFilter}
              onChange={(e) => {
                setKindFilter(e.target.value as MediaKind);
                setFolder(null);
              }}
              aria-label="Тип медиа"
            >
              <option value="photo">{MEDIA_KIND_LABELS.photo}</option>
              <option value="video">{MEDIA_KIND_LABELS.video}</option>
              <option value="audio">{MEDIA_KIND_LABELS.audio}</option>
            </select>
          </div>
          <button
            type="button"
            onClick={() => setFolder(null)}
            className={`cms-media-folder-btn${folder === null ? " is-active" : ""}`}
          >
            Все
          </button>
          <div className="cms-media-folders-divider" />
          {products.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => setFolder(p.id)}
              className={`cms-media-folder-btn${folder === p.id ? " is-active" : ""}`}
              title={p.nameRu || p.name}
            >
              {p.nameRu || p.name}
            </button>
          ))}
        </aside>

        <div className="cms-media-main">
          <div
            className={`cms-uploader-zone${dragging ? " dragging" : ""}`}
            onDrop={onDrop}
            onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
            onDragLeave={() => setDragging(false)}
            onClick={() => !uploading && fileInputRef.current?.click()}
          >
            {uploading ? (
              <div className="cms-uploader-zone-label">
                {uploadProgress.total > 1
                  ? `Загрузка ${uploadProgress.current} из ${uploadProgress.total}...`
                  : "Загрузка..."}
              </div>
            ) : (
              <div className="cms-uploader-zone-label">
                <Icon name="attach" size={16} />
                <span>{dropLabel}</span>
              </div>
            )}
            <input
              ref={fileInputRef}
              type="file"
              accept={ACCEPT_BY_KIND[kindFilter]}
              multiple
              style={{ display: "none" }}
              onChange={onFileInputChange}
            />
          </div>

          <div className="cms-scroll cms-media-grid-wrap">
            <div className="cms-gallery-grid">
              {filtered.map((item) => {
                const kind = mediaKindOf(item);
                const active = mobileActive === item.relativePath;
                return (
                  <div
                    key={item.relativePath}
                    className={`cms-gallery-tile${active ? " is-active" : ""}${kind === "audio" ? " is-audio" : ""}${kind === "video" ? " is-video" : ""}`}
                    onClick={() => {
                      if (window.matchMedia("(hover: none)").matches) {
                        setMobileActive((v) => (v === item.relativePath ? null : item.relativePath));
                      } else {
                        openItem(item);
                      }
                    }}
                  >
                    <div className="cms-gallery-thumb">
                      {kind === "audio" ? (
                        <span className="cms-gallery-audio-icon" aria-hidden>
                          <Icon name="musicFile" size={36} />
                        </span>
                      ) : kind === "video" ? (
                        <video src={item.url} muted playsInline preload="metadata" />
                      ) : (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={item.url} alt={item.filename} />
                      )}
                    </div>
                    <div className="cms-gallery-meta">
                      <div className="cms-gallery-meta-row">
                        {editingPath === item.relativePath ? (
                          <input
                            className="cms-input cms-input-sm"
                            value={editName}
                            autoFocus
                            onClick={(e) => e.stopPropagation()}
                            onChange={(e) => setEditName(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") void saveRename(item);
                              if (e.key === "Escape") setEditingPath(null);
                            }}
                            onBlur={() => void saveRename(item)}
                            style={{ flex: 1, minWidth: 0 }}
                          />
                        ) : (
                          <span className="cms-gallery-name" title={item.filename}>{item.filename}</span>
                        )}
                      </div>
                      <div className="cms-gallery-size">{formatSize(item.size)}</div>
                      <div className="cms-gallery-actions" onClick={(e) => e.stopPropagation()}>
                        <IconButton icon="view" label="Просмотр" shape="square" onClick={() => openItem(item)} />
                        <IconButton
                          icon="copy"
                          label="Скопировать URL"
                          shape="square"
                          onClick={async () => {
                            const ok = await copyText(item.url);
                            showMessage(ok ? "Скопировано" : "Не удалось");
                          }}
                        />
                        <IconButton
                          icon="edit"
                          label="Изменить"
                          shape="square"
                          onClick={() => {
                            setEditingPath(item.relativePath);
                            setEditName(item.filename);
                          }}
                        />
                        <IconButton
                          icon="delete"
                          label="Удалить"
                          shape="square"
                          tone="danger"
                          onClick={() => deleteImage(item.relativePath)}
                        />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
            {filtered.length === 0 && (
              <div className="cms-datalist-empty">
                Нет {kindFilter === "photo" ? "изображений" : kindFilter === "video" ? "видео" : "аудио"}
              </div>
            )}
          </div>
        </div>
      </div>

      {lightbox && (
        <div className="cms-modal-overlay" onClick={closeLightbox}>
          <div className="cms-modal" style={{ maxWidth: mediaKindOf(lightbox) === "audio" ? 420 : 900, width: "100%" }} onClick={(e) => e.stopPropagation()}>
            <div className="cms-modal-header">
              <h3 style={{ margin: 0, overflow: "hidden", textOverflow: "ellipsis" }}>{lightbox.filename}</h3>
              <div className="cms-modal-header-actions">
                <IconButton
                  icon="copy"
                  label="Скопировать URL"
                  shape="square"
                  onClick={async () => {
                    const ok = await copyText(lightbox.url);
                    showMessage(ok ? "Скопировано" : "Не удалось");
                  }}
                />
                <IconButton
                  icon="delete"
                  label="Удалить"
                  shape="square"
                  tone="danger"
                  onClick={() => deleteImage(lightbox.relativePath)}
                />
                <IconButton icon="close" label="Закрыть" shape="square" onClick={closeLightbox} />
              </div>
            </div>
            <div className="cms-modal-body cms-gallery-lightbox-body">
              {mediaKindOf(lightbox) === "audio" ? (
                <div className="cms-gallery-audio-player">
                  <span className="cms-gallery-audio-icon" aria-hidden>
                    <Icon name="musicFile" size={48} />
                  </span>
                  <div className="cms-gallery-audio-name">{lightbox.filename}</div>
                  <div className="cms-gallery-audio-size">{formatSize(lightbox.size)}</div>
                  <IconButton
                    icon={audioPlaying ? "stop" : "play"}
                    label={audioPlaying ? "Остановить" : "Воспроизвести"}
                    shape="circle"
                    size="md"
                    onClick={toggleAudio}
                  />
                </div>
              ) : mediaKindOf(lightbox) === "video" ? (
                <video src={lightbox.url} controls playsInline style={{ width: "100%", maxHeight: "70dvh", display: "block", background: "#0c0e14" }} />
              ) : (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={lightbox.url} alt={lightbox.filename} style={{ width: "100%", maxHeight: "70dvh", objectFit: "contain", display: "block" }} />
              )}
            </div>
          </div>
        </div>
      )}

      {message && <div className={adminToastClass(message)}>{message}</div>}
    </AdminPage>
  );
}
