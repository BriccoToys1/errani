'use client';

import { useEffect, useRef, useState } from 'react';

type Review = {
  id: string;
  customerName: string;
  rating: number;
  text: string;
  media: string[];
};

// px of scroll travel per card transition
const SCROLL_PER_CARD = 300;

interface Props {
  slug?: string;
  lang?: string;
  heading?: string;
}

function lerp(a: number, b: number, t: number) {
  return a + (b - a) * Math.max(0, Math.min(1, t));
}

// Maps a card's continuous "depth" (progress - cardIndex) to visual transform values.
// depth 0  = fully active  |  depth 1 = one behind  |  depth -1 = next card below
function resolveCardStyle(depth: number) {
  if (depth < -1.01 || depth > 3.01) return null;
  const zIndex = Math.round(200 - depth * 10);
  let scale: number, opacity: number, ty: number;

  if (depth <= 0) {
    // Entering: slides up from below into active position
    const t = depth + 1; // 0→1
    scale   = lerp(0.92, 1,   t);
    opacity = lerp(0,    1,   t);
    ty      = lerp(90,   0,   t);
  } else if (depth <= 1) {
    // Active → one behind
    const t = depth;
    scale   = lerp(1,    0.92,  t);
    opacity = lerp(1,    0.72,  t);
    ty      = lerp(0,   -30,    t);
  } else if (depth <= 2) {
    // One behind → two behind
    const t = depth - 1;
    scale   = lerp(0.92, 0.84,  t);
    opacity = lerp(0.72, 0.38,  t);
    ty      = lerp(-30,  -50,   t);
  } else {
    // Two behind → fading out
    const t = depth - 2;
    scale   = lerp(0.84, 0.76,  t);
    opacity = lerp(0.38, 0,     t);
    ty      = lerp(-50,  -60,   t);
  }

  return { scale, opacity, ty, zIndex };
}

export default function ReviewsStack({ slug, lang = 'ru', heading }: Props) {
  const [reviews, setReviews] = useState<Review[]>([]);
  const [progress, setProgress] = useState(0);
  const outerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const url = slug
      ? `/api/reviews/public?slug=${encodeURIComponent(slug)}`
      : '/api/reviews/public?all=true';
    fetch(url)
      .then(r => r.json())
      .then(d => {
        if (d.success) setReviews((d.reviews ?? []).filter((r: Review) => r.text?.trim()));
      })
      .catch(() => {});
  }, [slug]);

  useEffect(() => {
    const onScroll = () => {
      if (!outerRef.current) return;
      const { top } = outerRef.current.getBoundingClientRect();
      setProgress(Math.max(0, -top / SCROLL_PER_CARD));
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  if (!reviews.length) return null;

  const n = reviews.length;
  // Clamp so last card stays fully active instead of disappearing
  const p = Math.min(progress, n - 0.001);

  return (
    <>
      {heading && (
        <div style={{ padding: '3rem 1.5rem 0', maxWidth: '680px', margin: '0 auto' }}>
          <h2 className="description-heading">{heading}</h2>
        </div>
      )}

      {/* Outer: tall enough to scroll through all cards */}
      <div
        ref={outerRef}
        style={{ position: 'relative', height: `calc(${SCROLL_PER_CARD * (n - 1)}px + 100vh)` }}
      >
        {/* Sticky window */}
        <div
          style={{
            position: 'sticky',
            top: 0,
            height: '100vh',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            overflow: 'hidden',
          }}
        >
          {/* Card stage */}
          <div
            style={{
              position: 'relative',
              width: '90%',
              maxWidth: '620px',
              height: 'clamp(300px, 42vh, 460px)',
            }}
          >
            {reviews.map((review, i) => {
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
                  <div
                    style={{
                      background: '#161616',
                      border: '1px solid rgba(255,255,255,0.09)',
                      borderRadius: '20px',
                      padding: '28px 26px',
                      height: '100%',
                      overflow: 'hidden',
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
                        overflow: 'hidden',
                        display: '-webkit-box',
                        WebkitLineClamp: 9,
                        WebkitBoxOrient: 'vertical' as const,
                        flex: 1,
                      }}
                    >
                      {review.text}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </>
  );
}
