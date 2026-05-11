import crypto from 'crypto';

const DEFAULT_SITE_URL = 'https://errani.ru';

export function generateReviewToken(): string {
  return crypto.randomBytes(24).toString('base64url');
}

export function hashReviewToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

export function tokenPreview(token: string): string {
  return token.slice(0, 8);
}

export function getPublicSiteUrl(): string {
  const configured = (process.env.NEXT_PUBLIC_SITE_URL || '').trim();
  return (configured || DEFAULT_SITE_URL).replace(/\/+$/, '');
}

export function buildReviewUrl(token: string): string {
  return `${getPublicSiteUrl()}/review/${encodeURIComponent(token)}`;
}

export function normalizeEmail(email: string): string {
  return String(email || '').trim().toLowerCase();
}

export function isValidRating(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 1 && value <= 5;
}
