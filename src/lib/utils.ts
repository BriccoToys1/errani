export function formatPrice(amount: number, currency = 'RUB'): string {
  return new Intl.NumberFormat('ru-RU', {
    style: 'currency',
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

export function generateOrderNumber(): string {
  const date = new Date();
  const y = date.getFullYear().toString().slice(-2);
  const m = (date.getMonth() + 1).toString().padStart(2, '0');
  const d = date.getDate().toString().padStart(2, '0');
  const rand = Math.random().toString(36).substring(2, 7).toUpperCase();
  return `ER-${y}${m}${d}-${rand}`;
}

export function cn(...classes: (string | undefined | null | false)[]): string {
  return classes.filter(Boolean).join(' ');
}

export const ORDER_STATUSES: Record<string, { label: string; color: string }> = {
  assembling: { label: 'Собирается', color: '#F59E4B' },
  shipped: { label: 'Отправлен', color: '#12c998' },
  in_transit: { label: 'Доставляется', color: '#439f76' },
  delivered: { label: 'Доставлен', color: '#4CAF50' },
  cancelled: { label: 'Отменён', color: '#E8722A' },
};

export const SHIPPING_METHODS_RU = [
  { key: 'ozon', label: 'OZON' },
  { key: 'yandex', label: 'Яндекс Доставка' },
  { key: 'pochta_ru', label: 'Почта России' },
  { key: 'cdek', label: 'СДЭК' },
];

export const SHIPPING_METHODS_INT = [
  { key: 'pochta_int', label: 'Почта России (международная)' },
];

export const COUNTRIES = [
  { code: 'RU', name: 'Россия' },
  { code: 'BY', name: 'Беларусь' },
  { code: 'KZ', name: 'Казахстан' },
  { code: 'UA', name: 'Украина' },
  { code: 'UZ', name: 'Узбекистан' },
  { code: 'KG', name: 'Кыргызстан' },
  { code: 'TJ', name: 'Таджикистан' },
  { code: 'AM', name: 'Армения' },
  { code: 'AZ', name: 'Азербайджан' },
  { code: 'GE', name: 'Грузия' },
  { code: 'MD', name: 'Молдова' },
  { code: 'TM', name: 'Туркменистан' },
  { code: 'LV', name: 'Латвия' },
  { code: 'LT', name: 'Литва' },
  { code: 'EE', name: 'Эстония' },
  { code: 'DE', name: 'Германия' },
  { code: 'FR', name: 'Франция' },
  { code: 'IT', name: 'Италия' },
  { code: 'ES', name: 'Испания' },
  { code: 'GB', name: 'Великобритания' },
  { code: 'US', name: 'США' },
  { code: 'CA', name: 'Канада' },
  { code: 'AU', name: 'Австралия' },
  { code: 'JP', name: 'Япония' },
  { code: 'CN', name: 'Китай' },
  { code: 'KR', name: 'Южная Корея' },
  { code: 'TR', name: 'Турция' },
  { code: 'AE', name: 'ОАЭ' },
  { code: 'IL', name: 'Израиль' },
  { code: 'TH', name: 'Таиланд' },
  { code: 'IN', name: 'Индия' },
  { code: 'BR', name: 'Бразилия' },
  { code: 'MX', name: 'Мексика' },
  { code: 'AR', name: 'Аргентина' },
  { code: 'PL', name: 'Польша' },
  { code: 'CZ', name: 'Чехия' },
  { code: 'AT', name: 'Австрия' },
  { code: 'CH', name: 'Швейцария' },
  { code: 'SE', name: 'Швеция' },
  { code: 'NO', name: 'Норвегия' },
  { code: 'FI', name: 'Финляндия' },
  { code: 'DK', name: 'Дания' },
  { code: 'NL', name: 'Нидерланды' },
  { code: 'BE', name: 'Бельгия' },
  { code: 'PT', name: 'Португалия' },
  { code: 'GR', name: 'Греция' },
  { code: 'RS', name: 'Сербия' },
  { code: 'ME', name: 'Черногория' },
  { code: 'OTHER', name: 'Другая страна' },
];

export function getCountryName(code: string): string {
  return COUNTRIES.find(c => c.code === code)?.name || code;
}
