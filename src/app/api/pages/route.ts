import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db';

// GET all pages (public: only published, admin: all)
export async function GET(req: NextRequest) {
  try {
    const isAdmin = req.headers.get('authorization');
    const pages = await prisma.customPage.findMany({
      where: isAdmin ? {} : { isPublished: true },
      orderBy: { sortOrder: 'asc' },
    });
    return NextResponse.json(pages);
  } catch (error) {
    console.error('Error fetching pages:', error);
    return NextResponse.json({ error: 'Failed to fetch pages' }, { status: 500 });
  }
}

// POST create page (admin only)
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const page = await prisma.customPage.create({
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
    console.error('Error creating page:', error);
    return NextResponse.json({ error: 'Failed to create page' }, { status: 500 });
  }
}
