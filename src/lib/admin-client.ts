const ADMIN_TOKEN_STORAGE_KEY = 'admin_token';

const TOAST_ERROR_RE = /ошибк|не удалось|сбой|failed|error|запрещ|обязательн/i;

/** Toast tone from message text (error vs success). */
export function adminToastTone(message: string): 'error' | 'success' {
  return TOAST_ERROR_RE.test(message) ? 'error' : 'success';
}

export function adminToastClass(message: string): string {
  return `cms-toast cms-toast-${adminToastTone(message)}`;
}

export function getAdminAuthToken(): string {
  if (typeof window === 'undefined') return '';
  const stored = window.localStorage.getItem(ADMIN_TOKEN_STORAGE_KEY);
  return stored?.trim() || '';
}

export function setAdminAuthToken(token: string): void {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(ADMIN_TOKEN_STORAGE_KEY, token);
}

export function clearAdminAuthToken(): void {
  if (typeof window === 'undefined') return;
  window.localStorage.removeItem(ADMIN_TOKEN_STORAGE_KEY);
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * fetch() with the admin Bearer token (cookie auth is sent automatically too).
 * Retries transient 503/502 briefly so a Postgres recovery blip does not wipe UI lists.
 */
export async function adminFetch(input: string, init: RequestInit = {}): Promise<Response> {
  const token = getAdminAuthToken();
  const method = (init.method || 'GET').toUpperCase();
  const canRetry = method === 'GET' || method === 'HEAD';
  const maxAttempts = canRetry ? 3 : 1;
  let lastRes: Response | null = null;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    const headers = new Headers(init.headers);
    if (token && !headers.has('Authorization')) headers.set('Authorization', `Bearer ${token}`);
    if (init.body && typeof init.body === 'string' && !headers.has('Content-Type')) {
      headers.set('Content-Type', 'application/json');
    }
    lastRes = await fetch(input, { cache: 'no-store', ...init, headers });
    if (!canRetry || attempt === maxAttempts || (lastRes.status !== 502 && lastRes.status !== 503)) {
      return lastRes;
    }
    await sleep(400 * attempt);
  }

  return lastRes as Response;
}

export const ADMIN_COUNTS_REFRESH_EVENT = 'admin:counts-refresh';

/** Ask the sidebar to refetch notification badges immediately. */
export function refreshAdminCounts() {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent(ADMIN_COUNTS_REFRESH_EVENT));
}
