import { NextRequest, NextResponse } from 'next/server';

import prisma from '@/lib/db';
import { withPrismaRetry } from '@/lib/prisma-retry';

function parseMedia(value: string): string[] {
  try {
    const parsed = JSON.parse(value || '[]');
    if (!Array.isArray(parsed)) return [];
    return parsed.map((item) => String(item || '').trim()).filter(Boolean);
  } catch {
    return [];
  }
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const slug = String(searchParams.get('slug') || '').trim();
    const productId = String(searchParams.get('productId') || '').trim();
    const all = searchParams.get('all') === 'true';

    if (!slug && !productId && !all) {
      return NextResponse.json({ success: false, message: 'Укажите slug, productId или all=true' }, { status: 400 });
    }

    let whereClause: { productId?: string; status: string } = { status: 'approved' };

    if (!all) {
      let resolvedProductId = productId;
      if (!resolvedProductId && slug) {
        const product = await withPrismaRetry(() =>
          prisma.product.findUnique({ where: { slug }, select: { id: true } })
        );
        if (!product) {
          return NextResponse.json({ success: true, reviews: [] });
        }
        resolvedProductId = product.id;
      }
      whereClause = { productId: resolvedProductId, status: 'approved' };
    }

    const reviews = await withPrismaRetry(() =>
      prisma.review.findMany({
        where: whereClause,
        orderBy: [{ approvedAt: 'desc' }, { createdAt: 'desc' }],
        select: {
          id: true,
          customerName: true,
          rating: true,
          text: true,
          media: true,
          approvedMedia: true,
          approvedAt: true,
          createdAt: true,
        },
      })
    );

    return NextResponse.json({
      success: true,
      reviews: reviews.map((review) => {
        const allMedia = parseMedia(review.media);
        const approved = parseMedia(review.approvedMedia);
        const displayMedia = approved.length > 0 ? approved : allMedia;
        return {
          id: review.id,
          customerName: review.customerName,
          rating: review.rating,
          text: review.text,
          media: displayMedia,
          approvedAt: review.approvedAt,
          createdAt: review.createdAt,
        };
      }),
    });
  } catch (error) {
    console.error('Public reviews error:', error);
    return NextResponse.json({ success: false, message: 'Ошибка загрузки отзывов' }, { status: 500 });
  }
}
