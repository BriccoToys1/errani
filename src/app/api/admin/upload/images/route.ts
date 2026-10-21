import { NextRequest, NextResponse } from 'next/server';

import { adminGuard } from '@/lib/admin-auth';
import {
  listActiveMediaItems,
  readMediaLibrary,
  softDeleteMediaItem,
  upsertMediaItem,
} from '@/lib/admin-media-library';

export async function GET(req: NextRequest) {
  const denied = adminGuard(req);
  if (denied) return denied;

  try {
    const dbItems = listActiveMediaItems(await readMediaLibrary());

    const items = dbItems.map((item) => ({
      filename: item.filename,
      relativePath: item.relativePath,
      url: item.url,
      size: item.size,
      updatedAt: item.updatedAt,
      mimeType: item.mimeType || '',
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

/** Rename display filename (does not change storage id / url). */
export async function PATCH(req: NextRequest) {
  const denied = adminGuard(req);
  if (denied) return denied;

  try {
    const body = await req.json().catch(() => ({}));
    const relativePath = String(body?.path || '').trim();
    const filename = String(body?.filename || '').trim().slice(0, 180);

    if (!relativePath || !filename) {
      return NextResponse.json(
        { success: false, message: 'Нужны path и filename' },
        { status: 400 }
      );
    }

    const items = listActiveMediaItems(await readMediaLibrary());
    const current = items.find((item) => item.relativePath === relativePath);
    if (!current) {
      return NextResponse.json(
        { success: false, message: 'Файл не найден' },
        { status: 404 }
      );
    }

    await upsertMediaItem({
      ...current,
      filename,
      updatedAt: new Date().toISOString(),
    });

    return NextResponse.json({ success: true, filename });
  } catch (error) {
    console.error('Admin media rename error:', error);
    return NextResponse.json(
      { success: false, message: 'Не удалось переименовать файл' },
      { status: 500 }
    );
  }
}

export async function DELETE(req: NextRequest) {
  const denied = adminGuard(req);
  if (denied) return denied;

  try {
    const body = await req.json().catch(() => ({}));
    const relativePath = String(body?.path || '').trim();

    if (!relativePath) {
      return NextResponse.json(
        { success: false, message: 'Некорректный путь файла' },
        { status: 400 }
      );
    }

    const deleted = await softDeleteMediaItem(relativePath).catch((dbError) => {
      console.error('Media DB soft delete warning:', dbError);
      return false;
    });

    return NextResponse.json({ success: true, archived: deleted });
  } catch (error) {
    console.error('Admin media delete error:', error);
    return NextResponse.json(
      { success: false, message: 'Не удалось удалить файл' },
      { status: 500 }
    );
  }
}
