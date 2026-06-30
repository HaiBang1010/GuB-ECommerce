import { apiFetch } from '@/lib/api/client';
import type { components } from '@/lib/api/schema';

export type Banner = components['schemas']['BannerResponseDto'];
export type CreateBannerBody = components['schemas']['CreateBannerDto'];
export type UpdateBannerBody = components['schemas']['UpdateBannerDto'];

// GET /admin/banners — all non-archived banners (incl. inactive). ADMIN-only on the
// backend; small list, so unpaginated (mirrors categories/sales).
export function getAdminBanners(signal?: AbortSignal): Promise<Banner[]> {
  return apiFetch<Banner[]>('/admin/banners', { signal });
}

// POST /admin/banners — create.
export function createBanner(body: CreateBannerBody): Promise<Banner> {
  return apiFetch<Banner>('/admin/banners', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

// PATCH /admin/banners/:id — update (also used for the inline isActive toggle).
export function updateBanner(
  id: string,
  body: UpdateBannerBody,
): Promise<Banner> {
  return apiFetch<Banner>(`/admin/banners/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

// DELETE /admin/banners/:id — archive (soft delete).
export function archiveBanner(id: string): Promise<Banner> {
  return apiFetch<Banner>(`/admin/banners/${encodeURIComponent(id)}`, {
    method: 'DELETE',
  });
}
