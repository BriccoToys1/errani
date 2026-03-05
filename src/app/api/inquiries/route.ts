import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db';

// GET all inquiries (admin only)
export async function GET(req: NextRequest) {
  try {
    const inquiries = await prisma.inquiry.findMany({
      orderBy: { createdAt: 'desc' },
    });
    return NextResponse.json(inquiries);
  } catch (error) {
    console.error('Error fetching inquiries:', error);
    return NextResponse.json({ error: 'Failed to fetch inquiries' }, { status: 500 });
  }
}

// POST new inquiry (public)
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    if (!body.name?.trim() || !body.email?.trim() || !body.message?.trim()) {
      return NextResponse.json({ error: 'Name, email and message are required' }, { status: 400 });
    }

    // Get IP and User-Agent
    const forwarded = req.headers.get('x-forwarded-for');
    const ip = forwarded ? forwarded.split(',')[0].trim() : req.headers.get('x-real-ip') || '';
    const userAgent = req.headers.get('user-agent') || '';

    const inquiry = await prisma.inquiry.create({
      data: {
        name: body.name.trim(),
        email: body.email.trim(),
        phone: body.phone?.trim() || '',
        message: body.message.trim(),
        source: body.source || 'contact_form',
        ip,
        userAgent,
      },
    });

    return NextResponse.json({ success: true, id: inquiry.id });
  } catch (error) {
    console.error('Error creating inquiry:', error);
    return NextResponse.json({ error: 'Failed to create inquiry' }, { status: 500 });
  }
}
