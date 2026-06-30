import { apiFetch } from '@/lib/api/client';
import type { components } from '@/lib/api/schema';

// A node in the public category tree. Top-level categories are returned at the root
// of the array; each node carries its (nested) children.
export type CategoryNode = components['schemas']['CategoryTreeNodeDto'];

// GET /categories — PUBLIC. Returns the ACTIVE category tree (top-level nodes, each
// with nested children). The storefront category grid renders the top-level nodes.
export function getCategories(signal?: AbortSignal): Promise<CategoryNode[]> {
  return apiFetch<CategoryNode[]>('/categories', { signal });
}
