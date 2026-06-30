import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { useAuthStore } from '@/stores/auth.store';
import {
  archiveCategory,
  createCategory,
  getAdminCategories,
  restoreCategory,
  updateCategory,
  type CreateCategoryBody,
  type UpdateCategoryBody,
} from '@/features/admin/categories/api/categories';

// Admin: every category (incl. archived) with counts. Gated to a logged-in user; the
// backend RoleGuard rejects non-admins.
export function useAdminCategories() {
  const authLoading = useAuthStore((s) => s.isLoading);
  const user = useAuthStore((s) => s.user);
  return useQuery({
    queryKey: ['admin', 'categories'],
    queryFn: ({ signal }) => getAdminCategories(signal),
    enabled: !authLoading && !!user,
  });
}

export function useCreateCategory() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: CreateCategoryBody) => createCategory(body),
    onSuccess: () => invalidate(qc),
  });
}

export function useUpdateCategory() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, body }: { id: string; body: UpdateCategoryBody }) =>
      updateCategory(id, body),
    onSuccess: () => invalidate(qc),
  });
}

export function useArchiveCategory() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => archiveCategory(id),
    onSuccess: () => invalidate(qc),
  });
}

export function useRestoreCategory() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => restoreCategory(id),
    onSuccess: () => invalidate(qc),
  });
}

// A category change (sizeSystem / visibility / parent) can change size suggestions
// and the storefront product listing, so refresh both alongside the admin list.
function invalidate(qc: ReturnType<typeof useQueryClient>) {
  void qc.invalidateQueries({ queryKey: ['admin', 'categories'] });
  void qc.invalidateQueries({ queryKey: ['size-suggestion'] });
}
