import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { adminGuard } from '@/lib/admin-auth';
import { clearAdminCountsCache, VIEWED_SETTING_KEYS, type ViewedSection } from '@/lib/admin-counts-cache';

/** POST: acknowledge notifications for a section (hides badge until new items arrive). */
export async function POST(req: NextRequest) {
  const denied = adminGuard(req);
  if (denied) return denied;

  try {
    const body = (await req.json().catch(() => ({}))) as { section?: string };
    const section = body.section as ViewedSection | undefined;
    if (!section || !(section in VIEWED_SETTING_KEYS)) {
      return NextResponse.json({ error: 'Unknown section' }, { status: 400 });
    }
    const key = VIEWED_SETTING_KEYS[section];
    const value = new Date().toISOString();
    await prisma.siteSettings.upsert({
      where: { key },
      update: { value },
      create: { key, value },
    });
    clearAdminCountsCache();
    return NextResponse.json({ success: true, key, value });
  } catch (error) {
    console.error('Error marking section viewed:', error);
    return NextResponse.json({ error: 'Failed' }, { status: 500 });
  }
}
