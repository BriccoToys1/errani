const DEFAULT_API_URL = 'https://api.cdek.ru/v2';
const DEFAULT_COURIER_TARIFF_CODE = 137;
const DEFAULT_PICKUP_TARIFF_CODE = 136;
const DEFAULT_FROM_CITY_CODE = 220; // Брянск
const DEFAULT_SHIPMENT_POINT = 'BRK11';
const REQUEST_TIMEOUT_MS = 12_000;
const DELIVERY_MARKUP_RUB = 50;

interface CdekConfig {
  apiUrl: string;
  clientId: string;
  clientSecret: string;
  fromCityCode: number;
  shipmentPoint: string;
  courierTariffCode: number;
  pickupTariffCode: number;
  unitWeight: number;
  unitLength: number;
  unitWidth: number;
  unitHeight: number;
}

interface CdekTokenResponse {
  access_token?: string;
  expires_in?: number;
  error?: string;
  error_description?: string;
}

interface CdekApiError {
  code?: string;
  message?: string;
}

interface CdekTariffResponse {
  delivery_sum?: number;
  total_sum?: number;
  period_min?: number;
  period_max?: number;
  calendar_min?: number;
  calendar_max?: number;
  errors?: CdekApiError[];
}

interface CdekCityResponse {
  code?: number;
  city?: string;
  region?: string;
  country_code?: string;
  postal_codes?: string[];
  region_code?: number;
  latitude?: number;
  longitude?: number;
}

interface CdekPointResponse {
  code?: string;
  name?: string;
  type?: string;
  work_time?: string;
  address_comment?: string;
  location?: {
    country_code?: string;
    region?: string;
    city?: string;
    city_code?: number;
    postal_code?: string;
    address?: string;
    latitude?: number;
    longitude?: number;
  };
}

interface CdekOrderResponse {
  entity?: { uuid?: string; cdek_number?: string };
  requests?: Array<{
    state?: string;
    errors?: CdekApiError[];
    warnings?: CdekApiError[];
  }>;
}

export type CdekDeliveryMode = 'courier' | 'pickup';

export interface CdekCalculationInput {
  city: string;
  postalCode?: string;
  address?: string;
  street?: string;
  house?: string;
  region?: string;
  itemCount: number;
  mode: CdekDeliveryMode;
  cityCode?: number;
  deliveryPointCode?: string;
  freeDelivery?: boolean;
}

export interface CdekDeliveryQuote {
  amount: number;
  tariffCode: number;
  tariffName: string;
  periodMin: number | null;
  periodMax: number | null;
  mode: CdekDeliveryMode;
}

export interface CdekPickupPoint {
  code: string;
  name: string;
  type: string;
  city: string;
  cityCode: number;
  postalCode: string;
  address: string;
  workTime: string;
  addressComment: string;
  latitude: number;
  longitude: number;
}

export interface CdekLocation {
  code: number;
  city: string;
  region: string;
  countryCode: string;
  postalCodes: string[];
  postalCode?: string;
  regionCode: number;
  latitude: number | null;
  longitude: number | null;
  address?: string;
  label?: string;
}

export interface CdekOrderInput {
  orderNumber: string;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  city: string;
  postalCode: string;
  address: string;
  mode: CdekDeliveryMode;
  tariffCode: number;
  deliveryPointCode?: string;
  items: Array<{
    productId: string;
    name: string;
    price: number;
    quantity: number;
  }>;
}

export interface CdekCreatedOrder {
  uuid: string;
  cdekNumber: string;
}

let tokenCache: { token: string; expiresAt: number } | null = null;
let locationsCatalogCache: { locations: CdekLocation[]; expiresAt: number } | null = null;

export class CdekError extends Error {
  constructor(message: string, public readonly status = 502) {
    super(message);
    this.name = 'CdekError';
  }
}

function positiveInteger(value: string | undefined, fallback?: number): number {
  const parsed = Number(value);
  if (Number.isInteger(parsed) && parsed > 0) return parsed;
  if (fallback !== undefined) return fallback;
  return 0;
}

function positiveNumber(value: string | undefined, fallback?: number): number {
  const parsed = Number(value);
  if (Number.isFinite(parsed) && parsed > 0) return parsed;
  if (fallback !== undefined) return fallback;
  return 0;
}

function getConfig(): CdekConfig {
  const clientId = process.env.CDEK_CLIENT_ID?.trim() || '';
  const clientSecret = process.env.CDEK_CLIENT_SECRET?.trim() || '';
  const fromCityCode = positiveInteger(process.env.CDEK_FROM_CITY_CODE, DEFAULT_FROM_CITY_CODE);
  const shipmentPoint = process.env.CDEK_SHIPMENT_POINT?.trim() || DEFAULT_SHIPMENT_POINT;
  const unitWeight = positiveInteger(process.env.CDEK_UNIT_WEIGHT_GRAMS, 500);
  const unitLength = positiveNumber(process.env.CDEK_UNIT_LENGTH_CM, 20);
  const unitWidth = positiveNumber(process.env.CDEK_UNIT_WIDTH_CM, 14);
  const unitHeight = positiveNumber(process.env.CDEK_UNIT_HEIGHT_CM, 11.5);

  if (!clientId || !clientSecret || !fromCityCode || !shipmentPoint || !unitWeight || !unitLength || !unitWidth || !unitHeight) {
    throw new CdekError('Расчёт СДЭК ещё не настроен. Обратитесь к администратору магазина.', 503);
  }

  return {
    apiUrl: (process.env.CDEK_API_URL?.trim() || DEFAULT_API_URL).replace(/\/$/, ''),
    clientId,
    clientSecret,
    fromCityCode,
    shipmentPoint,
    courierTariffCode: positiveInteger(
      process.env.CDEK_COURIER_TARIFF_CODE || process.env.CDEK_TARIFF_CODE,
      DEFAULT_COURIER_TARIFF_CODE,
    ),
    pickupTariffCode: positiveInteger(process.env.CDEK_PICKUP_TARIFF_CODE, DEFAULT_PICKUP_TARIFF_CODE),
    unitWeight,
    unitLength,
    unitWidth,
    unitHeight,
  };
}

async function cdekFetch(url: string, init: RequestInit): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    return await fetch(url, { ...init, signal: controller.signal, cache: 'no-store' });
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      throw new CdekError('СДЭК не ответил вовремя. Попробуйте ещё раз.');
    }
    throw new CdekError('Не удалось связаться со СДЭК. Попробуйте ещё раз.');
  } finally {
    clearTimeout(timeout);
  }
}

async function getAccessToken(config: CdekConfig): Promise<string> {
  if (tokenCache && tokenCache.expiresAt > Date.now() + 30_000) {
    return tokenCache.token;
  }

  const body = new URLSearchParams({
    grant_type: 'client_credentials',
    client_id: config.clientId,
    client_secret: config.clientSecret,
  });
  const response = await cdekFetch(`${config.apiUrl}/oauth/token?parameters`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  });
  const data = await response.json().catch(() => ({})) as CdekTokenResponse;

  if (!response.ok || !data.access_token) {
    console.error('CDEK OAuth error:', response.status, data.error, data.error_description);
    throw new CdekError('Не удалось авторизоваться в СДЭК. Обратитесь к администратору магазина.', 503);
  }

  const expiresIn = positiveInteger(String(data.expires_in || ''), 3600);
  tokenCache = {
    token: data.access_token,
    expiresAt: Date.now() + expiresIn * 1000,
  };
  return data.access_token;
}

async function authorizedRequest<T>(path: string, init: RequestInit = {}): Promise<{ response: Response; data: T }> {
  const config = getConfig();
  const accessToken = await getAccessToken(config);
  const response = await cdekFetch(`${config.apiUrl}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      ...(init.body ? { 'Content-Type': 'application/json' } : {}),
      ...init.headers,
    },
  });
  const data = await response.json().catch(() => ({})) as T;
  return { response, data };
}

function joinApiErrors(errors: CdekApiError[] | undefined, fallback: string): string {
  return errors?.map((error) => error.message).filter(Boolean).join('; ') || fallback;
}

function packageData(config: CdekConfig, itemCount: number) {
  return {
    weight: config.unitWeight * itemCount,
    length: config.unitLength,
    width: config.unitWidth,
    height: config.unitHeight * itemCount,
  };
}

interface NominatimAddress {
  country_code?: string;
  house_number?: string;
  road?: string;
  pedestrian?: string;
  residential?: string;
  neighbourhood?: string;
  quarter?: string;
  suburb?: string;
  city_district?: string;
  state_district?: string;
  county?: string;
  state?: string;
  city?: string;
  town?: string;
  village?: string;
  municipality?: string;
  hamlet?: string;
  postcode?: string;
}

interface NominatimResult {
  display_name?: string;
  address?: NominatimAddress;
}

function normalizeAddressPart(value: string): string {
  return value
    .toLocaleLowerCase('ru-RU')
    .replace(/ё/g, 'е')
    .replace(/\b(?:г|город|ул|улица|проспект|пр-т|переулок|пер|шоссе|наб|набережная)\b/giu, ' ')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim();
}

function addressPartMatches(expected: string, actual: string): boolean {
  const left = normalizeAddressPart(expected);
  const right = normalizeAddressPart(actual);
  return Boolean(left && right && (left === right || left.includes(right) || right.includes(left)));
}

function houseMatches(expected: string, actual: string): boolean {
  const normalizeHouse = (value: string) => value
    .toLocaleLowerCase('ru-RU')
    .replace(/\b(?:дом|д)\b/giu, '')
    .replace(/\b(?:корпус|корп|к)\b/giu, 'к')
    .replace(/\b(?:строение|стр|с)\b/giu, 'с')
    .replace(/\b(?:литера|лит)\b/giu, 'л')
    .replace(/[^\p{L}\p{N}]/gu, '');
  return Boolean(normalizeHouse(expected) && normalizeHouse(expected) === normalizeHouse(actual));
}

function houseAppearsInAddress(expected: string, displayName: string): boolean {
  const compact = (value: string) => value
    .toLocaleLowerCase('ru-RU')
    .replace(/\b(?:дом|д)\b/giu, '')
    .replace(/\b(?:корпус|корп|к)\b/giu, 'к')
    .replace(/\b(?:строение|стр|с)\b/giu, 'с')
    .replace(/\b(?:литера|лит)\b/giu, 'л')
    .replace(/[^\p{L}\p{N}]/gu, '');
  const house = compact(expected);
  return Boolean(house && compact(displayName).includes(house));
}

async function validateRussianCourierAddress(input: CdekCalculationInput): Promise<void> {
  const city = input.city.trim();
  const street = input.street?.trim() || '';
  const house = input.house?.trim() || '';
  const postalCode = input.postalCode?.trim() || '';
  if (!city || !street || !house) {
    throw new CdekError('Укажите полный адрес: город, улицу и дом.', 400);
  }

  const params = new URLSearchParams({
    street: `${house} ${street}`,
    city,
    format: 'jsonv2',
    addressdetails: '1',
    countrycodes: 'ru',
    limit: '5',
    layer: 'address',
  });
  if (input.region?.trim()) params.set('state', input.region.trim());
  if (postalCode) params.set('postalcode', postalCode);
  let response: Response;
  try {
    response = await fetch(`https://nominatim.openstreetmap.org/search?${params.toString()}`, {
      headers: {
        'User-Agent': 'errani.ru delivery address validation',
        Referer: 'https://errani.ru/',
        'Accept-Language': 'ru',
      },
      next: { revalidate: 86_400 },
    });
  } catch {
    throw new CdekError('Не удалось проверить адрес. Попробуйте ещё раз.', 503);
  }
  if (!response.ok) {
    throw new CdekError('Сервис проверки адреса временно недоступен. Попробуйте ещё раз.', 503);
  }

  const results = await response.json().catch(() => []) as NominatimResult[];
  const valid = Array.isArray(results) && results.some((result) => {
    const address = result.address || {};
    const displayName = result.display_name || '';
    const settlements = [
      address.city, address.town, address.village, address.municipality, address.hamlet,
      address.city_district, address.state_district, address.county, address.suburb,
    ].filter((value): value is string => Boolean(value));
    const roads = [
      address.road, address.pedestrian, address.residential, address.neighbourhood,
      address.quarter, address.suburb,
    ].filter((value): value is string => Boolean(value));
    const cityMatches = settlements.some((value) => addressPartMatches(city, value))
      || addressPartMatches(city, displayName);
    const streetMatches = roads.some((value) => addressPartMatches(street, value))
      || addressPartMatches(street, displayName);
    const matchedHouse = houseMatches(house, address.house_number || '')
      || houseAppearsInAddress(house, displayName);
    return address.country_code?.toLowerCase() === 'ru'
      && cityMatches
      && streetMatches
      && matchedHouse
      && (!postalCode || !address.postcode || address.postcode === postalCode);
  });
  if (!valid) {
    throw new CdekError('Адрес не найден. Проверьте город, улицу и номер дома. Доставка доступна только по России.', 422);
  }
}

async function getCdekPickupPointByCode(code: string): Promise<CdekPickupPoint> {
  const points = await loadCdekPickupPoints(new URLSearchParams({
    code,
    is_handout: 'true',
  }));
  const point = points.find((entry) => entry.code === code);
  if (!point) throw new CdekError('Выбранный пункт выдачи СДЭК не найден.', 404);
  return point;
}

export async function calculateCdekDelivery(input: CdekCalculationInput): Promise<CdekDeliveryQuote> {
  const config = getConfig();
  const itemCount = Math.floor(Number(input.itemCount));
  const city = input.city.trim();
  const postalCode = input.postalCode?.trim() || '';
  const tariffCode = input.mode === 'pickup' ? config.pickupTariffCode : config.courierTariffCode;

  if (!city || (postalCode && !/^\d{6}$/.test(postalCode)) || itemCount < 1 || itemCount > 100) {
    throw new CdekError('Проверьте адрес и состав заказа.', 400);
  }

  if (input.mode === 'courier') await validateRussianCourierAddress(input);

  const selectedPoint = input.mode === 'pickup' && input.deliveryPointCode
    ? await getCdekPickupPointByCode(input.deliveryPointCode)
    : null;
  if (input.mode === 'pickup' && !selectedPoint) {
    throw new CdekError('Выберите пункт выдачи СДЭК.', 400);
  }
  const destination = (selectedPoint || input.cityCode) ? null : await findCdekCity(city, postalCode);
  const destinationCode = selectedPoint?.cityCode || input.cityCode || destination?.code;
  if (!destinationCode) throw new CdekError('Адрес не найден', 404);
  const toLocation = { code: destinationCode };
  const { response, data } = await authorizedRequest<CdekTariffResponse>('/calculator/tariff', {
    method: 'POST',
    body: JSON.stringify({
      tariff_code: tariffCode,
      from_location: { code: config.fromCityCode },
      to_location: toLocation,
      packages: [packageData(config, itemCount)],
    }),
  });

  if (!response.ok || data.errors?.length) {
    console.error('CDEK tariff error:', response.status, data.errors);
    throw new CdekError(
      joinApiErrors(data.errors, 'СДЭК не смог рассчитать доставку для указанного адреса.'),
      response.status === 400 ? 400 : 502,
    );
  }

  const rawAmount = Number(data.delivery_sum ?? data.total_sum);
  if (!Number.isFinite(rawAmount) || rawAmount < 0) {
    throw new CdekError('СДЭК вернул некорректную стоимость доставки.');
  }

  return {
    amount: input.freeDelivery ? 0 : Math.ceil(rawAmount) + DELIVERY_MARKUP_RUB,
    tariffCode,
    tariffName: 'Доставка СДЭК',
    periodMin: Number.isFinite(Number(data.period_min ?? data.calendar_min))
      ? Number(data.period_min ?? data.calendar_min)
      : null,
    periodMax: Number.isFinite(Number(data.period_max ?? data.calendar_max))
      ? Number(data.period_max ?? data.calendar_max)
      : null,
    mode: input.mode,
  };
}

function locationFromResponse(entry: CdekCityResponse): CdekLocation | null {
  if (!entry.code || !entry.city) return null;
  return {
    code: entry.code,
    city: entry.city,
    region: entry.region || '',
    countryCode: entry.country_code || 'RU',
    postalCodes: entry.postal_codes || [],
    regionCode: Number(entry.region_code || 0),
    latitude: Number.isFinite(Number(entry.latitude)) ? Number(entry.latitude) : null,
    longitude: Number.isFinite(Number(entry.longitude)) ? Number(entry.longitude) : null,
  };
}

function normalizeLocationCandidate(value: string): string {
  return value
    .trim()
    .replace(/^(?:г\.?|город|п\.?|пос[её]лок|с\.?|село)\s+/iu, '')
    .trim();
}

export async function getCdekRussianLocationsCatalog(): Promise<CdekLocation[]> {
  if (locationsCatalogCache && locationsCatalogCache.expiresAt > Date.now()) {
    return locationsCatalogCache.locations;
  }

  const params = new URLSearchParams({ country_codes: 'RU', size: '10000' });
  const { response, data } = await authorizedRequest<CdekCityResponse[]>(`/location/cities?${params.toString()}`);
  if (!response.ok || !Array.isArray(data)) {
    throw new CdekError('Не удалось загрузить справочник населённых пунктов.', 502);
  }
  const unique = new Map<number, CdekLocation>();
  for (const entry of data) {
    const location = locationFromResponse(entry);
    if (location) unique.set(location.code, location);
  }
  const locations = [...unique.values()];
  locationsCatalogCache = { locations, expiresAt: Date.now() + 24 * 60 * 60 * 1000 };
  return locations;
}

export async function searchCdekLocations(query: string): Promise<CdekLocation[]> {
  const normalized = query.trim();
  if (normalized.length < 2) return [];

  const candidates = /^\d{3,6}$/.test(normalized)
    ? [normalized]
    : [...new Set([
        normalized,
        ...normalized.split(',').map(normalizeLocationCandidate).reverse(),
      ].filter((candidate) => candidate.length >= 2))].slice(0, 4);
  const locations = new Map<number, CdekLocation>();

  for (const candidate of candidates) {
    const params = new URLSearchParams({ country_codes: 'RU', size: '20' });
    params.set(/^\d{3,6}$/.test(candidate) ? 'postal_code' : 'city', candidate);
    const { response, data } = await authorizedRequest<CdekCityResponse[]>(`/location/cities?${params.toString()}`);
    if (!response.ok || !Array.isArray(data)) continue;

    for (const entry of data) {
      const location = locationFromResponse(entry);
      if (location) locations.set(location.code, location);
    }
    if (locations.size > 0) break;
  }

  return [...locations.values()].slice(0, 20);
}

export async function findCdekCity(city: string, postalCode = ''): Promise<CdekCityResponse> {
  const locations = await searchCdekLocations(postalCode || city);
  const normalizedCity = city.trim().toLocaleLowerCase('ru-RU');
  const selected = locations.find((entry) => postalCode && entry.postalCodes.includes(postalCode))
    || locations.find((entry) => entry.city.toLocaleLowerCase('ru-RU') === normalizedCity)
    || locations[0];
  if (!selected) throw new CdekError('Адрес не найден', 404);

  return {
    code: selected.code,
    city: selected.city,
    region: selected.region,
    country_code: selected.countryCode,
    postal_codes: selected.postalCodes,
    region_code: selected.regionCode,
    latitude: selected.latitude || undefined,
    longitude: selected.longitude || undefined,
  };
}

async function loadCdekPickupPoints(params: URLSearchParams, city = ''): Promise<CdekPickupPoint[]> {
  const { response, data } = await authorizedRequest<CdekPointResponse[]>(`/deliverypoints?${params.toString()}`);
  if (!response.ok || !Array.isArray(data)) {
    throw new CdekError('Не удалось получить пункты выдачи СДЭК.');
  }

  return data.flatMap((point) => {
    const location = point.location;
    if (!point.code || !location?.city_code || !location.address || !location.latitude || !location.longitude) return [];
    return [{
      code: point.code,
      name: point.name || point.code,
      type: point.type || 'PVZ',
      city: location.city || city,
      cityCode: location.city_code,
      postalCode: location.postal_code || '',
      address: location.address,
      workTime: point.work_time || '',
      addressComment: point.address_comment || '',
      latitude: location.latitude,
      longitude: location.longitude,
    }];
  });
}

export async function getCdekPickupPointsByCityCode(cityCode: number, city = ''): Promise<CdekPickupPoint[]> {
  return loadCdekPickupPoints(new URLSearchParams({
    city_code: String(cityCode),
    is_handout: 'true',
  }), city);
}

function pickupPointDistance(point: CdekPickupPoint, latitude: number, longitude: number): number {
  const toRadians = (value: number) => value * Math.PI / 180;
  const latitudeDelta = toRadians(point.latitude - latitude);
  const longitudeDelta = toRadians(point.longitude - longitude);
  const a = Math.sin(latitudeDelta / 2) ** 2
    + Math.cos(toRadians(latitude)) * Math.cos(toRadians(point.latitude)) * Math.sin(longitudeDelta / 2) ** 2;
  return 6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export async function getCdekPickupPointsForLocation(location: CdekLocation): Promise<CdekPickupPoint[]> {
  const cityPoints = await getCdekPickupPointsByCityCode(location.code, location.city);
  const points = cityPoints.length > 0 || !location.regionCode
    ? cityPoints
    : await loadCdekPickupPoints(new URLSearchParams({
        region_code: String(location.regionCode),
        is_handout: 'true',
      }), location.city);
  if (location.latitude === null || location.longitude === null) return points;

  return points.sort((left, right) => (
    pickupPointDistance(left, location.latitude!, location.longitude!)
    - pickupPointDistance(right, location.latitude!, location.longitude!)
  ));
}

export async function getCdekPickupPoints(city: string, postalCode = ''): Promise<CdekPickupPoint[]> {
  const cdekCity = await findCdekCity(city, postalCode);
  if (!cdekCity.code) throw new CdekError('СДЭК не вернул код города.', 502);
  return getCdekPickupPointsByCityCode(cdekCity.code, cdekCity.city || city);
}

export async function createCdekOrder(input: CdekOrderInput): Promise<CdekCreatedOrder> {
  const config = getConfig();
  const itemCount = input.items.reduce((sum, item) => sum + item.quantity, 0);
  if (!input.customerPhone || itemCount < 1) {
    throw new CdekError('Недостаточно данных для создания заказа СДЭК.', 400);
  }

  const payload = {
    type: 1,
    number: input.orderNumber,
    tariff_code: input.tariffCode,
    shipment_point: config.shipmentPoint,
    ...(input.mode === 'pickup'
      ? { delivery_point: input.deliveryPointCode }
      : {
          to_location: {
            country_code: 'RU',
            ...(input.postalCode ? { postal_code: input.postalCode } : {}),
            city: input.city,
            address: input.address,
          },
        }),
    recipient: {
      name: input.customerName,
      email: input.customerEmail,
      phones: [{ number: input.customerPhone }],
    },
    packages: [{
      number: '1',
      ...packageData(config, itemCount),
      items: input.items.map((item) => ({
        name: item.name,
        ware_key: item.productId,
        payment: { value: 0 },
        cost: Number(item.price.toFixed(2)),
        weight: config.unitWeight,
        amount: item.quantity,
      })),
    }],
  };
  const { response, data } = await authorizedRequest<CdekOrderResponse>('/orders', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
  const errors = data.requests?.flatMap((request) => request.errors || []) || [];

  if (!response.ok || !data.entity?.uuid || errors.length > 0) {
    console.error('CDEK order creation error:', response.status, data.requests);
    throw new CdekError(joinApiErrors(errors, 'СДЭК не принял заказ.'));
  }

  return {
    uuid: data.entity.uuid,
    cdekNumber: data.entity.cdek_number || '',
  };
}
