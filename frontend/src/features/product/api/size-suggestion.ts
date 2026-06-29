import { apiFetch } from '@/lib/api/client';
import type { components } from '@/lib/api/schema';

export type SizeSuggestion = components['schemas']['SizeSuggestionResponseDto'];

// GET /products/:slug/size-suggestion — rule-based suggested size for the current
// user (auth required; reads the caller's own measurements).
export function getSizeSuggestion(
  slug: string,
  signal?: AbortSignal,
): Promise<SizeSuggestion> {
  return apiFetch<SizeSuggestion>(
    `/products/${encodeURIComponent(slug)}/size-suggestion`,
    { signal },
  );
}
