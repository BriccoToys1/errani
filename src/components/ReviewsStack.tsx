'use client';

import { useEffect, useMemo, useRef, useState } from 'react';

type Review = {
  id: string;
  customerName: string;
  rating: number;
  text: string;
  media: string[];
};

const SCROLL_PER_CARD = 300;
const INITIAL_VISIBLE = 3;
const LOAD_MORE_STEP = 5;
const HEADER_OFFSET = 72;

interface Props {
  slug?: string;
  lang?: string;
  heading?: string;
}

function lerp(a: number, b: number, t: number) {
  return a + (b - a) * Math.max(0, Math.min(1, t));
}

function resolveCardStyle(depth: number) {
  if (depth < -1.01 || depth > 3.01) return null;
  const zIndex = Math.round(200 - depth * 10);
  let scale: number;
  let opacity: number;
  let ty: number;

  if (depth <= 0) {
    const t = depth + 1;
    scale = lerp(0.92, 1, t);
    opacity = lerp(0, 1, t);
    ty = lerp(90, 0, t);
  } else if (depth <= 1) {
    const t = depth;
    scale = lerp(1, 0.92, t);
    opacity = lerp(1, 0.72, t);
    ty = lerp(0, 42, t);   // slides DOWN → peeks below active card
  } else if (depth <= 2) {
    const t = depth - 1;
    scale = lerp(0.92, 0.84, t);
    opacity = lerp(0.72, 0.38, t);
    ty = lerp(42, 70, t);
  } else {
    const t = depth - 2;
    scale = lerp(0.84, 0.76, t);
    opacity = lerp(0.38, 0, t);
    ty = lerp(70, 88, t);
  }

  return { scale, opacity, ty, zIndex };
}

function ReviewCard({ review, lang }: { review: Review; lang: string }) {
  return (
    <div
      style={{
        background: '#161616',
        border: '1px solid rgba(255,255,255,0.09)',
        borderRadius: '20px',
        padding: '28px 26px',
        boxShadow: '0 16px 48px rgba(0,0,0,0.65)',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '16px',
          flexShrink: 0,
        }}
      >
        <span style={{ fontWeight: 700, fontSize: '1.05rem', color: 'var(--text-primary, #fff)' }}>
          {(review.customerName || '').split(' ')[0] || (lang === 'ru' ? 'Клиент' : 'Customer')}
        </span>
        <span style={{ color: '#ffb400', fontWeight: 600, fontSize: '0.95rem', letterSpacing: '0.02em' }}>
          {review.rating.toFixed(1)} ★
        </span>
      </div>
      <p
        style={{
          margin: 0,
          lineHeight: 1.75,
          color: 'rgba(255,255,255,0.66)',
          fontSize: '0.92rem',
          whiteSpace: 'pre-wrap',
        }}
      >
        {review.text}
      </p>
    </div>
  );
}

export default function ReviewsStack({ slug, lang = 'ru', heading }: Props) {
  const [reviews, setReviews] = useState<Review[]>([]);
  const [visibleCount, setVisibleCount] = useState(INITIAL_VISIBLE);
  const [progress, setProgress] = useState(0);
  const outerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const url = slug
      ? `/api/reviews/public?slug=${encodeURIComponent(slug)}`
      : '/api/reviews/public?all=true';
    fetch(url)
      .then((r) => r.json())
      .then((d) => {
        if (d.success) {
          const filtered = (d.reviews ?? []).filter((r: Review) => r.text?.trim());
          setReviews(filtered);
          setVisibleCount(Math.min(INITIAL_VISIBLE, filtered.length));
        }
      })
      .catch(() => {});
  }, [slug]);

  const visibleReviews = useMemo(() => reviews.slice(0, visibleCount), [reviews, visibleCount]);

  useEffect(() => {
    const onScroll = () => {
      if (!outerRef.current) return;
      const { top } = outerRef.current.getBoundingClientRect();
      setProgress(Math.max(0, -top / SCROLL_PER_CARD));
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
    return () => window.removeEventListener('scroll', onScroll);
  }, [visibleCount]);

  if (!visibleReviews.length) return null;

  const n = visibleReviews.length;
  const p = Math.min(progress, n - 0.001);
  const activeIndex = Math.min(Math.floor(p), n - 1);
  const activeReview = visibleReviews[activeIndex];

  return (
    <>
      <div
        ref={outerRef}
        style={{ position: 'relative', height: `calc(${SCROLL_PER_CARD * Math.max(n - 1, 0)}px + 100vh)` }}
      >
        <div
          style={{
            position: 'sticky',
            top: `${HEADER_OFFSET}px`,
            minHeight: `calc(100vh - ${HEADER_OFFSET}px)`,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            overflow: 'hidden',
            padding: '0.1rem 0.25rem 0.35rem',
          }}
        >
          {heading && (
            <div style={{ width: '100%', maxWidth: '680px', margin: '0 auto', padding: '0 1.5rem 0.25rem' }}>
              <h2 className="description-heading">{heading}</h2>
            </div>
          )}

          <div
            style={{
              position: 'relative',
              width: '90%',
              maxWidth: '620px',
            }}
          >
            {/* ghost sets container height; paddingBottom leaves room for depth-1 card peeking below */}
            <div style={{ visibility: 'hidden', pointerEvents: 'none', paddingBottom: '52px' }}>
              <ReviewCard review={activeReview} lang={lang} />
            </div>

            {visibleReviews.map((review, i) => {
              const cs = resolveCardStyle(p - i);
              if (!cs) return null;
              const { scale, opacity, ty, zIndex } = cs;

              return (
                <div
                  key={review.id}
                  style={{
                    position: 'absolute',
                    inset: 0,
                    transform: `translateY(${ty}px) scale(${scale})`,
                    opacity,
                    zIndex,
                    transformOrigin: 'top center',
                    willChange: 'transform, opacity',
                  }}
                >
                  <ReviewCard review={review} lang={lang} />
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {visibleCount < reviews.length && (
        <div style={{ display: 'flex', justifyContent: 'center', padding: '0.75rem 1.5rem 2.5rem' }}>
          <button
            type="button"
            onClick={() => setVisibleCount((prev) => Math.min(prev + LOAD_MORE_STEP, reviews.length))}
            style={{
              padding: '0.85rem 1.5rem',
              borderRadius: 999,
              border: '1px solid rgba(232,114,42,0.55)',
              background: 'rgba(232,114,42,0.08)',
              color: '#E8722A',
              fontSize: '0.9rem',
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            {lang === 'ru' ? 'Показать больше' : 'Show more'}
          </button>
        </div>
      )}
    </>
  );
}
