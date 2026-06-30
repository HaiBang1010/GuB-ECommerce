import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';

import { useAuthStore } from '@/stores/auth.store';
import {
  adminRefundOrder,
  adminUpdateOrderStatus,
  getAdminOrder,
  getAdminOrders,
} from '@/features/admin/orders/api/orders';
import type {
  AdminOrder,
  UpdateOrderStatusBody,
} from '@/features/admin/orders/api/orders';
import type { OrderStatus } from '@/features/order/api/orders';

// Admin: a paginated page of orders, with optional multi-status filter + search.
// Gated to a logged-in user; the backend RoleGuard rejects non-admins (the admin
// shell also guards the UI). Statuses are sorted in the key so cache hits are
// order-stable; keepPreviousData avoids a flash when paging/filtering.
export function useAdminOrders(
  statuses?: OrderStatus[],
  search?: string,
  page = 1,
  pageSize = 10,
) {
  const authLoading = useAuthStore((s) => s.isLoading);
  const user = useAuthStore((s) => s.user);
  const sorted = [...(statuses ?? [])].sort();
  const term = search?.trim() ?? '';
  return useQuery({
    queryKey: ['admin', 'orders', { statuses: sorted, search: term, page, pageSize }],
    queryFn: ({ signal }) =>
      getAdminOrders({ statuses: sorted, search: term, page, pageSize }, signal),
    enabled: !authLoading && !!user,
    placeholderData: keepPreviousData,
  });
}

// Admin: a single order's full detail for the order-detail dialog. Gated to the
// dialog being open (a non-null id) + a logged-in user; the backend RoleGuard
// rejects non-admins. The list row seeds placeholderData so the dialog paints
// instantly, then refetches fresh detail.
export function useAdminOrderDetail(
  id: string | null,
  initial?: AdminOrder,
) {
  const authLoading = useAuthStore((s) => s.isLoading);
  const user = useAuthStore((s) => s.user);
  return useQuery({
    queryKey: ['admin', 'order', id],
    queryFn: ({ signal }) => getAdminOrder(id as string, signal),
    enabled: !!id && !authLoading && !!user,
    placeholderData: initial,
  });
}

// Admin: advance an order's fulfillment status. Refresh the admin list + the open
// detail + any user-detail page (its recent orders / stats) on success.
export function useAdminUpdateOrderStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, body }: { id: string; body: UpdateOrderStatusBody }) =>
      adminUpdateOrderStatus(id, body),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['admin', 'orders'] });
      void qc.invalidateQueries({ queryKey: ['admin', 'order'] });
      void qc.invalidateQueries({ queryKey: ['admin', 'user'] });
    },
  });
}

// Admin: full-refund an order. Same invalidations as a status change — the list,
// the open detail, and any user-detail page (total-spent excludes REFUNDED).
export function useRefundOrder() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => adminRefundOrder(id),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['admin', 'orders'] });
      void qc.invalidateQueries({ queryKey: ['admin', 'order'] });
      void qc.invalidateQueries({ queryKey: ['admin', 'user'] });
    },
  });
}
