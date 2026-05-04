import { NextRequest, NextResponse } from 'next/server';

const allowedTypes = [
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
  'image/avif',
  'image/heic',
  'image/heif',
  'image/svg+xml',
];
const allowedExts = ['jpg', 'jpeg', 'png', 'webp', 'avif', 'svg', 'heic', 'heif'];
const maxSize = 10 * 1024 * 1024; // 10 MB

const extToMime: Record<string, string> = {
  jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png',
  webp: 'image/webp', avif: 'image/avif', svg: 'image/svg+xml',
  heic: 'image/heic', heif: 'image/heif',
};

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get('file') as File | null;

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    const originalExt = file.name.split('.').pop()?.toLowerCase() || '';
    const mimeType = (file.type || '').toLowerCase();
    const isAllowedByMime = allowedTypes.includes(mimeType);
    const isAllowedByExt = allowedExts.includes(originalExt);

    if (!isAllowedByMime && !isAllowedByExt) {
      return NextResponse.json(
        { error: `Invalid file type: ${file.type || originalExt}. Allowed: PNG, JPG, JPEG, SVG, HEIC, WEBP, AVIF` },
        { status: 400 }
      );
    }

    if (file.size > maxSize) {
      return NextResponse.json({ error: 'File too large. Max size: 10MB' }, { status: 400 });
    }

    const fs = await import('fs');
    const path = await import('path');
    const uploadDir = path.join(process.cwd(), 'public', 'media');
    if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

    const arrayBuffer = await file.arrayBuffer();
    const sourceBuffer = Buffer.from(arrayBuffer);

    const ext = originalExt || 'jpg';
    const filename = `${Date.now()}-${Math.random().toString(36).substring(2, 8)}.${ext}`;
    const finalType = mimeType || extToMime[ext] || 'image/jpeg';

    fs.writeFileSync(path.join(uploadDir, filename), sourceBuffer);

    return NextResponse.json({
      success: true,
      url: `/media/${filename}`,
      filename,
      size: sourceBuffer.byteLength,
      type: finalType,
    });
  } catch (error) {
    console.error('Upload error:', error);
    const msg = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: `Upload failed: ${msg}` }, { status: 500 });
  }
}
