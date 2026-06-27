import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';

import { useAuthStore } from '@/stores/auth.store';
import {
  adminReplyToReview,
  createReview,
  getAdminReviews,
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

// Admin: a paginated page of all reviews, optionally filtered by reply state, each
// enriched with product + reviewer info. Gated to a logged-in user; the backend
// RoleGuard rejects non-admins. keepPreviousData avoids a flash when paging/filtering.
export function useAdminReviews(
  page = 1,
  pageSize = 10,
  replied?: boolean,
) {
  const authLoading = useAuthStore((s) => s.isLoading);
  const user = useAuthStore((s) => s.user);
  return useQuery({
    queryKey: ['admin', 'reviews', { page, pageSize, replied }],
    queryFn: ({ signal }) =>
      getAdminReviews({ page, pageSize, replied }, signal),
    enabled: !authLoading && !!user,
    placeholderData: keepPreviousData,
  });
}

// Admin: post a store reply to a review. Refresh both that product's storefront
// review list (inline reply on the product page) AND the admin reviews list (so the
// reply renders / the filter updates immediately).
export function useAdminReplyToReview() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, body }: { id: string; body: AdminReplyBody }) =>
      adminReplyToReview(id, body),
    onSuccess: (data) => {
      void qc.invalidateQueries({ queryKey: ['reviews', data.productId] });
      void qc.invalidateQueries({ queryKey: ['admin', 'reviews'] });
    },
  });
}
