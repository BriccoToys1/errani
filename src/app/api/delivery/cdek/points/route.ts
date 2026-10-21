import { NextRequest, NextResponse } from 'next/server';
import { CdekError, getCdekPickupPoints, getCdekPickupPointsForLocation } from '@/lib/cdek';
import { flash, langFromRequest } from '@/lib/flash';

export async function GET(req: NextRequest) {
  const lang = langFromRequest(req);
  try {
    const { searchParams } = new URL(req.url);
    const city = searchParams.get('city')?.trim() || '';
    const postalCode = searchParams.get('postalCode')?.trim() || '';
    const cityCode = Number(searchParams.get('cityCode'));
    const regionCode = Number(searchParams.get('regionCode'));
    const latitudeRaw = searchParams.get('latitude');
    const longitudeRaw = searchParams.get('longitude');
    const latitude = latitudeRaw ? Number(latitudeRaw) : null;
    const longitude = longitudeRaw ? Number(longitudeRaw) : null;
    if (!cityCode && city.length < 2) {
      return NextResponse.json({ error: flash(lang, 'cdek.enter_city') }, { status: 400 });
    }

    const points = cityCode
      ? await getCdekPickupPointsForLocation({
          code: cityCode,
          city,
          region: '',
          countryCode: 'RU',
          postalCodes: postalCode ? [postalCode] : [],
          regionCode,
          latitude: latitude !== null && Number.isFinite(latitude) ? latitude : null,
          longitude: longitude !== null && Number.isFinite(longitude) ? longitude : null,
        })
      : await getCdekPickupPoints(city, postalCode);
    return NextResponse.json(points, { headers: { 'Cache-Control': 'private, max-age=300' } });
  } catch (error) {
    if (error instanceof CdekError) {
      return NextResponse.json({ error: error.localize(lang) }, { status: error.status });
    }
    console.error('Unexpected CDEK pickup points error:', error);
    return NextResponse.json({ error: flash(lang, 'cdek.load_points_failed') }, { status: 500 });
  }
}
