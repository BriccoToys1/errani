'use client';

import { useEffect, useState, useCallback, useRef } from 'react';

type Review = {
  id: string;
  customerName: string;
  rating: number;
  text: string;
};

type Transition = {
  fromIdx: number;
  toIdx: number;
  dir: 1 | -1; // 1 = next (exits left), -1 = prev (exits right)
};

const DURATION = 380;

export default function ReviewsCarousel() {
  const [reviews, setReviews] = useState<Review[]>([]);
  const [current, setCurrent] = useState(0);
  const [trans, setTrans] = useState<Transition | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const transitioning = trans !== null;

  useEffect(() => {
    fetch('/api/reviews/public?all=true')
      .then((r) => r.json())
      .then((data) => {
        if (data.success && Array.isArray(data.reviews)) {
          setReviews(data.reviews.filter((r: Review) => r.text?.trim()));
        }
      })
      .catch(() => {});
  }, []);

  const navigate = useCallback((dir: 1 | -1) => {
    if (transitioning) return;
    setTrans((prev) => {
      const from = prev ? prev.toIdx : current;
      const to = (from + dir + reviews.length) % reviews.length;
      return { fromIdx: from, toIdx: to, dir };
    });
    setTimeout(() => {
      setCurrent((c) => {
        setTrans((t) => {
          if (t) setCurrent(t.toIdx);
          return null;
        });
        return c;
      });
    }, DURATION);
  }, [transitioning, current, reviews.length]);

  // simpler navigate that avoids closure issues
  const go = useCallback((dir: 1 | -1) => {
    if (transitioning || reviews.length < 2) return;
    const to = (current + dir + reviews.length) % reviews.length;
    setTrans({ fromIdx: current, toIdx: to, dir });
    setTimeout(() => {
      setCurrent(to);
      setTrans(null);
    }, DURATION);
  }, [transitioning, current, reviews.length]);

  const goTo = useCallback((idx: number) => {
    if (transitioning || idx === current || reviews.length < 2) return;
    const dir: 1 | -1 = idx > current ? 1 : -1;
    setTrans({ fromIdx: current, toIdx: idx, dir });
    setTimeout(() => {
      setCurrent(idx);
      setTrans(null);
    }, DURATION);
  }, [transitioning, current, reviews.length]);

  useEffect(() => {
    if (reviews.length < 2) return;
    timerRef.current = setTimeout(() => go(1), 5000);
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [current, reviews.length, go]);

  if (reviews.length === 0) return null;

  const displayCurrent = trans ? reviews[trans.fromIdx] : reviews[current];
  const displayEntering = trans ? reviews[trans.toIdx] : null;

  // leaving: exits left (dir=1) or right (dir=-1)
  // entering: enters from right (dir=1) or from left (dir=-1)
  const leaveClass = trans
    ? trans.dir === 1 ? 'rc-card--leave-left' : 'rc-card--leave-right'
    : '';
  const enterClass = trans
    ? trans.dir === 1 ? 'rc-card--enter-right' : 'rc-card--enter-left'
    : '';

  return (
    <section className="rc-section">
      <div className="rc-wrap">
        <div className="rc-track">
          {/* leaving card */}
          {trans && (
            <div key={`leave-${trans.fromIdx}`} className={`rc-card ${leaveClass}`}>
              <CardInner review={displayCurrent} />
            </div>
          )}
          {/* entering / static card */}
          <div key={`enter-${trans ? trans.toIdx : current}`} className={`rc-card${trans ? ` ${enterClass}` : ''}`}>
            <CardInner review={displayEntering ?? displayCurrent} />
          </div>
        </div>

        {reviews.length > 1 && (
          <div className="rc-controls">
            <button className="rc-arrow" onClick={() => go(-1)} aria-label="Предыдущий отзыв">‹</button>
            <div className="rc-dots">
              {reviews.map((_, i) => (
                <button
                  key={i}
                  className={`rc-dot${i === (trans ? trans.toIdx : current) ? ' rc-dot--active' : ''}`}
                  onClick={() => goTo(i)}
                  aria-label={`Отзыв ${i + 1}`}
                />
              ))}
            </div>
            <button className="rc-arrow" onClick={() => go(1)} aria-label="Следующий отзыв">›</button>
          </div>
        )}
      </div>
    </section>
  );
}

function CardInner({ review }: { review: Review }) {
  return (
    <>
      <div className="rc-card-header">
        <span className="rc-card-rating">
          {review.rating.toFixed(1)} <span className="rc-star">★</span>
        </span>
      </div>
      <p className="rc-card-text">{review.text}</p>
    </>
  );
}
