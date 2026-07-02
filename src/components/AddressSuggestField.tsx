'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

const RUSSIAN_REGIONS = [
  'Алтайский край', 'Амурская область', 'Архангельская область', 'Астраханская область',
  'Белгородская область', 'Брянская область', 'Владимирская область', 'Волгоградская область',
  'Вологодская область', 'Воронежская область', 'Еврейская автономная область', 'Забайкальский край',
  'Ивановская область', 'Иркутская область', 'Кабардино-Балкарская Республика', 'Калининградская область',
  'Калужская область', 'Камчатский край', 'Карачаево-Черкесская Республика', 'Кемеровская область — Кузбасс',
  'Кировская область', 'Костромская область', 'Краснодарский край', 'Красноярский край',
  'Курганская область', 'Курская область', 'Ленинградская область', 'Липецкая область',
  'Магаданская область', 'Москва', 'Московская область', 'Мурманская область', 'Ненецкий автономный округ',
  'Нижегородская область', 'Новгородская область', 'Новосибирская область', 'Омская область',
  'Оренбургская область', 'Орловская область', 'Пензенская область', 'Пермский край', 'Приморский край',
  'Псковская область', 'Республика Адыгея', 'Республика Алтай', 'Республика Башкортостан',
  'Республика Бурятия', 'Республика Дагестан', 'Республика Ингушетия', 'Республика Калмыкия',
  'Республика Карелия', 'Республика Коми', 'Республика Крым', 'Республика Марий Эл',
  'Республика Мордовия', 'Республика Саха (Якутия)', 'Республика Северная Осетия — Алания',
  'Республика Татарстан', 'Республика Тыва', 'Республика Хакасия', 'Ростовская область',
  'Рязанская область', 'Самарская область', 'Санкт-Петербург', 'Саратовская область',
  'Сахалинская область', 'Свердловская область', 'Севастополь', 'Смоленская область',
  'Ставропольский край', 'Тамбовская область', 'Тверская область', 'Томская область',
  'Тульская область', 'Тюменская область', 'Удмуртская Республика', 'Ульяновская область',
  'Хабаровский край', 'Ханты-Мансийский автономный округ — Югра', 'Челябинская область',
  'Чеченская Республика', 'Чувашская Республика', 'Чукотский автономный округ',
  'Ямало-Ненецкий автономный округ', 'Ярославская область',
];

interface Suggestion {
  value: string;
  label: string;
  region?: string;
}

export function AddressSuggestField({
  kind,
  label,
  value,
  region = '',
  city = '',
  error,
  onChange,
  onSelect,
}: {
  kind: 'region' | 'city' | 'street';
  label: string;
  value: string;
  region?: string;
  city?: string;
  error?: string;
  onChange: (value: string) => void;
  onSelect?: (suggestion: Suggestion) => void;
}) {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const skipNextSearchRef = useRef(false);
  const [items, setItems] = useState<Suggestion[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);

  const regionItems = useMemo(() => {
    const query = value.toLocaleLowerCase('ru-RU').trim();
    return RUSSIAN_REGIONS
      .filter((item) => !query || item.toLocaleLowerCase('ru-RU').includes(query))
      .slice(0, 16)
      .map((item) => ({ value: item, label: item }));
  }, [value]);

  useEffect(() => {
    const close = (event: MouseEvent) => {
      if (!wrapperRef.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, []);

  const loadSuggestions = useCallback(async (query: string, signal?: AbortSignal) => {
    if (kind === 'region' || (kind === 'street' && !city.trim() && !region.trim())) return;
    setLoading(true);
    setSearched(true);
    try {
      const params = new URLSearchParams({ type: kind, q: query });
      if (region) params.set('region', region);
      if (city) params.set('city', city);
      const response = await fetch(`/api/delivery/address-suggestions?${params}`, { signal });
      const data = await response.json();
      setItems(response.ok && Array.isArray(data) ? data : []);
      setOpen(true);
    } catch (error) {
      if (!(error instanceof Error && error.name === 'AbortError')) setItems([]);
    } finally {
      if (!signal?.aborted) setLoading(false);
    }
  }, [city, kind, region]);

  useEffect(() => {
    const isCitySearch = kind === 'city';
    const isStreetSearch = kind === 'street';
    const hasStreetContext = Boolean(city.trim() || region.trim());
    if (skipNextSearchRef.current) {
      skipNextSearchRef.current = false;
      return;
    }
    if ((!isCitySearch && !isStreetSearch) || !value.trim() || (isStreetSearch && !hasStreetContext)) {
      if (isCitySearch || isStreetSearch) setItems([]);
      return;
    }
    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      await loadSuggestions(value.trim(), controller.signal);
    }, 350);
    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [city, kind, loadSuggestions, region, value]);

  const visibleItems = kind === 'region' ? regionItems : items;
  const choose = (item: Suggestion) => {
    skipNextSearchRef.current = true;
    onChange(item.value);
    onSelect?.(item);
    setOpen(false);
  };

  return (
    <div ref={wrapperRef} style={{ position: 'relative', minWidth: 0 }}>
      <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '0.5rem' }}>{label}</label>
      <div style={{ position: 'relative' }}>
        <input
          type="text"
          className="form-field"
          value={value}
          onChange={(event) => {
            const nextValue = event.target.value;
            onChange(nextValue);
            setSearched(false);
            if (kind === 'region') setOpen(true);
            if (kind !== 'region' && !nextValue.trim()) {
              setItems([]);
              void loadSuggestions('');
            }
          }}
          onFocus={() => {
            setOpen(true);
            if (kind !== 'region' && visibleItems.length === 0) void loadSuggestions(value.trim());
          }}
          autoComplete={kind === 'region' ? 'address-level1' : kind === 'city' ? 'address-level2' : 'address-line1'}
          style={error ? { borderColor: '#ef4444' } : undefined}
        />
        {loading && (kind === 'city' || kind === 'street') && <span style={{ position: 'absolute', right: 12, top: 14, color: '#666', fontSize: '0.72rem' }}>Ищем…</span>}
      </div>
      {error && <p style={{ fontSize: '0.75rem', color: '#ef4444', marginTop: '0.25rem' }}>{error}</p>}
      {open && (
        <div style={{ position: 'absolute', zIndex: 90, top: error ? 'calc(100% - 18px)' : 'calc(100% + 5px)', left: 0, right: 0, maxHeight: 260, overflowY: 'auto', border: '1px solid #d6d6d6', borderRadius: 10, background: '#fff', color: '#111', boxShadow: '0 16px 36px rgba(0,0,0,0.24)' }}>
          {visibleItems.map((item) => (
            <button
              key={`${item.value}-${item.label}`}
              type="button"
              onClick={() => choose(item)}
              style={{ display: 'block', width: '100%', padding: '0.75rem 0.85rem', border: 0, borderBottom: '1px solid #ececec', background: '#fff', color: '#111', textAlign: 'left', cursor: 'pointer', fontSize: '0.8rem', lineHeight: 1.4 }}
            >
              {item.label}
            </button>
          ))}
          {searched && !loading && visibleItems.length === 0 && (
            <div style={{ padding: '0.8rem', color: '#555', fontSize: '0.78rem' }}>Ничего не найдено</div>
          )}
        </div>
      )}
    </div>
  );
}
