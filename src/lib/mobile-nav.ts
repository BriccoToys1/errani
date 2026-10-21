import type { IconName } from '@/components/admin/Icon';

export const MOBILE_NAV_SETTING_KEY = 'mobile_nav_v1';

export type MobileNavSlotId =
  | 'analytics'
  | 'email'
  | 'orders'
  | 'products'
  | 'media'
  | 'inquiries'
  | 'waitlist'
  | 'users'
  | 'reviews'
  | 'settings'
  | 'account';

export interface MobileNavOption {
  id: MobileNavSlotId;
  href: string;
  icon: IconName;
  label: string;
  countKey?: 'newOrders' | 'newInquiries' | 'newEmails' | 'newWaitlist' | 'newReviews';
}

/** All admin sections that can occupy a bottom-nav slot. */
export const MOBILE_NAV_CATALOG: MobileNavOption[] = [
  { id: 'analytics', href: '/admin', icon: 'analytics', label: 'Аналитика' },
  { id: 'email', href: '/admin/email', icon: 'mail', label: 'Почта', countKey: 'newEmails' },
  { id: 'orders', href: '/admin/orders', icon: 'orders', label: 'Заказы', countKey: 'newOrders' },
  { id: 'products', href: '/admin/products', icon: 'products', label: 'Товары' },
  { id: 'media', href: '/admin/media', icon: 'media', label: 'Галерея' },
  { id: 'inquiries', href: '/admin/inquiries', icon: 'requests', label: 'Заявки', countKey: 'newInquiries' },
  { id: 'waitlist', href: '/admin/waitlist', icon: 'waiting', label: 'В ожидании', countKey: 'newWaitlist' },
  { id: 'users', href: '/admin/users', icon: 'customers', label: 'Клиенты' },
  { id: 'reviews', href: '/admin/reviews', icon: 'reviews', label: 'Отзывы', countKey: 'newReviews' },
  { id: 'settings', href: '/admin/settings', icon: 'settings', label: 'Настройки' },
  { id: 'account', href: '/admin/account', icon: 'user', label: 'Пользователи' },
];

export const DEFAULT_MOBILE_NAV_SLOTS: MobileNavSlotId[] = [
  'analytics',
  'orders',
  'products',
  'email',
];

export function parseMobileNavSlots(raw: unknown): MobileNavSlotId[] {
  const ids = Array.isArray(raw)
    ? raw
    : typeof raw === 'string'
      ? (() => {
          try {
            const parsed = JSON.parse(raw);
            return Array.isArray(parsed) ? parsed : [];
          } catch {
            return [];
          }
        })()
      : [];

  const valid = ids
    .map((v) => String(v))
    .filter((id): id is MobileNavSlotId => MOBILE_NAV_CATALOG.some((o) => o.id === id));

  const unique: MobileNavSlotId[] = [];
  for (const id of valid) {
    if (!unique.includes(id)) unique.push(id);
    if (unique.length === 4) break;
  }
  while (unique.length < 4) {
    const fallback = DEFAULT_MOBILE_NAV_SLOTS.find((id) => !unique.includes(id))
      || MOBILE_NAV_CATALOG.find((o) => !unique.includes(o.id))?.id;
    if (!fallback) break;
    unique.push(fallback);
  }
  return unique.slice(0, 4);
}

export function resolveMobileNavSlots(ids: MobileNavSlotId[]): MobileNavOption[] {
  return ids
    .map((id) => MOBILE_NAV_CATALOG.find((o) => o.id === id))
    .filter((o): o is MobileNavOption => Boolean(o));
}
