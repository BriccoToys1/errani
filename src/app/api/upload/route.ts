import { NextRequest, NextResponse } from 'next/server';
import sharp from 'sharp';

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

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get('file') as File | null;

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    const originalExt = file.name.split('.').pop()?.toLowerCase() || '';
    const mimeType = (file.type || '').toLowerCase();
    const isSvg = mimeType === 'image/svg+xml' || originalExt === 'svg';
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

    // ── VPS filesystem upload ───────────────────────────────────────────────
    const fs = await import('fs');
    const path = await import('path');
    // Use absolute path based on CWD (works on VPS)
    const uploadDir = path.join(process.cwd(), 'public', 'media');
    if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

    const arrayBuffer = await file.arrayBuffer();
    const sourceBuffer = Buffer.from(arrayBuffer);

    let filename: string;
    let finalBuffer: Buffer;
    let finalType: string;

    if (isSvg) {
      filename = `${Date.now()}-${Math.random().toString(36).substring(2, 8)}.svg`;
      finalBuffer = sourceBuffer;
      finalType = 'image/svg+xml';
    } else {
      try {
        // Decode and normalize all raster formats into WebP for stable rendering on site.
        finalBuffer = await sharp(sourceBuffer, { animated: true })
          .rotate()
          .webp({ quality: 90 })
          .toBuffer();
        filename = `${Date.now()}-${Math.random().toString(36).substring(2, 8)}.webp`;
        finalType = 'image/webp';
      } catch (decodeError) {
        console.error('Image decode error:', decodeError);
        return NextResponse.json(
          { error: 'Failed to decode image. Please upload a valid PNG, JPG, JPEG, SVG, HEIC, WEBP or AVIF file.' },
          { status: 400 }
        );
      }
    }

    fs.writeFileSync(path.join(uploadDir, filename), finalBuffer);

    return NextResponse.json({
      success: true,
      url: `/media/${filename}`,
      filename,
      size: finalBuffer.byteLength,
      type: finalType,
    });
  } catch (error) {
    console.error('Upload error:', error);
    const msg = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: `Upload failed: ${msg}` }, { status: 500 });
  }
}
