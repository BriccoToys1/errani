import prisma from '@/lib/db';
import { withPrismaRetry } from '@/lib/prisma-retry';

export const ADMIN_MEDIA_LIBRARY_KEY = 'admin_media_library_v1';
const MEDIA_CACHE_TTL_MS = 12_000;

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

let mediaCache: { expiresAt: number; data: MediaLibraryItem[] } | null = null;

function toDateOrNow(value: string | undefined): Date {
  if (!value) return new Date();
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? new Date() : parsed;
}

function invalidateCache() {
  mediaCache = null;
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

function toLibraryItem(asset: {
  id: string;
  filename: string;
  relativePath: string;
  url: string;
  size: number;
  width: number;
  height: number;
  mimeType: string;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
}): MediaLibraryItem {
  return {
    id: asset.id,
    filename: asset.filename,
    relativePath: asset.relativePath,
    url: asset.url,
    size: asset.size,
    width: asset.width,
    height: asset.height,
    mimeType: asset.mimeType,
    createdAt: asset.createdAt.toISOString(),
    updatedAt: asset.updatedAt.toISOString(),
    deletedAt: asset.deletedAt ? asset.deletedAt.toISOString() : null,
  };
}

async function readLegacySiteContentMedia(): Promise<MediaLibraryItem[]> {
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

async function migrateLegacySiteContentMedia(): Promise<MediaLibraryItem[]> {
  const legacyItems = listActiveMediaItems(await readLegacySiteContentMedia());
  if (legacyItems.length === 0) return [];

  await withPrismaRetry(() =>
    prisma.mediaAsset.createMany({
      data: legacyItems.map((item) => ({
        id: item.id,
        filename: item.filename,
        relativePath: item.relativePath,
        url: item.url,
        size: item.size,
        width: item.width,
        height: item.height,
        mimeType: item.mimeType || 'image/webp',
        source: 'admin',
        createdAt: toDateOrNow(item.createdAt),
        updatedAt: toDateOrNow(item.updatedAt),
        deletedAt: item.deletedAt ? toDateOrNow(item.deletedAt) : null,
      })),
      skipDuplicates: true,
    })
  );

  const assets = await withPrismaRetry(() =>
    prisma.mediaAsset.findMany({
      where: { deletedAt: null },
      orderBy: { updatedAt: 'desc' },
      take: 5000,
    })
  );

  return assets.map(toLibraryItem);
}

export async function readMediaLibrary(): Promise<MediaLibraryItem[]> {
  const now = Date.now();
  if (mediaCache && mediaCache.expiresAt > now) {
    return mediaCache.data;
  }

  const assets = await withPrismaRetry(() =>
    prisma.mediaAsset.findMany({
      where: { deletedAt: null },
      orderBy: { updatedAt: 'desc' },
      take: 5000,
    })
  );

  let items = assets.map(toLibraryItem);
  if (items.length === 0) {
    items = await migrateLegacySiteContentMedia();
  }

  mediaCache = { expiresAt: now + MEDIA_CACHE_TTL_MS, data: items };
  return items;
}

export async function writeMediaLibrary(items: MediaLibraryItem[]): Promise<void> {
  const activeItems = listActiveMediaItems(items);
  const now = new Date();

  await withPrismaRetry(() =>
    prisma.$transaction(async (tx) => {
      for (const item of activeItems) {
        await tx.mediaAsset.upsert({
          where: { relativePath: item.relativePath },
          update: {
            filename: item.filename,
            url: item.url,
            size: item.size,
            width: item.width,
            height: item.height,
            mimeType: item.mimeType || 'image/webp',
            deletedAt: null,
            updatedAt: now,
          },
          create: {
            id: item.id,
            filename: item.filename,
            relativePath: item.relativePath,
            url: item.url,
            size: item.size,
            width: item.width,
            height: item.height,
            mimeType: item.mimeType || 'image/webp',
            source: 'admin',
            createdAt: item.createdAt ? toDateOrNow(item.createdAt) : now,
            updatedAt: item.updatedAt ? toDateOrNow(item.updatedAt) : now,
            deletedAt: null,
          },
        });
      }
    })
  );

  invalidateCache();
}

export async function upsertMediaItem(item: MediaLibraryItem): Promise<void> {
  const now = new Date();

  await withPrismaRetry(() =>
    prisma.mediaAsset.upsert({
      where: { relativePath: item.relativePath },
      update: {
        filename: item.filename,
        url: item.url,
        size: item.size,
        width: item.width,
        height: item.height,
        mimeType: item.mimeType || 'image/webp',
        deletedAt: null,
        updatedAt: now,
      },
      create: {
        id: item.id,
        filename: item.filename,
        relativePath: item.relativePath,
        url: item.url,
        size: item.size,
        width: item.width,
        height: item.height,
        mimeType: item.mimeType || 'image/webp',
        source: 'admin',
        createdAt: item.createdAt ? toDateOrNow(item.createdAt) : now,
        updatedAt: item.updatedAt ? toDateOrNow(item.updatedAt) : now,
        deletedAt: null,
      },
    })
  );

  invalidateCache();
}

export async function softDeleteMediaItem(relativePath: string): Promise<boolean> {
  const now = new Date();
  const result = await withPrismaRetry(() =>
    prisma.mediaAsset.updateMany({
      where: { relativePath, deletedAt: null },
      data: { deletedAt: now },
    })
  );

  if (result.count > 0) {
    invalidateCache();
    return true;
  }

  return false;
}

export function listActiveMediaItems(items: MediaLibraryItem[]): MediaLibraryItem[] {
  return items
    .filter((item) => !item.deletedAt)
    .sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : -1));
}
