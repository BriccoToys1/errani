'use client';

import { useEffect, useRef } from 'react';
import { usePathname } from 'next/navigation';

function getSessionId(): string {
  let sid = sessionStorage.getItem('_errani_sid');
  if (!sid) {
    sid = Math.random().toString(36).slice(2) + Date.now().toString(36);
    sessionStorage.setItem('_errani_sid', sid);
  }
  return sid;
}

export function AnalyticsTracker() {
  const pathname = usePathname();
  const startRef = useRef(Date.now());
  const prevPath = useRef<string | null>(null);

  useEffect(() => {
    // Skip admin pages
    if (pathname.startsWith('/admin')) return;

    const sessionId = getSessionId();
    const lang = localStorage.getItem('errani_lang') || navigator.language.slice(0, 2);

    // Send duration for previous page
    if (prevPath.current && prevPath.current !== pathname) {
      const duration = Math.round((Date.now() - startRef.current) / 1000);
      navigator.sendBeacon(
        '/api/analytics/track',
        JSON.stringify({
          sessionId,
          path: prevPath.current,
          referrer: '',
          lang,
          duration,
        })
      );
    }

    // Track new page view
    startRef.current = Date.now();
    prevPath.current = pathname;

    fetch('/api/analytics/track', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sessionId,
        path: pathname,
        referrer: document.referrer || '',
        lang,
        duration: 0,
      }),
    }).catch(() => {});

    // On page unload, send final duration
    const handleUnload = () => {
      const duration = Math.round((Date.now() - startRef.current) / 1000);
      navigator.sendBeacon(
        '/api/analytics/track',
        JSON.stringify({
          sessionId,
          path: pathname,
          referrer: '',
          lang,
          duration,
        })
      );
    };

    window.addEventListener('beforeunload', handleUnload);
    return () => window.removeEventListener('beforeunload', handleUnload);
  }, [pathname]);

  return null;
}
