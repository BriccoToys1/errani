import fs from 'fs/promises';
import path from 'path';

const MEDIA_CHECK_TTL_MS = 5 * 60 * 1000;
const DEFAULT_PRODUCT_IMAGE = '/media/photo-11.jpeg';
const DEFAULT_PRODUCT_GALLERY = [
  '/media/photo-1.jpeg',
  '/media/photo-2.jpeg',
  '/media/photo-3.jpeg',
  '/media/photo-9.jpeg',
  '/media/photo-10.jpeg',
  '/media/photo-8.jpeg',
];

const mediaExistsCache = new Map<string, { ts: number; exists: boolean }>();

function normalizeMediaPath(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed.startsWith('/')) return null;
  const normalized = `/${trimmed.replace(/\\/g, '/').replace(/^\/+/, '')}`;
  if (!normalized.startsWith('/media/')) return null;
  return normalized;
}

async function localMediaExists(relativePath: string): Promise<boolean> {
  const now = Date.now();
  const cached = mediaExistsCache.get(relativePath);
  if (cached && now - cached.ts < MEDIA_CHECK_TTL_MS) {
    return cached.exists;
  }

  const absolutePath = path.resolve(process.cwd(), 'public', relativePath.replace(/^\/+/, ''));
  const publicRoot = path.resolve(process.cwd(), 'public');
  if (!absolutePath.startsWith(publicRoot)) {
    mediaExistsCache.set(relativePath, { ts: now, exists: false });
    return false;
  }

  const exists = await fs.access(absolutePath).then(() => true).catch(() => false);
  mediaExistsCache.set(relativePath, { ts: now, exists });
  return exists;
}

async function isUsableMediaUrl(url: string): Promise<boolean> {
  if (!url || typeof url !== 'string') return false;
  const trimmed = url.trim();
  if (!trimmed) return false;
  if (/^https?:\/\//i.test(trimmed)) return true;

  const normalized = normalizeMediaPath(trimmed);
  if (!normalized) return true;
  return localMediaExists(normalized);
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

async function getDefaultGallery(): Promise<string[]> {
  const checks = await Promise.all(DEFAULT_PRODUCT_GALLERY.map(async (item) => ({ item, ok: await isUsableMediaUrl(item) })));
  return checks.filter((entry) => entry.ok).map((entry) => entry.item);
}

export async function normalizeProductMedia<T extends { image: string; images: string }>(product: T): Promise<T> {
  const image = typeof product.image === 'string' ? product.image.trim() : '';
  const parsedGallery = parseImagesJson(product.images);
  const candidates = uniq([image, ...parsedGallery].filter(Boolean));
  const checks = await Promise.all(
    candidates.map(async (item) => ({ item, ok: await isUsableMediaUrl(item) }))
  );
  const valid = checks.filter((entry) => entry.ok).map((entry) => entry.item);

  const fallbackHero = (await isUsableMediaUrl(DEFAULT_PRODUCT_IMAGE)) ? DEFAULT_PRODUCT_IMAGE : '';
  const fallbackGallery = await getDefaultGallery();

  const hero = valid[0] || fallbackHero || fallbackGallery[0] || '';
  const gallery = uniq(valid.filter((item) => item !== hero));
  const normalizedGallery = gallery.length > 0 ? gallery : fallbackGallery.filter((item) => item !== hero);

  return {
    ...product,
    image: hero,
    images: JSON.stringify(normalizedGallery),
  };
}

export async function normalizeProductMediaList<T extends { image: string; images: string }>(products: T[]): Promise<T[]> {
  return Promise.all(products.map((product) => normalizeProductMedia(product)));
}
