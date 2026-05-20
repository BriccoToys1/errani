const DEFAULT_PRODUCT_IMAGE = '/media/photo-11.jpeg';
const DEFAULT_PRODUCT_GALLERY = [
  '/media/photo-1.jpeg',
  '/media/photo-2.jpeg',
  '/media/photo-3.jpeg',
  '/media/photo-9.jpeg',
  '/media/photo-10.jpeg',
  '/media/photo-8.jpeg',
];

function isUsableMediaUrl(url: string): boolean {
  if (!url || typeof url !== 'string') return false;
  return url.trim().length > 0;
}

function parseImagesJson(value: string): string[] {
  try {
    const parsed = JSON.parse(value || '[]');
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((item): item is string => typeof item === 'string' && item.trim().length > 0);
  } catch {
    return [];
  }
}

function uniq(values: string[]): string[] {
  return Array.from(new Set(values.filter(Boolean)));
}

export async function normalizeProductMedia<T extends { image: string; images: string }>(product: T): Promise<T> {
  const image = typeof product.image === 'string' ? product.image.trim() : '';
  const parsedGallery = parseImagesJson(product.images);
  const valid = uniq([image, ...parsedGallery].filter(isUsableMediaUrl));

  const hero = valid[0] || DEFAULT_PRODUCT_IMAGE;
  const gallery = uniq(valid.filter((item) => item !== hero));
  const normalizedGallery = gallery.length > 0 ? gallery : DEFAULT_PRODUCT_GALLERY.filter((item) => item !== hero);

  return {
    ...product,
    image: hero,
    images: JSON.stringify(normalizedGallery),
  };
}

export async function normalizeProductMediaList<T extends { image: string; images: string }>(products: T[]): Promise<T[]> {
  return Promise.all(products.map((product) => normalizeProductMedia(product)));
}
