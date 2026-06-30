import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { useAuthStore } from '@/stores/auth.store';
import {
  addCollectionProducts,
  archiveCollection,
  createCollection,
  getAdminCollections,
  getCollectionProductIds,
  removeCollectionProducts,
  restoreCollection,
  updateCollection,
  type CreateCollectionBody,
  type UpdateCollectionBody,
} from '@/features/admin/collections/api/collections';

// Admin: every collection (incl. archived). Gated to a logged-in user; the backend
// RoleGuard rejects non-admins.
export function useAdminCollections() {
  const authLoading = useAuthStore((s) => s.isLoading);
  const user = useAuthStore((s) => s.user);
  return useQuery({
    queryKey: ['admin', 'collections'],
    queryFn: ({ signal }) => getAdminCollections(signal),
    enabled: !authLoading && !!user,
  });
}

// Current member product ids for one collection — only fetched in edit mode (id set).
export function useCollectionProductIds(id: string | null) {
  const authLoading = useAuthStore((s) => s.isLoading);
  const user = useAuthStore((s) => s.user);
  return useQuery({
    queryKey: ['admin', 'collections', id, 'products'],
    queryFn: ({ signal }) => getCollectionProductIds(id as string, signal),
    enabled: !authLoading && !!user && !!id,
  });
}

export function useCreateCollection() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: CreateCollectionBody) => createCollection(body),
    onSuccess: () => invalidate(qc),
  });
}

export function useUpdateCollection() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, body }: { id: string; body: UpdateCollectionBody }) =>
      updateCollection(id, body),
    onSuccess: () => invalidate(qc),
  });
}

export function useArchiveCollection() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => archiveCollection(id),
    onSuccess: () => invalidate(qc),
  });
}

export function useRestoreCollection() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => restoreCollection(id),
    onSuccess: () => invalidate(qc),
  });
}

export function useAddCollectionProducts(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (productIds: string[]) => addCollectionProducts(id, productIds),
    onSuccess: () => invalidateMembers(qc, id),
  });
}

export function useRemoveCollectionProducts(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (productIds: string[]) => removeCollectionProducts(id, productIds),
    onSuccess: () => invalidateMembers(qc, id),
  });
}

// A collection change (featured flag / order / window) alters the home featured rows
// + collection pages, so refresh the public collection caches alongside the admin list.
function invalidate(qc: ReturnType<typeof useQueryClient>) {
  void qc.invalidateQueries({ queryKey: ['admin', 'collections'] });
  void qc.invalidateQueries({ queryKey: ['collections'] });
}

function invalidateMembers(qc: ReturnType<typeof useQueryClient>, id: string) {
  void qc.invalidateQueries({
    queryKey: ['admin', 'collections', id, 'products'],
  });
  void qc.invalidateQueries({ queryKey: ['collections'] });
}
