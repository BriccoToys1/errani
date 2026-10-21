/** In-memory cache for GET /api/admin/counts (shared across route modules). */

export type AdminCountsPayload = {
  newOrders: number;
  newInquiries: number;
  newWaitlist: number;
  newEmails: number;
  newReviews: number;
};

let cache: { expiresAt: number; payload: AdminCountsPayload } | null = null;

export function getAdminCountsCache(): typeof cache {
  return cache;
}

export function setAdminCountsCache(next: { expiresAt: number; payload: AdminCountsPayload } | null) {
  cache = next;
}

export function clearAdminCountsCache() {
  cache = null;
}

export const VIEWED_SETTING_KEYS = {
  orders: 'ordersViewedAt',
  waitlist: 'waitlistViewedAt',
  reviews: 'reviewsViewedAt',
} as const;

export type ViewedSection = keyof typeof VIEWED_SETTING_KEYS;
