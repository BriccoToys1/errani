import { NextRequest, NextResponse } from 'next/server';

const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
const maxSize = 10 * 1024 * 1024; // 10 MB

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get('file') as File | null;

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    if (!allowedTypes.includes(file.type)) {
      return NextResponse.json(
        { error: 'Invalid file type. Allowed: JPEG, PNG, WebP, GIF' },
        { status: 400 }
      );
    }

    if (file.size > maxSize) {
      return NextResponse.json({ error: 'File too large. Max size: 10MB' }, { status: 400 });
    }

    // Generate unique filename
    const ext = file.name.split('.').pop() || 'jpg';
    const filename = `${Date.now()}-${Math.random().toString(36).substring(2, 8)}.${ext}`;

    // ── Vercel (Blob storage) ──────────────────────────────────────────────
    if (process.env.BLOB_READ_WRITE_TOKEN) {
      const { put } = await import('@vercel/blob');
      const blob = await put(`media/${filename}`, file, { access: 'public' });
      return NextResponse.json({
        success: true,
        url: blob.url,
        filename: blob.pathname,
        size: file.size,
        type: file.type,
      });
    }

    // ── Local / VPS (filesystem) ───────────────────────────────────────────
    const fs = await import('fs');
    const path = await import('path');
    const uploadDir = path.join(process.cwd(), 'public', 'media');
    if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

    const buffer = Buffer.from(await file.arrayBuffer());
    fs.writeFileSync(path.join(uploadDir, filename), buffer);

    return NextResponse.json({
      success: true,
      url: `/media/${filename}`,
      filename,
      size: file.size,
      type: file.type,
    });
  } catch (error) {
    console.error('Upload error:', error);
    return NextResponse.json({ error: 'Upload failed' }, { status: 500 });
  }
}
