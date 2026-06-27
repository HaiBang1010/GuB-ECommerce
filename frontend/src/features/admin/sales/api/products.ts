import { apiFetch } from '@/lib/api/client';
import type { components } from '@/lib/api/schema';

// The admin product shape (sourced from the backend OpenAPI schema). The admin
// list returns every product, including archived ones, with base + sale price.
export type AdminProduct = components['schemas']['ProductResponseDto'];

// GET /admin/products — all products (incl. archived). ADMIN-only on the backend.
// Unpaginated: the storefront catalog is small, so the page filters client-side.
export function getAdminProducts(signal?: AbortSignal): Promise<AdminProduct[]> {
  return apiFetch<AdminProduct[]>('/admin/products', { signal });
}

// PATCH /admin/products/:id — set (number) or clear (null) the product sale price.
// The backend re-validates salePriceCents < basePriceCents and 400s otherwise.
export function setProductSale(
  id: string,
  salePriceCents: number | null,
): Promise<AdminProduct> {
  return apiFetch<AdminProduct>(`/admin/products/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ salePriceCents }),
  });
}
