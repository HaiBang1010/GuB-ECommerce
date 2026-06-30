import { apiFetch } from '@/lib/api/client';
import type { components } from '@/lib/api/schema';

// Storefront product shape, sourced from the backend OpenAPI schema (generated).
export type Product = components['schemas']['ProductResponseDto'];
export type ProductVariant = components['schemas']['VariantResponseDto'];
export type ProductImage = components['schemas']['ImageResponseDto'];

// Detail-view shape: the flat product plus its variants and images. The backend
// serves variants/images on separate sub-resource endpoints, so getProduct()
// composes all three into this single typed value.
export type ProductDetail = Product & {
  variants: ProductVariant[];
  images: ProductImage[];
};

export interface ProductListParams {
  search?: string;
  category?: string; // category slug
  onSale?: boolean; // only products currently on sale
  sort?: 'new'; // 'new' = newest first (else name asc)
  limit?: number; // cap the result (home carousels)
}

// GET /products — public storefront read. Returns a bare array (no pagination);
// search is full-text + fuzzy, capped at 50 server-side. All params optional.
export function getProducts(params: ProductListParams = {}): Promise<Product[]> {
  const query = new URLSearchParams();
  if (params.search?.trim()) query.set('search', params.search.trim());
  if (params.category?.trim()) query.set('category', params.category.trim());
  if (params.onSale) query.set('onSale', 'true');
  if (params.sort) query.set('sort', params.sort);
  if (params.limit !== undefined) query.set('limit', String(params.limit));
  const qs = query.toString();
  return apiFetch<Product[]>(`/products${qs ? `?${qs}` : ''}`);
}

// GET /products/:slug returns a FLAT product (no embedded relations); variants and
// images live on /products/:slug/variants and /products/:slug/images. Compose all
// three in parallel so the detail page consumes one typed object.
export async function getProduct(slug: string): Promise<ProductDetail> {
  const s = encodeURIComponent(slug);
  const [product, variants, images] = await Promise.all([
    apiFetch<Product>(`/products/${s}`),
    apiFetch<ProductVariant[]>(`/products/${s}/variants`),
    apiFetch<ProductImage[]>(`/products/${s}/images`),
  ]);
  return { ...product, variants, images };
}
