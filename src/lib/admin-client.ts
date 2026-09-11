const ADMIN_TOKEN_STORAGE_KEY = 'admin_token';

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
