/**
 * Public storefront maintenance gate.
 * Flip FORCE_PUBLIC_MAINTENANCE to false after Postgres on the VPS is healthy again.
 * Can also be forced with env MAINTENANCE_MODE=true without a code change.
 */
export const FORCE_PUBLIC_MAINTENANCE = false;

export const MAINTENANCE_TITLE = 'Технические работы';
export const MAINTENANCE_MESSAGE =
  'Сайт временно недоступен. Мы проводим технические работы и скоро вернём каталог, заказы и все данные.';

export function isPublicMaintenanceEnabled(): boolean {
  if (FORCE_PUBLIC_MAINTENANCE) return true;
  const flag = String(process.env.MAINTENANCE_MODE || '').trim().toLowerCase();
  return flag === '1' || flag === 'true' || flag === 'yes' || flag === 'on';
}
