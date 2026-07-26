import { NextRequest, NextResponse } from 'next/server';

import prisma from '@/lib/db';
import { withPrismaRetry } from '@/lib/prisma-retry';
import { hashReviewToken, isValidRating, normalizeEmail } from '@/lib/review-links';

function parseMedia(input: unknown): string[] {
  if (!Array.isArray(input)) return [];
  return input
    .map((item) => String(item || '').trim())
    .filter((url) => url.startsWith('/api/media/') || url.startsWith('/media/reviews/'))
    .slice(0, 8);
}

function readClientIp(req: NextRequest): string {
  const xff = req.headers.get('x-forwarded-for') || '';
  if (xff.includes(',')) return xff.split(',')[0].trim();
  return xff.trim();
}

async function getInviteByToken(token: string) {
  const tokenHash = hashReviewToken(token);
  return withPrismaRetry(() =>
    prisma.reviewInvite.findUnique({
      where: { tokenHash },
      include: {
        product: {
          select: {
            id: true,
            slug: true,
            name: true,
            nameRu: true,
            image: true,
          },
        },
      },
    })
  );
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const token = String(searchParams.get('token') || '').trim();
    if (!token) {
      return NextResponse.json({ success: false, message: 'Токен не указан' }, { status: 400 });
    }

    const invite = await getInviteByToken(token);
    if (!invite) {
      return NextResponse.json({ success: false, message: 'Ссылка не найдена' }, { status: 404 });
    }

    const expired = invite.expiresAt ? invite.expiresAt.getTime() <= Date.now() : false;
    const alreadyUsed = Boolean(invite.usedAt) || invite.status === 'used';

    return NextResponse.json({
      success: true,
      valid: !expired && !alreadyUsed && invite.status === 'sent',
      expired,
      alreadyUsed,
      invite: {
        id: invite.id,
        email: invite.email,
        expiresAt: invite.expiresAt,
      },
      product: invite.product,
    });
  } catch (error) {
    console.error('Review token validation error:', error);
    return NextResponse.json({ success: false, message: 'Ошибка проверки ссылки' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const token = String(body?.token || '').trim();
    const rating = Number(body?.rating);
    const text = String(body?.text || '').trim();
    const media = parseMedia(body?.media);

    if (!token) {
      return NextResponse.json({ success: false, message: 'Токен не указан' }, { status: 400 });
    }

    if (!isValidRating(rating)) {
      return NextResponse.json({ success: false, message: 'Оценка должна быть от 1 до 5' }, { status: 400 });
    }

    if (text.length === 0 && media.length === 0) {
      return NextResponse.json({ success: false, message: 'Добавьте текст или медиа' }, { status: 400 });
    }

    const invite = await getInviteByToken(token);
    if (!invite) {
      return NextResponse.json({ success: false, message: 'Ссылка не найдена' }, { status: 404 });
    }

    if (invite.expiresAt && invite.expiresAt.getTime() <= Date.now()) {
      await withPrismaRetry(() =>
        prisma.reviewInvite.update({ where: { id: invite.id }, data: { status: 'expired' } })
      );
      return NextResponse.json({ success: false, message: 'Срок действия ссылки истёк' }, { status: 410 });
    }

    if (invite.usedAt || invite.status !== 'sent') {
      return NextResponse.json({ success: false, message: 'Ссылка уже использована' }, { status: 409 });
    }

    const result = await withPrismaRetry(() =>
      prisma.$transaction(async (tx) => {
        const already = await tx.review.findUnique({ where: { inviteId: invite.id }, select: { id: true } });
        if (already) {
          throw new Error('INVITE_ALREADY_USED');
        }

        const created = await tx.review.create({
          data: {
            productId: invite.productId,
            inviteId: invite.id,
            customerEmail: normalizeEmail(invite.email),
            customerName: '',
            rating,
            text: text.slice(0, 6000),
            media: JSON.stringify(media),
            status: 'pending',
            ip: readClientIp(req),
            userAgent: req.headers.get('user-agent') || '',
          },
        });

        await tx.reviewInvite.update({
          where: { id: invite.id },
          data: {
            usedAt: new Date(),
            status: 'used',
          },
        });

        return created;
      })
    );

    return NextResponse.json({ success: true, reviewId: result.id });
  } catch (error) {
    if (error instanceof Error && error.message === 'INVITE_ALREADY_USED') {
      return NextResponse.json({ success: false, message: 'Ссылка уже использована' }, { status: 409 });
    }

    console.error('Review submit error:', error);
    return NextResponse.json({ success: false, message: 'Ошибка отправки отзыва' }, { status: 500 });
  }
}
