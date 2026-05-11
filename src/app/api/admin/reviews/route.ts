import { NextRequest, NextResponse } from 'next/server';

import { adminGuard, verifyAdminToken } from '@/lib/admin-auth';
import prisma from '@/lib/db';
import { withPrismaRetry } from '@/lib/prisma-retry';

const PAGE_SIZE = 30;
const REVIEW_STATUSES = new Set(['pending', 'approved', 'rejected']);

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
  const denied = adminGuard(req);
  if (denied) return denied;

  try {
    const { searchParams } = new URL(req.url);
    const page = Math.max(1, Number(searchParams.get('page') || '1'));
    const status = (searchParams.get('status') || '').trim();
    const productId = (searchParams.get('productId') || '').trim();
    const q = (searchParams.get('q') || '').trim();

    const where: {
      status?: string;
      productId?: string;
      OR?: Array<{ customerEmail?: { contains: string; mode: 'insensitive' }; customerName?: { contains: string; mode: 'insensitive' }; text?: { contains: string; mode: 'insensitive' } }>;
    } = {};

    if (REVIEW_STATUSES.has(status)) where.status = status;
    if (productId) where.productId = productId;
    if (q) {
      where.OR = [
        { customerEmail: { contains: q, mode: 'insensitive' } },
        { customerName: { contains: q, mode: 'insensitive' } },
        { text: { contains: q, mode: 'insensitive' } },
      ];
    }

    const [total, pending, reviews, products] = await Promise.all([
      withPrismaRetry(() => prisma.review.count({ where })),
      withPrismaRetry(() => prisma.review.count({ where: { status: 'pending' } })),
      withPrismaRetry(() =>
        prisma.review.findMany({
          where,
          orderBy: [{ createdAt: 'desc' }],
          skip: (page - 1) * PAGE_SIZE,
          take: PAGE_SIZE,
          include: {
            product: { select: { id: true, slug: true, name: true, nameRu: true } },
            invite: { select: { id: true, sentAt: true, usedAt: true, tokenPreview: true } },
          },
        })
      ),
      withPrismaRetry(() =>
        prisma.product.findMany({
          select: { id: true, slug: true, name: true, nameRu: true },
          where: { isActive: true },
          orderBy: [{ sortOrder: 'asc' }, { updatedAt: 'desc' }],
        })
      ),
    ]);

    return NextResponse.json({
      success: true,
      total,
      page,
      pages: Math.max(1, Math.ceil(total / PAGE_SIZE)),
      pending,
      products,
      reviews: reviews.map((review) => ({
        id: review.id,
        productId: review.productId,
        product: review.product,
        customerEmail: review.customerEmail,
        customerName: review.customerName,
        rating: review.rating,
        text: review.text,
        media: parseMedia(review.media),
        status: review.status,
        createdAt: review.createdAt,
        updatedAt: review.updatedAt,
        approvedAt: review.approvedAt,
        rejectedAt: review.rejectedAt,
        moderatedBy: review.moderatedBy,
        invite: review.invite,
      })),
    });
  } catch (error) {
    console.error('Admin reviews list error:', error);
    return NextResponse.json({ success: false, message: 'Ошибка загрузки отзывов' }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  const denied = adminGuard(req);
  if (denied) return denied;

  try {
    const body = await req.json();
    const reviewId = String(body?.reviewId || '').trim();
    const action = String(body?.action || '').trim();

    if (!reviewId) {
      return NextResponse.json({ success: false, message: 'reviewId обязателен' }, { status: 400 });
    }

    let status: 'pending' | 'approved' | 'rejected';
    if (action === 'approve') status = 'approved';
    else if (action === 'reject') status = 'rejected';
    else if (action === 'pending') status = 'pending';
    else {
      return NextResponse.json({ success: false, message: 'Некорректное действие' }, { status: 400 });
    }

    const admin = verifyAdminToken(req);
    const moderator = admin?.email || 'admin';

    const now = new Date();
    const updated = await withPrismaRetry(() =>
      prisma.review.update({
        where: { id: reviewId },
        data: {
          status,
          approvedAt: status === 'approved' ? now : null,
          rejectedAt: status === 'rejected' ? now : null,
          moderatedBy: moderator,
        },
      })
    );

    return NextResponse.json({ success: true, review: updated });
  } catch (error) {
    console.error('Admin review moderation error:', error);
    return NextResponse.json({ success: false, message: 'Ошибка сохранения статуса' }, { status: 500 });
  }
}
