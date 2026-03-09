'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useLanguage } from '@/contexts/LanguageContext';
import { t } from '@/lib/i18n';
import { addToCart } from '@/lib/cart';
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
  image: string;
  images: string;
  isAuthor: boolean;
  isPreorder: boolean;
  isActive: boolean;
}

type FilterType = 'all' | 'author' | 'preorder';

export function CatalogContent() {
  const { lang } = useLanguage();
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<FilterType>('all');
  const [addedIds, setAddedIds] = useState<Set<string>>(new Set());

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
      // Sort: авторские колоды first
      const sorted = data
        .filter((p: Product) => p.isActive)
        .sort((a: Product, b: Product) => {
          if (a.isAuthor && !b.isAuthor) return -1;
          if (!a.isAuthor && b.isAuthor) return 1;
          return 0;
        });
      setProducts(sorted);
    } catch (error) {
      console.error('Failed to fetch products:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleAddToCart = (e: React.MouseEvent, product: Product) => {
    e.preventDefault();
    e.stopPropagation();
    const imgs: string[] = (() => { try { return JSON.parse(product.images) || []; } catch { return []; } })();
    addToCart({
      productId: product.id,
      name: lang === 'ru' && product.nameRu ? product.nameRu : product.name,
      price: product.price,
      currency: 'RUB',
      image: product.image || imgs[0] || '',
      isPreorder: product.isPreorder,
    });
    setAddedIds(prev => { const n = new Set(prev); n.add(product.id); return n; });
    setTimeout(() => setAddedIds(prev => { const n = new Set(prev); n.delete(product.id); return n; }), 2000);
  };

  const filters: { key: FilterType; label: string }[] = [
    { key: 'all', label: lang === 'ru' ? 'Все' : 'All' },
    { key: 'author', label: lang === 'ru' ? 'Авторские' : 'Author' },
    { key: 'preorder', label: lang === 'ru' ? 'Предзаказ' : 'Preorder' },
  ];

  const formatPrice = (price: number) =>
    `${price.toLocaleString('ru-RU')} ₽`;

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
            {products.map((product, index) => {
              const imgs: string[] = (() => { try { return JSON.parse(product.images) || []; } catch { return []; } })();
              const heroImg = product.image || imgs[0] || '';
              const displayName = lang === 'ru' && product.nameRu ? product.nameRu : product.name;
              const isAdded = addedIds.has(product.id);
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
                        sizes="(max-width: 768px) 100vw, 300px"
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
                    >
                      {isAdded ? (lang === 'ru' ? '✓ Добавлено' : '✓ Added') : t(lang, 'catalog.view')}
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
