import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db';

interface Params {
  params: Promise<{ id: string }>;
}

// GET single inquiry
export async function GET(req: NextRequest, { params }: Params) {
  try {
    const { id } = await params;
    const inquiry = await prisma.inquiry.findUnique({ where: { id } });
    if (!inquiry) {
      return NextResponse.json({ error: 'Inquiry not found' }, { status: 404 });
    }
    return NextResponse.json(inquiry);
  } catch (error) {
    console.error('Error fetching inquiry:', error);
    return NextResponse.json({ error: 'Failed to fetch inquiry' }, { status: 500 });
  }
}

// PUT update inquiry (status, notes)
export async function PUT(req: NextRequest, { params }: Params) {
  try {
    const { id } = await params;
    const body = await req.json();

    const inquiry = await prisma.inquiry.update({
      where: { id },
      data: {
        status: body.status,
        notes: body.notes,
      },
    });

    return NextResponse.json(inquiry);
  } catch (error) {
    console.error('Error updating inquiry:', error);
    return NextResponse.json({ error: 'Failed to update inquiry' }, { status: 500 });
  }
}

// DELETE inquiry
export async function DELETE(req: NextRequest, { params }: Params) {
  try {
    const { id } = await params;
    await prisma.inquiry.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting inquiry:', error);
    return NextResponse.json({ error: 'Failed to delete inquiry' }, { status: 500 });
  }
}
