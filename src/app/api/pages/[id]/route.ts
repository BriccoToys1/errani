import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { adminGuard, verifyAdminToken } from '@/lib/admin-auth';

interface Params {
  params: Promise<{ id: string }>;
}

// GET single page
export async function GET(req: NextRequest, { params }: Params) {
  try {
    const { id } = await params;
    const isAdmin = Boolean(verifyAdminToken(req));
    const page = await prisma.customPage.findUnique({ where: { id } });
    if (!page || (!isAdmin && !page.isPublished)) {
      return NextResponse.json({ error: 'Page not found' }, { status: 404 });
    }
    return NextResponse.json(page);
  } catch (error) {
    console.error('Error fetching page:', error);
    return NextResponse.json({ error: 'Failed to fetch page' }, { status: 500 });
  }
}

// PUT update page
export async function PUT(req: NextRequest, { params }: Params) {
  const denied = adminGuard(req);
  if (denied) return denied;

  try {
    const { id } = await params;
    const body = await req.json();
    const page = await prisma.customPage.update({
      where: { id },
      data: {
        title: body.title,
        titleRu: body.titleRu ?? '',
        slug: body.slug,
        content: body.content,
        contentRu: body.contentRu ?? '',
        isPublished: body.isPublished ?? false,
        sortOrder: body.sortOrder ?? 0,
      },
    });
    return NextResponse.json(page);
  } catch (error) {
    console.error('Error updating page:', error);
    return NextResponse.json({ error: 'Failed to update page' }, { status: 500 });
  }
}

// DELETE page
export async function DELETE(req: NextRequest, { params }: Params) {
  const denied = adminGuard(req);
  if (denied) return denied;

  try {
    const { id } = await params;
    await prisma.customPage.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting page:', error);
    return NextResponse.json({ error: 'Failed to delete page' }, { status: 500 });
  }
}
