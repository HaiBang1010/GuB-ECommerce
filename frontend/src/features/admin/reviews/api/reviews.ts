import { apiFetch } from '@/lib/api/client';
import type { components } from '@/lib/api/schema';
import type { Review } from '@/features/review/api/reviews';

export type AdminReplyBody = components['schemas']['AdminReplyDto'];
// Admin list row = review + enriched product name + reviewer identity.
export type AdminReview = components['schemas']['AdminReviewResponseDto'];
export type PaginatedAdminReviews =
  components['schemas']['PaginatedAdminReviewsResponseDto'];

// GET /admin/reviews — every review, paginated, optionally filtered by reply state,
// each enriched with product name + reviewer info. ADMIN-only on the backend.
export function getAdminReviews(
  params: { page?: number; pageSize?: number; replied?: boolean } = {},
  signal?: AbortSignal,
): Promise<PaginatedAdminReviews> {
  const qs = new URLSearchParams();
  if (params.page) qs.set('page', String(params.page));
  if (params.pageSize) qs.set('pageSize', String(params.pageSize));
  if (params.replied !== undefined) qs.set('replied', String(params.replied));
  const q = qs.toString();
  return apiFetch<PaginatedAdminReviews>(
    `/admin/reviews${q ? `?${q}` : ''}`,
    { signal },
  );
}

// POST /admin/reviews/:id/reply — store reply to a review. ADMIN-only on the
// backend (RoleGuard). Returns the updated review (carries adminReply/adminReplyAt).
export function adminReplyToReview(
  id: string,
  body: AdminReplyBody,
): Promise<Review> {
  return apiFetch<Review>(`/admin/reviews/${encodeURIComponent(id)}/reply`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}
