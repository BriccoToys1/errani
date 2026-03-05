import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db';

interface Params {
  params: Promise<{ key: string }>;
}

// GET content by key
export async function GET(req: NextRequest, { params }: Params) {
  try {
    const { key } = await params;
    const content = await prisma.siteContent.findUnique({
      where: { key },
    });

    if (!content) {
      return NextResponse.json({ error: 'Content not found' }, { status: 404 });
    }

    return NextResponse.json(content);
  } catch (error) {
    console.error('Error fetching content:', error);
    return NextResponse.json({ error: 'Failed to fetch content' }, { status: 500 });
  }
}

// PUT update content (admin only)
export async function PUT(req: NextRequest, { params }: Params) {
  try {
    const { key } = await params;
    const body = await req.json();

    const content = await prisma.siteContent.upsert({
      where: { key },
      update: { value: body.value },
      create: { key, value: body.value },
    });

    return NextResponse.json(content);
  } catch (error) {
    console.error('Error updating content:', error);
    return NextResponse.json({ error: 'Failed to update content' }, { status: 500 });
  }
}
