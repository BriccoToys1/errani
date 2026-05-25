'use client';

import { useEffect, useState, useCallback, useRef } from 'react';

type Review = {
  id: string;
  customerName: string;
  rating: number;
  text: string;
  media: string[];
};

export default function ReviewsCarousel() {
  const [reviews, setReviews] = useState<Review[]>([]);
  const [current, setCurrent] = useState(0);
  const [visible, setVisible] = useState(true);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    fetch('/api/reviews/public?all=true')
      .then((r) => r.json())
      .then((data) => {
        if (data.success && Array.isArray(data.reviews)) {
          setReviews(data.reviews.filter((r: Review) => r.text && r.text.trim().length > 0));
        }
      })
      .catch(() => {});
  }, []);

  const goTo = useCallback((index: number) => {
    setVisible(false);
    setTimeout(() => {
      setCurrent(index);
      setVisible(true);
    }, 280);
  }, []);

  const next = useCallback(() => {
    if (reviews.length === 0) return;
    goTo((current + 1) % reviews.length);
  }, [current, reviews.length, goTo]);

  const prev = useCallback(() => {
    if (reviews.length === 0) return;
    goTo((current - 1 + reviews.length) % reviews.length);
  }, [current, reviews.length, goTo]);

  useEffect(() => {
    if (reviews.length < 2) return;
    timerRef.current = setTimeout(next, 5000);
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [current, reviews.length, next]);

  if (reviews.length === 0) return null;

  const review = reviews[current];

  return (
    <section className="reviews-carousel-section">
      <div className="reviews-carousel-wrap">
        <div className={`reviews-carousel-card${visible ? ' reviews-carousel-card--visible' : ''}`}>
          <div className="reviews-carousel-header">
            <span className="reviews-carousel-name">{review.customerName}</span>
            <span className="reviews-carousel-rating">
              {review.rating.toFixed(1)} <span className="reviews-carousel-star">★</span>
            </span>
          </div>
          <p className="reviews-carousel-text">{review.text}</p>
        </div>

        {reviews.length > 1 && (
          <div className="reviews-carousel-controls">
            <button
              className="reviews-carousel-arrow"
              onClick={prev}
              aria-label="Предыдущий отзыв"
            >
              ‹
            </button>
            <div className="reviews-carousel-dots">
              {reviews.map((_, i) => (
                <button
                  key={i}
                  className={`reviews-carousel-dot${i === current ? ' reviews-carousel-dot--active' : ''}`}
                  onClick={() => goTo(i)}
                  aria-label={`Отзыв ${i + 1}`}
                />
              ))}
            </div>
            <button
              className="reviews-carousel-arrow"
              onClick={next}
              aria-label="Следующий отзыв"
            >
              ›
            </button>
          </div>
        )}
      </div>
    </section>
  );
}
