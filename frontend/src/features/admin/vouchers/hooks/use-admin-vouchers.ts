import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';

import { useAuthStore } from '@/stores/auth.store';
import {
  archiveVoucher,
  createVoucher,
  getAdminVouchers,
  getVoucherGrants,
  grantVoucher,
  updateVoucher,
  type CreateVoucherBody,
  type UpdateVoucherBody,
} from '@/features/admin/vouchers/api/vouchers';

// Admin: a paginated page of vouchers (optional code search). Gated to a logged-in
// user; the backend RoleGuard rejects non-admins. keepPreviousData avoids a paging flash.
export function useAdminVouchers(search: string, page = 1, pageSize = 10) {
  const authLoading = useAuthStore((s) => s.isLoading);
  const user = useAuthStore((s) => s.user);
  return useQuery({
    queryKey: ['admin', 'vouchers', { search, page, pageSize }],
    queryFn: ({ signal }) =>
      getAdminVouchers({ search: search || undefined, page, pageSize }, signal),
    enabled: !authLoading && !!user,
    placeholderData: keepPreviousData,
  });
}

export function useCreateVoucher() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: CreateVoucherBody) => createVoucher(body),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['admin', 'vouchers'] });
    },
  });
}

export function useUpdateVoucher() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, body }: { id: string; body: UpdateVoucherBody }) =>
      updateVoucher(id, body),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['admin', 'vouchers'] });
    },
  });
}

export function useArchiveVoucher() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => archiveVoucher(id),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['admin', 'vouchers'] });
    },
  });
}

export function useGrantVoucher() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, email }: { id: string; email: string }) =>
      grantVoucher(id, email),
    onSuccess: (_data, { id }) => {
      void qc.invalidateQueries({
        queryKey: ['admin', 'vouchers', 'grants', id],
      });
    },
  });
}

// The users a (wallet-only) voucher has been granted to. Enabled only when a
// voucher id is provided (the grant panel is open).
export function useVoucherGrants(voucherId: string | null) {
  const authLoading = useAuthStore((s) => s.isLoading);
  const user = useAuthStore((s) => s.user);
  return useQuery({
    queryKey: ['admin', 'vouchers', 'grants', voucherId],
    queryFn: ({ signal }) => getVoucherGrants(voucherId as string, signal),
    enabled: !authLoading && !!user && !!voucherId,
  });
}
