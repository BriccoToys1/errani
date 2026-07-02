import { NextRequest, NextResponse } from 'next/server';
import { CdekError, getCdekRussianLocationsCatalog } from '@/lib/cdek';

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

const POPULAR_CITIES = [
  { value: 'Москва', region: 'Москва' },
  { value: 'Санкт-Петербург', region: 'Санкт-Петербург' },
  { value: 'Новосибирск', region: 'Новосибирская область' },
  { value: 'Екатеринбург', region: 'Свердловская область' },
  { value: 'Казань', region: 'Республика Татарстан' },
  { value: 'Краснодар', region: 'Краснодарский край' },
  { value: 'Нижний Новгород', region: 'Нижегородская область' },
  { value: 'Челябинск', region: 'Челябинская область' },
  { value: 'Самара', region: 'Самарская область' },
  { value: 'Ростов-на-Дону', region: 'Ростовская область' },
  { value: 'Уфа', region: 'Республика Башкортостан' },
  { value: 'Красноярск', region: 'Красноярский край' },
  { value: 'Омск', region: 'Омская область' },
  { value: 'Воронеж', region: 'Воронежская область' },
  { value: 'Пермь', region: 'Пермский край' },
  { value: 'Волгоград', region: 'Волгоградская область' },
];

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
      if (!query && !region) {
        return NextResponse.json(POPULAR_CITIES.map((item) => ({
          ...item,
          label: `${item.value}, ${item.region}`,
        })), {
          headers: { 'Cache-Control': 'public, s-maxage=86400, stale-while-revalidate=604800' },
        });
      }
      const locations = await getCdekRussianLocationsCatalog();
      const queryKey = normalize(query);
      const regionKey = normalize(region);
      const unique = new Map<string, { value: string; label: string; region: string }>();
      const popularRank = new Map(POPULAR_CITIES.map((item, index) => [normalize(item.value), index]));
      const matched = locations
        .filter((location) => queryKey
          ? normalize(location.city).includes(queryKey)
          : Boolean(regionKey) || popularRank.has(normalize(location.city)))
        .filter((location) => !regionKey || normalize(location.region).includes(regionKey) || regionKey.includes(normalize(location.region)))
        .sort((left, right) => {
          if (!queryKey && !regionKey) {
            return (popularRank.get(normalize(left.city)) ?? 999) - (popularRank.get(normalize(right.city)) ?? 999);
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

    if (type === 'street' && (city || region)) {
      const search = new URLSearchParams({
        q: [query || 'улица', city, region, 'Россия'].filter(Boolean).join(', '),
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
