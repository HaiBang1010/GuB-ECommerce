import { apiFetch } from '@/lib/api/client';
import type { components } from '@/lib/api/schema';

// The admin list row (category + active product/child counts for the archive warning).
export type AdminCategory = components['schemas']['AdminCategoryResponseDto'];
// A plain category row (mutation responses don't carry counts).
export type Category = components['schemas']['CategoryResponseDto'];
export type CreateCategoryBody = components['schemas']['CreateCategoryDto'];
export type UpdateCategoryBody = components['schemas']['UpdateCategoryDto'];
export type SizeSystem = NonNullable<AdminCategory['sizeSystem']>;

// GET /admin/categories — every category (incl. archived) with counts. Unpaginated:
// the catalog is small, so the page filters client-side.
export function getAdminCategories(
  signal?: AbortSignal,
): Promise<AdminCategory[]> {
  return apiFetch<AdminCategory[]>('/admin/categories', { signal });
}

export function createCategory(body: CreateCategoryBody): Promise<Category> {
  return apiFetch<Category>('/admin/categories', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

export function updateCategory(
  id: string,
  body: UpdateCategoryBody,
): Promise<Category> {
  return apiFetch<Category>(`/admin/categories/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

// Soft-archive (hide; cascades to products at read time, restorable — never deletes).
export function archiveCategory(id: string): Promise<Category> {
  return apiFetch<Category>(
    `/admin/categories/${encodeURIComponent(id)}/archive`,
    { method: 'POST' },
  );
}

export function restoreCategory(id: string): Promise<Category> {
  return apiFetch<Category>(
    `/admin/categories/${encodeURIComponent(id)}/restore`,
    { method: 'POST' },
  );
}
