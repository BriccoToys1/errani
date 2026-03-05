"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { AdminSidebar } from "../AdminSidebar";

interface FileItem {
  name: string;
  path: string;
  isDirectory: boolean;
  size: number;
  modified: string;
  isEditable: boolean;
  isImage: boolean;
  extension: string;
}

interface DirectoryListing {
  path: string;
  items: FileItem[];
  parent: string | null;
}

export default function AdminFilesPage() {
  const router = useRouter();
  const [currentPath, setCurrentPath] = useState("");
  const [items, setItems] = useState<FileItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [parent, setParent] = useState<string | null>(null);
  const [selected, setSelected] = useState<FileItem | null>(null);
  const [editorContent, setEditorContent] = useState("");
  const [editorOriginal, setEditorOriginal] = useState("");
  const [saving, setSaving] = useState(false);
  const [notification, setNotification] = useState("");
  const [deleteConfirm, setDeleteConfirm] = useState<FileItem | null>(null);
  const [newItemModal, setNewItemModal] = useState<"file" | "folder" | null>(null);
  const [newItemName, setNewItemName] = useState("");
  const [search, setSearch] = useState("");

  const getToken = useCallback(() => localStorage.getItem("admin_token"), []);

  const fetchDirectory = useCallback(async (path: string) => {
    const token = getToken();
    if (!token) { router.push("/admin/login"); return; }
    
    setLoading(true);
    const res = await fetch(`/api/admin/files?path=${encodeURIComponent(path)}`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (res.status === 401) {
      localStorage.removeItem("admin_token");
      router.push("/admin/login");
      return;
    }

    const data: DirectoryListing = await res.json();
    setItems(data.items || []);
    setParent(data.parent);
    setCurrentPath(path);
    setLoading(false);
  }, [getToken, router]);

  useEffect(() => {
    fetchDirectory("");
  }, [fetchDirectory]);

  const navigateTo = (path: string) => {
    setSelected(null);
    fetchDirectory(path);
  };

  const openFile = async (item: FileItem) => {
    if (item.isDirectory) {
      navigateTo(item.path);
      return;
    }

    if (!item.isEditable) {
      notify("Этот тип файла нельзя редактировать");
      return;
    }

    const token = getToken();
    const res = await fetch(`/api/admin/files?path=${encodeURIComponent(item.path)}&action=read`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (res.ok) {
      const data = await res.json();
      setSelected(item);
      setEditorContent(data.content);
      setEditorOriginal(data.content);
    } else {
      notify("Не удалось загрузить файл");
    }
  };

  const saveFile = async () => {
    if (!selected) return;
    setSaving(true);
    const token = getToken();
    
    const res = await fetch("/api/admin/files", {
      method: "PUT",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ path: selected.path, content: editorContent }),
    });

    if (res.ok) {
      notify("Файл сохранён");
      setEditorOriginal(editorContent);
    } else {
      notify("Ошибка сохранения");
    }
    setSaving(false);
  };

  const createItem = async () => {
    if (!newItemName.trim()) return;
    const token = getToken();
    const path = currentPath ? `${currentPath}/${newItemName}` : newItemName;

    const res = await fetch("/api/admin/files", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ path, content: "", isDirectory: newItemModal === "folder" }),
    });

    if (res.ok) {
      notify(newItemModal === "folder" ? "Папка создана" : "Файл создан");
      setNewItemModal(null);
      setNewItemName("");
      fetchDirectory(currentPath);
    } else {
      notify("Ошибка создания");
    }
  };

  const deleteItem = async (item: FileItem) => {
    const token = getToken();
    const res = await fetch(`/api/admin/files?path=${encodeURIComponent(item.path)}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` },
    });

    if (res.ok) {
      notify(item.isDirectory ? "Папка удалена" : "Файл удалён");
      setDeleteConfirm(null);
      if (selected?.path === item.path) setSelected(null);
      fetchDirectory(currentPath);
    } else {
      notify("Ошибка удаления");
    }
  };

  const notify = (msg: string) => {
    setNotification(msg);
    setTimeout(() => setNotification(""), 3000);
  };

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const filtered = items.filter((item) => {
    if (!search) return true;
    return item.name.toLowerCase().includes(search.toLowerCase());
  });

  const breadcrumbs = currentPath ? currentPath.split("/").filter(Boolean) : [];

  if (loading && items.length === 0) {
    return <div className="cms-loading"><div className="cms-spinner" /> Загрузка...</div>;
  }

  return (
    <div className="cms-root">
      <AdminSidebar />
      <main className="cms-main">
        <div className="cms-header">
          <h1 className="cms-header-title">Файловый менеджер</h1>
          <div className="cms-header-actions">
            <button className="cms-btn cms-btn-sm" onClick={() => setNewItemModal("file")}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><path d="M14 2v6h6M12 18v-6M9 15h6"/></svg>
              Новый файл
            </button>
            <button className="cms-btn cms-btn-sm" onClick={() => setNewItemModal("folder")}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z"/></svg>
              Новая папка
            </button>
          </div>
        </div>

        <div className="cms-content">
          {/* Breadcrumbs */}
          <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "16px", fontSize: "13px" }}>
            <button 
              onClick={() => navigateTo("")}
              className="cms-btn cms-btn-xs cms-btn-ghost"
              style={{ fontWeight: currentPath === "" ? 700 : 400 }}
            >
              📁 public
            </button>
            {breadcrumbs.map((crumb, i) => {
              const crumbPath = breadcrumbs.slice(0, i + 1).join("/");
              return (
                <span key={i} style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                  <span style={{ color: "var(--cms-text-muted)" }}>/</span>
                  <button
                    onClick={() => navigateTo(crumbPath)}
                    className="cms-btn cms-btn-xs cms-btn-ghost"
                    style={{ fontWeight: crumbPath === currentPath ? 700 : 400 }}
                  >
                    {crumb}
                  </button>
                </span>
              );
            })}
          </div>

          <div style={{ display: "grid", gridTemplateColumns: selected ? "1fr 1fr" : "1fr", gap: "16px" }}>
            {/* File list */}
            <div className="cms-table-wrap">
              <div style={{ padding: "12px 16px", borderBottom: "1px solid var(--cms-border)", display: "flex", gap: "10px" }}>
                <input 
                  className="cms-input" 
                  placeholder="Поиск файлов..." 
                  value={search} 
                  onChange={(e) => setSearch(e.target.value)}
                  style={{ flex: 1 }}
                />
              </div>
              <div style={{ maxHeight: "500px", overflowY: "auto" }}>
                {parent !== null && (
                  <div 
                    onClick={() => navigateTo(parent)}
                    style={{ display: "flex", alignItems: "center", gap: "10px", padding: "10px 16px", borderBottom: "1px solid var(--cms-border)", cursor: "pointer", background: "var(--cms-surface)" }}
                    className="cms-file-row"
                  >
                    <span style={{ fontSize: "18px" }}>📁</span>
                    <span style={{ fontWeight: 500 }}>..</span>
                  </div>
                )}
                {filtered.map((item) => (
                  <div
                    key={item.path}
                    onClick={() => openFile(item)}
                    style={{ 
                      display: "flex", 
                      alignItems: "center", 
                      gap: "10px", 
                      padding: "10px 16px", 
                      borderBottom: "1px solid var(--cms-border)", 
                      cursor: "pointer",
                      background: selected?.path === item.path ? "rgba(232, 114, 42, 0.1)" : "transparent"
                    }}
                    className="cms-file-row"
                  >
                    <span style={{ fontSize: "18px" }}>
                      {item.isDirectory ? "📁" : item.isImage ? "🖼️" : item.isEditable ? "📄" : "📎"}
                    </span>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 500 }}>{item.name}</div>
                      <div style={{ fontSize: "11px", color: "var(--cms-text-muted)" }}>
                        {formatSize(item.size)} • {new Date(item.modified).toLocaleDateString("ru-RU")}
                      </div>
                    </div>
                    {!item.isDirectory && (
                      <button 
                        className="cms-btn cms-btn-xs cms-btn-ghost"
                        onClick={(e) => { e.stopPropagation(); setDeleteConfirm(item); }}
                        style={{ color: "var(--cms-danger)" }}
                        title="Удалить"
                      >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/></svg>
                      </button>
                    )}
                  </div>
                ))}
                {filtered.length === 0 && (
                  <div style={{ padding: "32px", textAlign: "center", color: "var(--cms-text-muted)" }}>
                    {search ? "Ничего не найдено" : "Папка пуста"}
                  </div>
                )}
              </div>
            </div>

            {/* Editor panel */}
            {selected && (
              <div className="cms-table-wrap" style={{ display: "flex", flexDirection: "column" }}>
                <div style={{ padding: "12px 16px", borderBottom: "1px solid var(--cms-border)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div>
                    <div style={{ fontWeight: 600 }}>{selected.name}</div>
                    <div style={{ fontSize: "11px", color: "var(--cms-text-muted)" }}>{selected.path}</div>
                  </div>
                  <div style={{ display: "flex", gap: "8px" }}>
                    <button 
                      className="cms-btn cms-btn-sm cms-btn-primary" 
                      onClick={saveFile}
                      disabled={saving || editorContent === editorOriginal}
                    >
                      {saving ? "Сохранение..." : "Сохранить"}
                    </button>
                    <button className="cms-btn cms-btn-sm" onClick={() => setSelected(null)}>Закрыть</button>
                  </div>
                </div>
                <textarea
                  value={editorContent}
                  onChange={(e) => setEditorContent(e.target.value)}
                  style={{
                    flex: 1,
                    minHeight: "400px",
                    padding: "12px",
                    border: "none",
                    background: "var(--cms-bg)",
                    color: "var(--cms-text)",
                    fontFamily: "'SF Mono', 'Fira Code', Consolas, monospace",
                    fontSize: "13px",
                    lineHeight: "1.5",
                    resize: "none",
                    outline: "none",
                  }}
                  spellCheck={false}
                />
              </div>
            )}
          </div>
        </div>

        {/* New Item Modal */}
        {newItemModal && (
          <div className="cms-modal-overlay" onClick={() => setNewItemModal(null)}>
            <div className="cms-modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: "400px" }}>
              <div className="cms-modal-header">
                <h2 className="cms-modal-title">{newItemModal === "folder" ? "Новая папка" : "Новый файл"}</h2>
                <button className="cms-modal-close" onClick={() => setNewItemModal(null)}>×</button>
              </div>
              <div className="cms-modal-body">
                <label className="cms-label">
                  Название
                  <input
                    className="cms-input"
                    value={newItemName}
                    onChange={(e) => setNewItemName(e.target.value)}
                    placeholder={newItemModal === "folder" ? "folder-name" : "filename.txt"}
                    autoFocus
                  />
                </label>
                <p style={{ fontSize: "12px", color: "var(--cms-text-muted)", marginTop: "8px" }}>
                  {newItemModal === "file" && "Добавьте расширение (.txt, .json, .css и т.д.)"}
                </p>
              </div>
              <div className="cms-modal-footer">
                <button className="cms-btn" onClick={() => setNewItemModal(null)}>Отмена</button>
                <button className="cms-btn cms-btn-primary" onClick={createItem}>Создать</button>
              </div>
            </div>
          </div>
        )}

        {/* Delete Confirm Modal */}
        {deleteConfirm && (
          <div className="cms-modal-overlay" onClick={() => setDeleteConfirm(null)}>
            <div className="cms-modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: "400px" }}>
              <div className="cms-modal-header">
                <h2 className="cms-modal-title">Удалить файл?</h2>
                <button className="cms-modal-close" onClick={() => setDeleteConfirm(null)}>×</button>
              </div>
              <div className="cms-modal-body">
                <p>Вы уверены, что хотите удалить <strong>{deleteConfirm.name}</strong>?</p>
                <p style={{ fontSize: "13px", color: "var(--cms-text-muted)" }}>Это действие нельзя отменить.</p>
              </div>
              <div className="cms-modal-footer">
                <button className="cms-btn" onClick={() => setDeleteConfirm(null)}>Отмена</button>
                <button className="cms-btn cms-btn-danger" onClick={() => deleteItem(deleteConfirm)}>Удалить</button>
              </div>
            </div>
          </div>
        )}

        {/* Notification */}
        {notification && (
          <div className="cms-notification">{notification}</div>
        )}
      </main>

      <style jsx>{`
        .cms-file-row:hover {
          background: var(--cms-surface-hover) !important;
        }
      `}</style>
    </div>
  );
}
