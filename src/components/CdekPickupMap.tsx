'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import type { Lang } from '@/lib/i18n';

const YANDEX_MAPS_SCRIPT_ID = 'errani-yandex-maps-script';

interface YandexEventManager {
  add(event: string, handler: () => void): void;
}

interface YandexPlacemark {
  events: YandexEventManager;
}

interface YandexGeoObjects {
  add(object: YandexPlacemark): void;
  removeAll(): void;
}

interface YandexMapInstance {
  geoObjects: YandexGeoObjects;
  setCenter(center: [number, number], zoom?: number, options?: { duration?: number }): void;
  destroy(): void;
  container: { fitToViewport(): void };
}

interface YandexMapsApi {
  ready(callback: () => void): void;
  Map: new (
    element: HTMLElement,
    state: { center: [number, number]; zoom: number; controls?: string[] },
    options?: { suppressMapOpenBlock?: boolean; yandexMapDisablePoiInteractivity?: boolean },
  ) => YandexMapInstance;
  Placemark: new (
    coordinates: [number, number],
    properties?: Record<string, string>,
    options?: Record<string, unknown>,
  ) => YandexPlacemark;
}

declare global {
  interface Window {
    ymaps?: YandexMapsApi;
    __erraniYandexMapsPromise?: Promise<YandexMapsApi>;
  }
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

export interface CdekPickupLocation {
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

function distanceKm(point: CdekPickupPoint, latitude: number, longitude: number): number {
  const toRadians = (value: number) => value * Math.PI / 180;
  const earthRadius = 6371;
  const latitudeDelta = toRadians(point.latitude - latitude);
  const longitudeDelta = toRadians(point.longitude - longitude);
  const a = Math.sin(latitudeDelta / 2) ** 2
    + Math.cos(toRadians(latitude)) * Math.cos(toRadians(point.latitude)) * Math.sin(longitudeDelta / 2) ** 2;
  return earthRadius * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function locationLabel(location: CdekPickupLocation): string {
  return location.label || location.address || [location.city, location.region].filter(Boolean).join(', ');
}

function escapeMapText(value: string): string {
  return value.replace(/[&<>"']/g, (character) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  })[character] || character);
}

function loadYandexMaps(): Promise<YandexMapsApi> {
  const apiKey = process.env.NEXT_PUBLIC_YANDEX_MAPS_API_KEY?.trim();
  if (!apiKey) return Promise.reject(new Error('YANDEX_MAPS_API_KEY_MISSING'));
  if (window.__erraniYandexMapsPromise) return window.__erraniYandexMapsPromise;

  window.__erraniYandexMapsPromise = new Promise<YandexMapsApi>((resolve, reject) => {
    const resolveApi = () => {
      if (!window.ymaps) {
        reject(new Error('Yandex Maps did not initialize.'));
        return;
      }
      window.ymaps.ready(() => resolve(window.ymaps!));
    };
    if (window.ymaps) {
      resolveApi();
      return;
    }

    const existingScript = document.getElementById(YANDEX_MAPS_SCRIPT_ID) as HTMLScriptElement | null;
    if (existingScript) {
      existingScript.addEventListener('load', resolveApi, { once: true });
      existingScript.addEventListener('error', () => reject(new Error('Yandex Maps failed to load.')), { once: true });
      return;
    }

    const script = document.createElement('script');
    script.id = YANDEX_MAPS_SCRIPT_ID;
    script.src = `https://api-maps.yandex.ru/2.1/?apikey=${encodeURIComponent(apiKey)}&lang=ru_RU`;
    script.async = true;
    script.addEventListener('load', resolveApi, { once: true });
    script.addEventListener('error', () => reject(new Error('Yandex Maps failed to load.')), { once: true });
    document.head.appendChild(script);
  });
  return window.__erraniYandexMapsPromise;
}

function InteractivePickupMap({
  points,
  selectedPoint,
  onSelect,
  lang,
}: {
  points: CdekPickupPoint[];
  selectedPoint: CdekPickupPoint | null;
  onSelect: (point: CdekPickupPoint) => void;
  lang: Lang;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<YandexMapInstance | null>(null);
  const pointsRef = useRef(points);
  const onSelectRef = useRef(onSelect);
  const [mapReady, setMapReady] = useState(false);
  const [mapError, setMapError] = useState('');
  const [useWidgetFallback, setUseWidgetFallback] = useState(false);

  useEffect(() => {
    pointsRef.current = points;
    onSelectRef.current = onSelect;
  }, [onSelect, points]);

  useEffect(() => {
    let active = true;
    loadYandexMaps()
      .then((yandexMaps) => {
        if (!active || !containerRef.current || mapRef.current) return;
        const initialPoint = selectedPoint || pointsRef.current[0];
        const map = new yandexMaps.Map(
          containerRef.current,
          {
            center: initialPoint ? [initialPoint.latitude, initialPoint.longitude] : [53.2436, 34.3634],
            zoom: initialPoint ? 15 : 10,
            controls: ['zoomControl', 'fullscreenControl'],
          },
          { suppressMapOpenBlock: true, yandexMapDisablePoiInteractivity: true },
        );
        mapRef.current = map;
        setMapReady(true);
        window.setTimeout(() => map.container.fitToViewport(), 0);
      })
      .catch((error) => {
        if (!active) return;
        if (error instanceof Error && error.message === 'YANDEX_MAPS_API_KEY_MISSING') {
          setUseWidgetFallback(true);
          return;
        }
        setMapError(lang === 'ru' ? 'Не удалось загрузить Яндекс Карты.' : 'Could not load Yandex Maps.');
      });

    return () => {
      active = false;
      mapRef.current?.destroy();
      mapRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (!mapReady || !mapRef.current || !window.ymaps) return;
    const yandexMaps = window.ymaps;
    const map = mapRef.current;
    map.geoObjects.removeAll();

    points.forEach((point) => {
      const selected = selectedPoint?.code === point.code;
      const marker = new yandexMaps.Placemark(
        [point.latitude, point.longitude],
        {
          hintContent: escapeMapText(`${point.name}, ${point.address}`),
          balloonContentHeader: escapeMapText(point.name),
          balloonContentBody: escapeMapText(point.address),
        },
        {
          preset: selected ? 'islands#orangeDotIcon' : 'islands#blueDotIcon',
          iconColor: selected ? '#e8722a' : '#2563eb',
          zIndex: selected ? 1000 : 0,
        },
      );
      marker.events.add('click', () => onSelectRef.current(point));
      map.geoObjects.add(marker);
    });

    const point = selectedPoint || points[0];
    if (point) map.setCenter([point.latitude, point.longitude], 16, { duration: 250 });
  }, [mapReady, points, selectedPoint]);

  const widgetPoint = selectedPoint || points[0];
  const widgetLatitude = widgetPoint?.latitude || 53.2436;
  const widgetLongitude = widgetPoint?.longitude || 34.3634;
  const widgetParams = new URLSearchParams({
    ll: `${widgetLongitude},${widgetLatitude}`,
    z: widgetPoint ? '16' : '10',
  });
  if (widgetPoint) widgetParams.set('pt', `${widgetLongitude},${widgetLatitude},pm2rdm`);

  return (
    <div className="cdek-map-wrap">
      {useWidgetFallback ? (
        <iframe
          className="cdek-interactive-map"
          src={`https://yandex.ru/map-widget/v1/?${widgetParams.toString()}`}
          title={lang === 'ru' ? 'Пункты выдачи СДЭК на Яндекс Картах' : 'CDEK pickup points on Yandex Maps'}
          loading="lazy"
          allowFullScreen
          referrerPolicy="strict-origin-when-cross-origin"
          style={{ border: 0 }}
        />
      ) : <div ref={containerRef} className="cdek-interactive-map" />}
      {!mapReady && !mapError && !useWidgetFallback && (
        <div className="cdek-map-status">{lang === 'ru' ? 'Загружаем карту…' : 'Loading map…'}</div>
      )}
      {mapError && (
        <div className="cdek-map-status cdek-map-status-error">
          {mapError}
        </div>
      )}
      {mapReady && points.length > 0 && (
        <div className="cdek-map-hint">
          {lang === 'ru'
            ? 'Нажмите на метку, чтобы выбрать пункт выдачи'
            : 'Click a marker to select a pickup point'}
        </div>
      )}
    </div>
  );
}

export function CdekPickupMap({
  selectedPoint,
  onSelect,
  onLocationChange,
  lang,
}: {
  selectedPoint: CdekPickupPoint | null;
  onSelect: (point: CdekPickupPoint) => void;
  onLocationChange: (location: CdekPickupLocation | null) => void;
  lang: Lang;
}) {
  const [query, setQuery] = useState('');
  const [locations, setLocations] = useState<CdekPickupLocation[]>([]);
  const [selectedLocation, setSelectedLocation] = useState<CdekPickupLocation | null>(null);
  const [points, setPoints] = useState<CdekPickupPoint[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [locationLoading, setLocationLoading] = useState(false);
  const [pointsLoading, setPointsLoading] = useState(false);
  const [error, setError] = useState('');
  const [position, setPosition] = useState<{ latitude: number; longitude: number } | null>(null);
  const [searchVersion, setSearchVersion] = useState(0);
  const manualSearchRef = useRef(false);
  const pointButtonRefs = useRef(new Map<string, HTMLButtonElement>());
  const mapSelectionRef = useRef(false);
  const localize = (ru: string, en: string) => lang === 'ru' ? ru : en;

  useEffect(() => {
    setError('');
    if (selectedLocation && query === locationLabel(selectedLocation)) {
      setLocations([]);
      return;
    }
    if (query.trim().length < 2) {
      setLocations([]);
      return;
    }

    const controller = new AbortController();
    const manualSearch = manualSearchRef.current;
    const timer = window.setTimeout(async () => {
      setSearchLoading(true);
      try {
        const response = await fetch(`/api/delivery/cdek/locations?q=${encodeURIComponent(query.trim())}`, { signal: controller.signal });
        const data = await response.json();
        if (!response.ok) throw new Error(lang === 'ru' ? (data.error || 'Не удалось найти адрес.') : 'Could not find this address.');
        const nextLocations = Array.isArray(data) ? data as CdekPickupLocation[] : [];
        if (manualSearch) {
          manualSearchRef.current = false;
          const nearestLocation = nextLocations[0];
          if (!nearestLocation) {
            setLocations([]);
            setError(localize(
              'Адрес не найден. Попробуйте указать населённый пункт и область.',
              'Address not found. Try entering the city and region.',
            ));
            return;
          }
          setSelectedLocation(nearestLocation);
          setQuery(locationLabel(nearestLocation));
          setLocations([]);
          setPosition(null);
          onLocationChange(nearestLocation);
          return;
        }
        setLocations(nextLocations);
      } catch (fetchError) {
        if (fetchError instanceof Error && fetchError.name === 'AbortError') return;
        setError(fetchError instanceof Error ? fetchError.message : localize('Не удалось найти адрес.', 'Could not find this address.'));
      } finally {
        if (!controller.signal.aborted) setSearchLoading(false);
      }
    }, manualSearch ? 0 : 450);

    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [lang, onLocationChange, query, searchVersion, selectedLocation]);

  useEffect(() => {
    setPoints([]);
    if (!selectedLocation) return;

    const controller = new AbortController();
    setPointsLoading(true);
    const params = new URLSearchParams({
      cityCode: String(selectedLocation.code),
      city: selectedLocation.city,
      regionCode: String(selectedLocation.regionCode),
    });
    if (selectedLocation.latitude !== null) params.set('latitude', String(selectedLocation.latitude));
    if (selectedLocation.longitude !== null) params.set('longitude', String(selectedLocation.longitude));
    if (selectedLocation.postalCode) params.set('postalCode', selectedLocation.postalCode);
    fetch(`/api/delivery/cdek/points?${params.toString()}`, { signal: controller.signal })
      .then(async (response) => {
        const data = await response.json();
        if (!response.ok) throw new Error(lang === 'ru' ? (data.error || 'Не удалось загрузить пункты выдачи.') : 'Could not load pickup points.');
        const nextPoints = Array.isArray(data) ? data as CdekPickupPoint[] : [];
        setPoints(nextPoints);
        if (selectedLocation.latitude !== null && selectedLocation.longitude !== null) {
          setPosition({ latitude: selectedLocation.latitude, longitude: selectedLocation.longitude });
        }
        if (nextPoints[0]) onSelect(nextPoints[0]);
      })
      .catch((fetchError) => {
        if (fetchError instanceof Error && fetchError.name === 'AbortError') return;
        setError(fetchError instanceof Error ? fetchError.message : localize('Не удалось загрузить пункты выдачи.', 'Could not load pickup points.'));
      })
      .finally(() => {
        if (!controller.signal.aborted) setPointsLoading(false);
      });

    return () => controller.abort();
  }, [lang, onSelect, selectedLocation]);

  const orderedPoints = useMemo(() => {
    if (!position) return points;
    return [...points].sort((left, right) => (
      distanceKm(left, position.latitude, position.longitude)
      - distanceKm(right, position.latitude, position.longitude)
    ));
  }, [points, position]);

  useEffect(() => {
    if (!selectedPoint || !mapSelectionRef.current) return;
    mapSelectionRef.current = false;
    pointButtonRefs.current.get(selectedPoint.code)?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }, [selectedPoint]);

  const selectPointFromMap = (point: CdekPickupPoint) => {
    mapSelectionRef.current = true;
    onSelect(point);
  };

  const selectLocation = (location: CdekPickupLocation) => {
    setSelectedLocation(location);
    setQuery(locationLabel(location));
    setLocations([]);
    setPosition(null);
    onLocationChange(location);
  };

  const findNearest = () => {
    setError('');
    if (!navigator.geolocation) {
      setError(localize('Ваш браузер не поддерживает определение местоположения.', 'Your browser does not support location detection.'));
      return;
    }

    setLocationLoading(true);
    navigator.geolocation.getCurrentPosition(async ({ coords }) => {
      try {
        const params = new URLSearchParams({
          latitude: String(coords.latitude),
          longitude: String(coords.longitude),
        });
        const response = await fetch(`/api/delivery/cdek/locations?${params.toString()}`);
        const data = await response.json();
        if (!response.ok) throw new Error(lang === 'ru' ? (data.error || 'Не удалось определить адрес.') : 'Could not determine your address.');
        const nearestLocation = Array.isArray(data) ? data[0] as CdekPickupLocation | undefined : undefined;
        if (!nearestLocation) {
          throw new Error(localize(
            'Не удалось найти пункты СДЭК рядом с вашим местоположением.',
            'No CDEK pickup points were found near your location.',
          ));
        }
        const currentPosition = { latitude: coords.latitude, longitude: coords.longitude };
        setPosition(currentPosition);
        setSelectedLocation({ ...nearestLocation, ...currentPosition });
        setQuery(locationLabel(nearestLocation));
        setLocations([]);
        onLocationChange({ ...nearestLocation, ...currentPosition });
      } catch (fetchError) {
        setError(fetchError instanceof Error ? fetchError.message : localize('Не удалось определить адрес.', 'Could not determine your address.'));
      } finally {
        setLocationLoading(false);
      }
    }, (geoError) => {
      setLocationLoading(false);
      setError(geoError.code === geoError.PERMISSION_DENIED
        ? localize(
            'Доступ к геопозиции запрещён. Разрешите его в настройках браузера или введите адрес.',
            'Location access was denied. Allow it in your browser settings or enter an address.',
          )
        : localize(
            'Не удалось определить местоположение. Попробуйте ещё раз или введите адрес.',
            'Could not determine your location. Try again or enter an address.',
          ));
    }, {
      enableHighAccuracy: true,
      timeout: 12_000,
      maximumAge: 300_000,
    });
  };

  return (
    <div style={{ marginTop: '0.8rem' }}>
      <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '0.5rem' }}>
        {localize('Адрес для поиска ПВЗ', 'Address for pickup point search')}
      </label>
      <div className="cdek-pickup-search-row">
        <div style={{ position: 'relative', minWidth: 0 }}>
          <input
            className="form-field"
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
              setSelectedLocation(null);
              setPoints([]);
              onLocationChange(null);
            }}
            onKeyDown={(event) => {
              if (event.key !== 'Enter') return;
              event.preventDefault();
              if (locations[0]) {
                selectLocation(locations[0]);
                return;
              }
              manualSearchRef.current = true;
              setSearchVersion((version) => version + 1);
            }}
            placeholder={localize('Введите адрес для выбора пункта выдачи', 'Enter an address to choose a pickup point')}
            autoComplete="off"
          />
          {(searchLoading || locationLoading) && <span style={{ position: 'absolute', right: 14, top: 13, fontSize: '0.74rem', color: 'var(--text-secondary)' }}>
            {locationLoading ? localize('Определяем…', 'Locating…') : localize('Ищем…', 'Searching…')}
          </span>}
        </div>
        <button
          type="button"
          className="cdek-pickup-search-button"
          disabled={locationLoading}
          onClick={findNearest}
        >
          {localize('Найти ближайший', 'Find nearest')}
        </button>
        {locations.length > 0 && (
          <div style={{ position: 'absolute', zIndex: 60, top: 'calc(100% + 5px)', left: 0, right: 0, maxHeight: 260, overflowY: 'auto', border: '1px solid var(--border)', borderRadius: 10, background: 'var(--bg-surface)', boxShadow: '0 16px 36px rgba(0,0,0,0.35)' }}>
            {locations.map((location) => (
              <button
                type="button"
                key={`${location.code}-${location.latitude}-${location.longitude}`}
                onClick={() => selectLocation(location)}
                style={{ width: '100%', padding: '0.78rem 0.9rem', border: 'none', borderBottom: '1px solid var(--border)', background: 'transparent', color: 'var(--text)', cursor: 'pointer', textAlign: 'left' }}
              >
                <strong style={{ display: 'block', fontSize: '0.82rem', lineHeight: 1.45 }}>{location.address || location.city}</strong>
                <span style={{ display: 'block', marginTop: 3, fontSize: '0.74rem', color: 'var(--text-secondary)' }}>
                  {[location.city, location.region, location.postalCode].filter(Boolean).join(', ')}
                </span>
              </button>
            ))}
          </div>
        )}
      </div>

      {error && <div style={{ color: '#ef4444', fontSize: '0.78rem', marginTop: '0.65rem' }}>{error}</div>}
      <InteractivePickupMap
        points={orderedPoints}
        selectedPoint={selectedPoint}
        onSelect={selectPointFromMap}
        lang={lang}
      />
      {selectedLocation && (
        <div style={{ marginTop: '0.8rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.75rem', marginBottom: '0.7rem', flexWrap: 'wrap' }}>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
              {pointsLoading
                ? localize('Загружаем пункты СДЭК…', 'Loading CDEK pickup points…')
                : localize(`Доступно пунктов: ${points.length}`, `Pickup points available: ${points.length}`)}
            </span>
          </div>

          {points.length > 0 && (
            <>
              <div style={{ display: 'grid', gap: '0.55rem', maxHeight: 230, overflowY: 'auto', marginTop: '0.75rem', paddingRight: 4 }}>
                {orderedPoints.slice(0, 60).map((point) => {
                  const selected = selectedPoint?.code === point.code;
                  const distance = position ? distanceKm(point, position.latitude, position.longitude) : null;
                  return (
                    <button
                      type="button"
                      key={point.code}
                      aria-pressed={selected}
                      ref={(element) => {
                        if (element) pointButtonRefs.current.set(point.code, element);
                        else pointButtonRefs.current.delete(point.code);
                      }}
                      onClick={() => onSelect(point)}
                      style={{
                        padding: '0.75rem 0.85rem',
                        borderRadius: 9,
                        border: `1px solid ${selected ? 'var(--orange)' : 'var(--border)'}`,
                        background: selected ? 'rgba(232,114,42,0.1)' : 'var(--surface-1)',
                        color: 'var(--text)',
                        cursor: 'pointer',
                        textAlign: 'left',
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.7rem', fontSize: '0.82rem', fontWeight: 700 }}>
                        <span>{point.name}</span>
                        {distance !== null && <span style={{ color: 'var(--orange)', whiteSpace: 'nowrap' }}>
                          {distance.toFixed(1)} {localize('км', 'km')}
                        </span>}
                      </div>
                      <div style={{ fontSize: '0.76rem', color: 'var(--text-secondary)', marginTop: 4 }}>{point.address}</div>
                      {point.workTime && <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', marginTop: 3 }}>{point.workTime}</div>}
                    </button>
                  );
                })}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
