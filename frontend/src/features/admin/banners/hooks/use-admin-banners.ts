import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { useAuthStore } from '@/stores/auth.store';
import {
  archiveBanner,
  createBanner,
  getAdminBanners,
  updateBanner,
  type CreateBannerBody,
  type UpdateBannerBody,
} from '@/features/admin/banners/api/banners';

// Admin: all non-archived banners. Gated to a logged-in user; the backend RoleGuard
// rejects non-admins.
export function useAdminBanners() {
  const authLoading = useAuthStore((s) => s.isLoading);
  const user = useAuthStore((s) => s.user);
  return useQuery({
    queryKey: ['admin', 'banners'],
    queryFn: ({ signal }) => getAdminBanners(signal),
    enabled: !authLoading && !!user,
  });
}

// Mutations invalidate BOTH the admin list and the public ['banners'] query, so the
// storefront home reflects a create / edit / toggle / archive immediately.
function useInvalidateBanners() {
  const qc = useQueryClient();
  return () => {
    void qc.invalidateQueries({ queryKey: ['admin', 'banners'] });
    void qc.invalidateQueries({ queryKey: ['banners'] });
  };
}

export function useCreateBanner() {
  const invalidate = useInvalidateBanners();
  return useMutation({
    mutationFn: (body: CreateBannerBody) => createBanner(body),
    onSuccess: invalidate,
  });
}

export function useUpdateBanner() {
  const invalidate = useInvalidateBanners();
  return useMutation({
    mutationFn: ({ id, body }: { id: string; body: UpdateBannerBody }) =>
      updateBanner(id, body),
    onSuccess: invalidate,
  });
}

export function useArchiveBanner() {
  const invalidate = useInvalidateBanners();
  return useMutation({
    mutationFn: (id: string) => archiveBanner(id),
    onSuccess: invalidate,
  });
}
