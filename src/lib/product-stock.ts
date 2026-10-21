/** Keep stock / availability flags consistent across API and admin saves. */

export type StockLike = {
  stock?: number | null;
  inStock?: boolean | null;
  isSoldOut?: boolean | null;
  isSaleDisabled?: boolean | null;
  isAvailable?: boolean | null;
};

export function normalizeStockFlags<T extends StockLike>(product: T): T {
  const stock = Math.max(0, Number(product.stock ?? 0) || 0);
  const isSaleDisabled = Boolean(product.isSaleDisabled);
  const isAvailable = product.isAvailable === false ? false : true;
  const isSoldOut = Boolean(product.isSoldOut) || stock <= 0;
  const inStock = !isSoldOut && !isSaleDisabled && isAvailable && stock > 0;
  return {
    ...product,
    stock,
    inStock,
    isSoldOut,
    isSaleDisabled,
    isAvailable,
  };
}

export function hasUsableProductImage(url: string | null | undefined): boolean {
  const value = String(url || '').trim();
  if (!value) return false;
  return (
    value.startsWith('/media/') ||
    value.startsWith('/api/media/') ||
    value.startsWith('https://errani.ru/media/') ||
    value.startsWith('https://errani.ru/api/media/') ||
    value.startsWith('http://') ||
    value.startsWith('https://')
  );
}
