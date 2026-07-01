import { NextRequest, NextResponse } from 'next/server';
import { CdekError, getCdekRussianLocationsCatalog } from '@/lib/cdek';

interface NominatimAddress {
  road?: string;
  pedestrian?: string;
  residential?: string;
  neighbourhood?: string;
  quarter?: string;
  suburb?: string;
  city?: string;
  town?: string;
  village?: string;
  municipality?: string;
  state?: string;
  country_code?: string;
}

interface NominatimResult {
  display_name?: string;
  address?: NominatimAddress;
}

function normalize(value: string): string {
  return value.toLocaleLowerCase('ru-RU').replace(/ё/g, 'е').replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
}

export async function GET(req: NextRequest) {
  try {
    const params = new URL(req.url).searchParams;
    const type = params.get('type');
    const query = params.get('q')?.trim() || '';
    const region = params.get('region')?.trim() || '';
    const city = params.get('city')?.trim() || '';
    if (query.length < 2) return NextResponse.json([]);

    if (type === 'city') {
      const locations = await getCdekRussianLocationsCatalog();
      const queryKey = normalize(query);
      const regionKey = normalize(region);
      const unique = new Map<string, { value: string; label: string; region: string }>();
      const matched = locations
        .filter((location) => normalize(location.city).includes(queryKey))
        .filter((location) => !regionKey || normalize(location.region).includes(regionKey) || regionKey.includes(normalize(location.region)))
        .sort((left, right) => {
          const leftStarts = normalize(left.city).startsWith(queryKey) ? 0 : 1;
          const rightStarts = normalize(right.city).startsWith(queryKey) ? 0 : 1;
          return leftStarts - rightStarts || left.city.localeCompare(right.city, 'ru');
        });
      for (const location of matched) {
        if (regionKey && !normalize(location.region).includes(regionKey) && !regionKey.includes(normalize(location.region))) continue;
        const key = `${normalize(location.city)}|${normalize(location.region)}`;
        unique.set(key, {
          value: location.city,
          label: [location.city, location.region].filter(Boolean).join(', '),
          region: location.region,
        });
      }
      return NextResponse.json([...unique.values()].slice(0, 16), {
        headers: { 'Cache-Control': 'public, s-maxage=86400, stale-while-revalidate=604800' },
      });
    }

    if (type === 'street' && city) {
      const search = new URLSearchParams({
        street: query,
        city,
        format: 'jsonv2',
        addressdetails: '1',
        countrycodes: 'ru',
        layer: 'address',
        limit: '10',
      });
      if (region) search.set('state', region);
      const response = await fetch(`https://nominatim.openstreetmap.org/search?${search.toString()}`, {
        headers: {
          'User-Agent': 'errani.ru user-triggered delivery address search',
          Referer: 'https://errani.ru/',
          'Accept-Language': 'ru',
        },
        next: { revalidate: 86_400 },
      });
      if (!response.ok) return NextResponse.json([], { status: response.status });
      const results = await response.json().catch(() => []) as NominatimResult[];
      const unique = new Map<string, { value: string; label: string }>();
      for (const result of results) {
        const address = result.address || {};
        if (address.country_code?.toLowerCase() !== 'ru') continue;
        const value = address.road || address.pedestrian || address.residential
          || address.quarter || address.neighbourhood || address.suburb || '';
        if (!value) continue;
        const settlement = address.city || address.town || address.village || address.municipality || city;
        unique.set(normalize(value), {
          value,
          label: [value, settlement, address.state].filter(Boolean).join(', '),
        });
      }
      return NextResponse.json([...unique.values()].slice(0, 10), {
        headers: { 'Cache-Control': 'public, s-maxage=86400, stale-while-revalidate=604800' },
      });
    }

    return NextResponse.json([]);
  } catch (error) {
    if (error instanceof CdekError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error('Address suggestions error:', error);
    return NextResponse.json({ error: 'Не удалось загрузить подсказки.' }, { status: 500 });
  }
}
