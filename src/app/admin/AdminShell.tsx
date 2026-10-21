'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { usePathname } from 'next/navigation';
import { hideAdminTooltip, placeAdminTooltip } from '@/lib/admin-tooltip';
import {
  applyAppearance,
  cacheAppearance,
  parseAppearance,
  readCachedAppearance,
  APPEARANCE_SETTING_KEY,
  DEFAULT_APPEARANCE,
} from '@/components/admin/appearance';
import { adminFetch } from '@/lib/admin-client';
import { AdminSidebar } from './AdminSidebar';

interface AdminShellContextValue {
  setFill: (fill: boolean) => void;
}

const AdminShellContext = createContext<AdminShellContextValue | null>(null);

export function useAdminShell() {
  return useContext(AdminShellContext);
}

/** Persistent admin chrome: sidebar stays mounted across page navigations. */
export function AdminShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const [fill, setFillState] = useState(false);
  const setFill = useCallback((next: boolean) => setFillState(next), []);
  const value = useMemo(() => ({ setFill }), [setFill]);

  useEffect(() => {
    const onOver = (e: Event) => {
      const t = (e.target as Element | null)?.closest?.('[data-tooltip]') as HTMLElement | null;
      if (t?.getAttribute('data-tooltip')) placeAdminTooltip(t);
    };
    const onOut = (e: Event) => {
      const t = (e.target as Element | null)?.closest?.('[data-tooltip]') as HTMLElement | null;
      const related = (e as PointerEvent).relatedTarget as Element | null;
      if (t && related && t.contains(related)) return;
      if (t) hideAdminTooltip();
    };
    const onFocus = (e: Event) => {
      const t = (e.target as Element | null)?.closest?.('[data-tooltip]') as HTMLElement | null;
      if (t?.getAttribute('data-tooltip')) placeAdminTooltip(t);
    };
    const onBlur = (e: Event) => {
      const t = (e.target as Element | null)?.closest?.('[data-tooltip]') as HTMLElement | null;
      const related = (e as FocusEvent).relatedTarget as Element | null;
      if (t && related && t.contains(related)) return;
      hideAdminTooltip();
    };
    document.addEventListener('pointerover', onOver, true);
    document.addEventListener('pointerout', onOut, true);
    document.addEventListener('focusin', onFocus, true);
    document.addEventListener('focusout', onBlur, true);
    return () => {
      document.removeEventListener('pointerover', onOver, true);
      document.removeEventListener('pointerout', onOut, true);
      document.removeEventListener('focusin', onFocus, true);
      document.removeEventListener('focusout', onBlur, true);
      hideAdminTooltip();
    };
  }, []);

  // Appearance: cache first, then settings; keep system theme in sync.
  useEffect(() => {
    const cached = readCachedAppearance();
    applyAppearance(cached || DEFAULT_APPEARANCE);

    let cancelled = false;
    void adminFetch(`/api/admin/settings?key=${APPEARANCE_SETTING_KEY}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (cancelled || !d?.value) return;
        const next = parseAppearance(d.value);
        applyAppearance(next);
        cacheAppearance(next);
      })
      .catch(() => undefined);

    const mq = window.matchMedia('(prefers-color-scheme: light)');
    const onScheme = () => {
      const pref = document.documentElement.getAttribute('data-cms-theme-pref');
      if (pref === 'system') {
        applyAppearance(parseAppearance({
          ...(readCachedAppearance() || DEFAULT_APPEARANCE),
          theme: 'system',
        }));
      }
    };
    mq.addEventListener?.('change', onScheme);
    return () => {
      cancelled = true;
      mq.removeEventListener?.('change', onScheme);
    };
  }, []);

  // Keep dropdowns / menus / popovers inside the viewport (never past the screen edge).
  useEffect(() => {
    const SELECTOR = '.cms-dropdown-panel, .cms-menu, .cms-popover';
    const EDGE = 8;
    const clamp = (el: HTMLElement) => {
      el.style.translate = '';
      const r = el.getBoundingClientRect();
      if (!r.width && !r.height) return;
      const vw = window.innerWidth;
      const vh = window.innerHeight;
      let dx = 0;
      let dy = 0;
      if (r.right > vw - EDGE) dx = vw - EDGE - r.right;
      if (r.left + dx < EDGE) dx = EDGE - r.left;
      if (r.bottom > vh - EDGE) dy = Math.max(vh - EDGE - r.bottom, EDGE - r.top);
      if (dx || dy) el.style.translate = `${Math.round(dx)}px ${Math.round(dy)}px`;
    };
    const run = (root: ParentNode) => {
      root.querySelectorAll?.<HTMLElement>(SELECTOR).forEach((el) => requestAnimationFrame(() => clamp(el)));
    };
    const observer = new MutationObserver((mutations) => {
      for (const m of mutations) {
        m.addedNodes.forEach((node) => {
          if (!(node instanceof HTMLElement)) return;
          if (node.matches(SELECTOR)) requestAnimationFrame(() => clamp(node));
          run(node);
        });
      }
    });
    observer.observe(document.body, { childList: true, subtree: true });
    const onResize = () => run(document);
    window.addEventListener('resize', onResize);
    return () => {
      observer.disconnect();
      window.removeEventListener('resize', onResize);
    };
  }, []);

  if (pathname === '/admin/login') {
    return <>{children}</>;
  }

  return (
    <AdminShellContext.Provider value={value}>
      <div className={`cms-root${fill ? ' cms-fill' : ''}`}>
        <AdminSidebar />
        {children}
      </div>
    </AdminShellContext.Provider>
  );
}
