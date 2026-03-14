import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { adminGuard } from '@/lib/admin-auth';

export async function GET(req: NextRequest) {
  const denied = adminGuard(req);
  if (denied) return denied;
  const expenses = await prisma.expense.findMany({ orderBy: { date: 'desc' } });
  const total = expenses.reduce((s, e) => s + e.amount, 0);
  return NextResponse.json({ expenses, total });
}

export async function POST(req: NextRequest) {
  const denied = adminGuard(req);
  if (denied) return denied;
  const { amount, description, category, date } = await req.json();
  if (!amount || !description || !date) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
  }
  const expense = await prisma.expense.create({
    data: { amount: Number(amount), description, category: category || 'other', date },
  });
  return NextResponse.json(expense, { status: 201 });
}

export async function DELETE(req: NextRequest) {
  const denied = adminGuard(req);
  if (denied) return denied;
  const { searchParams } = new URL(req.url);
  const id = searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 });
  await prisma.expense.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
