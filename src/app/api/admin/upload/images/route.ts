import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';

import { adminGuard } from '@/lib/admin-auth';
import {
  listActiveMediaItems,
  readMediaLibrary,
  softDeleteMediaItem,
  upsertMediaItem,
} from '@/lib/admin-media-library';

interface MediaItemResponse {
  filename: string;
  relativePath: string;
  url: string;
  size: number;
  updatedAt: string;
}

const ROOT_MEDIA_DIR = path.join(process.cwd(), 'public', 'media', 'products');

function getPublicBaseUrl(req: NextRequest): string {
  const configured = (process.env.NEXT_PUBLIC_SITE_URL || '').trim();
  if (configured) return configured.replace(/\/+$/, '');

  const proto = req.headers.get('x-forwarded-proto') || 'https';
  const forwardedHost = req.headers.get('x-forwarded-host') || req.headers.get('host') || 'errani.ru';
  const publicHost = forwardedHost.startsWith('admin.')
    ? forwardedHost.replace(/^admin\./, '')
    : forwardedHost;
  return `${proto}://${publicHost}`;
}

function normalizeRelativePath(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;

  const rawPath = trimmed.startsWith('http://') || trimmed.startsWith('https://')
    ? (() => {
        try {
          return new URL(trimmed).pathname;
        } catch {
          return '';
        }
      })()
    : trimmed;

  const normalized = `/${rawPath.replace(/\\/g, '/').replace(/^\/+/, '')}`;
  if (!normalized.startsWith('/media/products/')) return null;
  return normalized;
}

function safeResolveFromRelative(relativePath: string): string | null {
  const absolute = path.resolve(process.cwd(), 'public', relativePath.replace(/^\/+/, ''));
  const root = path.resolve(ROOT_MEDIA_DIR);
  if (!absolute.startsWith(root)) return null;
  return absolute;
}

async function listFilesFromFs(baseUrl: string): Promise<MediaItemResponse[]> {
  const exists = await fs.stat(ROOT_MEDIA_DIR).then(() => true).catch(() => false);
  if (!exists) return [];

  const rows: MediaItemResponse[] = [];

  async function walk(currentDir: string) {
    const entries = await fs.readdir(currentDir, { withFileTypes: true });
    for (const entry of entries) {
      const absolutePath = path.join(currentDir, entry.name);
      if (entry.isDirectory()) {
        await walk(absolutePath);
        continue;
      }
      if (!entry.isFile() || !entry.name.toLowerCase().endsWith('.webp')) continue;

      const stats = await fs.stat(absolutePath);
      const relative = `/${path.relative(path.join(process.cwd(), 'public'), absolutePath).replace(/\\/g, '/')}`;
      rows.push({
        filename: entry.name,
        relativePath: relative,
        url: `${baseUrl}${relative}`,
        size: stats.size,
        updatedAt: stats.mtime.toISOString(),
      });
    }
  }

  await walk(ROOT_MEDIA_DIR);
  rows.sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : -1));
  return rows;
}

async function syncDbWithFs(baseUrl: string): Promise<void> {
  const fsItems = await listFilesFromFs(baseUrl);
  for (const item of fsItems) {
    await upsertMediaItem({
      id: uuidv4(),
      filename: item.filename,
      relativePath: item.relativePath,
      url: item.url,
      size: item.size,
      width: 0,
      height: 0,
      mimeType: 'image/webp',
      createdAt: item.updatedAt,
      updatedAt: item.updatedAt,
      deletedAt: null,
    });
  }
}

export async function GET(req: NextRequest) {
  const denied = adminGuard(req);
  if (denied) return denied;

  try {
    const baseUrl = getPublicBaseUrl(req);

    let dbItems;
    try {
      dbItems = listActiveMediaItems(await readMediaLibrary());
      if (dbItems.length === 0) {
        await syncDbWithFs(baseUrl);
        dbItems = listActiveMediaItems(await readMediaLibrary());
      }
    } catch (dbError) {
      console.error('Media DB read warning, fallback to FS:', dbError);
      const fsItems = await listFilesFromFs(baseUrl);
      return NextResponse.json({ success: true, items: fsItems });
    }

    const items: MediaItemResponse[] = dbItems.map((item) => ({
      filename: item.filename,
      relativePath: item.relativePath,
      url: item.relativePath.startsWith('/media/')
        ? `${baseUrl}${item.relativePath}`
        : item.url,
      size: item.size,
      updatedAt: item.updatedAt,
    }));

    return NextResponse.json({ success: true, items });
  } catch (error) {
    console.error('Admin media list error:', error);
    return NextResponse.json(
      { success: false, message: 'Не удалось загрузить медиатеку' },
      { status: 500 }
    );
  }
}

export async function DELETE(req: NextRequest) {
  const denied = adminGuard(req);
  if (denied) return denied;

  try {
    const body = await req.json().catch(() => ({}));
    const relativePath = normalizeRelativePath(String(body?.path || ''));
    if (!relativePath) {
      return NextResponse.json({ success: false, message: 'Некорректный путь файла' }, { status: 400 });
    }

    const absolutePath = safeResolveFromRelative(relativePath);
    if (!absolutePath) {
      return NextResponse.json({ success: false, message: 'Некорректный путь файла' }, { status: 400 });
    }

    await softDeleteMediaItem(relativePath).catch((dbError) => {
      console.error('Media DB soft delete warning:', dbError);
    });
    await fs.unlink(absolutePath).catch(() => undefined);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Admin media delete error:', error);
    return NextResponse.json(
      { success: false, message: 'Не удалось удалить файл' },
      { status: 500 }
    );
  }
}
