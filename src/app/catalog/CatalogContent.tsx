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
  images: string[];
  isHit: boolean;
  isAuthor: boolean;
  isPreorder: boolean;
  isActive: boolean;
}

type FilterType = 'all' | 'hits' | 'author' | 'discount' | 'preorder';

export function CatalogContent() {
  const { lang } = useLanguage();
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<FilterType>('all');

  useEffect(() => {
    fetchProducts();
  }, [filter]);

  const fetchProducts = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filter === 'hits') params.set('hits', 'true');
      if (filter === 'author') params.set('author', 'true');
      if (filter === 'discount') params.set('discount', 'true');
      if (filter === 'preorder') params.set('preorder', 'true');
      
      const res = await fetch(`/api/products?${params.toString()}`);
      const data = await res.json();
      setProducts(data.filter((p: Product) => p.isActive));
    } catch (error) {
      console.error('Failed to fetch products:', error);
    } finally {
      setLoading(false);
    }
  };

  const filters: { key: FilterType; label: string }[] = [
    { key: 'all', label: lang === 'ru' ? 'Все' : 'All' },
    { key: 'hits', label: lang === 'ru' ? 'Хиты' : 'Hits' },
    { key: 'author', label: lang === 'ru' ? 'Авторские' : 'Author' },
    { key: 'discount', label: lang === 'ru' ? 'Скидки' : 'Sale' },
    { key: 'preorder', label: lang === 'ru' ? 'Предзаказ' : 'Preorder' },
  ];

  const formatPrice = (price: number) => {
    return lang === 'ru' 
      ? `${price.toLocaleString('ru-RU')} ₽` 
      : `$${(price / 90).toFixed(0)}`;
  };

  return (
    <main>
      <section className="catalog-section">
        <h1 className="catalog-heading anim-fade-up">{t(lang, 'catalog.title')}</h1>

        <div className="catalog-filters anim-fade-up">
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

        {loading ? (
          <div className="catalog-loading">
            <div className="spinner" />
          </div>
        ) : products.length === 0 ? (
          <div className="catalog-empty">
            {lang === 'ru' ? 'Товары не найдены' : 'No products found'}
          </div>
        ) : (
          <div className="catalog-grid">
            {products.map((product, index) => (
              <Link 
                href={`/${product.slug}`} 
                key={product.id} 
                className={`catalog-card anim-fade-up anim-fade-up-d${Math.min(index + 1, 5)}`}
              >
                <div className="catalog-card-image aspect-4-3">
                  {product.images[0] && (
                    <Image
                      src={product.images[0]}
                      alt={lang === 'ru' && product.nameRu ? product.nameRu : product.name}
                      fill
                      className="object-cover"
                      sizes="(max-width: 768px) 100vw, 300px"
                      quality={85}
                    />
                  )}
                  <div className="catalog-card-badges">
                    {product.isHit && <span className="badge badge-hit">{lang === 'ru' ? 'Хит' : 'Hit'}</span>}
                    {product.isAuthor && <span className="badge badge-author">{lang === 'ru' ? 'Авторская' : 'Author'}</span>}
                    {product.discount > 0 && <span className="badge badge-discount">-{product.discount}%</span>}
                    {product.isPreorder && <span className="badge badge-preorder">{lang === 'ru' ? 'Предзаказ' : 'Preorder'}</span>}
                  </div>
                </div>
                <div className="catalog-card-info">
                  <h2 className="catalog-card-title">
                    {lang === 'ru' && product.nameRu ? product.nameRu : product.name}
                  </h2>
                  {product.description && (
                    <p className="catalog-card-desc">
                      {lang === 'ru' && product.descriptionRu ? product.descriptionRu : product.description}
                    </p>
                  )}
                  <div className="catalog-card-price-row">
                    <span className="catalog-card-price">{formatPrice(product.price)}</span>
                    {product.oldPrice && (
                      <span className="catalog-card-old-price">{formatPrice(product.oldPrice)}</span>
                    )}
                  </div>
                  <span className="catalog-card-link">
                    {t(lang, 'catalog.view')}
                    <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
                    </svg>
                  </span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
