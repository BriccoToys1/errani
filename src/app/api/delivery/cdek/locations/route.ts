import { NextRequest, NextResponse } from 'next/server';
import { CdekError, CdekLocation, searchCdekLocations } from '@/lib/cdek';

interface GeocodeAddress {
  city?: string;
  town?: string;
  village?: string;
  municipality?: string;
  hamlet?: string;
  county?: string;
  state?: string;
  postcode?: string;
  country_code?: string;
}

interface GeocodeResult {
  display_name?: string;
  lat?: string;
  lon?: string;
  address?: GeocodeAddress;
}

function normalize(value: string): string {
  return value.toLocaleLowerCase('ru-RU').replace(/^г\.?\s*/i, '').trim();
}

function settlementName(address: GeocodeAddress): string {
  return address.city
    || address.town
    || address.village
    || address.municipality
    || address.hamlet
    || address.county
    || '';
}

function cleanedPart(value: string): string {
  return value
    .trim()
    .replace(/^г(?:\.|ород)?\s+/iu, '')
    .replace(/^(?:д(?:\.|еревня)?|с(?:\.|ело)?|п(?:\.|ос(?:[её]лок)?)?)\s+/iu, '')
    .replace(/\s+обл\.?$/iu, ' область')
    .trim();
}

function smartGeocodeQueries(query: string): string[] {
  const parts = query.split(',').map((part) => part.trim()).filter(Boolean);
  const regionPart = parts.find((part) => /(?:обл(?:\.|асть)?|край|респ(?:\.|ублика)?)/iu.test(part));
  const cityPart = parts.find((part) => /^г(?:\.|ород)?\s+/iu.test(part));
  const settlementPart = parts.find((part) => {
    const match = part.match(/^(?:д(?:\.|еревня)?|с(?:\.|ело)?|п(?:\.|ос(?:[её]лок)?)?)\s+(.+)$/iu);
    return Boolean(match?.[1] && !/^\d+[а-яa-z]?$/iu.test(match[1].trim()));
  });
  const region = regionPart ? cleanedPart(regionPart) : '';
  const city = cityPart ? cleanedPart(cityPart) : '';
  const settlement = settlementPart ? cleanedPart(settlementPart) : '';

  return [...new Set([
    query,
    [settlement, region].filter(Boolean).join(', '),
    [city, region].filter(Boolean).join(', '),
    settlement,
    city,
  ].filter((candidate) => candidate.length >= 3))];
}

async function findCdekLocation(result: GeocodeResult): Promise<CdekLocation | null> {
  const address = result.address || {};
  const settlement = settlementName(address);
  const postalCode = address.postcode || '';
  let locations = postalCode ? await searchCdekLocations(postalCode) : [];
  if (locations.length === 0 && settlement) locations = await searchCdekLocations(settlement);
  if (locations.length === 0) return null;

  const normalizedSettlement = normalize(settlement);
  const normalizedRegion = normalize(address.state || '');
  const location = locations.find((candidate) => (
    normalize(candidate.city) === normalizedSettlement
      && (!normalizedRegion || normalize(candidate.region) === normalizedRegion)
  )) || locations.find((candidate) => normalize(candidate.city) === normalizedSettlement) || locations[0];
  const latitude = Number(result.lat);
  const longitude = Number(result.lon);

  return {
    ...location,
    postalCodes: postalCode ? [postalCode] : location.postalCodes,
    postalCode: postalCode || location.postalCodes[0] || '',
    latitude: Number.isFinite(latitude) ? latitude : location.latitude,
    longitude: Number.isFinite(longitude) ? longitude : location.longitude,
    address: result.display_name || [settlement, address.state].filter(Boolean).join(', '),
    label: result.display_name || [settlement, address.state].filter(Boolean).join(', '),
  };
}

async function geocodeQuery(query: string): Promise<GeocodeResult[]> {
  const params = new URLSearchParams({
    q: query,
    format: 'jsonv2',
    addressdetails: '1',
    countrycodes: 'ru',
    limit: '5',
  });
  const response = await fetch(`https://nominatim.openstreetmap.org/search?${params.toString()}`, {
    headers: {
      'User-Agent': 'errani.ru delivery address search',
      Referer: 'https://errani.ru/',
      'Accept-Language': 'ru',
    },
    next: { revalidate: 86_400 },
  });
  if (!response.ok) return [];
  const results = await response.json().catch(() => []) as GeocodeResult[];
  return Array.isArray(results) ? results : [];
}

async function reverseGeocode(latitude: number, longitude: number): Promise<GeocodeResult | null> {
  const params = new URLSearchParams({
    lat: String(latitude),
    lon: String(longitude),
    format: 'jsonv2',
    addressdetails: '1',
    zoom: '18',
  });
  const response = await fetch(`https://nominatim.openstreetmap.org/reverse?${params.toString()}`, {
    headers: {
      'User-Agent': 'errani.ru delivery location search',
      Referer: 'https://errani.ru/',
      'Accept-Language': 'ru',
    },
    cache: 'no-store',
  });
  if (!response.ok) return null;
  const result = await response.json().catch(() => null) as GeocodeResult | null;
  return result && typeof result === 'object' ? result : null;
}

async function geocodeAddress(query: string): Promise<CdekLocation[]> {
  const candidates = smartGeocodeQueries(query);
  for (let index = 0; index < candidates.length; index += 1) {
    if (index > 0) await new Promise((resolve) => setTimeout(resolve, 1050));
    const results = await geocodeQuery(candidates[index]);
    if (results.length === 0) continue;
    const resolved = await Promise.all(results.map(findCdekLocation));
    const locations = resolved.filter((location): location is CdekLocation => Boolean(location));
    if (locations.length > 0) return locations;
  }
  return [];
}

export async function GET(req: NextRequest) {
  try {
    const searchParams = new URL(req.url).searchParams;
    const latitudeRaw = searchParams.get('latitude');
    const longitudeRaw = searchParams.get('longitude');
    const latitude = Number(latitudeRaw);
    const longitude = Number(longitudeRaw);
    if (latitudeRaw !== null && longitudeRaw !== null
      && Number.isFinite(latitude) && Number.isFinite(longitude)
      && latitude >= -90 && latitude <= 90 && longitude >= -180 && longitude <= 180) {
      const geocoded = await reverseGeocode(latitude, longitude);
      if (!geocoded || geocoded.address?.country_code?.toLowerCase() !== 'ru') {
        return NextResponse.json([], { headers: { 'Cache-Control': 'private, no-store' } });
      }
      const location = await findCdekLocation({
        ...geocoded,
        lat: String(latitude),
        lon: String(longitude),
      });
      return NextResponse.json(location ? [location] : [], {
        headers: { 'Cache-Control': 'private, no-store' },
      });
    }

    const query = searchParams.get('q')?.trim() || '';
    if (query.length < 3) return NextResponse.json([]);

    const geocoded = await geocodeAddress(query);
    const locations = geocoded.length > 0 ? geocoded : await searchCdekLocations(query);
    return NextResponse.json(locations, { headers: { 'Cache-Control': 'public, s-maxage=86400, stale-while-revalidate=604800' } });
  } catch (error) {
    if (error instanceof CdekError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error('Unexpected CDEK location search error:', error);
    return NextResponse.json({ error: 'Не удалось выполнить поиск адреса.' }, { status: 500 });
  }
}
