import prisma from '@/lib/db';
import { withPrismaRetry } from '@/lib/prisma-retry';

export const ADMIN_MEDIA_LIBRARY_KEY = 'admin_media_library_v1';

export interface MediaLibraryItem {
  id: string;
  filename: string;
  relativePath: string;
  url: string;
  size: number;
  width: number;
  height: number;
  mimeType: string;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function normalizeItem(raw: unknown): MediaLibraryItem | null {
  if (!isObject(raw)) return null;

  const id = String(raw.id || '').trim();
  const filename = String(raw.filename || '').trim();
  const relativePath = String(raw.relativePath || '').trim();
  const url = String(raw.url || '').trim();

  if (!id || !filename || !relativePath || !url) return null;

  return {
    id,
    filename,
    relativePath,
    url,
    size: Number(raw.size || 0),
    width: Number(raw.width || 0),
    height: Number(raw.height || 0),
    mimeType: String(raw.mimeType || 'image/webp'),
    createdAt: String(raw.createdAt || new Date().toISOString()),
    updatedAt: String(raw.updatedAt || new Date().toISOString()),
    deletedAt: raw.deletedAt ? String(raw.deletedAt) : null,
  };
}

export async function readMediaLibrary(): Promise<MediaLibraryItem[]> {
  const content = await withPrismaRetry(() =>
    prisma.siteContent.findUnique({
      where: { key: ADMIN_MEDIA_LIBRARY_KEY },
      select: { value: true },
    })
  );

  if (!content?.value) return [];

  try {
    const parsed = JSON.parse(content.value);
    if (!Array.isArray(parsed)) return [];
    return parsed.map(normalizeItem).filter((item): item is MediaLibraryItem => Boolean(item));
  } catch {
    return [];
  }
}

export async function writeMediaLibrary(items: MediaLibraryItem[]): Promise<void> {
  await withPrismaRetry(() =>
    prisma.siteContent.upsert({
      where: { key: ADMIN_MEDIA_LIBRARY_KEY },
      update: { value: JSON.stringify(items) },
      create: { key: ADMIN_MEDIA_LIBRARY_KEY, value: JSON.stringify(items) },
    })
  );
}

export async function upsertMediaItem(item: MediaLibraryItem): Promise<void> {
  const items = await readMediaLibrary();
  const now = new Date().toISOString();

  const next = [...items];
  const existingIndex = next.findIndex((x) => x.relativePath === item.relativePath);
  if (existingIndex >= 0) {
    const existing = next[existingIndex];
    next[existingIndex] = {
      ...existing,
      ...item,
      id: existing.id,
      createdAt: existing.createdAt,
      updatedAt: now,
      deletedAt: null,
    };
  } else {
    next.unshift({
      ...item,
      createdAt: item.createdAt || now,
      updatedAt: item.updatedAt || now,
      deletedAt: null,
    });
  }

  await writeMediaLibrary(next);
}

export async function softDeleteMediaItem(relativePath: string): Promise<boolean> {
  const items = await readMediaLibrary();
  const now = new Date().toISOString();
  let changed = false;

  const next = items.map((item) => {
    if (item.relativePath !== relativePath) return item;
    if (item.deletedAt) return item;
    changed = true;
    return { ...item, deletedAt: now, updatedAt: now };
  });

  if (changed) {
    await writeMediaLibrary(next);
  }

  return changed;
}

export function listActiveMediaItems(items: MediaLibraryItem[]): MediaLibraryItem[] {
  return items
    .filter((item) => !item.deletedAt)
    .sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : -1));
}
