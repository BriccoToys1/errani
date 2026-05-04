import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';

import prisma from '@/lib/db';
import { verifyAdminToken } from '@/lib/admin-auth';

interface MediaItem {
  filename: string;
  relativePath: string;
  url: string;
  size: number;
  updatedAt: string;
}

const ROOT_UPLOADS_DIR = path.join(process.cwd(), 'public', 'uploads', 'products');

function getPublicBaseUrl(req: NextRequest): string {
  const configured = (process.env.NEXT_PUBLIC_SITE_URL || '').trim();
  if (configured) {
    return configured.replace(/\/+$/, '');
  }

  const proto = req.headers.get('x-forwarded-proto') || 'https';
  const forwardedHost = req.headers.get('x-forwarded-host') || req.headers.get('host') || 'errani.ru';
  const publicHost = forwardedHost.startsWith('admin.') ? forwardedHost.replace(/^admin\./, '') : forwardedHost;
  return `${proto}://${publicHost}`;
}

async function ensureAdmin(req: NextRequest): Promise<NextResponse | null> {
  const admin = verifyAdminToken(req);
  if (!admin) {
    return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
  }

  const adminExists = await prisma.admin.findUnique({
    where: { id: admin.adminId },
    select: { id: true },
  });

  if (!adminExists) {
    return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
  }

  return null;
}

function safeResolveFromRelative(relativePath: string): string | null {
  const normalized = relativePath.replace(/\\/g, '/').replace(/^\/+/, '');
  if (!normalized.startsWith('uploads/products/')) {
    return null;
  }

  const absolute = path.resolve(process.cwd(), 'public', normalized);
  const root = path.resolve(ROOT_UPLOADS_DIR);

  if (!absolute.startsWith(root)) {
    return null;
  }

  return absolute;
}

async function collectMediaFiles(dir: string, baseUrl: string): Promise<MediaItem[]> {
  const exists = await fs.stat(dir).then(() => true).catch(() => false);
  if (!exists) {
    return [];
  }

  const output: MediaItem[] = [];

  async function walk(currentDir: string) {
    const entries = await fs.readdir(currentDir, { withFileTypes: true });

    for (const entry of entries) {
      const absolutePath = path.join(currentDir, entry.name);
      if (entry.isDirectory()) {
        await walk(absolutePath);
        continue;
      }

      if (!entry.isFile() || !entry.name.toLowerCase().endsWith('.webp')) {
        continue;
      }

      const stats = await fs.stat(absolutePath);
      const relative = path.relative(path.join(process.cwd(), 'public'), absolutePath).replace(/\\/g, '/');
      const relativePath = `/${relative}`;

      output.push({
        filename: entry.name,
        relativePath,
        url: `${baseUrl}${relativePath}`,
        size: stats.size,
        updatedAt: stats.mtime.toISOString(),
      });
    }
  }

  await walk(dir);

  output.sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : -1));
  return output;
}

export async function GET(req: NextRequest) {
  try {
    const denied = await ensureAdmin(req);
    if (denied) return denied;

    const items = await collectMediaFiles(ROOT_UPLOADS_DIR, getPublicBaseUrl(req));

    return NextResponse.json({
      success: true,
      items,
    });
  } catch (error) {
    console.error('Admin media list error:', error);
    return NextResponse.json({ success: false, message: 'Не удалось загрузить медиатеку' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const denied = await ensureAdmin(req);
    if (denied) return denied;

    const body = await req.json().catch(() => ({}));
    const rawPath = String(body?.path || '').trim();

    if (!rawPath) {
      return NextResponse.json({ success: false, message: 'Не указан путь файла' }, { status: 400 });
    }

    let relativePath = rawPath;
    if (rawPath.startsWith('http://') || rawPath.startsWith('https://')) {
      try {
        relativePath = new URL(rawPath).pathname;
      } catch {
        return NextResponse.json({ success: false, message: 'Некорректный URL файла' }, { status: 400 });
      }
    }

    const absolutePath = safeResolveFromRelative(relativePath);
    if (!absolutePath) {
      return NextResponse.json({ success: false, message: 'Некорректный путь файла' }, { status: 400 });
    }

    await fs.unlink(absolutePath);

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    const err = error as NodeJS.ErrnoException;
    if (err?.code === 'ENOENT') {
      return NextResponse.json({ success: false, message: 'Файл не найден' }, { status: 404 });
    }

    console.error('Admin media delete error:', error);
    return NextResponse.json({ success: false, message: 'Не удалось удалить файл' }, { status: 500 });
  }
}
