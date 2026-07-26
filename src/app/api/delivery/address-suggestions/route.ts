import { NextRequest, NextResponse } from 'next/server';
import { CdekError, getCdekRussianLocationsCatalog } from '@/lib/cdek';

const POPULAR_CITIES = [
  'Москва',
  'Санкт-Петербург',
  'Екатеринбург',
  'Казань',
  'Новосибирск',
  'Нижний Новгород',
  'Краснодар',
  'Ростов-на-Дону',
  'Самара',
  'Воронеж',
  'Пермь',
  'Уфа',
];

interface PhotonProperties {
  name?: string;
  street?: string;
  type?: string;
  city?: string;
  town?: string;
  village?: string;
  county?: string;
  state?: string;
  countrycode?: string;
}

interface PhotonResponse {
  features?: Array<{ properties?: PhotonProperties }>;
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

    if (type === 'city') {
      const locations = await getCdekRussianLocationsCatalog();
      const queryKey = normalize(query);
      const regionKey = normalize(region);
      const unique = new Map<string, { value: string; label: string; region: string }>();
      const source = queryKey
        ? locations
        : [
            ...POPULAR_CITIES.map((popular) => locations.find((location) => location.city === popular)).filter(Boolean),
            ...locations,
          ];
      const matched = source
        .filter((location): location is NonNullable<typeof location> => Boolean(location))
        .filter((location) => !queryKey || normalize(location.city).includes(queryKey))
        .filter((location) => !regionKey || normalize(location.region).includes(regionKey) || regionKey.includes(normalize(location.region)))
        .sort((left, right) => {
          if (!queryKey) {
            const leftPopular = POPULAR_CITIES.indexOf(left.city);
            const rightPopular = POPULAR_CITIES.indexOf(right.city);
            if (leftPopular !== rightPopular) return (leftPopular < 0 ? 999 : leftPopular) - (rightPopular < 0 ? 999 : rightPopular);
          }
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

    if (query.length < 2) return NextResponse.json([]);

    if (type === 'street' && (city || region)) {
      const search = new URLSearchParams({
        q: [query, city, region, 'Россия'].filter(Boolean).join(', '),
        limit: '20',
      });
      const response = await fetch(`https://photon.komoot.io/api/?${search.toString()}`, {
        headers: {
          'User-Agent': 'errani.ru delivery address suggestions',
          Referer: 'https://errani.ru/',
        },
        next: { revalidate: 3600 },
      });
      if (!response.ok) return NextResponse.json([], { status: response.status });
      const data = await response.json().catch(() => ({})) as PhotonResponse;
      const cityKey = normalize(city);
      const regionKey = normalize(region);
      const unique = new Map<string, { value: string; label: string }>();
      for (const feature of data.features || []) {
        const address = feature.properties || {};
        if (address.countrycode?.toUpperCase() !== 'RU') continue;
        const settlement = address.city || address.town || address.village || '';
        if (cityKey && !normalize(settlement).includes(cityKey) && !cityKey.includes(normalize(settlement))) continue;
        if (regionKey && !normalize(address.state || '').includes(regionKey) && !regionKey.includes(normalize(address.state || ''))) continue;
        const value = address.type === 'street'
          ? address.name || address.street || ''
          : address.street || '';
        if (!value) continue;
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
