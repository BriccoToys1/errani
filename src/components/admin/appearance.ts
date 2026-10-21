/** Admin appearance: wallpaper + color theme (liquid glass removed). */

export type AdminTheme = 'system' | 'light' | 'dark';

export interface AdminAppearance {
  /** Kept for backward-compat with saved settings; always treated as 0. */
  glass: number;
  /** Wallpaper image URL ('' = none). */
  wallpaperUrl: string;
  /** 0..100 — wallpaper darkening. */
  wallpaperDim: number;
  /** Color scheme preference. */
  theme: AdminTheme;
}

export const APPEARANCE_SETTING_KEY = 'admin_appearance';
const STORAGE_KEY = 'cms_appearance_v1';

export const DEFAULT_APPEARANCE: AdminAppearance = {
  glass: 0,
  wallpaperUrl: '',
  wallpaperDim: 55,
  theme: 'dark',
};

const clamp = (n: unknown, fallback: number) => {
  const v = typeof n === 'number' && Number.isFinite(n) ? n : fallback;
  return Math.max(0, Math.min(100, v));
};

function parseTheme(raw: unknown): AdminTheme {
  const t = String(raw || '').trim().toLowerCase();
  if (t === 'light' || t === 'dark' || t === 'system') return t;
  return DEFAULT_APPEARANCE.theme;
}

export function parseAppearance(raw: unknown): AdminAppearance {
  let obj: Record<string, unknown> = {};
  if (typeof raw === 'string') {
    try {
      obj = JSON.parse(raw) as Record<string, unknown>;
    } catch {
      obj = {};
    }
  } else if (raw && typeof raw === 'object') {
    obj = raw as Record<string, unknown>;
  }
  const url = typeof obj.wallpaperUrl === 'string' ? obj.wallpaperUrl.trim() : '';
  return {
    glass: 0,
    wallpaperUrl: /^(https?:\/\/|\/)[^\s"'()]+$/.test(url) ? url : '',
    wallpaperDim: clamp(obj.wallpaperDim, DEFAULT_APPEARANCE.wallpaperDim),
    theme: parseTheme(obj.theme),
  };
}

function resolveTheme(theme: AdminTheme): 'light' | 'dark' {
  if (theme === 'light' || theme === 'dark') return theme;
  if (typeof window === 'undefined') return 'dark';
  return window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
}

export function applyAppearance(a: AdminAppearance): void {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;
  root.style.removeProperty('--cms-glass');
  root.style.removeProperty('--cms-lg-blur');
  root.style.removeProperty('--cms-lg-sat');
  root.style.removeProperty('--cms-lg-wash');
  root.style.removeProperty('--cms-lg-frost');
  root.style.setProperty('--cms-wallpaper-dim', String(a.wallpaperDim / 100));

  if (a.wallpaperUrl) {
    root.style.setProperty('--cms-wallpaper', `url("${a.wallpaperUrl}")`);
    root.setAttribute('data-cms-wallpaper', '1');
  } else {
    root.style.setProperty('--cms-wallpaper', 'none');
    root.removeAttribute('data-cms-wallpaper');
  }

  const resolved = resolveTheme(a.theme);
  root.setAttribute('data-cms-theme', resolved);
  root.setAttribute('data-cms-theme-pref', a.theme);
  root.classList.toggle('dark', resolved === 'dark');
  root.classList.toggle('light', resolved === 'light');
  root.style.colorScheme = resolved;
}

export function readCachedAppearance(): AdminAppearance | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return raw ? parseAppearance(raw) : null;
  } catch {
    return null;
  }
}

export function cacheAppearance(a: AdminAppearance): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...a, glass: 0 }));
  } catch {
    /* storage full / disabled */
  }
}
