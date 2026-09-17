'use client';

import { useEffect, useRef, useState } from 'react';
import { usePathname } from 'next/navigation';

const ENDPOINT = '/api/analytics/track';
const SESSION_DURATION = 30 * 60 * 1000;
const HEARTBEAT_INTERVAL = 30_000;
const HEARTBEAT_DEDUP_WINDOW = 2_000;
const CONSENT_KEY = 'errani_consent';

interface Acquisition {
  utmSource: string;
  utmMedium: string;
  utmCampaign: string;
  utmContent: string;
  utmTerm: string;
}

interface SessionData {
  sid: string;
  acquisition: Acquisition;
}

function emptyAcquisition(): Acquisition {
  return { utmSource: '', utmMedium: '', utmCampaign: '', utmContent: '', utmTerm: '' };
}

function acquisitionFromUrl(): Acquisition {
  const params = new URLSearchParams(window.location.search);
  return {
    utmSource: params.get('utm_source')?.slice(0, 120) || '',
    utmMedium: params.get('utm_medium')?.slice(0, 120) || '',
    utmCampaign: params.get('utm_campaign')?.slice(0, 180) || '',
    utmContent: params.get('utm_content')?.slice(0, 180) || '',
    utmTerm: params.get('utm_term')?.slice(0, 180) || '',
  };
}

function getSession(): SessionData {
  const fromUrl = acquisitionFromUrl();
  try {
    const stored = localStorage.getItem('_errani_session');
    if (stored) {
      const parsed = JSON.parse(stored) as { sid?: string; expires?: number; acquisition?: Acquisition };
      if (parsed.sid && Number(parsed.expires) > Date.now()) {
        const acquisition = Object.values(fromUrl).some(Boolean)
          ? fromUrl
          : parsed.acquisition || emptyAcquisition();
        localStorage.setItem('_errani_session', JSON.stringify({
          sid: parsed.sid,
          expires: Date.now() + SESSION_DURATION,
          acquisition,
        }));
        return { sid: parsed.sid, acquisition };
      }
    }
  } catch {
    // Create a fresh session below.
  }

  const sid = globalThis.crypto?.randomUUID?.() || `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
  localStorage.setItem('_errani_session', JSON.stringify({
    sid,
    expires: Date.now() + SESSION_DURATION,
    acquisition: fromUrl,
  }));
  return { sid, acquisition: fromUrl };
}

function hasConsent(): boolean {
  try {
    if (localStorage.getItem(CONSENT_KEY) === '1') return true;
    return document.cookie.split(';').some((cookie) => cookie.trim().startsWith(`${CONSENT_KEY}=1`));
  } catch {
    return false;
  }
}

function send(data: object): void {
  const body = JSON.stringify(data);
  const queued = navigator.sendBeacon?.(ENDPOINT, new Blob([body], { type: 'application/json' }));
  if (!queued) {
    void fetch(ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body,
      keepalive: true,
    }).catch(() => undefined);
  }
}

function scrollDepth(): number {
  const height = Math.max(document.documentElement.scrollHeight, document.body.scrollHeight, window.innerHeight);
  return Math.max(0, Math.min(100, Math.round(((window.scrollY + window.innerHeight) / height) * 100)));
}

export function AnalyticsTracker() {
  const pathname = usePathname();
  const previousPathRef = useRef('');
  const [enabled, setEnabled] = useState(false);

  useEffect(() => {
    const enable = () => setEnabled(hasConsent());
    enable();
    window.addEventListener('errani:consent', enable);
    return () => window.removeEventListener('errani:consent', enable);
  }, []);

  useEffect(() => {
    if (!enabled || pathname.startsWith('/admin')) return;

    const { sid: sessionId, acquisition } = getSession();
    const viewId = globalThis.crypto?.randomUUID?.() || `${sessionId}-${Date.now().toString(36)}`;
    const lang = localStorage.getItem('errani_lang') || navigator.language.slice(0, 2);
    const previousPath = previousPathRef.current;
    const common = {
      sessionId,
      viewId,
      path: pathname,
      query: window.location.search.slice(0, 500),
      title: document.title.slice(0, 300),
      previousPath,
      referrer: previousPath ? '' : document.referrer.slice(0, 1000),
      lang: lang.slice(0, 12),
      screenWidth: window.screen.width,
      screenHeight: window.screen.height,
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || '',
      ...acquisition,
    };

    previousPathRef.current = pathname;
    let activeMs = 0;
    let activeSince = Date.now();
    let maxScroll = scrollDepth();
    let lastHeartbeatAt = 0;

    const collectActiveTime = () => {
      if (document.visibilityState === 'visible') activeMs += Date.now() - activeSince;
      activeSince = Date.now();
    };
    const heartbeat = () => {
      const now = Date.now();
      if (now - lastHeartbeatAt < HEARTBEAT_DEDUP_WINDOW) return;
      lastHeartbeatAt = now;
      collectActiveTime();
      send({
        type: 'heartbeat',
        sessionId,
        viewId,
        path: pathname,
        duration: Math.min(86_400, Math.round(activeMs / 1000)),
        maxScroll,
      });
    };
    const handleScroll = () => {
      maxScroll = Math.max(maxScroll, scrollDepth());
    };
    const handleVisibility = () => {
      if (document.visibilityState === 'hidden') heartbeat();
      else activeSince = Date.now();
    };

    send({ type: 'pageview', ...common, duration: 0, maxScroll });
    const interval = window.setInterval(heartbeat, HEARTBEAT_INTERVAL);
    window.addEventListener('scroll', handleScroll, { passive: true });
    window.addEventListener('pagehide', heartbeat);
    document.addEventListener('visibilitychange', handleVisibility);

    return () => {
      heartbeat();
      window.clearInterval(interval);
      window.removeEventListener('scroll', handleScroll);
      window.removeEventListener('pagehide', heartbeat);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [enabled, pathname]);

  return null;
}
