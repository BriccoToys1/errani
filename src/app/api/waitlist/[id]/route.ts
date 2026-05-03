import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { adminGuard } from '@/lib/admin-auth';

interface Params {
  params: Promise<{ id: string }>;
}

export async function GET(req: NextRequest, { params }: Params) {
  const denied = adminGuard(req);
  if (denied) return denied;

  try {
    const { id } = await params;
    const request = await prisma.waitlistRequest.findUnique({ where: { id } });
    if (!request) {
      return NextResponse.json({ error: 'Waitlist request not found' }, { status: 404 });
    }
    return NextResponse.json(request);
  } catch (error) {
    console.error('Error fetching waitlist request:', error);
    return NextResponse.json({ error: 'Failed to fetch waitlist request' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: Params) {
  const denied = adminGuard(req);
  if (denied) return denied;

  try {
    const { id } = await params;
    const existing = await prisma.waitlistRequest.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: 'Waitlist request not found' }, { status: 404 });
    }

    if (existing.status !== 'archived') {
      await prisma.waitlistRequest.update({
        where: { id },
        data: { status: 'archived' },
      });
      return NextResponse.json({ success: true, archived: true });
    }

    await prisma.waitlistRequest.delete({ where: { id } });
    return NextResponse.json({ success: true, deleted: true });
  } catch (error) {
    console.error('Error deleting waitlist request:', error);
    return NextResponse.json({ error: 'Failed to delete waitlist request' }, { status: 500 });
  }
}
