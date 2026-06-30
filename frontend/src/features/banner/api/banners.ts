import { apiFetch } from '@/lib/api/client';
import type { components } from '@/lib/api/schema';

export type Banner = components['schemas']['BannerResponseDto'];

// GET /banners — PUBLIC. Active banners ordered by sortOrder (shown to everyone,
// including guests, on the home page).
export function getBanners(signal?: AbortSignal): Promise<Banner[]> {
  return apiFetch<Banner[]>('/banners', { signal });
}
