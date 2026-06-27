import { apiFetch } from '@/lib/api/client';
import type { components } from '@/lib/api/schema';

export type ProductReviews = components['schemas']['ProductReviewsResponseDto'];
export type Review = components['schemas']['ReviewResponseDto'];
export type CreateReviewBody = components['schemas']['CreateReviewDto'];
export type UpdateReviewBody = components['schemas']['UpdateReviewDto'];

// GET /products/:productId/reviews — public: a product's reviews + rating aggregate.
export function getProductReviews(
  productId: string,
  signal?: AbortSignal,
): Promise<ProductReviews> {
  return apiFetch<ProductReviews>(
    `/products/${encodeURIComponent(productId)}/reviews`,
    { signal },
  );
}

// POST /reviews — purchased-only; the backend derives productId from the order
// item, so the body never carries it.
export function createReview(body: CreateReviewBody): Promise<Review> {
  return apiFetch<Review>('/reviews', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

// PATCH /reviews/:id — edit your own review (rating / body).
export function updateReview(
  id: string,
  body: UpdateReviewBody,
): Promise<Review> {
  return apiFetch<Review>(`/reviews/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}
