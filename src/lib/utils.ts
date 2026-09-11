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
  const rand = crypto.randomUUID().replace(/-/g, '').slice(0, 12).toUpperCase();
  return `ER-${y}${m}${d}-${rand}`;
}

export function cn(...classes: (string | undefined | null | false)[]): string {
  return classes.filter(Boolean).join(' ');
}

export const ORDER_STATUSES: Record<string, { label: string; color: string }> = {
  pending: { label: 'Ожидает оплаты', color: '#888' },
  paid: { label: 'Оплачен', color: '#3B82F6' },
  assembling: { label: 'Собирается', color: '#F59E4B' },
  shipped: { label: 'Отправлен', color: '#12c998' },
  in_transit: { label: 'Доставляется', color: '#439f76' },
  delivered: { label: 'Доставлен', color: '#4CAF50' },
  cancelled: { label: 'Отменён', color: '#E8722A' },
};

export const SHIPPING_METHODS_RU = [
  { key: 'manual_delivery', label: 'Доставка по адресу' },
];

export const SHIPPING_METHODS_INT = [
  { key: 'pochta_int', label: 'Почта России (международная)' },
];

export function getShippingCost(itemCount: number): number {
  if (itemCount <= 2) return 350;
  if (itemCount <= 5) return 470;
  return 790;
}

export const COUNTRIES = [
  { code: 'RU', name: 'Россия', nameEn: 'Russia' },
  { code: 'BY', name: 'Беларусь', nameEn: 'Belarus' },
  { code: 'KZ', name: 'Казахстан', nameEn: 'Kazakhstan' },
  { code: 'UZ', name: 'Узбекистан', nameEn: 'Uzbekistan' },
  { code: 'KG', name: 'Кыргызстан', nameEn: 'Kyrgyzstan' },
  { code: 'TJ', name: 'Таджикистан', nameEn: 'Tajikistan' },
  { code: 'AM', name: 'Армения', nameEn: 'Armenia' },
  { code: 'AZ', name: 'Азербайджан', nameEn: 'Azerbaijan' },
  { code: 'GE', name: 'Грузия', nameEn: 'Georgia' },
  { code: 'MD', name: 'Молдова', nameEn: 'Moldova' },
  { code: 'TM', name: 'Туркменистан', nameEn: 'Turkmenistan' },
  { code: 'LV', name: 'Латвия', nameEn: 'Latvia' },
  { code: 'LT', name: 'Литва', nameEn: 'Lithuania' },
  { code: 'EE', name: 'Эстония', nameEn: 'Estonia' },
  { code: 'DE', name: 'Германия', nameEn: 'Germany' },
  { code: 'FR', name: 'Франция', nameEn: 'France' },
  { code: 'IT', name: 'Италия', nameEn: 'Italy' },
  { code: 'ES', name: 'Испания', nameEn: 'Spain' },
  { code: 'GB', name: 'Великобритания', nameEn: 'United Kingdom' },
  { code: 'US', name: 'США', nameEn: 'United States' },
  { code: 'CA', name: 'Канада', nameEn: 'Canada' },
  { code: 'AU', name: 'Австралия', nameEn: 'Australia' },
  { code: 'JP', name: 'Япония', nameEn: 'Japan' },
  { code: 'CN', name: 'Китай', nameEn: 'China' },
  { code: 'KR', name: 'Южная Корея', nameEn: 'South Korea' },
  { code: 'TR', name: 'Турция', nameEn: 'Turkey' },
  { code: 'AE', name: 'ОАЭ', nameEn: 'United Arab Emirates' },
  { code: 'IL', name: 'Израиль', nameEn: 'Israel' },
  { code: 'TH', name: 'Таиланд', nameEn: 'Thailand' },
  { code: 'IN', name: 'Индия', nameEn: 'India' },
  { code: 'BR', name: 'Бразилия', nameEn: 'Brazil' },
  { code: 'MX', name: 'Мексика', nameEn: 'Mexico' },
  { code: 'AR', name: 'Аргентина', nameEn: 'Argentina' },
  { code: 'PL', name: 'Польша', nameEn: 'Poland' },
  { code: 'CZ', name: 'Чехия', nameEn: 'Czechia' },
  { code: 'AT', name: 'Австрия', nameEn: 'Austria' },
  { code: 'CH', name: 'Швейцария', nameEn: 'Switzerland' },
  { code: 'SE', name: 'Швеция', nameEn: 'Sweden' },
  { code: 'NO', name: 'Норвегия', nameEn: 'Norway' },
  { code: 'FI', name: 'Финляндия', nameEn: 'Finland' },
  { code: 'DK', name: 'Дания', nameEn: 'Denmark' },
  { code: 'NL', name: 'Нидерланды', nameEn: 'Netherlands' },
  { code: 'BE', name: 'Бельгия', nameEn: 'Belgium' },
  { code: 'PT', name: 'Португалия', nameEn: 'Portugal' },
  { code: 'GR', name: 'Греция', nameEn: 'Greece' },
  { code: 'RS', name: 'Сербия', nameEn: 'Serbia' },
  { code: 'ME', name: 'Черногория', nameEn: 'Montenegro' },
  { code: 'OTHER', name: 'Другая страна', nameEn: 'Other country' },
];

export function getCountryName(code: string): string {
  return COUNTRIES.find(c => c.code === code)?.name || code;
}
