import { NextRequest, NextResponse } from 'next/server';

import { adminGuard } from '@/lib/admin-auth';
import {
  listActiveMediaItems,
  readMediaLibrary,
  softDeleteMediaItem,
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
