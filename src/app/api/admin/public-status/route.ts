import { NextResponse } from 'next/server';
import prisma from '@/lib/db';
import {
  isPublicMaintenanceEnabled,
  MAINTENANCE_MESSAGE,
} from '@/lib/maintenance';

// Public endpoint — no auth needed, used by middleware
// Returns only site status flags, nothing sensitive
export async function GET() {
  if (isPublicMaintenanceEnabled()) {
    return NextResponse.json(
      {
        siteDisabled: false,
        maintenanceMode: true,
        maintenanceMessage: MAINTENANCE_MESSAGE,
      },
      { headers: { 'Cache-Control': 'no-store' } }
    );
  }

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
          // Must stay fresh — proxy gates the storefront on siteDisabled.
          'Cache-Control': 'no-store',
        },
      }
    );
  } catch {
    // DB unavailable — show maintenance instead of an empty broken shop
    return NextResponse.json({
      siteDisabled: false,
      maintenanceMode: true,
      maintenanceMessage: MAINTENANCE_MESSAGE,
    });
  }
}
