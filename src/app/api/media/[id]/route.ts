import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';
import prisma from '@/lib/db';
import { withPrismaRetry } from '@/lib/prisma-retry';

function toResponseBody(data: Buffer | Uint8Array): Uint8Array<ArrayBuffer> {
  if (Buffer.isBuffer(data)) {
    return new Uint8Array(data.buffer, data.byteOffset, data.byteLength) as Uint8Array<ArrayBuffer>;
  }
  return new Uint8Array(data.buffer, data.byteOffset, data.byteLength) as Uint8Array<ArrayBuffer>;
}

async function readPublicFallback(relativePath: string): Promise<Buffer | null> {
  const cleaned = relativePath.replace(/^https?:\/\/[^/]+/i, '').replace(/^\/+/, '');
  if (!cleaned.startsWith('media/') || cleaned.includes('..')) return null;
  try {
    return await fs.readFile(path.join(process.cwd(), 'public', cleaned));
  } catch {
    return null;
  }
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  try {
    const asset = await withPrismaRetry(() =>
      prisma.mediaAsset.findFirst({
        where: { id, deletedAt: null },
        select: { data: true, mimeType: true, relativePath: true, url: true },
      })
    );

    if (asset?.data && asset.data.length > 0) {
      return new NextResponse(toResponseBody(asset.data as Uint8Array), {
        headers: {
          'Content-Type': asset.mimeType || 'application/octet-stream',
          'Cache-Control': 'public, max-age=31536000, immutable',
        },
      });
    }

    const fallbackPath = asset?.relativePath || asset?.url || '';
    const file = fallbackPath ? await readPublicFallback(fallbackPath) : null;
    if (file) {
      return new NextResponse(toResponseBody(file), {
        headers: {
          'Content-Type': asset?.mimeType || 'application/octet-stream',
          'Cache-Control': 'public, max-age=31536000, immutable',
        },
      });
    }

    return new NextResponse(null, { status: 404 });
  } catch (error) {
    console.error('media GET failed', id, error);
    return new NextResponse(null, { status: 503 });
  }
}
