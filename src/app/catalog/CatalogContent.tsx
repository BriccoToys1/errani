'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useLanguage } from '@/contexts/LanguageContext';
import { t } from '@/lib/i18n';
import { addToCart, getCart } from '@/lib/cart';
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
  image: string;
  images: string;
  isAuthor: boolean;
  isPreorder: boolean;
  isActive: boolean;
  createdAt: string;
}

type FilterType = 'all' | 'author' | 'preorder';
type SortType = 'newest' | 'oldest' | 'cheap' | 'expensive';

export function CatalogContent() {
  const { lang } = useLanguage();
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<FilterType>('all');
  const [sort, setSort] = useState<SortType>('newest');
  const [cartIds, setCartIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    // Init cart state
    const cart = getCart();
    setCartIds(new Set(cart.map(i => i.productId)));
  }, []);

  useEffect(() => {
    fetchProducts();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filter]);

  const fetchProducts = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filter === 'author') params.set('author', 'true');
      if (filter === 'preorder') params.set('preorder', 'true');
      
      const res = await fetch(`/api/products?${params.toString()}`);
      const data = await res.json();
      setProducts(Array.isArray(data) ? data.filter((p: Product) => p.isActive) : []);
    } catch (error) {
      console.error('Failed to fetch products:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleAddToCart = (e: React.MouseEvent, product: Product) => {
    e.preventDefault();
    e.stopPropagation();

    if (!product.inStock) {
      return;
    }

    if (cartIds.has(product.id)) {
      window.location.href = '/cart';
      return;
    }

    const imgs: string[] = (() => { try { return JSON.parse(product.images) || []; } catch { return []; } })();
    addToCart({
      productId: product.id,
      name: lang === 'ru' && product.nameRu ? product.nameRu : product.name,
      price: product.price,
      currency: 'RUB',
      image: product.image || imgs[0] || '',
      isPreorder: product.isPreorder,
    });
    setCartIds(prev => { const n = new Set(prev); n.add(product.id); return n; });
  };

  const filters: { key: FilterType; label: string }[] = [
    { key: 'all', label: lang === 'ru' ? 'Все' : 'All' },
    { key: 'author', label: lang === 'ru' ? 'Авторские' : 'Author' },
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

  const formatPrice = (price: number) =>
    `${price.toLocaleString('ru-RU')} ₽`;

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
          <div className="catalog-loading">
            <div className="spinner" />
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
              const isInCart = cartIds.has(product.id);
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
                    <div className="catalog-card-badges">
                      {product.isAuthor && <span className="badge badge-author"><i className="fi fi-rr-thumbtack" style={{ fontSize: 10, marginRight: 4 }} />{lang === 'ru' ? 'Авторская' : 'Author'}</span>}
                      {product.discount > 0 && <span className="badge badge-discount">-{product.discount}%</span>}
                      {product.isPreorder && <span className="badge badge-preorder">{lang === 'ru' ? 'Предзаказ' : 'Preorder'}</span>}
                    </div>
                  </div>
                  <div className="catalog-card-info">
                    <h2 className="catalog-card-title">{displayName}</h2>
                    <div className="catalog-card-price-row">
                      <span className="catalog-card-price">{formatPrice(product.price)}</span>
                      {product.oldPrice && (
                        <span className="catalog-card-old-price">{formatPrice(product.oldPrice)}</span>
                      )}
                    </div>
                    <button
                      className="catalog-card-cart-btn"
                      onClick={(e) => handleAddToCart(e, product)}
                      disabled={!product.inStock}
                      style={!product.inStock ? { opacity: 0.55, cursor: 'not-allowed' } : undefined}
                    >
                      {!product.inStock
                        ? (lang === 'ru' ? 'Недоступно' : 'Unavailable')
                        : isInCart
                          ? (lang === 'ru' ? 'Перейти в корзину' : 'Go to cart')
                          : t(lang, 'catalog.view')}
                    </button>
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
