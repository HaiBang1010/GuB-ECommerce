import { apiFetch } from '@/lib/api/client';
import type { components } from '@/lib/api/schema';

// Storefront product shape, sourced from the backend OpenAPI schema (generated).
export type Product = components['schemas']['ProductResponseDto'];

export interface ProductListParams {
  search?: string;
  category?: string; // category slug
}

// GET /products — public storefront read. Returns a bare array (no pagination);
// search is full-text + fuzzy, capped at 50 server-side. Both params optional.
export function getProducts(params: ProductListParams = {}): Promise<Product[]> {
  const query = new URLSearchParams();
  if (params.search?.trim()) query.set('search', params.search.trim());
  if (params.category?.trim()) query.set('category', params.category.trim());
  const qs = query.toString();
  return apiFetch<Product[]>(`/products${qs ? `?${qs}` : ''}`);
}
