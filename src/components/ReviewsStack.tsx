'use client';

import { useEffect, useMemo, useState } from 'react';

type Review = {
  id: string;
  customerName: string;
  rating: number;
  text: string;
  media: string[];
};

const INITIAL_VISIBLE = 3;
const LOAD_MORE_STEP = 5;

interface Props {
  slug?: string;
  lang?: string;
  heading?: string;
}

function ReviewCard({ review, lang }: { review: Review; lang: string }) {
  return (
    <article className="review-list-card">
      <div className="review-list-card-header">
        <span className="review-list-author">
          {(review.customerName || '').split(' ')[0] || (lang === 'ru' ? 'Клиент' : 'Customer')}
        </span>
        <span className="review-list-rating">{review.rating.toFixed(1)} ★</span>
      </div>
      <p className="review-list-text">{review.text}</p>
    </article>
  );
}

export default function ReviewsStack({ slug, lang = 'ru', heading }: Props) {
  const [reviews, setReviews] = useState<Review[]>([]);
  const [visibleCount, setVisibleCount] = useState(INITIAL_VISIBLE);

  useEffect(() => {
    const url = slug
      ? `/api/reviews/public?slug=${encodeURIComponent(slug)}`
      : '/api/reviews/public?all=true';
    fetch(url)
      .then((response) => response.json())
      .then((data) => {
        if (data.success) {
          const filtered = (data.reviews ?? []).filter((review: Review) => review.text?.trim());
          setReviews(filtered);
          setVisibleCount(Math.min(INITIAL_VISIBLE, filtered.length));
        }
      })
      .catch(() => {});
  }, [slug]);

  const visibleReviews = useMemo(() => reviews.slice(0, visibleCount), [reviews, visibleCount]);

  if (!visibleReviews.length) return null;

  return (
    <section className="description-section reviews-list-section">
      {heading && <h2 className="description-heading">{heading}</h2>}

      <div className="reviews-list">
        {visibleReviews.map((review) => (
          <ReviewCard key={review.id} review={review} lang={lang} />
        ))}
      </div>

      {visibleCount < reviews.length && (
        <div className="reviews-load-more">
          <button
            type="button"
            className="reviews-load-more-button"
            onClick={() => setVisibleCount((previous) => Math.min(previous + LOAD_MORE_STEP, reviews.length))}
          >
            {lang === 'ru' ? 'Показать больше' : 'Show more'}
          </button>
        </div>
      )}
    </section>
  );
}
