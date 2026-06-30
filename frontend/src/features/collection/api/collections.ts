import { apiFetch } from '@/lib/api/client';
import type { components } from '@/lib/api/schema';
import type { Product } from '@/features/product/api/products';

// Public storefront collection shape, sourced from the backend OpenAPI schema.
export type Collection = components['schemas']['CollectionResponseDto'];

// GET /collections?featured=true — PUBLIC. Active, home-featured collections, already
// ordered by homeSortOrder server-side (powers the home showcase rows).
export function getFeaturedCollections(
  signal?: AbortSignal,
): Promise<Collection[]> {
  return apiFetch<Collection[]>('/collections?featured=true', { signal });
}

// GET /collections/:slug — PUBLIC. One active collection (used for the page heading).
export function getCollection(
  slug: string,
  signal?: AbortSignal,
): Promise<Collection> {
  return apiFetch<Collection>(`/collections/${encodeURIComponent(slug)}`, {
    signal,
  });
}

// GET /collections/:slug/products — PUBLIC. Active products in a collection, each with
// a primaryImageUrl (the backend attaches cover images).
export function getCollectionProducts(
  slug: string,
  signal?: AbortSignal,
): Promise<Product[]> {
  return apiFetch<Product[]>(
    `/collections/${encodeURIComponent(slug)}/products`,
    { signal },
  );
}
