import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { withPrismaRetry } from '@/lib/prisma-retry';

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const asset = await withPrismaRetry(() =>
    prisma.mediaAsset.findUnique({
      where: { id, deletedAt: null },
      select: { data: true, mimeType: true },
    })
  );

  if (!asset?.data) {
    return new NextResponse(null, { status: 404 });
  }

  return new NextResponse(asset.data as unknown as Buffer, {
    headers: {
      'Content-Type': asset.mimeType,
      'Cache-Control': 'public, max-age=31536000, immutable',
    },
  });
}
