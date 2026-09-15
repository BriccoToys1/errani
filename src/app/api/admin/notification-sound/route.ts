import { NextRequest, NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';

import { adminGuard } from '@/lib/admin-auth';
import prisma from '@/lib/db';
import { withPrismaRetry } from '@/lib/prisma-retry';

const ALLOWED_MIME = new Set(['audio/mpeg', 'audio/mp3']);
const MAX_SIZE_BYTES = 3 * 1024 * 1024;

// POST: upload a custom MP3 notification sound, stored like any other media asset.
export async function POST(req: NextRequest) {
  const denied = adminGuard(req);
  if (denied) return denied;

  try {
    const formData = await req.formData();
    const filePart = formData.get('file');

    if (!(filePart instanceof File)) {
      return NextResponse.json({ success: false, error: 'No file provided' }, { status: 400 });
    }
    if (filePart.size <= 0 || filePart.size > MAX_SIZE_BYTES) {
      return NextResponse.json({ success: false, error: 'Файл должен быть MP3 размером до 3MB' }, { status: 400 });
    }
    const mimeType = (filePart.type || '').toLowerCase();
    if (!ALLOWED_MIME.has(mimeType) && !filePart.name.toLowerCase().endsWith('.mp3')) {
      return NextResponse.json({ success: false, error: 'Разрешён только формат MP3' }, { status: 400 });
    }

    const buffer = Buffer.from(await filePart.arrayBuffer());
    const id = uuidv4();
    const filename = `${id}.mp3`;
    const url = `/api/media/${id}`;
    const now = new Date();

    await withPrismaRetry(() =>
      prisma.mediaAsset.create({
        data: {
          id,
          filename,
          relativePath: url,
          url,
          data: buffer as unknown as Uint8Array<ArrayBuffer>,
          size: buffer.byteLength,
          mimeType: 'audio/mpeg',
          source: 'admin',
          createdAt: now,
          updatedAt: now,
        },
      })
    );

    return NextResponse.json({ success: true, url });
  } catch (error) {
    console.error('Notification sound upload error:', error);
    return NextResponse.json({ success: false, error: 'Upload failed' }, { status: 500 });
  }
}
