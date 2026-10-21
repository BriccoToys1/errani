import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { adminGuard } from '@/lib/admin-auth';
import { withPrismaRetry } from '@/lib/prisma-retry';
import { flash, parseLang } from '@/lib/flash';

// GET all inquiries (admin only)
export async function GET(req: NextRequest) {
  const denied = adminGuard(req);
  if (denied) return denied;

  try {
    const { searchParams } = new URL(req.url);
    const includeArchived = searchParams.get('includeArchived') === 'true';

    const inquiries = await withPrismaRetry(
      () => prisma.inquiry.findMany({
        where: includeArchived ? {} : { status: { not: 'archived' } },
        orderBy: { createdAt: 'desc' },
      }),
      3,
      120
    );
    return NextResponse.json(inquiries);
  } catch (error) {
    console.error('Error fetching inquiries:', error);
    return NextResponse.json({ error: 'Failed to fetch inquiries' }, { status: 500 });
  }
}

// PUT: mark all "new" inquiries as "read"
export async function PUT(req: NextRequest) {
  const denied = adminGuard(req);
  if (denied) return denied;

  try {
    const result = await withPrismaRetry(() =>
      prisma.inquiry.updateMany({
        where: { status: 'new' },
        data: { status: 'read' },
      })
    );
    const { clearAdminCountsCache } = await import('@/lib/admin-counts-cache');
    clearAdminCountsCache();
    return NextResponse.json({ updated: result.count });
  } catch (error) {
    console.error('Error marking inquiries as read:', error);
    return NextResponse.json({ error: 'Failed to mark as read' }, { status: 500 });
  }
}

// POST new inquiry (public)
export async function POST(req: NextRequest) {
  let lang = parseLang(req.headers.get('accept-language'), 'ru');
  try {
    const body = await req.json();
    lang = parseLang(body.language ?? body.lang, lang);

    if (!body.name?.trim() || !body.email?.trim() || !body.message?.trim()) {
      return NextResponse.json({ error: flash(lang, 'inquiry.required') }, { status: 400 });
    }

    // Get IP and User-Agent
    const forwarded = req.headers.get('x-forwarded-for');
    const ip = forwarded ? forwarded.split(',')[0].trim() : req.headers.get('x-real-ip') || '';
    const userAgent = req.headers.get('user-agent') || '';

    const inquiry = await withPrismaRetry(() =>
      prisma.inquiry.create({
        data: {
          name: body.name.trim(),
          email: body.email.trim(),
          phone: body.phone?.trim() || '',
          message: body.message.trim(),
          source: body.source || 'contact_form',
          ip,
          userAgent,
        },
      })
    );

    return NextResponse.json({ success: true, id: inquiry.id });
  } catch (error) {
    console.error('Error creating inquiry:', error);
    return NextResponse.json({ error: flash(lang, 'inquiry.create_failed') }, { status: 500 });
  }
}
