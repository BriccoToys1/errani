import { NextResponse } from 'next/server';
import prisma from '@/lib/db';

// Public endpoint — no auth needed, used by middleware
// Returns only site status flags, nothing sensitive
export async function GET() {
  try {
    const settings = await prisma.siteSettings.findMany({
      where: { key: { in: ['general_settings'] } },
    });

    const generalRaw = settings.find(s => s.key === 'general_settings')?.value;
    let siteDisabled = false;
    let maintenanceMode = false;
    let maintenanceMessage = '';

    if (generalRaw) {
      try {
        const parsed = JSON.parse(generalRaw);
        siteDisabled = parsed.siteEnabled === false;
        maintenanceMode = parsed.maintenanceMode === true;
        maintenanceMessage = parsed.maintenanceMessage || '';
      } catch {
        // ignore parse errors
      }
    }

    return NextResponse.json(
      { siteDisabled, maintenanceMode, maintenanceMessage },
      {
        headers: {
          'Cache-Control': 'public, s-maxage=30, stale-while-revalidate=60',
        },
      }
    );
  } catch {
    // DB unavailable — let site through
    return NextResponse.json({ siteDisabled: false, maintenanceMode: false, maintenanceMessage: '' });
  }
}
