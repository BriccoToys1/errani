"use client";

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { useRouter } from "next/navigation";
import { AdminSidebar } from "../AdminSidebar";

const SUPPORTED_IMAGE_EXTENSIONS = [".png", ".jpg", ".jpeg", ".webp"];
const SUPPORTED_IMAGE_MIME_TYPES = ["image/png", "image/jpeg", "image/jpg", "image/webp"];
const IMAGE_ACCEPT = SUPPORTED_IMAGE_EXTENSIONS.join(",");
const MAX_IMAGES = 20;
const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024;
const MAX_FILE_SIZE_MB = 10;
const LOW_STOCK_THRESHOLD = 3;

function isSupportedImageFile(file: File): boolean {
  const n = (file.name || "").toLowerCase();
  return SUPPORTED_IMAGE_EXTENSIONS.some(ext => n.endsWith(ext)) ||
    SUPPORTED_IMAGE_MIME_TYPES.includes((file.type || "").toLowerCase());
}

function parseImageList(value: string): string[] {
  try {
    const p = JSON.parse(value || "[]");
    return Array.isArray(p) ? p.filter((x): x is string => typeof x === "string" && x.trim().length > 0) : [];
  } catch { return []; }
}

function toJson(v: unknown): string { return JSON.stringify(v); }

async function uploadProductImage(file: File, token: string): Promise<string> {
  if (!isSupportedImageFile(file)) throw new Error("Только JPG, PNG, WEBP");
  if (file.size > MAX_FILE_SIZE_BYTES) throw new Error(`Размер > ${MAX_FILE_SIZE_MB}MB`);
  const fd = new FormData();
  fd.append("image", file);
  for (let i = 1; i <= 3; i++) {
    const res = await fetch("/api/admin/media/upload", { method: "POST", headers: { Authorization: `Bearer ${token}` }, body: fd });
    const d = await res.json().catch(() => ({}));
    if (res.ok && d?.url) return String(d.url);
    if (![429, 500, 502, 503, 504].includes(res.status) || i === 3) throw new Error(d?.message || "Ошибка загрузки");
    await new Promise(r => setTimeout(r, 180 * i));
  }
  throw new Error("Ошибка загрузки");
}

function slugify(text: string): string {
  const map: Record<string, string> = {
    а:"a",б:"b",в:"v",г:"g",д:"d",е:"e",ё:"e",ж:"zh",з:"z",и:"i",й:"y",
    к:"k",л:"l",м:"m",н:"n",о:"o",п:"p",р:"r",с:"s",т:"t",у:"u",ф:"f",
    х:"h",ц:"ts",ч:"ch",ш:"sh",щ:"sch",ъ:"",ы:"y",ь:"",э:"e",ю:"yu",я:"ya",
  };
  return text.toLowerCase().split("").map(c => map[c] ?? c).join("")
    .replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

// ─── Types ────────────────────────────────────────────────────────────────────

interface Product {
  id: string; name: string; nameRu: string; slug: string;
  description: string; descriptionRu: string;
  price: number; shippingFee: number; oldPrice: number | null; discount: number;
  stock: number; currency: string; image: string; images: string;
  inStock: boolean; isPreorder: boolean; preorderClosed: boolean;
  preorderAvailableDate: string | null;
  isAuthor: boolean; isLimited: boolean; limitedEditionText: string;
  limitedEditionTextEn?: string;
  noticeText?: string; noticeTextEn?: string;
  shippingConditions?: string;
  isActive: boolean; isAvailable: boolean; isSaleDisabled: boolean; isSoldOut: boolean;
  sortOrder: number; characteristics: string; colors: string; customBadges?: string; createdAt: string;
}

interface MediaItem { filename: string; relativePath: string; url: string; size: number; updatedAt: string; }
type ColorEntry = { name: string; nameEn?: string; hex: string; stock?: number; photo?: string };
type CharEntry = { key: string; keyEn?: string; value: string; valueEn?: string };
type Lang = "ru" | "en";
type StockFilter = "all" | "inStock" | "outOfStock" | "preorder" | "lowStock";
type TypeFilter = "all" | "author" | "limited";
type StatusFilter = "all" | "onSale" | "soon" | "soldOut";
type SortMode = "updatedDesc" | "priceAsc" | "priceDesc" | "stockAsc" | "stockDesc" | "nameAsc";
type BulkAction = "none"|"activate"|"deactivate"|"makeAvailable"|"makeUnavailable"|"markSoon"|"unmarkSoon"|"markSoldOut"|"unmarkSoldOut"|"archive";

const emptyProduct = {
  name: "", nameRu: "", slug: "", description: "", descriptionRu: "",
  price: 0, shippingFee: 0, oldPrice: null as number | null, discount: 0, stock: 0,
  currency: "RUB", image: "", images: "[]", inStock: true, isPreorder: false,
  preorderClosed: false, preorderAvailableDate: "",
  isAuthor: false, isLimited: false, limitedEditionText: "", limitedEditionTextEn: "",
  noticeText: "", noticeTextEn: "", shippingConditions: "[]",
  isActive: true, isAvailable: true, isSaleDisabled: false, isSoldOut: false, sortOrder: 0,
  characteristics: "[]", colors: "[]", customBadges: "[]",
};

// ─── PhotoGallery ─────────────────────────────────────────────────────────────

function PhotoGallery({
  galleryJson, onChange, token, onOpenMedia,
}: {
  galleryJson: string; onChange: (json: string) => void;
  token: string; onOpenMedia: () => void;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const replaceRef = useRef<HTMLInputElement>(null);
  const replaceIdx = useRef<number | null>(null);
  const [uploading, setUploading] = useState(false);
  const [dragging, setDragging] = useState(false);

  const photos = parseImageList(galleryJson);
  const set = (next: string[]) => onChange(toJson(next));

  const add = (url: string) => {
    const u = url.trim();
    if (!u) return;
    if (photos.includes(u)) return;
    if (photos.length >= MAX_IMAGES) { alert(`Максимум ${MAX_IMAGES}`); return; }
    set([...photos, u]);
  };

  const remove = (i: number) => set(photos.filter((_, j) => j !== i));

  const move = (i: number, dir: -1 | 1) => {
    const t = i + dir;
    if (t < 0 || t >= photos.length) return;
    const n = [...photos]; [n[i], n[t]] = [n[t], n[i]]; set(n);
  };

  const upload = async (file: File) => {
    if (!isSupportedImageFile(file)) return;
    setUploading(true);
    try { add(await uploadProductImage(file, token)); }
    catch (e) { alert(e instanceof Error ? e.message : "Ошибка"); }
    finally { setUploading(false); }
  };

  const replace = async (i: number, file: File) => {
    try {
      const url = await uploadProductImage(file, token);
      const n = [...photos]; n[i] = url; set(n);
    } catch (e) { alert(e instanceof Error ? e.message : "Ошибка"); }
  };

  return (
    <div>
      {photos.length > 0 && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(96px, 1fr))", gap: "8px", marginBottom: "10px" }}>
          {photos.map((url, i) => (
            <div key={`${url}-${i}`} style={{ position: "relative", borderRadius: "8px", overflow: "hidden", border: `2px solid ${i === 0 ? "var(--cms-accent, #9b87f5)" : "var(--cms-border)"}`, background: "#0e1017", aspectRatio: "1" }}>
              <img
                src={url} alt=""
                style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
                onError={(e) => { (e.target as HTMLImageElement).style.opacity = "0.25"; }}
              />
              {i === 0 && (
                <div style={{ position: "absolute", top: 0, left: 0, right: 0, textAlign: "center", fontSize: "9px", background: "rgba(155,135,245,0.9)", color: "#fff", padding: "2px 0", letterSpacing: "0.5px", fontWeight: 600 }}>
                  ГЛАВНОЕ
                </div>
              )}
              <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, display: "flex", justifyContent: "center", gap: "1px", background: "rgba(0,0,0,0.72)", padding: "3px 2px" }}>
                <button type="button" onClick={() => move(i, -1)} disabled={i === 0} title="Вверх"
                  style={{ background: "none", border: "none", color: i === 0 ? "#444" : "#ccc", cursor: i === 0 ? "default" : "pointer", fontSize: "11px", padding: "1px 4px", lineHeight: 1 }}>↑</button>
                <button type="button" onClick={() => move(i, 1)} disabled={i === photos.length - 1} title="Вниз"
                  style={{ background: "none", border: "none", color: i === photos.length - 1 ? "#444" : "#ccc", cursor: i === photos.length - 1 ? "default" : "pointer", fontSize: "11px", padding: "1px 4px", lineHeight: 1 }}>↓</button>
                <button type="button" title="Заменить"
                  onClick={() => { replaceIdx.current = i; replaceRef.current?.click(); }}
                  style={{ background: "none", border: "none", color: "#aaa", cursor: "pointer", fontSize: "11px", padding: "1px 4px", lineHeight: 1 }}>
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 013 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>
                </button>
                <button type="button" onClick={() => remove(i)} title="Удалить"
                  style={{ background: "none", border: "none", color: "#f66", cursor: "pointer", fontSize: "13px", padding: "1px 4px", lineHeight: 1 }}>×</button>
              </div>
            </div>
          ))}
        </div>
      )}

      <div
        className={`cms-uploader-zone${dragging ? " dragging" : ""}`}
        onDrop={async (e) => { e.preventDefault(); setDragging(false); const files = Array.from(e.dataTransfer.files); if (!files.length) return; setUploading(true); const newUrls: string[] = []; for (const f of files) { try { newUrls.push(await uploadProductImage(f, token)); } catch (err) { alert(err instanceof Error ? err.message : "Ошибка"); } } setUploading(false); if (newUrls.length > 0) onChange(toJson([...parseImageList(galleryJson), ...newUrls].slice(0, MAX_IMAGES))); }}
        onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onClick={() => fileRef.current?.click()}
        style={{ padding: "14px", cursor: "pointer", textAlign: "center" }}
      >
        {uploading ? <span style={{ color: "#9b87f5", fontSize: "13px" }}>Загрузка...</span> : (
          <>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#666" strokeWidth="1.5" style={{ marginBottom: "4px" }}><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
            <div style={{ color: "#888", fontSize: "12px" }}>Перетащите или нажмите для выбора</div>
          </>
        )}
        <input ref={fileRef} type="file" accept={IMAGE_ACCEPT} multiple style={{ display: "none" }}
          onChange={async (e) => {
            const files = Array.from(e.target.files || []);
            e.target.value = "";
            if (!files.length) return;
            setUploading(true);
            const newUrls: string[] = [];
            for (const file of files) {
              try { newUrls.push(await uploadProductImage(file, token)); }
              catch (err) { alert(err instanceof Error ? err.message : "Ошибка загрузки"); }
            }
            setUploading(false);
            if (newUrls.length > 0) {
              onChange(toJson([...parseImageList(galleryJson), ...newUrls].slice(0, MAX_IMAGES)));
            }
          }} />
      </div>

      <button type="button" className="cms-btn cms-btn-xs" style={{ marginTop: "6px" }} onClick={onOpenMedia}>
        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ marginRight: "4px" }}><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>
        Из медиатеки
      </button>

      {photos.length > 0 && (
        <div style={{ fontSize: "11px", color: "var(--cms-text-muted)", marginTop: "6px" }}>
          Первое фото — каталог и корзина · ↑↓ для сортировки
        </div>
      )}

      <input ref={replaceRef} type="file" accept={IMAGE_ACCEPT} style={{ display: "none" }}
        onChange={(e) => {
          const file = e.target.files?.[0]; const idx = replaceIdx.current;
          e.target.value = ""; if (file && idx !== null) replace(idx, file);
          replaceIdx.current = null;
        }} />
    </div>
  );
}

// ─── CharacteristicsEditor ────────────────────────────────────────────────────

function CharacteristicsEditor({ value, onChange, lang }: { value: string; onChange: (v: string) => void; lang: Lang }) {
  let chars: CharEntry[] = [];
  try { chars = JSON.parse(value || "[]"); } catch { chars = []; }
  const update = (next: CharEntry[]) => onChange(toJson(next));

  return (
    <div>
      {chars.map((c, i) => (
        <div key={i} style={{ display: "grid", gridTemplateColumns: "1fr 1fr 28px", gap: "6px", marginBottom: "6px", alignItems: "center" }}>
          <input className="cms-input" placeholder={lang === "ru" ? "Название (RU)" : "Name (EN)"}
            value={lang === "ru" ? c.key : (c.keyEn || "")}
            onChange={(e) => update(chars.map((x, j) => j === i ? (lang === "ru" ? { ...x, key: e.target.value } : { ...x, keyEn: e.target.value }) : x))} />
          <input className="cms-input" placeholder={lang === "ru" ? "Значение (RU)" : "Value (EN)"}
            value={lang === "ru" ? c.value : (c.valueEn || "")}
            onChange={(e) => update(chars.map((x, j) => j === i ? (lang === "ru" ? { ...x, value: e.target.value } : { ...x, valueEn: e.target.value }) : x))} />
          <button type="button" onClick={() => update(chars.filter((_, j) => j !== i))}
            style={{ background: "none", border: "none", color: "#666", cursor: "pointer", fontSize: "16px", lineHeight: 1, padding: 0 }}>×</button>
        </div>
      ))}
      <button type="button" className="cms-btn cms-btn-xs"
        onClick={() => update([...chars, { key: "", keyEn: "", value: "", valueEn: "" }])}>
        + Добавить
      </button>
    </div>
  );
}

// ─── ColorPickerField ─────────────────────────────────────────────────────────

const COLOR_PALETTE = [
  '#ffffff','#000000','#1e293b','#374151','#6b7280','#9ca3af','#d1d5db','#f1f5f9',
  '#ef4444','#f97316','#f59e0b','#eab308','#84cc16','#22c55e','#10b981','#14b8a6',
  '#06b6d4','#3b82f6','#6366f1','#8b5cf6','#a855f7','#d946ef','#ec4899','#f43f5e',
  '#fca5a5','#fdba74','#fcd34d','#86efac','#6ee7b7','#93c5fd','#c4b5fd','#f0abfc',
  '#9b87f5','#e8722a','#ff6eb4','#ffb400','#a78bfa','#2dd4bf','#fb923c','#4ade80',
  '#1d4ed8','#7c3aed','#be185d','#0369a1','#065f46','#7c2d12','#581c87','#1e3a8a',
];

function ColorPickerField({ value, onChange }: { value: string; onChange: (hex: string) => void }) {
  const [open, setOpen] = useState(false);
  const [hexInput, setHexInput] = useState(value);

  useEffect(() => { setHexInput(value); }, [value]);

  const eyedrop = async () => {
    if (typeof window !== 'undefined' && 'EyeDropper' in window) {
      try {
        // @ts-expect-error EyeDropper is experimental API
        const ed = new window.EyeDropper();
        const result = await ed.open();
        onChange(result.sRGBHex);
        setHexInput(result.sRGBHex);
      } catch { /* user cancelled */ }
    }
  };

  return (
    <div style={{ position: 'relative', display: 'inline-block' }}>
      <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
        <button type="button" onClick={() => setOpen(v => !v)}
          style={{ width: 34, height: 34, borderRadius: 6, border: '2px solid rgba(255,255,255,0.18)', background: value, cursor: 'pointer', flexShrink: 0, boxShadow: '0 1px 4px rgba(0,0,0,0.4)' }} />
        <input type="text" value={hexInput}
          onChange={e => { setHexInput(e.target.value); if (/^#[0-9a-fA-F]{6}$/.test(e.target.value)) { onChange(e.target.value); } }}
          onBlur={() => setHexInput(value)}
          style={{ width: 78, fontFamily: 'monospace', fontSize: 12, padding: '4px 6px', background: '#141720', border: '1px solid #3a3f52', borderRadius: 6, color: '#fff' }} />
        <button type="button" onClick={eyedrop} title="Пипетка — выбрать цвет с экрана"
          style={{ background: '#1a1d27', border: '1px solid #3a3f52', borderRadius: 6, cursor: 'pointer', padding: '5px 6px', color: '#aaa', display: 'flex', alignItems: 'center' }}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M2 22l1-1h3l9-9"/><path d="M3 21v-3l9-9"/>
            <path d="M15 6l3.4-3.4a2.1 2.1 0 013 3L17 9l.4.4a2.1 2.1 0 010 3l-3.38 3.38a2.1 2.1 0 01-3 0L6 10.7a2.1 2.1 0 010-3L9.4 4.3a2.1 2.1 0 013 0L15 6z"/>
          </svg>
        </button>
      </div>
      {open && (
        <>
          <div style={{ position: 'fixed', inset: 0, zIndex: 55 }} onClick={() => setOpen(false)} />
          <div style={{ position: 'absolute', zIndex: 56, top: '100%', left: 0, marginTop: 4, background: '#1a1d27', border: '1px solid #3a3f52', borderRadius: 10, padding: 10, boxShadow: '0 8px 32px rgba(0,0,0,0.7)', minWidth: 270 }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(8, 1fr)', gap: 5, marginBottom: 4 }}>
              {COLOR_PALETTE.map(color => (
                <button key={color} type="button" title={color}
                  onClick={() => { onChange(color); setHexInput(color); setOpen(false); }}
                  style={{ width: '100%', aspectRatio: '1', borderRadius: 5, background: color, border: value === color ? '2px solid #fff' : '1px solid rgba(255,255,255,0.1)', cursor: 'pointer', transition: 'transform 0.1s' }}
                  onMouseEnter={e => (e.currentTarget.style.transform = 'scale(1.25)')}
                  onMouseLeave={e => (e.currentTarget.style.transform = '')} />
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

// ─── CustomBadgesEditor ───────────────────────────────────────────────────────

type CustomBadge = { text: string; textEn?: string; icon: string; color: string };

const BADGE_ICONS_LIST = ['pin','star','heart','fire','diamond','crown','leaf','bolt','check','sparkle','award','gift'];

function BadgeIconSvg({ icon, size = 11 }: { icon: string; size?: number }) {
  const s = size;
  const props = { width: s, height: s, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const, style: { display: 'inline-block', verticalAlign: 'middle', marginRight: 4 } };
  switch (icon) {
    case 'pin': return <svg {...props}><line x1="12" y1="17" x2="12" y2="22"/><path d="M5 17h14v-1.76a2 2 0 00-1.11-1.79l-1.78-.9A2 2 0 0115 10.76V6h1a2 2 0 000-4H8a2 2 0 000 4h1v4.76a2 2 0 01-1.11 1.79l-1.78.9A2 2 0 005 15.24V17z"/></svg>;
    case 'star': return <svg {...props}><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>;
    case 'heart': return <svg {...props}><path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z"/></svg>;
    case 'fire': return <svg {...props}><path d="M8.5 14.5A2.5 2.5 0 0011 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 01-7 7 7 7 0 01-7-7c0-1.153.433-2.294 1-3a2.5 2.5 0 002.5 2.5z"/></svg>;
    case 'diamond': return <svg {...props}><path d="M6 3h12l4 6-10 13L2 9z"/><path d="M11 3L8 9l4 13 4-13-3-6"/><path d="M2 9h20"/></svg>;
    case 'crown': return <svg {...props}><path d="M2 20h20"/><path d="M5 20V10l5.5 6L12 4l1.5 12L19 10v10"/></svg>;
    case 'leaf': return <svg {...props}><path d="M11 20A7 7 0 014 13V6s2 1 4 1 3-1 5-1 3.5.5 5.5.5V13a7 7 0 01-7 7z"/><path d="M4 6l7 14"/></svg>;
    case 'bolt': return <svg {...props}><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/></svg>;
    case 'check': return <svg {...props}><polyline points="20 6 9 17 4 12"/></svg>;
    case 'sparkle': return <svg {...props}><path d="M12 3v4M12 17v4M3 12h4M17 12h4M5.6 5.6l2.8 2.8M15.6 15.6l2.8 2.8M5.6 18.4l2.8-2.8M15.6 8.4l2.8-2.8"/></svg>;
    case 'award': return <svg {...props}><circle cx="12" cy="8" r="6"/><path d="M15.477 12.89L17 22l-5-3-5 3 1.523-9.11"/></svg>;
    case 'gift': return <svg {...props}><polyline points="20 12 20 22 4 22 4 12"/><rect x="2" y="7" width="20" height="5"/><path d="M12 22V7"/><path d="M12 7H7.5a2.5 2.5 0 010-5C11 2 12 7 12 7z"/><path d="M12 7h4.5a2.5 2.5 0 000-5C13 2 12 7 12 7z"/></svg>;
    default: return <svg {...props}><circle cx="12" cy="12" r="4"/></svg>;
  }
}

function CustomBadgesEditor({ value, onChange, lang }: { value: string; onChange: (v: string) => void; lang: Lang }) {
  const [textRu, setTextRu] = useState('');
  const [textEn, setTextEn] = useState('');
  const [icon, setIcon] = useState('star');
  const [color, setColor] = useState('#9b87f5');

  let badges: CustomBadge[] = [];
  try { badges = JSON.parse(value || '[]'); } catch { badges = []; }
  const update = (next: CustomBadge[]) => onChange(toJson(next));

  return (
    <div>
      {badges.length > 0 && (
        <div style={{ marginBottom: 10, border: '1px solid var(--cms-border)', borderRadius: 8 }}>
          {badges.map((b, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px', borderBottom: i < badges.length - 1 ? '1px solid var(--cms-border)' : 'none', flexWrap: 'wrap' }}>
              <span style={{ display: 'inline-flex', alignItems: 'center', padding: '3px 10px', borderRadius: 20, fontSize: 11, fontWeight: 700, background: b.color + '22', color: b.color, border: `1px solid ${b.color}66`, flexShrink: 0 }}>
                <BadgeIconSvg icon={b.icon} size={10} />{lang === 'ru' ? b.text : (b.textEn || b.text)}
              </span>
              <input className="cms-input" value={b.text} onChange={e => update(badges.map((x, j) => j === i ? { ...x, text: e.target.value } : x))} placeholder="Текст RU" style={{ flex: 1, minWidth: 80, fontSize: 12 }} />
              <input className="cms-input" value={b.textEn || ''} onChange={e => update(badges.map((x, j) => j === i ? { ...x, textEn: e.target.value } : x))} placeholder="Text EN" style={{ flex: 1, minWidth: 80, fontSize: 12 }} />
              <select className="cms-select" value={b.icon} onChange={e => update(badges.map((x, j) => j === i ? { ...x, icon: e.target.value } : x))} style={{ fontSize: 12, width: 86 }}>
                {BADGE_ICONS_LIST.map(k => <option key={k} value={k}>{k}</option>)}
              </select>
              <ColorPickerField value={b.color} onChange={c => update(badges.map((x, j) => j === i ? { ...x, color: c } : x))} />
              <button type="button" onClick={() => update(badges.filter((_, j) => j !== i))} style={{ color: '#f66', background: 'none', border: 'none', cursor: 'pointer', fontSize: 18, padding: 0 }}>×</button>
            </div>
          ))}
        </div>
      )}
      <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
        <input className="cms-input" value={textRu} onChange={e => setTextRu(e.target.value)} placeholder="Текст RU" style={{ flex: 1, minWidth: 90, fontSize: 12 }} />
        <input className="cms-input" value={textEn} onChange={e => setTextEn(e.target.value)} placeholder="Text EN" style={{ flex: 1, minWidth: 90, fontSize: 12 }} />
        <select className="cms-select" value={icon} onChange={e => setIcon(e.target.value)} style={{ fontSize: 12, width: 86 }}>
          {BADGE_ICONS_LIST.map(k => <option key={k} value={k}>{k}</option>)}
        </select>
        <ColorPickerField value={color} onChange={setColor} />
        <button type="button" className="cms-btn cms-btn-sm" onClick={() => {
          if (!textRu.trim()) return;
          update([...badges, { text: textRu.trim(), textEn: textEn.trim() || undefined, icon, color }]);
          setTextRu(''); setTextEn('');
        }}>+ Добавить</button>
      </div>
    </div>
  );
}

// ─── ColorsEditor (Выбор 3: фото из галереи + остатки) ───────────────────────

function ColorsEditor({ value, onChange, lang, galleryPhotos }: { value: string; onChange: (v: string) => void; token: string; lang: Lang; galleryPhotos?: string[] }) {
  const [nameRu, setNameRu] = useState(""); const [nameEn, setNameEn] = useState("");
  const [hex, setHex] = useState("#9b87f5"); const [stock, setStock] = useState<number | "">("");
  const [pickerForIdx, setPickerForIdx] = useState<number | null>(null);

  let colors: ColorEntry[] = [];
  try { const p = JSON.parse(value || "[]"); if (Array.isArray(p)) colors = p; } catch { colors = []; }
  const update = (next: ColorEntry[]) => onChange(toJson(next));
  const gallery = galleryPhotos && galleryPhotos.length > 0 ? galleryPhotos : [];

  return (
    <div style={{ position: "relative" }}>
      {colors.length > 0 && (
        <div style={{ marginBottom: "10px", border: "1px solid var(--cms-border)", borderRadius: "8px", overflow: "visible" }}>
          {colors.map((c, i) => (
            <div key={i} style={{ position: "relative", display: "grid", gridTemplateColumns: "auto auto 1fr auto auto", gap: "8px", alignItems: "center", padding: "7px 10px", borderBottom: i < colors.length - 1 ? "1px solid var(--cms-border)" : "none" }}>
              <span style={{ width: 16, height: 16, borderRadius: "50%", background: c.hex, border: "1px solid rgba(255,255,255,0.2)", display: "block", flexShrink: 0 }} />
              <span style={{ fontSize: "12px", color: "#ddd", minWidth: 60 }}>{lang === "ru" ? c.name : (c.nameEn || c.name)}</span>
              {/* Photo from gallery */}
              <div style={{ display: "flex", alignItems: "center", gap: "6px", position: "relative" }}>
                {c.photo ? (
                  <div style={{ position: "relative" }}>
                    <img src={c.photo} alt="" style={{ width: 32, height: 32, objectFit: "cover", borderRadius: 4, display: "block", cursor: "pointer" }}
                      onClick={() => setPickerForIdx(pickerForIdx === i ? null : i)}
                      onError={(e) => { (e.target as HTMLImageElement).style.opacity = "0.3"; }} />
                    <button type="button" onClick={() => update(colors.map((x, j) => j === i ? { ...x, photo: undefined } : x))}
                      style={{ position: "absolute", top: -4, right: -4, background: "#333", border: "none", borderRadius: "50%", color: "#f66", cursor: "pointer", width: 14, height: 14, fontSize: 10, lineHeight: 1, padding: 0 }}>×</button>
                  </div>
                ) : (
                  <button type="button" className="cms-btn cms-btn-xs" title="Выбрать фото из галереи" onClick={() => setPickerForIdx(pickerForIdx === i ? null : i)}>
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>
                  </button>
                )}
                {pickerForIdx === i && (
                  <div style={{ position: "absolute", top: "100%", left: 0, zIndex: 50, background: "var(--cms-surface, #1a1d27)", border: "1px solid var(--cms-border)", borderRadius: 8, padding: 8, boxShadow: "0 8px 24px rgba(0,0,0,0.5)", minWidth: 200, maxWidth: 280 }}>
                    <div style={{ fontSize: 11, color: "var(--cms-text-muted)", marginBottom: 6, fontWeight: 600 }}>Выберите фото из галереи товара</div>
                    {gallery.length === 0 ? (
                      <div style={{ fontSize: 12, color: "var(--cms-text-muted)", padding: "8px 0" }}>Сначала добавьте фотографии к товару</div>
                    ) : (
                      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(56px, 1fr))", gap: 6 }}>
                        {gallery.map((url, gi) => (
                          <img key={gi} src={url} alt="" title={url}
                            style={{ width: "100%", aspectRatio: "1", objectFit: "cover", borderRadius: 4, cursor: "pointer", border: c.photo === url ? "2px solid var(--cms-accent, #9b87f5)" : "2px solid transparent", opacity: 0.9 }}
                            onClick={() => { update(colors.map((x, j) => j === i ? { ...x, photo: url } : x)); setPickerForIdx(null); }}
                            onError={(e) => { (e.target as HTMLImageElement).style.opacity = "0.2"; }} />
                        ))}
                      </div>
                    )}
                    <button type="button" onClick={() => setPickerForIdx(null)}
                      style={{ marginTop: 8, fontSize: 11, color: "var(--cms-text-muted)", background: "none", border: "none", cursor: "pointer", padding: 0 }}>Закрыть</button>
                  </div>
                )}
              </div>
              <input type="number" min="0" className="cms-input" value={c.stock ?? ""} placeholder="—"
                onChange={(e) => update(colors.map((x, j) => j === i ? { ...x, stock: e.target.value === "" ? undefined : Number(e.target.value) } : x))}
                style={{ width: 64, fontSize: "12px", padding: "2px 6px", height: 28 }} />
              <button type="button" onClick={() => update(colors.filter((_, j) => j !== i))}
                style={{ background: "none", border: "none", color: "#666", cursor: "pointer", fontSize: "16px", padding: 0 }}>×</button>
            </div>
          ))}
        </div>
      )}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr auto 70px auto", gap: "6px", alignItems: "center" }}>
        <input className="cms-input" placeholder="Название (RU)" value={nameRu} onChange={e => setNameRu(e.target.value)} style={{ fontSize: "12px" }} />
        <input className="cms-input" placeholder="Name (EN)" value={nameEn} onChange={e => setNameEn(e.target.value)} style={{ fontSize: "12px" }} />
        <ColorPickerField value={hex} onChange={setHex} />
        <input type="number" min="0" className="cms-input" placeholder="Остаток" value={stock}
          onChange={e => setStock(e.target.value === "" ? "" : Number(e.target.value))} style={{ fontSize: "12px" }} />
        <button type="button" className="cms-btn cms-btn-sm" onClick={() => {
          if (!nameRu.trim()) return;
          update([...colors, { name: nameRu.trim(), nameEn: nameEn.trim() || undefined, hex, stock: stock === "" ? undefined : Number(stock) }]);
          setNameRu(""); setNameEn(""); setStock("");
        }}>+</button>
      </div>
    </div>
  );
}

// ─── Section divider ──────────────────────────────────────────────────────────

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: "20px" }}>
      <div style={{ fontSize: "11px", fontWeight: 600, color: "var(--cms-text-muted)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: "10px", paddingBottom: "6px", borderBottom: "1px solid var(--cms-border)" }}>{title}</div>
      {children}
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function AdminProductsPage() {
  const router = useRouter();
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Product | null>(null);
  const [isNew, setIsNew] = useState(false);
  const [form, setForm] = useState(emptyProduct);
  const [lang, setLang] = useState<Lang>("ru");
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
  const [showFilters, setShowFilters] = useState(false);
  const [showExport, setShowExport] = useState(false);
  const [mediaPickerOpen, setMediaPickerOpen] = useState(false);
  const [mediaItems, setMediaItems] = useState<MediaItem[]>([]);
  const [mediaLoading, setMediaLoading] = useState(false);
  const [mediaSearch, setMediaSearch] = useState("");

  const getToken = useCallback(() => typeof window !== "undefined" ? localStorage.getItem("admin_token") : null, []);
  const notify = useCallback((msg: string) => { setNotification(msg); setTimeout(() => setNotification(""), 3200); }, []);

  const req = useCallback(async (url: string, init: RequestInit = {}): Promise<{ ok: boolean; status: number; data: unknown }> => {
    for (let i = 1; i <= 3; i++) {
      try {
        const res = await fetch(url, { cache: "no-store", ...init });
        const data = await res.json().catch(() => ({}));
        if (res.ok) return { ok: true, status: res.status, data };
        if (![429, 500, 502, 503, 504].includes(res.status) || i === 3) return { ok: false, status: res.status, data };
      } catch { if (i === 3) return { ok: false, status: 0, data: {} }; }
      await new Promise(r => setTimeout(r, 180 * i));
    }
    return { ok: false, status: 0, data: {} };
  }, []);

  const fetchProducts = useCallback(async () => {
    const token = getToken();
    if (!token) { router.push("/admin/login"); return; }
    const r = await req("/api/products?showAll=true&includeArchived=true", { headers: { Authorization: `Bearer ${token}` } });
    if (r.ok && Array.isArray(r.data)) {
      setProducts(prev => {
        const next = r.data as Product[];
        if (next.length === 0 && prev.length > 0) { notify("Сбой чтения — показаны кешированные данные"); return prev; }
        return next;
      });
    } else { notify("Не удалось загрузить товары"); }
    setLoading(false);
  }, [getToken, notify, req, router]);

  const fetchMedia = useCallback(async () => {
    const token = getToken(); if (!token) return;
    setMediaLoading(true);
    try {
      const r = await req("/api/admin/upload/images", { headers: { Authorization: `Bearer ${token}` } });
      const d = r.data as { success?: boolean; items?: unknown[] };
      if (r.ok && d?.success && Array.isArray(d.items)) {
        setMediaItems(d.items.filter((x): x is Record<string, unknown> => typeof x === "object" && x !== null)
          .map(x => ({ filename: String(x.filename||""), relativePath: String(x.relativePath||""), url: String(x.url||""), size: Number(x.size||0), updatedAt: String(x.updatedAt||"") })));
      }
    } finally { setMediaLoading(false); }
  }, [getToken, req]);

  useEffect(() => {
    if (!getToken()) { router.push("/admin/login"); return; }
    fetchProducts();
  }, [fetchProducts, getToken, router]);

  useEffect(() => {
    const t = setTimeout(() => setSearch(searchInput.trim().toLowerCase()), 180);
    return () => clearTimeout(t);
  }, [searchInput]);

  // Merge product.image into gallery (images array), deduped, main first
  const buildGallery = (p: { image: string; images: string }): string => {
    const list = parseImageList(p.images);
    if (p.image && !list.includes(p.image)) return toJson([p.image, ...list]);
    if (p.image && list[0] !== p.image) {
      const rest = list.filter(u => u !== p.image);
      return toJson([p.image, ...rest]);
    }
    return p.images || "[]";
  };

  const openProduct = (p: Product) => {
    setSelected(p); setIsNew(false); setLang("ru");
    setForm({
      name: p.name, nameRu: p.nameRu || "", slug: p.slug,
      description: p.description, descriptionRu: p.descriptionRu || "",
      price: p.price, shippingFee: p.shippingFee ?? 0, oldPrice: p.oldPrice,
      discount: p.discount, stock: p.stock, currency: p.currency,
      image: p.image, images: buildGallery(p),
      inStock: p.inStock, isPreorder: p.isPreorder,
      preorderClosed: p.preorderClosed || false,
      preorderAvailableDate: p.preorderAvailableDate ? new Date(p.preorderAvailableDate).toISOString().split("T")[0] : "",
      isAuthor: p.isAuthor, isLimited: p.isLimited || false,
      limitedEditionText: p.limitedEditionText || "",
      limitedEditionTextEn: p.limitedEditionTextEn || "",
      noticeText: p.noticeText || "", noticeTextEn: p.noticeTextEn || "",
      shippingConditions: p.shippingConditions || "[]",
      isActive: p.isActive, isAvailable: p.isAvailable ?? true, isSaleDisabled: p.isSaleDisabled || false,
      isSoldOut: p.isSoldOut || false, sortOrder: p.sortOrder,
      characteristics: p.characteristics || "[]", colors: p.colors || "[]",
      customBadges: p.customBadges || "[]",
    });
  };

  const openNew = () => { setIsNew(true); setSelected(null); setLang("ru"); setForm({ ...emptyProduct }); };
  const closeDialog = () => { setSelected(null); setIsNew(false); };

  const duplicateProduct = (p: Product) => {
    setIsNew(true); setSelected(null); setLang("ru");
    setForm({
      name: p.name + " (copy)", nameRu: (p.nameRu || p.name) + " (копия)",
      slug: p.slug + "-copy", description: p.description, descriptionRu: p.descriptionRu || "",
      price: p.price, shippingFee: p.shippingFee ?? 0, oldPrice: p.oldPrice,
      discount: p.discount, stock: p.stock, currency: p.currency,
      image: p.image, images: buildGallery(p),
      inStock: p.inStock, isPreorder: p.isPreorder, preorderClosed: false,
      preorderAvailableDate: "",
      isAuthor: p.isAuthor, isLimited: p.isLimited || false,
      limitedEditionText: p.limitedEditionText || "",
      limitedEditionTextEn: p.limitedEditionTextEn || "",
      noticeText: p.noticeText || "", noticeTextEn: p.noticeTextEn || "",
      shippingConditions: p.shippingConditions || "[]",
      isActive: false, isAvailable: true, isSaleDisabled: p.isSaleDisabled || false,
      isSoldOut: false, characteristics: p.characteristics || "[]",
      colors: p.colors || "[]", customBadges: p.customBadges || "[]", sortOrder: p.sortOrder,
    });
  };

  const buildPayload = (f: typeof form) => {
    const gallery = parseImageList(f.images);
    return {
      ...f, price: Number(f.price), shippingFee: Number(f.shippingFee) || 0,
      oldPrice: f.oldPrice !== null && f.oldPrice !== undefined ? Number(f.oldPrice) : null,
      discount: Number(f.discount), stock: Number(f.stock), sortOrder: Number(f.sortOrder),
      image: gallery[0] || f.image || "",
      preorderAvailableDate: f.preorderAvailableDate ? new Date(f.preorderAvailableDate).toISOString() : null,
    };
  };

  const updateById = useCallback(async (p: Product, overrides: Record<string, unknown>) => {
    const token = getToken(); if (!token) return false;
    const gallery = parseImageList(p.images);
    const payload = {
      name: p.name, nameRu: p.nameRu || "", slug: p.slug,
      description: p.description, descriptionRu: p.descriptionRu || "",
      price: p.price, shippingFee: p.shippingFee ?? 0, oldPrice: p.oldPrice,
      discount: p.discount, stock: p.stock, currency: p.currency,
      image: gallery[0] || p.image || "", images: p.images,
      inStock: p.inStock, isPreorder: p.isPreorder, preorderClosed: p.preorderClosed || false,
      preorderAvailableDate: p.preorderAvailableDate || null,
      isAuthor: p.isAuthor, isLimited: p.isLimited || false,
      limitedEditionText: p.limitedEditionText || "", isActive: p.isActive,
      isAvailable: p.isAvailable ?? true,
      isSaleDisabled: p.isSaleDisabled || false, isSoldOut: p.isSoldOut || false,
      characteristics: p.characteristics || "[]", colors: p.colors || "[]",
      sortOrder: p.sortOrder, ...overrides,
    };
    const r = await req(`/api/products/${p.id}`, { method: "PUT", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` }, body: JSON.stringify(payload) });
    if (!r.ok) { notify((r.data as Record<string,string>)?.error || "Ошибка сохранения"); return false; }
    return true;
  }, [getToken, notify, req]);

  const handleSave = async () => {
    setSaving(true);
    const token = getToken();
    const url = isNew ? "/api/products" : `/api/products/${selected!.id}`;
    const r = await req(url, { method: isNew ? "POST" : "PUT", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` }, body: JSON.stringify(buildPayload(form)) });
    if (r.ok) {
      const saved = r.data as Product;
      setProducts(prev => isNew ? [saved, ...prev] : prev.map(p => p.id === selected?.id ? saved : p));
      notify(isNew ? "Товар создан" : "Товар сохранён");
      closeDialog(); fetchProducts();
    } else {
      notify(`Ошибка: ${(r.data as Record<string,string>)?.error || "неизвестная"}`);
    }
    setSaving(false);
  };

  const handleDelete = async (ids: string[]) => {
    const token = getToken(); const hard = archiveView === "archived";
    let failed = 0;
    for (const id of ids) {
      const r = await req(`/api/products/${id}${hard ? "?hard=true" : ""}`, { method: "DELETE", headers: { Authorization: `Bearer ${token}` } });
      if (!r.ok) failed++;
    }
    notify(failed > 0 ? `Обработано: ${ids.length - failed}, ошибок: ${failed}` : `Готово: ${ids.length}`);
    if (failed < ids.length) setProducts(prev => prev.filter(p => !ids.includes(p.id)));
    setDeleteConfirm(null); setCheckedIds(new Set()); fetchProducts();
  };

  const applyBulk = useCallback(async () => {
    const ids = Array.from(checkedIds);
    if (!ids.length) { notify("Выберите товары"); return; }
    if (bulkAction === "none") { notify("Выберите действие"); return; }
    if (bulkAction === "archive") { setDeleteConfirm(ids); return; }
    const overridesMap: Record<BulkAction, Record<string, unknown>> = {
      none: {}, activate: { isActive: true }, deactivate: { isActive: false },
      makeAvailable: { inStock: true }, makeUnavailable: { inStock: false },
      markSoon: { isSaleDisabled: true }, unmarkSoon: { isSaleDisabled: false },
      markSoldOut: { isSoldOut: true }, unmarkSoldOut: { isSoldOut: false }, archive: {},
    };
    const selected2 = products.filter(p => checkedIds.has(p.id));
    setBulkApplying(true);
    let ok = 0;
    for (const p of selected2) { if (await updateById(p, overridesMap[bulkAction])) ok++; }
    setBulkApplying(false); setBulkAction("none"); setCheckedIds(new Set());
    await fetchProducts(); notify(`Обновлено: ${ok} из ${selected2.length}`);
  }, [bulkAction, checkedIds, fetchProducts, notify, products, updateById]);

  const formatPrice = (n: number) => new Intl.NumberFormat("ru-RU", { style: "currency", currency: "RUB", minimumFractionDigits: 0 }).format(n);

  const getStatusBadges = (p: Product) => {
    const b: Array<{ label: string; cls: string }> = [];
    if (!p.isActive) b.push({ label: "Архив", cls: "cms-badge-red" });
    if (p.isPreorder) b.push({ label: "Предзаказ", cls: "cms-badge-blue" });
    if (p.isSaleDisabled) b.push({ label: "Скоро", cls: "cms-badge-yellow" });
    if (p.isSoldOut) b.push({ label: "Sold Out", cls: "cms-badge-red" });
    if (p.discount > 0) b.push({ label: `-${p.discount}%`, cls: "cms-badge-green" });
    if (p.isAuthor) b.push({ label: "Signature", cls: "cms-badge-blue" });
    if (p.isLimited) b.push({ label: "Limited", cls: "cms-badge-yellow" });
    if (p.inStock && p.stock <= LOW_STOCK_THRESHOLD && !p.isSaleDisabled && !p.isSoldOut) b.push({ label: `Мало: ${p.stock}`, cls: "cms-badge-red" });
    if (b.length === 0 && p.inStock) b.push({ label: "В продаже", cls: "cms-badge-green" });
    return b;
  };

  const stats = useMemo(() => ({
    active: products.filter(p => p.isActive).length,
    archived: products.filter(p => !p.isActive).length,
    onSale: products.filter(p => p.isActive && p.inStock && !p.isSaleDisabled && !p.isSoldOut).length,
    soon: products.filter(p => p.isSaleDisabled).length,
    soldOut: products.filter(p => p.isSoldOut).length,
  }), [products]);

  const filtered = useMemo(() => {
    const rows = products.filter(p => {
      if (archiveView === "active" && !p.isActive) return false;
      if (archiveView === "archived" && p.isActive) return false;
      if (search && ![p.name, p.nameRu, p.slug, p.description, p.descriptionRu].join(" ").toLowerCase().includes(search)) return false;
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
      if (sortMode === "priceAsc") return a.price - b.price;
      if (sortMode === "priceDesc") return b.price - a.price;
      if (sortMode === "stockAsc") return a.stock - b.stock;
      if (sortMode === "stockDesc") return b.stock - a.stock;
      if (sortMode === "nameAsc") return (a.nameRu || a.name).localeCompare(b.nameRu || b.name, "ru");
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });
    return rows;
  }, [archiveView, filterStatus, filterStock, filterType, products, search, sortMode]);

  const toggleAll = () => checkedIds.size === filtered.length ? setCheckedIds(new Set()) : setCheckedIds(new Set(filtered.map(p => p.id)));
  const toggleCheck = (id: string) => setCheckedIds(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });

  const adminToken = typeof window !== "undefined" ? (getToken() || "") : "";
  const filteredMedia = mediaItems.filter(m => !mediaSearch || m.filename.toLowerCase().includes(mediaSearch.toLowerCase()));

  if (loading) return <div className="cms-loading"><div className="cms-spinner" /> Загрузка...</div>;

  const hasFilters = filterStock !== "all" || filterType !== "all" || filterStatus !== "all" || search;

  return (
    <div className="cms-root">
      <AdminSidebar />
      <main className="cms-main">

        {/* ── Header ── */}
        <div className="cms-header">
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <h1 className="cms-header-title">Товары</h1>
            <span style={{ fontSize: 12, color: "var(--cms-text-muted)", background: "var(--cms-surface)", border: "1px solid var(--cms-border)", borderRadius: 12, padding: "1px 8px" }}>{products.length}</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <button className="cms-btn cms-btn-sm cms-btn-primary" onClick={openNew} title="Добавить товар">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
            </button>
            <div style={{ position: "relative" }}>
              <button className="cms-btn cms-btn-sm" onClick={() => setShowExport(v => !v)} title="Импорт / Экспорт">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M8 3H5a2 2 0 00-2 2v3"/><path d="M16 3h3a2 2 0 012 2v3"/><path d="M8 21H5a2 2 0 01-2-2v-3"/><path d="M16 21h3a2 2 0 002-2v-3"/></svg>
              </button>
              {showExport && (
                <div onClick={() => setShowExport(false)} style={{ position: "fixed", inset: 0, zIndex: 999 }} />
              )}
              {showExport && (
                <div style={{ position: "absolute", right: 0, top: "calc(100% + 4px)", background: "var(--cms-surface)", border: "1px solid var(--cms-border)", borderRadius: 8, minWidth: 150, zIndex: 1000, overflow: "hidden", boxShadow: "0 8px 24px rgba(0,0,0,0.4)" }}>
                  <a href="/api/admin/export?type=products&format=xls" download className="cms-btn" style={{ display: "flex", alignItems: "center", gap: 8, borderRadius: 0, border: "none", borderBottom: "1px solid var(--cms-border)", padding: "9px 14px", fontSize: 13, width: "100%" }}>
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                    Экспорт XLS
                  </a>
                  <button className="cms-btn" style={{ display: "flex", alignItems: "center", gap: 8, borderRadius: 0, border: "none", padding: "9px 14px", fontSize: 13, width: "100%", opacity: 0.5, cursor: "not-allowed" }}>
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
                    Импорт
                  </button>
                </div>
              )}
            </div>
            <button className="cms-btn cms-btn-sm" onClick={() => { setLoading(true); fetchProducts(); }} title="Обновить">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M23 4v6h-6M1 20v-6h6"/><path d="M3.51 9a9 9 0 0114.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0020.49 15"/></svg>
            </button>
          </div>
        </div>

        <div className="cms-content">
          {/* ── Toolbar ── */}
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10, flexWrap: "wrap" }}>
            {/* Все tab */}
            <button
              className={`cms-btn cms-btn-sm${archiveView === "active" && !hasFilters ? " cms-btn-primary" : ""}`}
              onClick={() => { setArchiveView("active"); setFilterStock("all"); setFilterType("all"); setFilterStatus("all"); setSearchInput(""); setSearch(""); }}
              style={{ display: "flex", alignItems: "center", gap: 5 }}
            >
              Все
              <span style={{ background: "rgba(255,255,255,0.15)", borderRadius: 10, padding: "0 5px", fontSize: 11, fontWeight: 600 }}>{stats.active}</span>
            </button>

            {/* Filter toggle */}
            <button
              className={`cms-btn cms-btn-sm${showFilters || hasFilters ? " cms-btn-primary" : ""}`}
              onClick={() => setShowFilters(v => !v)} title="Фильтры"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="4" y1="6" x2="20" y2="6"/><line x1="8" y1="12" x2="16" y2="12"/><line x1="11" y1="18" x2="13" y2="18"/></svg>
              {hasFilters && <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#9b87f5", display: "inline-block", marginLeft: 2 }} />}
            </button>

            {/* Search */}
            <input
              className="cms-input"
              placeholder="Поиск по товарам..."
              value={searchInput}
              onChange={e => setSearchInput(e.target.value)}
              style={{ flex: 1, minWidth: 160, maxWidth: 320, height: 32, fontSize: 13 }}
            />

            {/* Archive toggle */}
            <button
              className={`cms-btn cms-btn-sm${archiveView === "archived" ? " cms-btn-primary" : ""}`}
              onClick={() => setArchiveView(v => v === "archived" ? "active" : "archived")} title="Архив"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="21 8 21 21 3 21 3 8"/><rect x="1" y="3" width="22" height="5"/><line x1="10" y1="12" x2="14" y2="12"/></svg>
              {archiveView === "archived" && <span style={{ marginLeft: 4, fontSize: 11 }}>Архив</span>}
            </button>

            {checkedIds.size > 0 && (
              <>
                <select className="cms-select" value={bulkAction} onChange={e => setBulkAction(e.target.value as BulkAction)} disabled={bulkApplying} style={{ height: 32, fontSize: 12 }}>
                  <option value="none">Действие...</option>
                  <option value="activate">Активировать</option>
                  <option value="deactivate">Скрыть</option>
                  <option value="makeAvailable">В наличии</option>
                  <option value="makeUnavailable">Нет в наличии</option>
                  <option value="markSoon">→ Скоро</option>
                  <option value="unmarkSoon">← Снять Скоро</option>
                  <option value="markSoldOut">→ Sold Out</option>
                  <option value="unmarkSoldOut">← Снять Sold Out</option>
                  <option value="archive">{archiveView === "archived" ? "Удалить" : "В архив"}</option>
                </select>
                <button className="cms-btn cms-btn-sm cms-btn-primary" onClick={applyBulk} disabled={bulkApplying}>
                  {bulkApplying ? "..." : `Применить (${checkedIds.size})`}
                </button>
              </>
            )}
          </div>

          {/* Filter panel */}
          {showFilters && (
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 10, padding: "10px 12px", background: "var(--cms-surface)", border: "1px solid var(--cms-border)", borderRadius: 8 }}>
              <select className="cms-select" value={filterStock} onChange={e => setFilterStock(e.target.value as StockFilter)} style={{ fontSize: 12, height: 30 }}>
                <option value="all">Наличие: все</option>
                <option value="inStock">В наличии</option>
                <option value="outOfStock">Нет в наличии</option>
                <option value="preorder">Предзаказ</option>
                <option value="lowStock">Мало (≤{LOW_STOCK_THRESHOLD})</option>
              </select>
              <select className="cms-select" value={filterType} onChange={e => setFilterType(e.target.value as TypeFilter)} style={{ fontSize: 12, height: 30 }}>
                <option value="all">Тип: все</option>
                <option value="author">Авторские</option>
                <option value="limited">Лимитированные</option>
              </select>
              <select className="cms-select" value={filterStatus} onChange={e => setFilterStatus(e.target.value as StatusFilter)} style={{ fontSize: 12, height: 30 }}>
                <option value="all">Статус: все</option>
                <option value="onSale">В продаже</option>
                <option value="soon">Скоро</option>
                <option value="soldOut">Sold Out</option>
              </select>
              <select className="cms-select" value={sortMode} onChange={e => setSortMode(e.target.value as SortMode)} style={{ fontSize: 12, height: 30 }}>
                <option value="updatedDesc">Новые</option>
                <option value="nameAsc">По имени</option>
                <option value="priceAsc">Цена ↑</option>
                <option value="priceDesc">Цена ↓</option>
                <option value="stockAsc">Остаток ↑</option>
                <option value="stockDesc">Остаток ↓</option>
              </select>
              {hasFilters && (
                <button className="cms-btn cms-btn-sm" onClick={() => { setFilterStock("all"); setFilterType("all"); setFilterStatus("all"); setSortMode("updatedDesc"); setSearchInput(""); setSearch(""); }}>
                  Сбросить
                </button>
              )}
              <span style={{ fontSize: 12, color: "var(--cms-text-muted)", alignSelf: "center", marginLeft: "auto" }}>
                {filtered.length} из {products.length}
              </span>
            </div>
          )}

          {/* ── Desktop Table ── */}
          <div className="cms-table-wrap cms-products-desktop-table">
            <table className="cms-table">
              <thead>
                <tr>
                  <th style={{ width: 32 }}><input type="checkbox" checked={checkedIds.size === filtered.length && filtered.length > 0} onChange={toggleAll} /></th>
                  <th style={{ width: 52 }}>Фото</th>
                  <th>Товар</th>
                  <th>Статусы</th>
                  <th>Цена</th>
                  <th>Остаток</th>
                  <th style={{ width: 120 }}></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(p => (
                  <tr key={p.id} className={checkedIds.has(p.id) ? "cms-row-selected" : ""}>
                    <td><input type="checkbox" checked={checkedIds.has(p.id)} onChange={() => toggleCheck(p.id)} /></td>
                    <td>
                      {p.image ? (
                        <img src={p.image} alt="" className="cms-products-thumb" onClick={() => openProduct(p)}
                          style={{ cursor: "pointer" }}
                          onError={(e) => { (e.target as HTMLImageElement).style.opacity = "0.3"; }} />
                      ) : (
                        <div className="cms-products-thumb cms-products-thumb-empty">—</div>
                      )}
                    </td>
                    <td>
                      <div className="cms-td-bold" style={{ cursor: "pointer" }} onClick={() => openProduct(p)}>{p.nameRu || p.name}</div>
                      <div className="cms-td-mono" style={{ fontSize: 11, marginTop: 2 }}>{p.slug}</div>
                    </td>
                    <td>
                      <div className="cms-products-badges">
                        {getStatusBadges(p).map((b, idx) => <span key={idx} className={`cms-badge ${b.cls}`}>{b.label}</span>)}
                      </div>
                    </td>
                    <td>
                      <div>{formatPrice(p.price)}</div>
                      {p.oldPrice && p.oldPrice > p.price && <div style={{ fontSize: 11, color: "var(--cms-text-muted)", textDecoration: "line-through" }}>{formatPrice(p.oldPrice)}</div>}
                    </td>
                    <td style={{ fontWeight: 700 }}>{p.stock}</td>
                    <td>
                      <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
                        {/* Edit */}
                        <button className="cms-btn cms-btn-xs" onClick={() => openProduct(p)} title="Изменить">
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 013 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>
                        </button>
                        {/* Duplicate */}
                        <button className="cms-btn cms-btn-xs" onClick={() => duplicateProduct(p)} title="Дубль">
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="9" y="9" width="13" height="13" rx="2"/><rect x="2" y="2" width="13" height="13" rx="2"/></svg>
                        </button>
                        {/* Hide/Show */}
                        <button className="cms-btn cms-btn-xs" onClick={async () => { const ok = await updateById(p, { isActive: !p.isActive }); if (ok) fetchProducts(); }} title={p.isActive ? "Скрыть" : "Показать"}>
                          {p.isActive
                            ? <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17.94 17.94A10.94 10.94 0 0112 20C7 20 2.73 16.89 1 12c.82-2.33 2.23-4.31 4.06-5.94"/><path d="M9.9 4.24A10.95 10.95 0 0112 4c5 0 9.27 3.11 11 8a11.8 11.8 0 01-2.16 3.19"/><line x1="1" y1="1" x2="23" y2="23"/></svg>
                            : <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>}
                        </button>
                        {/* Archive */}
                        <button className="cms-btn cms-btn-xs cms-btn-danger" onClick={() => setDeleteConfirm([p.id])} title={archiveView === "archived" ? "Удалить" : "В архив"}>
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="21 8 21 21 3 21 3 8"/><rect x="1" y="3" width="22" height="5"/><line x1="10" y1="12" x2="14" y2="12"/></svg>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {filtered.length === 0 && (
                  <tr><td colSpan={7} style={{ textAlign: "center", padding: 32, color: "var(--cms-text-muted)" }}>Товары не найдены</td></tr>
                )}
              </tbody>
            </table>
          </div>

          {/* ── Mobile Cards ── */}
          <div className="cms-products-mobile-list">
            {filtered.map(p => (
              <div key={p.id} className="cms-products-mobile-card">
                <div className="cms-products-mobile-head">
                  <label style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <input type="checkbox" checked={checkedIds.has(p.id)} onChange={() => toggleCheck(p.id)} />
                    {p.image ? <img src={p.image} alt="" className="cms-products-thumb" onError={(e) => { (e.target as HTMLImageElement).style.opacity = "0.3"; }} /> : <div className="cms-products-thumb cms-products-thumb-empty">—</div>}
                  </label>
                  <div style={{ flex: 1 }}>
                    <div className="cms-td-bold">{p.nameRu || p.name}</div>
                    <div className="cms-td-mono" style={{ fontSize: 11 }}>{p.slug}</div>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <div style={{ fontWeight: 700 }}>{formatPrice(p.price)}</div>
                    <div style={{ fontSize: 12, color: "var(--cms-text-muted)" }}>Остаток: {p.stock}</div>
                  </div>
                </div>
                <div className="cms-products-badges" style={{ marginBottom: 8 }}>
                  {getStatusBadges(p).map((b, idx) => <span key={idx} className={`cms-badge ${b.cls}`}>{b.label}</span>)}
                </div>
                <div className="cms-products-row-actions">
                  <button className="cms-btn cms-btn-xs" onClick={() => openProduct(p)} title="Изменить">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 013 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>
                  </button>
                  <button className="cms-btn cms-btn-xs" onClick={() => duplicateProduct(p)} title="Дубль">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="9" y="9" width="13" height="13" rx="2"/><rect x="2" y="2" width="13" height="13" rx="2"/></svg>
                  </button>
                  <button className="cms-btn cms-btn-xs" onClick={async () => { const ok = await updateById(p, { isActive: !p.isActive }); if (ok) fetchProducts(); }} title={p.isActive ? "Скрыть" : "Показать"}>
                    {p.isActive
                      ? <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17.94 17.94A10.94 10.94 0 0112 20C7 20 2.73 16.89 1 12c.82-2.33 2.23-4.31 4.06-5.94"/><line x1="1" y1="1" x2="23" y2="23"/></svg>
                      : <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>}
                  </button>
                  <button className="cms-btn cms-btn-xs cms-btn-danger" onClick={() => setDeleteConfirm([p.id])} title={archiveView === "archived" ? "Удалить" : "В архив"}>
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="21 8 21 21 3 21 3 8"/><rect x="1" y="3" width="22" height="5"/></svg>
                  </button>
                </div>
              </div>
            ))}
            {filtered.length === 0 && <div className="cms-products-mobile-empty">Товары не найдены</div>}
          </div>
        </div>
      </main>

      {/* ═══ Edit Modal ═══ */}
      {(selected || isNew) && (
        <div className="cms-modal-overlay" onClick={closeDialog}>
          <div className="cms-modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 660, width: "100%" }}>
            <div className="cms-modal-header">
              <h3 style={{ margin: 0, fontSize: 15 }}>{isNew ? "Новый товар" : (form.nameRu || form.name || "Редактирование")}</h3>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginLeft: "auto" }}>
                {/* Lang toggle */}
                <div style={{ display: "flex", background: "var(--cms-bg)", border: "1px solid var(--cms-border)", borderRadius: 6, overflow: "hidden", fontSize: 12 }}>
                  {(["ru", "en"] as Lang[]).map(l => (
                    <button key={l} type="button" onClick={() => setLang(l)}
                      style={{ padding: "3px 10px", border: "none", cursor: "pointer", fontWeight: lang === l ? 700 : 400, background: lang === l ? "var(--cms-accent, #9b87f5)" : "transparent", color: lang === l ? "#fff" : "var(--cms-text-muted)", textTransform: "uppercase", letterSpacing: "0.04em" }}>
                      {l}
                    </button>
                  ))}
                </div>
                <button className="cms-modal-close" onClick={closeDialog}>&times;</button>
              </div>
            </div>

            <div className="cms-modal-body" style={{ maxHeight: "70vh", overflowY: "auto", padding: "16px 20px" }}>

              {/* ── Slug ── */}
              <div style={{ marginBottom: 16 }}>
                <label className="cms-label">
                  Slug
                  <input className="cms-input" value={form.slug} onChange={e => setForm({ ...form, slug: e.target.value })} placeholder="tenderly-vibe" style={{ fontFamily: "monospace", fontSize: 13 }} />
                </label>
              </div>

              {/* ── Название ── */}
              <Section title="Название">
                <input className="cms-input" placeholder={lang === "ru" ? "Название на русском" : "Name in English"}
                  value={lang === "ru" ? form.nameRu : form.name}
                  onChange={e => {
                    if (lang === "ru") {
                      const nameRu = e.target.value;
                      setForm(prev => ({ ...prev, nameRu, ...(isNew && (!prev.slug || prev.slug === slugify(prev.nameRu)) ? { slug: slugify(nameRu) } : {}) }));
                    } else {
                      setForm(prev => ({ ...prev, name: e.target.value }));
                    }
                  }} />
              </Section>

              {/* ── Описание ── */}
              <Section title="Описание">
                <textarea className="cms-textarea" rows={3} style={{ width: "100%" }}
                  placeholder={lang === "ru" ? "Описание на русском" : "Description in English"}
                  value={lang === "ru" ? form.descriptionRu : form.description}
                  onChange={e => setForm(prev => lang === "ru" ? { ...prev, descriptionRu: e.target.value } : { ...prev, description: e.target.value })} />
              </Section>

              {/* ── Товар ── */}
              <Section title="Товар">
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10, marginBottom: 10 }}>
                  <label className="cms-label">
                    Цена (₽)
                    <input className="cms-input" type="number" min="0" value={form.price} onChange={e => setForm({ ...form, price: Number(e.target.value) })} />
                  </label>
                  <label className="cms-label">
                    Прежняя цена
                    <input className="cms-input" type="number" min="0" value={form.oldPrice || ""} onChange={e => setForm({ ...form, oldPrice: e.target.value ? Number(e.target.value) : null })} placeholder="—" />
                  </label>
                  <label className="cms-label">
                    Скидка %
                    <input className="cms-input" type="number" min="0" max="100" value={form.discount} onChange={e => setForm({ ...form, discount: Number(e.target.value) })} />
                  </label>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
                  <label className="cms-label">
                    Доставка (₽)
                    <input className="cms-input" type="number" min="0" value={form.shippingFee} onChange={e => setForm({ ...form, shippingFee: Number(e.target.value) })} />
                  </label>
                  <label className="cms-label">
                    Остаток (шт.)
                    <input className="cms-input" type="number" min="0" value={form.stock} onChange={e => setForm({ ...form, stock: Number(e.target.value) })} />
                  </label>
                  <label className="cms-label">
                    Порядок
                    <input className="cms-input" type="number" value={form.sortOrder} onChange={e => setForm({ ...form, sortOrder: Number(e.target.value) })} />
                  </label>
                </div>
                {/* Shipping conditions */}
                <div style={{ marginTop: 12, padding: "10px 12px", background: "rgba(155,135,245,0.05)", border: "1px solid rgba(155,135,245,0.15)", borderRadius: 8 }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: "var(--cms-text-muted)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 8 }}>
                    Условия доставки по кол-ву (до 10)
                  </div>
                  <div style={{ fontSize: 11, color: "var(--cms-text-muted)", marginBottom: 8 }}>
                    Если заказ от X до Y шт. → цена доставки. Если не попадает в условие — используется базовая цена выше.
                  </div>
                  {(() => {
                    let conds: Array<{fromQty: number; toQty: number; price: number}> = [];
                    try { conds = JSON.parse(form.shippingConditions || "[]"); } catch { conds = []; }
                    const updateConds = (next: typeof conds) => setForm(prev => ({ ...prev, shippingConditions: JSON.stringify(next) }));
                    return (
                      <>
                        {conds.map((c, i) => (
                          <div key={i} style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 28px", gap: 6, marginBottom: 6, alignItems: "center" }}>
                            <input className="cms-input" type="number" min="1" placeholder="От (шт.)" value={c.fromQty}
                              onChange={e => updateConds(conds.map((x, j) => j === i ? { ...x, fromQty: Number(e.target.value) } : x))}
                              style={{ fontSize: 12 }} />
                            <input className="cms-input" type="number" min="1" placeholder="До (шт.)" value={c.toQty}
                              onChange={e => updateConds(conds.map((x, j) => j === i ? { ...x, toQty: Number(e.target.value) } : x))}
                              style={{ fontSize: 12 }} />
                            <input className="cms-input" type="number" min="0" placeholder="Цена (₽)" value={c.price}
                              onChange={e => updateConds(conds.map((x, j) => j === i ? { ...x, price: Number(e.target.value) } : x))}
                              style={{ fontSize: 12 }} />
                            <button type="button" onClick={() => updateConds(conds.filter((_, j) => j !== i))}
                              style={{ background: "none", border: "none", color: "#666", cursor: "pointer", fontSize: 16, padding: 0 }}>×</button>
                          </div>
                        ))}
                        {conds.length < 10 && (
                          <button type="button" className="cms-btn cms-btn-xs"
                            onClick={() => updateConds([...conds, { fromQty: 1, toQty: 9, price: 0 }])}>
                            + Добавить условие
                          </button>
                        )}
                      </>
                    );
                  })()}
                </div>
              </Section>

              {/* ── Статус / Плашки ── */}
              <Section title="Статус и плашки">
                {(() => {
                  const tog = (active: boolean, on: () => void, label: string, colorOn = "var(--cms-accent, #9b87f5)", bgOn = "rgba(155,135,245,0.15)") => (
                    <button type="button" onClick={on} style={{
                      padding: "5px 14px", borderRadius: 20, fontSize: 12, border: "1px solid",
                      borderColor: active ? colorOn : "var(--cms-border)",
                      background: active ? bgOn : "transparent",
                      color: active ? colorOn : "var(--cms-text-muted)",
                      cursor: "pointer", fontWeight: active ? 600 : 400, transition: "all 0.15s",
                    }}>{label}</button>
                  );
                  return (
                    <>
                      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 12 }}>
                        {tog(form.isActive, () => setForm(p => ({ ...p, isActive: !p.isActive })), "Активен")}
                        {tog(form.isAvailable, () => setForm(p => ({ ...p, isAvailable: !p.isAvailable })), "Доступен", "#16a34a", "rgba(22,163,74,0.12)")}
                        {tog(form.isPreorder, () => setForm(p => ({ ...p, isPreorder: !p.isPreorder, inStock: !p.isPreorder ? true : p.inStock })), "Предзаказ", "#f59e0b", "rgba(245,158,11,0.12)")}
                        {tog(form.isLimited, () => setForm(p => ({ ...p, isLimited: !p.isLimited })), "Лимитированный", "#8b5cf6", "rgba(139,92,246,0.12)")}
                        {tog(form.isAuthor, () => setForm(p => ({ ...p, isAuthor: !p.isAuthor })), "Авторская", "#0ea5e9", "rgba(14,165,233,0.12)")}
                        {tog(form.isSoldOut, () => setForm(p => ({ ...p, isSoldOut: !p.isSoldOut })), "Sold Out", "#ef4444", "rgba(239,68,68,0.12)")}
                        {tog(form.inStock, () => setForm(p => ({ ...p, inStock: !p.inStock })), "В наличии", "#16a34a", "rgba(22,163,74,0.12)")}
                        {tog(form.isSaleDisabled, () => setForm(p => ({ ...p, isSaleDisabled: !p.isSaleDisabled })), "Скоро", "#f59e0b", "rgba(245,158,11,0.12)")}
                      </div>
                      {form.isPreorder && (
                        <div style={{ padding: "10px 12px", background: "rgba(245,158,11,0.07)", borderRadius: 8, border: "1px solid rgba(245,158,11,0.2)", marginBottom: 8 }}>
                          <label className="cms-label">
                            Ориентировочный срок доставки
                            <input className="cms-input" type="date" value={form.preorderAvailableDate || ""}
                              onChange={e => setForm({ ...form, preorderAvailableDate: e.target.value })} style={{ marginTop: 4 }} />
                          </label>
                          <label className="cms-checkbox-label" style={{ marginTop: 8, display: "flex", alignItems: "center", gap: 6 }}>
                            <input type="checkbox" checked={form.preorderClosed} onChange={e => setForm({ ...form, preorderClosed: e.target.checked })} />
                            Предзаказ закрыт
                          </label>
                        </div>
                      )}
                      {form.isLimited && (
                        <div style={{ padding: "10px 12px", background: "rgba(139,92,246,0.07)", borderRadius: 8, border: "1px solid rgba(139,92,246,0.2)" }}>
                          <div style={{ fontSize: 11, color: "var(--cms-text-muted)", marginBottom: 4 }}>Описание тиража ({lang.toUpperCase()})</div>
                          <textarea className="cms-textarea" rows={3} style={{ width: "100%" }}
                            placeholder={lang === "ru" ? "Тираж ограничен..." : "Limited edition..."}
                            value={lang === "ru" ? form.limitedEditionText : (form.limitedEditionTextEn || "")}
                            onChange={e => setForm(prev => lang === "ru" ? { ...prev, limitedEditionText: e.target.value } : { ...prev, limitedEditionTextEn: e.target.value })} />
                        </div>
                      )}
                    </>
                  );
                })()}
              </Section>

              {/* ── Фотографии ── */}
              <Section title="Фотографии">
                <PhotoGallery
                  galleryJson={form.images}
                  onChange={json => {
                    const list = parseImageList(json);
                    setForm(prev => ({ ...prev, images: json, image: list[0] || prev.image }));
                  }}
                  token={adminToken}
                  onOpenMedia={() => { setMediaPickerOpen(true); setMediaSearch(""); fetchMedia(); }}
                />
              </Section>

              {/* ── Цвета (Выбор 3) ── */}
              <Section title="Цвета / фото к цветам / остатки">
                <ColorsEditor value={form.colors} onChange={val => setForm(prev => ({ ...prev, colors: val }))} token={adminToken} lang={lang} galleryPhotos={parseImageList(form.images)} />
              </Section>

              {/* ── Кастомные бейджи ── */}
              <Section title="Кастомные бейджи (значок + текст + цвет)">
                <CustomBadgesEditor value={form.customBadges || "[]"} onChange={val => setForm(prev => ({ ...prev, customBadges: val }))} lang={lang} />
              </Section>

              {/* ── Уведомление (плашка) ── */}
              <Section title="Уведомление / Плашка">
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                  <div>
                    <div style={{ fontSize: 11, fontWeight: 600, color: "var(--cms-text-muted)", marginBottom: 4 }}>Текст (RU)</div>
                    <input className="cms-input" placeholder="Например: ⚠️ Ориентировочная дата доставок — начало июня"
                      value={form.noticeText || ""}
                      onChange={e => setForm(prev => ({ ...prev, noticeText: e.target.value }))} />
                  </div>
                  <div>
                    <div style={{ fontSize: 11, fontWeight: 600, color: "var(--cms-text-muted)", marginBottom: 4 }}>Текст (EN)</div>
                    <input className="cms-input" placeholder="E.g.: ⚠️ Estimated delivery — early June"
                      value={form.noticeTextEn || ""}
                      onChange={e => setForm(prev => ({ ...prev, noticeTextEn: e.target.value }))} />
                  </div>
                </div>
              </Section>

              {/* ── Характеристики ── */}
              <Section title={`Характеристики (${lang.toUpperCase()})`}>
                <CharacteristicsEditor value={form.characteristics} onChange={val => setForm(prev => ({ ...prev, characteristics: val }))} lang={lang} />
              </Section>

            </div>

            <div className="cms-modal-actions">
              <button className="cms-btn cms-btn-primary" onClick={handleSave} disabled={saving}>{saving ? "Сохранение..." : "Сохранить"}</button>
              <button className="cms-btn" onClick={closeDialog}>Отмена</button>
            </div>
          </div>
        </div>
      )}

      {/* ═══ Media Picker Modal ═══ */}
      {mediaPickerOpen && (
        <div className="cms-modal-overlay" onClick={() => setMediaPickerOpen(false)}>
          <div className="cms-modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 760 }}>
            <div className="cms-modal-header">
              <h3>Медиатека</h3>
              <button className="cms-modal-close" onClick={() => setMediaPickerOpen(false)}>&times;</button>
            </div>
            <div className="cms-modal-body" style={{ maxHeight: "68vh", overflowY: "auto" }}>
              <input className="cms-input" placeholder="Поиск..." value={mediaSearch} onChange={e => setMediaSearch(e.target.value)} style={{ marginBottom: 12 }} />
              {mediaLoading ? (
                <div style={{ padding: "18px 0", color: "var(--cms-text-muted)" }}>Загрузка...</div>
              ) : (
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))", gap: 10 }}>
                  {filteredMedia.map(item => (
                    <button key={item.relativePath} type="button"
                      onClick={() => {
                        const url = item.url || item.relativePath;
                        const list = parseImageList(form.images);
                        const next = list.includes(url) ? list : [...list, url];
                        setForm(prev => ({ ...prev, images: toJson(next), image: next[0] || prev.image }));
                        setMediaPickerOpen(false);
                      }}
                      style={{ border: "1px solid var(--cms-border)", borderRadius: 10, background: "var(--cms-surface)", padding: 8, textAlign: "left", cursor: "pointer" }}>
                      <img src={item.url} alt={item.filename}
                        style={{ width: "100%", height: 130, objectFit: "contain", borderRadius: 8, background: "#0e1017", display: "block" }}
                        onError={(e) => { (e.target as HTMLImageElement).style.opacity = "0.3"; }} />
                      <div style={{ marginTop: 5, fontSize: 11, color: "var(--cms-text-muted)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{item.filename}</div>
                    </button>
                  ))}
                </div>
              )}
              {!mediaLoading && filteredMedia.length === 0 && <div style={{ padding: "18px 0", color: "var(--cms-text-muted)" }}>Нет изображений</div>}
            </div>
          </div>
        </div>
      )}

      {/* ═══ Delete/Archive Confirm ═══ */}
      {deleteConfirm && (
        <div className="cms-modal-overlay" onClick={() => setDeleteConfirm(null)}>
          <div className="cms-modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 420 }}>
            <div className="cms-modal-header">
              <h3>{archiveView === "archived" ? "Удаление" : "В архив"}</h3>
              <button className="cms-modal-close" onClick={() => setDeleteConfirm(null)}>&times;</button>
            </div>
            <div className="cms-modal-body">
              <p style={{ fontSize: 14 }}>
                {archiveView === "archived"
                  ? <>Удалить навсегда <strong>{deleteConfirm.length}</strong> товар(ов)?</>
                  : <>Архивировать <strong>{deleteConfirm.length}</strong> товар(ов)? Они будут скрыты из витрины.</>}
              </p>
            </div>
            <div className="cms-modal-actions">
              <button className="cms-btn cms-btn-danger" onClick={() => handleDelete(deleteConfirm)}>
                {archiveView === "archived" ? "Удалить навсегда" : "В архив"}
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
