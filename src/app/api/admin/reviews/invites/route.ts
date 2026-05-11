import { NextRequest, NextResponse } from 'next/server';

import { adminGuard } from '@/lib/admin-auth';
import prisma from '@/lib/db';
import { sendReviewInviteEmail } from '@/lib/email';
import { withPrismaRetry } from '@/lib/prisma-retry';
import {
  buildReviewUrl,
  generateReviewToken,
  hashReviewToken,
  normalizeEmail,
  tokenPreview,
} from '@/lib/review-links';

interface RecipientInput {
  email: string;
  name?: string;
}

function normalizeRecipients(input: unknown): RecipientInput[] {
  if (!Array.isArray(input)) return [];

  const uniq = new Map<string, RecipientInput>();
  for (const raw of input) {
    if (!raw || typeof raw !== 'object') continue;
    const row = raw as { email?: unknown; name?: unknown };
    const email = normalizeEmail(String(row.email || ''));
    if (!email || !email.includes('@')) continue;
    const name = String(row.name || '').trim();
    if (!uniq.has(email)) {
      uniq.set(email, { email, name });
    }
  }

  return Array.from(uniq.values());
}

export async function POST(req: NextRequest) {
  const denied = adminGuard(req);
  if (denied) return denied;

  try {
    const body = await req.json();
    const productId = String(body?.productId || '').trim();
    const recipients = normalizeRecipients(body?.recipients);
    const expiresInDaysRaw = Number(body?.expiresInDays ?? 30);
    const expiresInDays = Number.isFinite(expiresInDaysRaw) ? Math.max(1, Math.min(90, expiresInDaysRaw)) : 30;

    if (!productId) {
      return NextResponse.json({ success: false, message: 'Не выбран товар' }, { status: 400 });
    }

    if (recipients.length === 0) {
      return NextResponse.json({ success: false, message: 'Нет получателей для отправки' }, { status: 400 });
    }

    const product = await withPrismaRetry(() =>
      prisma.product.findUnique({ where: { id: productId }, select: { id: true, name: true, nameRu: true } })
    );

    if (!product) {
      return NextResponse.json({ success: false, message: 'Товар не найден' }, { status: 404 });
    }

    const expiresAt = new Date(Date.now() + expiresInDays * 24 * 60 * 60 * 1000);

    const sent: string[] = [];
    const failed: Array<{ email: string; reason: string }> = [];

    for (const recipient of recipients) {
      try {
        const existing = await withPrismaRetry(() =>
          prisma.reviewInvite.findFirst({
            where: {
              email: recipient.email,
              productId,
              usedAt: null,
              status: 'sent',
              OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
            },
            orderBy: { createdAt: 'desc' },
            select: { id: true },
          })
        );

        if (existing) {
          failed.push({ email: recipient.email, reason: 'У клиента уже есть активная ссылка' });
          continue;
        }

        const token = generateReviewToken();
        const hashed = hashReviewToken(token);

        const invite = await withPrismaRetry(() =>
          prisma.reviewInvite.create({
            data: {
              tokenHash: hashed,
              tokenPreview: tokenPreview(token),
              email: recipient.email,
              customerName: recipient.name || '',
              productId,
              status: 'pending_send',
              sentAt: new Date(),
              expiresAt,
            },
          })
        );

        const url = buildReviewUrl(token);

        const emailResult = await sendReviewInviteEmail({
          recipientEmail: recipient.email,
          recipientName: recipient.name || recipient.email,
          productName: product.nameRu || product.name,
          reviewUrl: url,
        });

        if (!emailResult.ok) {
          await withPrismaRetry(() =>
            prisma.reviewInvite.update({
              where: { id: invite.id },
              data: { status: 'send_failed' },
            })
          );
          failed.push({ email: recipient.email, reason: 'Ошибка отправки письма' });
          continue;
        }

        await withPrismaRetry(() =>
          prisma.reviewInvite.update({
            where: { id: invite.id },
            data: { status: 'sent' },
          })
        );

        sent.push(recipient.email);
      } catch (error) {
        console.error('Review invite send error:', recipient.email, error);
        failed.push({ email: recipient.email, reason: 'Внутренняя ошибка' });
      }
    }

    return NextResponse.json({
      success: true,
      product: { id: product.id, name: product.nameRu || product.name },
      sentCount: sent.length,
      failedCount: failed.length,
      sent,
      failed,
    });
  } catch (error) {
    console.error('Admin review invites error:', error);
    return NextResponse.json({ success: false, message: 'Ошибка отправки приглашений' }, { status: 500 });
  }
}
