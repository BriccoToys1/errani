'use client';

import { useEffect, useRef } from 'react';
import { usePathname } from 'next/navigation';

const ENDPOINT = '/api/analytics/track';

function getSessionId(): string {
  let sid = sessionStorage.getItem('_errani_sid');
  if (!sid) {
    sid = Math.random().toString(36).slice(2) + Date.now().toString(36);
    sessionStorage.setItem('_errani_sid', sid);
  }
  return sid;
}

function beacon(data: object) {
  navigator.sendBeacon(
    ENDPOINT,
    new Blob([JSON.stringify(data)], { type: 'application/json' })
  );
}

export function AnalyticsTracker() {
  const pathname = usePathname();
  const startRef = useRef(Date.now());
  const prevPath = useRef<string | null>(null);

  useEffect(() => {
    if (pathname.startsWith('/admin')) return;

    const sessionId = getSessionId();
    const lang = localStorage.getItem('errani_lang') || navigator.language.slice(0, 2);

    // Отправляем время на предыдущей странице
    if (prevPath.current && prevPath.current !== pathname) {
      beacon({
        sessionId,
        path: prevPath.current,
        referrer: '',
        lang,
        duration: Math.round((Date.now() - startRef.current) / 1000),
      });
    }

    startRef.current = Date.now();
    prevPath.current = pathname;

    // Трекаем новую страницу
    beacon({ sessionId, path: pathname, referrer: document.referrer || '', lang, duration: 0 });

    const handleUnload = () => {
      beacon({
        sessionId,
        path: pathname,
        referrer: '',
        lang,
        duration: Math.round((Date.now() - startRef.current) / 1000),
      });
    };

    window.addEventListener('beforeunload', handleUnload);
    return () => window.removeEventListener('beforeunload', handleUnload);
  }, [pathname]);

  return null;
}
