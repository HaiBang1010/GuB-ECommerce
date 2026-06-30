import { apiFetch } from '@/lib/api/client';
import type { components } from '@/lib/api/schema';

// Admin collection row (incl. archived; no counts) — same shape as the public DTO.
export type AdminCollection = components['schemas']['CollectionResponseDto'];
export type CreateCollectionBody = components['schemas']['CreateCollectionDto'];
export type UpdateCollectionBody = components['schemas']['UpdateCollectionDto'];

// GET /admin/collections — every collection (incl. archived). Unpaginated: the
// catalog is small, so the page filters client-side.
export function getAdminCollections(
  signal?: AbortSignal,
): Promise<AdminCollection[]> {
  return apiFetch<AdminCollection[]>('/admin/collections', { signal });
}

export function createCollection(
  body: CreateCollectionBody,
): Promise<AdminCollection> {
  return apiFetch<AdminCollection>('/admin/collections', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

export function updateCollection(
  id: string,
  body: UpdateCollectionBody,
): Promise<AdminCollection> {
  return apiFetch<AdminCollection>(
    `/admin/collections/${encodeURIComponent(id)}`,
    {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    },
  );
}

// Soft-archive / restore (hide from the storefront; never deletes — orders reference products).
export function archiveCollection(id: string): Promise<AdminCollection> {
  return apiFetch<AdminCollection>(
    `/admin/collections/${encodeURIComponent(id)}/archive`,
    { method: 'POST' },
  );
}

export function restoreCollection(id: string): Promise<AdminCollection> {
  return apiFetch<AdminCollection>(
    `/admin/collections/${encodeURIComponent(id)}/restore`,
    { method: 'POST' },
  );
}

// Membership (n-n). Every endpoint returns the RESULTING set of product ids.
export function getCollectionProductIds(
  id: string,
  signal?: AbortSignal,
): Promise<string[]> {
  return apiFetch<string[]>(
    `/admin/collections/${encodeURIComponent(id)}/products`,
    { signal },
  );
}

export function addCollectionProducts(
  id: string,
  productIds: string[],
): Promise<string[]> {
  return apiFetch<string[]>(
    `/admin/collections/${encodeURIComponent(id)}/products`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ productIds }),
    },
  );
}

export function removeCollectionProducts(
  id: string,
  productIds: string[],
): Promise<string[]> {
  return apiFetch<string[]>(
    `/admin/collections/${encodeURIComponent(id)}/products`,
    {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ productIds }),
    },
  );
}
