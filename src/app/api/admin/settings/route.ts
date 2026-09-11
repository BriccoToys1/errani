import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { adminGuard } from '@/lib/admin-auth';
import { withPrismaRetry } from '@/lib/prisma-retry';

// Public keys that can be read without auth
const PUBLIC_KEYS = new Set(['featuredProductLink', 'deliveryEstimate', 'orderDeliveryFootnote']);
const PUBLIC_SETTINGS_TTL_MS = 60_000;
const publicSettingsCache = new Map<string, { ts: number; payload: { key: string; value: string | null } }>();

// GET: Retrieve settings
export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const key = url.searchParams.get('key');

  // Allow public access to specific keys
  if (key && PUBLIC_KEYS.has(key)) {
    try {
      const cached = publicSettingsCache.get(key);
      if (cached && Date.now() - cached.ts < PUBLIC_SETTINGS_TTL_MS) {
        return NextResponse.json(cached.payload, { headers: { 'X-Public-Setting-Cache': 'hit' } });
      }
      const setting = await withPrismaRetry(
        () => prisma.siteSettings.findUnique({ where: { key } }),
        2,
        80
      );
      const payload = setting || { key, value: null };
      publicSettingsCache.set(key, { ts: Date.now(), payload });
      return NextResponse.json(payload, { headers: { 'X-Public-Setting-Cache': 'miss' } });
    } catch {
      const stale = publicSettingsCache.get(key)?.payload;
      return NextResponse.json(stale || { key, value: null }, { headers: { 'X-Public-Setting-Cache': stale ? 'stale' : 'degraded' } });
    }
  }

  const denied = adminGuard(req);
  if (denied) return denied;

  try {
    if (key) {
      const setting = await withPrismaRetry(
        () => prisma.siteSettings.findUnique({ where: { key } }),
        2,
        80
      );
      return NextResponse.json(setting || { key, value: null });
    }

    // Return all settings
    const settings = await withPrismaRetry(() => prisma.siteSettings.findMany(), 2, 80);
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

    const setting = await withPrismaRetry(() => prisma.siteSettings.upsert({
      where: { key },
      create: { key, value: typeof value === 'string' ? value : JSON.stringify(value) },
      update: { value: typeof value === 'string' ? value : JSON.stringify(value) },
    }), 2, 80);
    if (PUBLIC_KEYS.has(key)) publicSettingsCache.delete(key);

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
    await withPrismaRetry(() => prisma.siteSettings.delete({ where: { key } }), 2, 80);
    if (PUBLIC_KEYS.has(key)) publicSettingsCache.delete(key);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Settings DELETE error:', error);
    return NextResponse.json({ error: 'Failed to delete setting' }, { status: 500 });
  }
}
