'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useLanguage } from '@/contexts/LanguageContext';
import { t } from '@/lib/i18n';
import { useState, useEffect } from 'react';

interface Product {
  id: string;
  slug: string;
  name: string;
  nameRu: string | null;
  description: string | null;
  descriptionRu: string | null;
  price: number;
  oldPrice: number | null;
  discount: number;
  stock: number;
  inStock: boolean;
  isSaleDisabled: boolean;
  isSoldOut: boolean;
  image: string;
  images: string;
  isAuthor: boolean;
  isPreorder: boolean;
  isActive: boolean;
  noticeText: string | null;
  noticeTextEn: string | null;
  customBadges: string;
  createdAt: string;
}

type FilterType = 'all' | 'author' | 'preorder';
type SortType = 'newest' | 'oldest' | 'cheap' | 'expensive';
const CATALOG_CACHE_KEY = 'catalog_products_cache_v1';

export function CatalogContent() {
  const { lang } = useLanguage();
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<FilterType>('all');
  const [sort, setSort] = useState<SortType>('newest');

  useEffect(() => {
    if (filter !== 'all') return;
    try {
      const raw = localStorage.getItem(CATALOG_CACHE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw) as { ts?: number; data?: Product[] };
      if (Array.isArray(parsed?.data) && parsed.data.length > 0) {
        setProducts(parsed.data.filter((p) => p.isActive));
        setLoading(false);
      }
    } catch {
      // ignore cache parse errors
    }
  }, [filter]);

  useEffect(() => {
    fetchProducts();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filter]);

  const fetchProducts = async () => {
    setLoading((prev) => products.length === 0 && prev);
    try {
      const params = new URLSearchParams();
      if (filter === 'author') params.set('author', 'true');
      if (filter === 'preorder') params.set('preorder', 'true');
      
      params.set('showAll', 'true');
      let successful = false;
      let data: unknown = [];
      for (let attempt = 1; attempt <= 3; attempt += 1) {
        const res = await fetch(`/api/products?${params.toString()}`, { cache: 'no-store' });
        const parsed = await res.json().catch(() => []);
        if (res.ok && Array.isArray(parsed)) {
          successful = true;
          data = parsed;
          break;
        }
        if (![429, 500, 502, 503, 504].includes(res.status) || attempt === 3) {
          data = parsed;
          break;
        }
        await new Promise((resolve) => setTimeout(resolve, 180 * attempt));
      }

      if (successful && Array.isArray(data)) {
        const active = data.filter((p: Product) => p.isActive);
        setProducts(active);
        if (filter === 'all' && active.length > 0) {
          localStorage.setItem(CATALOG_CACHE_KEY, JSON.stringify({ ts: Date.now(), data: active }));
        }
      }
    } catch (error) {
      console.error('Failed to fetch products:', error);
    } finally {
      setLoading(false);
    }
  };

  const filters: { key: FilterType; label: string }[] = [
    { key: 'all', label: lang === 'ru' ? 'Все' : 'All' },
    { key: 'author', label: lang === 'ru' ? 'Авторские' : 'Signature' },
    { key: 'preorder', label: lang === 'ru' ? 'Предзаказ' : 'Preorder' },
  ];

  const sortOptions: { key: SortType; label: string }[] = [
    { key: 'newest', label: lang === 'ru' ? 'Новинки' : 'Newest' },
    { key: 'oldest', label: lang === 'ru' ? 'Старые' : 'Oldest' },
    { key: 'cheap', label: lang === 'ru' ? 'Дешевле' : 'Cheapest' },
    { key: 'expensive', label: lang === 'ru' ? 'Дороже' : 'Most expensive' },
  ];

  const sortedProducts = [...products].sort((a, b) => {
    // Author products always pinned first
    if (a.isAuthor !== b.isAuthor) return a.isAuthor ? -1 : 1;
    switch (sort) {
      case 'newest': return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      case 'oldest': return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
      case 'cheap': return a.price - b.price;
      case 'expensive': return b.price - a.price;
      default: return 0;
    }
  });

  return (
    <main>
      <section className="catalog-section">
        <h1 className="catalog-heading anim-fade-up">{t(lang, 'catalog.title')}</h1>

        {/* Filters + Sort in one row */}
        <div className="catalog-toolbar anim-fade-up">
          <div className="catalog-filters">
            {filters.map((f) => (
              <button
                key={f.key}
                className={`catalog-filter-btn ${filter === f.key ? 'active' : ''}`}
                onClick={() => setFilter(f.key)}
              >
                {f.label}
              </button>
            ))}
          </div>
          <div className="catalog-sort-wrapper">
            <span className="catalog-sort-icon">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 6h18M7 12h10M11 18h2" />
              </svg>
            </span>
            <select
              className="catalog-sort-select"
              value={sort}
              onChange={(e) => setSort(e.target.value as SortType)}
            >
              {sortOptions.map(s => (
                <option key={s.key} value={s.key}>{s.label}</option>
              ))}
            </select>
          </div>
        </div>

        {loading ? (
          <div className="catalog-grid" aria-busy="true" aria-label={lang === 'ru' ? 'Загрузка каталога' : 'Loading catalog'}>
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="catalog-card catalog-skeleton-card">
                <div className="catalog-card-image aspect-4-3 catalog-skeleton-media" />
                <div className="catalog-card-info">
                  <div className="catalog-skeleton-line catalog-skeleton-line-lg" />
                  <div className="catalog-skeleton-line catalog-skeleton-line-sm" />
                </div>
              </div>
            ))}
          </div>
        ) : sortedProducts.length === 0 ? (
          <div className="catalog-empty">
            {lang === 'ru' ? 'Товары не найдены' : 'No products found'}
          </div>
        ) : (
          <div className="catalog-grid">
            {sortedProducts.map((product, index) => {
              const imgs: string[] = (() => { try { return JSON.parse(product.images) || []; } catch { return []; } })();
              const heroImg = product.image || imgs[0] || '';
              const displayName = lang === 'ru' && product.nameRu ? product.nameRu : product.name;
              const price = product.price;
              const soldOut = product.isSoldOut || product.stock <= 0 || !product.inStock;
              return (
                <Link 
                  href={`/${product.slug}`} 
                  key={product.id} 
                  className={`catalog-card anim-fade-up anim-fade-up-d${Math.min(index + 1, 5)}`}
                >
                  <div className="catalog-card-image aspect-4-3">
                    {heroImg && (
                      <Image
                        src={heroImg}
                        alt={displayName}
                        fill
                        className="object-cover"
                        sizes="(max-width: 640px) 100vw, 50vw"
                        quality={85}
                      />
                    )}
                    {soldOut && (
                      <span className="catalog-sold-out-badge">Sold Out</span>
                    )}
                    <div className="catalog-card-badges">
                      {product.isAuthor && <span className="badge badge-author"><svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: 4, display: 'inline-block', verticalAlign: 'middle' }}><line x1="12" y1="17" x2="12" y2="22"/><path d="M5 17h14v-1.76a2 2 0 00-1.11-1.79l-1.78-.9A2 2 0 0115 10.76V6h1a2 2 0 000-4H8a2 2 0 000 4h1v4.76a2 2 0 01-1.11 1.79l-1.78.9A2 2 0 005 15.24V17z"/></svg>{lang === 'ru' ? 'Авторская' : 'Signature'}</span>}
                      {product.isPreorder && <span className="badge badge-preorder">{lang === 'ru' ? 'Предзаказ' : 'Preorder'}</span>}
                      {product.discount > 0 && <span className="badge badge-discount">-{product.discount}%</span>}
                      {(() => { try { const bs: Array<{text:string;textEn?:string;icon:string;color:string}> = JSON.parse(product.customBadges || '[]'); return bs.map((b, bi) => <span key={bi} style={{ display: 'inline-flex', alignItems: 'center', padding: '2px 8px', borderRadius: 20, fontSize: '9px', fontWeight: 700, background: b.color + '22', color: b.color, border: `1px solid ${b.color}55` }}>{lang === 'ru' ? b.text : (b.textEn || b.text)}</span>); } catch { return null; } })()}
                    </div>
                  </div>
                  <div className="catalog-card-info">
                    <p className="catalog-card-name">{displayName}</p>
                    <p className="catalog-card-price">{product.isSaleDisabled ? 'Скоро' : `${price.toLocaleString('ru-RU')} ₽`}</p>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </section>
    </main>
  );
}
