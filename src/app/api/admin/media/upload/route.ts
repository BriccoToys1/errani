import { NextRequest, NextResponse } from 'next/server';
import sharp from 'sharp';
import { v4 as uuidv4 } from 'uuid';

import { adminGuard } from '@/lib/admin-auth';
import prisma from '@/lib/db';
import { extensionOf, mediaKindOf } from '@/lib/media-kind';
import { withPrismaRetry } from '@/lib/prisma-retry';

const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
const MAX_AUDIO_BYTES = 30 * 1024 * 1024;
const MAX_VIDEO_BYTES = 80 * 1024 * 1024;

const IMAGE_MIME = new Set(['image/jpeg', 'image/png', 'image/webp']);
const AUDIO_MIME = new Set([
  'audio/mpeg',
  'audio/mp3',
  'audio/wav',
  'audio/x-wav',
  'audio/ogg',
  'audio/mp4',
  'audio/aac',
  'audio/flac',
  'audio/webm',
]);
const VIDEO_MIME = new Set([
  'video/mp4',
  'video/webm',
  'video/quicktime',
  'video/x-m4v',
]);

const IMAGE_EXT = new Set(['jpg', 'jpeg', 'png', 'webp']);
const AUDIO_EXT = new Set(['mp3', 'wav', 'ogg', 'm4a', 'aac', 'flac']);
const VIDEO_EXT = new Set(['mp4', 'webm', 'mov', 'm4v']);

function detectKind(file: File): 'photo' | 'video' | 'audio' | null {
  const mime = (file.type || '').toLowerCase();
  const ext = extensionOf(file.name);
  if (IMAGE_MIME.has(mime) || IMAGE_EXT.has(ext)) return 'photo';
  if (AUDIO_MIME.has(mime) || AUDIO_EXT.has(ext)) return 'audio';
  if (VIDEO_MIME.has(mime) || VIDEO_EXT.has(ext)) return 'video';
  return null;
}

function outputExt(kind: 'photo' | 'video' | 'audio', file: File): string {
  if (kind === 'photo') return 'webp';
  const ext = extensionOf(file.name);
  if (kind === 'audio') return AUDIO_EXT.has(ext) ? ext : 'mp3';
  return VIDEO_EXT.has(ext) ? ext : 'mp4';
}

function outputMime(kind: 'photo' | 'video' | 'audio', file: File, ext: string): string {
  if (kind === 'photo') return 'image/webp';
  const mime = (file.type || '').toLowerCase();
  if (mime) return mime;
  if (kind === 'audio') {
    if (ext === 'wav') return 'audio/wav';
    if (ext === 'ogg') return 'audio/ogg';
    if (ext === 'm4a' || ext === 'aac') return 'audio/mp4';
    if (ext === 'flac') return 'audio/flac';
    return 'audio/mpeg';
  }
  if (ext === 'webm') return 'video/webm';
  if (ext === 'mov') return 'video/quicktime';
  return 'video/mp4';
}

export async function POST(req: NextRequest) {
  const denied = adminGuard(req);
  if (denied) return denied;

  try {
    const formData = await req.formData();
    const filePart = formData.get('image') || formData.get('file') || formData.get('media');

    if (!(filePart instanceof File)) {
      return NextResponse.json(
        { success: false, message: 'Файл не найден. Используйте поле image, file или media.' },
        { status: 400 }
      );
    }

    if (filePart.size <= 0) {
      return NextResponse.json({ success: false, message: 'Пустой файл' }, { status: 400 });
    }

    const kind = detectKind(filePart);
    if (!kind) {
      return NextResponse.json(
        { success: false, message: 'Разрешены фото (JPEG/PNG/WEBP), аудио и видео' },
        { status: 400 }
      );
    }

    const maxBytes = kind === 'photo' ? MAX_IMAGE_BYTES : kind === 'audio' ? MAX_AUDIO_BYTES : MAX_VIDEO_BYTES;
    if (filePart.size > maxBytes) {
      const mb = Math.round(maxBytes / (1024 * 1024));
      return NextResponse.json(
        { success: false, message: `Максимальный размер файла: ${mb} MB` },
        { status: 400 }
      );
    }

    const id = uuidv4();
    const ext = outputExt(kind, filePart);
    const filename = `${id}.${ext}`;
    const url = `/api/media/${id}`;
    const now = new Date();
    let buffer: Buffer;
    let width = 0;
    let height = 0;
    let size = filePart.size;
    const mimeType = outputMime(kind, filePart, ext);

    if (kind === 'photo') {
      const sourceBuffer = Buffer.from(await filePart.arrayBuffer());
      let metadata: sharp.Metadata;
      try {
        metadata = await sharp(sourceBuffer, { failOn: 'error' }).metadata();
      } catch {
        return NextResponse.json(
          { success: false, message: 'Файл не является корректным изображением' },
          { status: 400 }
        );
      }
      const detectedFormat = (metadata.format || '').toLowerCase();
      if (!['jpeg', 'png', 'webp'].includes(detectedFormat)) {
        return NextResponse.json(
          { success: false, message: 'Недопустимый формат изображения' },
          { status: 400 }
        );
      }
      const { data: outputBuffer, info } = await sharp(sourceBuffer, { failOn: 'error' })
        .rotate()
        .resize({ width: 1600, fit: 'inside', withoutEnlargement: true })
        .webp({ quality: 82, effort: 3 })
        .toBuffer({ resolveWithObject: true });
      buffer = outputBuffer;
      width = info.width || 0;
      height = info.height || 0;
      size = info.size;
    } else {
      buffer = Buffer.from(await filePart.arrayBuffer());
    }

    await withPrismaRetry(() =>
      prisma.mediaAsset.create({
        data: {
          id,
          filename,
          relativePath: url,
          url,
          data: buffer as unknown as Uint8Array<ArrayBuffer>,
          size,
          width,
          height,
          mimeType,
          source: 'admin',
          createdAt: now,
          updatedAt: now,
        },
      })
    );

    return NextResponse.json({
      success: true,
      url,
      fullUrl: url,
      filename,
      width,
      height,
      size,
      mimeType,
      kind: mediaKindOf({ mimeType, filename, url }),
    });
  } catch (error) {
    console.error('Admin media upload error:', error);
    return NextResponse.json(
      { success: false, message: 'Ошибка загрузки файла' },
      { status: 500 }
    );
  }
}
