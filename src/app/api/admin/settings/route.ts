import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { adminGuard } from '@/lib/admin-auth';

// GET: Retrieve settings
export async function GET(req: NextRequest) {
  const denied = adminGuard(req);
  if (denied) return denied;

  const url = new URL(req.url);
  const key = url.searchParams.get('key');

  try {
    if (key) {
      const setting = await prisma.siteSettings.findUnique({
        where: { key },
      });
      return NextResponse.json(setting || { key, value: null });
    }

    // Return all settings
    const settings = await prisma.siteSettings.findMany();
    const settingsMap = settings.reduce((acc, s) => {
      acc[s.key] = s.value;
      return acc;
    }, {} as Record<string, string>);

    return NextResponse.json(settingsMap);
  } catch (error) {
    console.error('Settings GET error:', error);
    return NextResponse.json({ error: 'Failed to get settings' }, { status: 500 });
  }
}

// POST: Save a setting
export async function POST(req: NextRequest) {
  const denied = adminGuard(req);
  if (denied) return denied;

  try {
    const body = await req.json();
    const { key, value } = body;

    if (!key) {
      return NextResponse.json({ error: 'Key is required' }, { status: 400 });
    }

    const setting = await prisma.siteSettings.upsert({
      where: { key },
      create: { key, value: typeof value === 'string' ? value : JSON.stringify(value) },
      update: { value: typeof value === 'string' ? value : JSON.stringify(value) },
    });

    return NextResponse.json({ success: true, setting });
  } catch (error) {
    console.error('Settings POST error:', error);
    return NextResponse.json({ error: 'Failed to save setting' }, { status: 500 });
  }
}

// DELETE: Remove a setting
export async function DELETE(req: NextRequest) {
  const denied = adminGuard(req);
  if (denied) return denied;

  const url = new URL(req.url);
  const key = url.searchParams.get('key');

  if (!key) {
    return NextResponse.json({ error: 'Key is required' }, { status: 400 });
  }

  try {
    await prisma.siteSettings.delete({
      where: { key },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Settings DELETE error:', error);
    return NextResponse.json({ error: 'Failed to delete setting' }, { status: 500 });
  }
}
