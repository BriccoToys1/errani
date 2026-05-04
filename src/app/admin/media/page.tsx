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

const ACCEPT = ".jpg,.jpeg,.png,.webp";
const MAX_SIZE_BYTES = 10 * 1024 * 1024;

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

export default function AdminMediaPage() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [items, setItems] = useState<MediaItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [search, setSearch] = useState("");
  const [message, setMessage] = useState("");
  const [lastUploaded, setLastUploaded] = useState("");

  const getToken = useCallback(() => localStorage.getItem("admin_token"), []);

  const showMessage = (text: string) => {
    setMessage(text);
    setTimeout(() => setMessage(""), 3000);
  };

  const fetchMedia = useCallback(async () => {
    const token = getToken();
    if (!token) {
      router.push("/admin/login");
      return;
    }

    setLoading(true);
    try {
      const response = await fetch("/api/admin/upload/images", {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (response.status === 401) {
        localStorage.removeItem("admin_token");
        router.push("/admin/login");
        return;
      }

      const data = await response.json();
      setItems(Array.isArray(data?.items) ? data.items : []);
    } catch {
      showMessage("Не удалось загрузить медиатеку");
    } finally {
      setLoading(false);
    }
  }, [getToken, router]);

  useEffect(() => {
    fetchMedia();
  }, [fetchMedia]);

  const uploadOne = async (file: File) => {
    if (!isAllowed(file)) {
      showMessage("Допустимы только JPG, JPEG, PNG, WEBP");
      return;
    }

    if (file.size > MAX_SIZE_BYTES) {
      showMessage("Размер файла больше 10 MB");
      return;
    }

    const token = getToken();
    if (!token) {
      router.push("/admin/login");
      return;
    }

    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("image", file);

      const response = await fetch("/api/admin/media/upload", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });

      const data = await response.json();
      if (!response.ok || !data?.success || !data?.url) {
        throw new Error(data?.message || "Ошибка загрузки");
      }

      setLastUploaded(String(data.url));
      showMessage("Изображение загружено");
      await fetchMedia();
    } catch (error) {
      const msg = error instanceof Error ? error.message : "Ошибка загрузки";
      showMessage(msg);
    } finally {
      setUploading(false);
    }
  };

  const onDrop = async (event: React.DragEvent) => {
    event.preventDefault();
    setDragging(false);

    const files = Array.from(event.dataTransfer.files);
    for (const file of files) {
      await uploadOne(file);
    }
  };

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return items;
    return items.filter((item) => item.filename.toLowerCase().includes(query) || item.url.toLowerCase().includes(query));
  }, [items, search]);

  const deleteImage = async (relativePath: string) => {
    const token = getToken();
    if (!token) return;

    const confirmed = confirm("Удалить это изображение?");
    if (!confirmed) return;

    try {
      const response = await fetch("/api/admin/upload/images", {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ path: relativePath }),
      });

      const data = await response.json();
      if (!response.ok || !data?.success) {
        throw new Error(data?.message || "Не удалось удалить файл");
      }

      showMessage("Изображение удалено");
      await fetchMedia();
    } catch (error) {
      const msg = error instanceof Error ? error.message : "Не удалось удалить файл";
      showMessage(msg);
    }
  };

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
            <button className="cms-btn cms-btn-sm cms-btn-primary" onClick={() => fileInputRef.current?.click()} disabled={uploading}>
              {uploading ? "Загрузка..." : "Загрузить фото"}
            </button>
          </div>
        </div>

        <div className="cms-content">
          <div
            className={`cms-uploader-zone ${dragging ? "dragging" : ""}`}
            onDrop={onDrop}
            onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
            onDragLeave={() => setDragging(false)}
            onClick={() => fileInputRef.current?.click()}
            style={{ padding: "22px", marginBottom: "12px" }}
          >
            <div style={{ fontSize: "14px", color: "var(--cms-text)" }}>Перетащите фото сюда или нажмите для выбора</div>
            <div style={{ fontSize: "12px", color: "var(--cms-text-muted)", marginTop: "6px" }}>JPG, JPEG, PNG, WEBP · до 10 MB · авто-конвертация в WEBP</div>
            <input
              ref={fileInputRef}
              type="file"
              accept={ACCEPT}
              multiple
              style={{ display: "none" }}
              onChange={async (e) => {
                const files = Array.from(e.target.files || []);
                for (const file of files) {
                  await uploadOne(file);
                }
              }}
            />
          </div>

          {lastUploaded && (
            <div className="cms-uploader-url-card" style={{ marginBottom: "12px" }}>
              <div style={{ fontSize: "11px", color: "var(--cms-text-muted)", marginBottom: "6px" }}>Последняя загруженная ссылка</div>
              <div style={{ fontSize: "12px", color: "var(--cms-text)", wordBreak: "break-all", marginBottom: "8px" }}>{lastUploaded}</div>
              <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
                <button
                  className="cms-btn cms-btn-xs"
                  onClick={async () => {
                    const ok = await copyText(lastUploaded);
                    showMessage(ok ? "Ссылка скопирована" : "Не удалось скопировать ссылку");
                  }}
                >
                  Скопировать URL
                </button>
                <a className="cms-btn cms-btn-xs cms-btn-ghost" href={lastUploaded} target="_blank" rel="noreferrer">Открыть изображение</a>
                <button className="cms-btn cms-btn-xs cms-btn-primary" onClick={() => router.push("/admin/products")}>Вставить в товар</button>
              </div>
            </div>
          )}

          <div style={{ marginBottom: "10px" }}>
            <input
              className="cms-input"
              placeholder="Поиск по имени или URL"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: "10px" }}>
            {filtered.map((item) => (
              <div key={item.relativePath} style={{ border: "1px solid var(--cms-border)", borderRadius: "10px", padding: "8px", background: "var(--cms-surface)" }}>
                <a href={item.url} target="_blank" rel="noreferrer">
                  <img src={item.url} alt={item.filename} style={{ width: "100%", height: "140px", objectFit: "cover", borderRadius: "8px", background: "#0c0e14" }} />
                </a>
                <div style={{ fontSize: "11px", color: "var(--cms-text-muted)", marginTop: "8px" }}>{formatSize(item.size)} · {new Date(item.updatedAt).toLocaleString("ru-RU")}</div>
                <div style={{ fontSize: "12px", color: "var(--cms-text)", wordBreak: "break-all", marginTop: "4px" }}>{item.url}</div>
                <div style={{ display: "flex", gap: "6px", marginTop: "8px", flexWrap: "wrap" }}>
                  <button
                    className="cms-btn cms-btn-xs"
                    onClick={async () => {
                      const ok = await copyText(item.url);
                      showMessage(ok ? "Ссылка скопирована" : "Не удалось скопировать ссылку");
                    }}
                  >
                    Скопировать URL
                  </button>
                  <a className="cms-btn cms-btn-xs cms-btn-ghost" href={item.url} target="_blank" rel="noreferrer">Открыть</a>
                  <button className="cms-btn cms-btn-xs cms-btn-danger" onClick={() => deleteImage(item.relativePath)}>Удалить</button>
                </div>
              </div>
            ))}
          </div>

          {filtered.length === 0 && (
            <div style={{ padding: "24px", textAlign: "center", color: "var(--cms-text-muted)" }}>
              Нет изображений
            </div>
          )}
        </div>
      </main>

      {message && <div className="cms-toast">{message}</div>}
    </div>
  );
}
