import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { adminGuard } from '@/lib/admin-auth';

const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function GET(req: NextRequest) {
  const denied = adminGuard(req);
  if (denied) return denied;

  try {
    const requests = await prisma.waitlistRequest.findMany({
      orderBy: { createdAt: 'desc' },
    });
    return NextResponse.json(requests);
  } catch (error) {
    console.error('Error fetching waitlist requests:', error);
    return NextResponse.json({ error: 'Failed to fetch waitlist requests' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const email = String(body.email || '').trim().toLowerCase();
    const name = String(body.name || '').trim();
    const productSlug = String(body.productSlug || '').trim();
    const productName = String(body.productName || '').trim();

    if (!name || !email || !productSlug || !productName) {
      return NextResponse.json({ error: 'Name, email and product are required' }, { status: 400 });
    }

    if (!emailRegex.test(email)) {
      return NextResponse.json({ error: 'Invalid email' }, { status: 400 });
    }

    const existing = await prisma.waitlistRequest.findFirst({
      where: {
        email,
        productSlug,
        status: 'pending',
      },
    });

    if (existing) {
      return NextResponse.json({ success: true, message: 'Already on waitlist' });
    }

    const request = await prisma.waitlistRequest.create({
      data: {
        productId: body.productId || null,
        productSlug,
        productName,
        name,
        email,
      },
    });

    return NextResponse.json({ success: true, id: request.id });
  } catch (error) {
    console.error('Error creating waitlist request:', error);
    return NextResponse.json({ error: 'Failed to create waitlist request' }, { status: 500 });
  }
}
