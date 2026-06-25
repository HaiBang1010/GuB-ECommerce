import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import {
  adminReplyToReview,
  createReview,
  getProductReviews,
  updateReview,
  type AdminReplyBody,
  type CreateReviewBody,
  type UpdateReviewBody,
} from '@/lib/api/reviews';

// Public storefront read of a product's reviews + rating aggregate (no auth).
export function useProductReviews(productId: string) {
  return useQuery({
    queryKey: ['reviews', productId],
    queryFn: ({ signal }) => getProductReviews(productId, signal),
    enabled: !!productId,
  });
}

// Create a purchased-only review; refresh that product's review list so the order
// page flips to "edit" and the product page shows the new review.
export function useCreateReview() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: CreateReviewBody) => createReview(body),
    onSuccess: (data) => {
      void qc.invalidateQueries({ queryKey: ['reviews', data.productId] });
    },
  });
}

// Edit the caller's own review (rating / body). Same invalidation off the
// returned review's productId.
export function useUpdateReview() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, body }: { id: string; body: UpdateReviewBody }) =>
      updateReview(id, body),
    onSuccess: (data) => {
      void qc.invalidateQueries({ queryKey: ['reviews', data.productId] });
    },
  });
}

// Admin: post a store reply to a review. Refresh that product's review list so the
// reply renders and the inline form disappears.
export function useAdminReplyToReview() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, body }: { id: string; body: AdminReplyBody }) =>
      adminReplyToReview(id, body),
    onSuccess: (data) => {
      void qc.invalidateQueries({ queryKey: ['reviews', data.productId] });
    },
  });
}
