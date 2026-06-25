import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { useAuthStore } from '@/stores/auth.store';
import { ApiError } from '@/lib/api/client';
import {
  adminUpdateOrderStatus,
  cancelOrder,
  createOrder,
  createPaymentIntent,
  getAdminOrders,
  getMyOrders,
  getOrder,
} from '@/lib/api/orders';
import type { OrderStatus, UpdateOrderStatusBody } from '@/lib/api/orders';

// The current user's order history (newest first handled in the view).
export function useMyOrders() {
  const authLoading = useAuthStore((s) => s.isLoading);
  const user = useAuthStore((s) => s.user);
  return useQuery({
    queryKey: ['orders'],
    queryFn: ({ signal }) => getMyOrders(signal),
    enabled: !authLoading && !!user,
  });
}

// POST /orders — places the order (stock is reserved here). The Stripe intent is
// created lazily on the durable pay page, so checkout just returns the order and
// navigates there.
export function useCreateOrder() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (addressId: string) => createOrder(addressId),
    // A 409 means stock ran out between viewing the cart and placing the order;
    // refresh the cart so the stock-sync UI reflects the new live quantities.
    onError: (err) => {
      if (err instanceof ApiError && err.status === 409) {
        void qc.invalidateQueries({ queryKey: ['cart'] });
      }
    },
  });
}

// Restore (or create) the Stripe PaymentIntent for a PENDING_PAYMENT order. Modelled
// as a query so the durable pay page recovers the clientSecret on mount/refresh; the
// backend reuses the in-flight intent (idempotent). Gated by `enabled` to the
// PENDING state, since the backend 400s otherwise. No retry: a 400 won't fix itself.
export function usePaymentIntent(orderId: string, enabled: boolean) {
  return useQuery({
    queryKey: ['payment-intent', orderId],
    queryFn: () => createPaymentIntent(orderId),
    enabled,
    staleTime: Infinity,
    retry: false,
  });
}

// Cancel an unpaid order (releases stock). Refresh the affected order + the list.
export function useCancelOrder() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (orderId: string) => cancelOrder(orderId),
    onSuccess: (_data, orderId) => {
      void qc.invalidateQueries({ queryKey: ['order', orderId] });
      void qc.invalidateQueries({ queryKey: ['orders'] });
    },
  });
}

// Admin: every order (optionally filtered by status). Gated to a logged-in user;
// the backend RoleGuard rejects non-admins (the admin shell also guards the UI).
export function useAdminOrders(status?: OrderStatus) {
  const authLoading = useAuthStore((s) => s.isLoading);
  const user = useAuthStore((s) => s.user);
  return useQuery({
    queryKey: ['admin', 'orders', status ?? 'all'],
    queryFn: ({ signal }) => getAdminOrders(status, signal),
    enabled: !authLoading && !!user,
  });
}

// Admin: advance an order's fulfillment status. Refresh the admin list on success.
export function useAdminUpdateOrderStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, body }: { id: string; body: UpdateOrderStatusBody }) =>
      adminUpdateOrderStatus(id, body),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['admin', 'orders'] });
    },
  });
}

// Polls while the order is still PENDING_PAYMENT (the webhook may lag behind the
// client confirm), stopping once it flips — and caps polling so a stuck order
// doesn't poll forever (~12s).
export function useOrder(id: string) {
  const authLoading = useAuthStore((s) => s.isLoading);
  const user = useAuthStore((s) => s.user);
  return useQuery({
    queryKey: ['order', id],
    queryFn: ({ signal }) => getOrder(id, signal),
    enabled: !authLoading && !!user,
    refetchInterval: (query) => {
      const status = query.state.data?.status;
      if (status && status !== 'PENDING_PAYMENT') return false;
      return query.state.dataUpdateCount < 6 ? 2000 : false;
    },
  });
}
